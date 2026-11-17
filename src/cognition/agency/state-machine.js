import { AGENCY_LIMITS, defaultAgency, readAgency, text, writeAgency, agencyPath } from './schema.js'
import { buildAgencyCandidates, candidateForEntity, sourceMap } from './candidates.js'
import { executeReview, advanceProgress, mergeSteps, stable } from './executor.js'
import { reconcileSharingOutreach, updateOutreachTimeouts } from './outreach.js'
import { withLock } from '../../persistence/storage.js'

function deferFocus(state, focus, now, reason) {
  const attempts = focus.attempts + 1
  if (attempts >= 3) {
    state.abandoned.push({
      sourceKey: focus.sourceKey, at: now, reason: reason || '反复被推迟',
      lastSourceUpdatedAt: focus.sourceUpdatedAt || 0,
    })
    state.abandoned = state.abandoned.slice(-AGENCY_LIMITS.abandoned)
    state.recent.push({ at: now, sourceKey: focus.sourceKey, title: focus.title, status: 'abandoned' })
    state.recent = state.recent.slice(-AGENCY_LIMITS.recent)
    return { abandoned: true }
  }
  state.deferred.push({
    sourceKey: focus.sourceKey, until: now + AGENCY_LIMITS.deferMs, attempts,
    reason: reason || '暂时推迟', lastSourceUpdatedAt: focus.sourceUpdatedAt || 0,
  })
  state.deferred = state.deferred.slice(-AGENCY_LIMITS.deferred)
  return { deferred: true }
}

function pruneDeferred(state, candidates, now) {
  const byKey = new Map(candidates.map((x) => [x.sourceKey, x]))
  let changed = false
  const remaining = []
  for (const item of state.deferred) {
    const source = byKey.get(item.sourceKey)
    if (item.until > now && !(source && source.sourceUpdatedAt > item.lastSourceUpdatedAt)) { remaining.push(item); continue }
    changed = true
    if (item.attempts >= 3) {
      state.abandoned.push({
        sourceKey: item.sourceKey, at: now, reason: '推迟次数用尽', lastSourceUpdatedAt: item.lastSourceUpdatedAt,
      })
      state.recent.push({ at: now, sourceKey: item.sourceKey, title: source?.title || item.sourceKey, status: 'abandoned' })
    }
  }
  state.deferred = remaining.slice(-AGENCY_LIMITS.deferred)
  state.abandoned = state.abandoned.slice(-AGENCY_LIMITS.abandoned)
  state.recent = state.recent.slice(-AGENCY_LIMITS.recent)
  return changed
}

function isAbandoned(state, candidate) {
  const row = state.abandoned.find((x) => x.sourceKey === candidate.sourceKey)
  if (!row) return false
  return !(candidate.sourceUpdatedAt > row.lastSourceUpdatedAt)
}

function candidateAvailable(candidate, state, deferred, now) {
  if (!candidate) return false
  if (candidate.expiresAt && candidate.expiresAt <= now) return false
  if (isAbandoned(state, candidate)) return false
  const blocked = deferred.get(candidate.sourceKey)
  if (!blocked) return true
  if (blocked.attempts >= 3) return false
  if (blocked.until > now && !(candidate.sourceUpdatedAt > blocked.lastSourceUpdatedAt)) return false
  return true
}

export function tickAgency(input = {}) {
  const now = Number(input.now) || Date.now()
  const result = withLock(agencyPath() + '.lock', () => {
    const state = readAgency(now)
    const candidates = buildAgencyCandidates({ ...input, now })
    const map = sourceMap(input.continuity, input.mind, candidates)
    const deferred = new Map(state.deferred.map((x) => [x.sourceKey, x]))
    let changed = reconcileSharingOutreach(state, input.sharingRecent, now)
    changed = updateOutreachTimeouts(state, now) || changed

    // A new persisted fact reopens a previously abandoned source. It is not
    // automatic forgiveness: a genuinely newer source revision is required.
    state.abandoned = state.abandoned.filter((row) => {
      const source = map.get(row.sourceKey)
      if (source && Number(source.sourceUpdatedAt) > row.lastSourceUpdatedAt) {
        state.recent.push({ at: now, sourceKey: row.sourceKey, title: source.title || row.sourceKey, status: 'reopened' })
        changed = true
        return false
      }
      return true
    })
    state.recent = state.recent.slice(-AGENCY_LIMITS.recent)

    let focus = state.focus
    if (focus) {
      const source = map.get(focus.sourceKey)
      const done = source && ['completed', 'cancelled', 'archived'].includes(source.status)
      const paused = source && source.status === 'paused'
      if (!source) {
        state.recent.push({ at: now, sourceKey: focus.sourceKey, title: focus.title, status: 'closed' })
        focus = null
        changed = true
      } else if (done) {
        state.recent.push({ at: now, sourceKey: focus.sourceKey, title: focus.title, status: 'done' })
        focus = null
        changed = true
      } else if (paused) {
        deferFocus(state, focus, now, '来源暂停')
        focus = null
        changed = true
      } else if (['rest', 'interest', 'relationship'].includes(focus.sourceType)) {
        // Needs/interests/relationships are stable focus cards. They only
        // close when their candidate/TTL disappears; they never auto-execute.
      } else {
        const next = candidateForEntity(source, focus.sourceKey, now)
        if (next) {
          const progressChanged = next.progress !== focus.progress
          const steps = mergeSteps(focus.steps, next.steps)
          const updated = {
            ...focus, ...next, steps, createdAt: focus.createdAt, attempts: focus.attempts,
            lastReviewAt: focus.lastReviewAt, lastActionAt: focus.lastActionAt,
            reason: focus.lastReviewAt ? focus.reason : next.reason,
            updatedAt: progressChanged ? now : focus.updatedAt,
            stepIndex: Math.max(focus.stepIndex, next.stepIndex),
          }
          if (progressChanged) {
            const evidence = `来源进度 ${focus.progress}→${next.progress}`
            const advanced = advanceProgress(updated.steps, evidence, now)
            updated.steps = advanced.steps
            updated.stepIndex = Math.max(updated.stepIndex, advanced.stepIndex)
            updated.lastActionAt = now
            if (updated.steps.some((x) => x.kind === 'review' && x.status !== 'done')) updated.pendingProgress = evidence
            state.executions.push({ at: now, sourceKey: focus.sourceKey, action: 'observe-progress', evidence: `${evidence}，只更新内部观察` })
            state.executions = state.executions.slice(-AGENCY_LIMITS.executions)
          }
          if (stable(updated) !== stable(focus)) { focus = updated; changed = true }
        }
      }
    }

    let lowReviewed = false
    if (focus && executeReview(state, focus, now)) {
      changed = true
      if (['interest', 'relationship'].includes(focus.sourceType)) {
        state.recent.push({ at: now, sourceKey: focus.sourceKey, title: focus.title, status: 'reviewed' })
        state.recent = state.recent.slice(-AGENCY_LIMITS.recent)
        state.explored[focus.sourceKey] = now
        focus = null
        lowReviewed = true
      }
    }

    if (!focus && !lowReviewed) {
      const available = candidates.filter((c) => candidateAvailable(c, state, deferred, now))
      let best = available.find((c) => c.score >= 50)
      if (!best) {
        // Low-priority interests/relationships/events become reachable only
        // after a deterministic exploration cooldown, never by randomness.
        best = available.filter((c) => c.score >= 35).find((c) => {
          const seen = Number(state.explored[c.sourceKey]) || 0
          return !seen || now - seen >= 6 * 3600000
        })
      }
      if (best) {
        const blocked = deferred.get(best.sourceKey)
        focus = {
          ...best, status: 'active', createdAt: now, updatedAt: now,
          lastReviewAt: 0, lastActionAt: 0,
          attempts: Math.max(0, Number(blocked?.attempts) || 0),
        }
        if (Number(best.score) < 50) state.explored[best.sourceKey] = now
        state.deferred = state.deferred.filter((x) => x.sourceKey !== best.sourceKey)
        state.focus = focus
        changed = true
      }
    } else {
      const available = candidates.filter((c) => candidateAvailable(c, state, deferred, now))
      const best = available.find((c) => c.score >= 50 && c.score >= focus.score + 8 && c.sourceKey !== focus.sourceKey)
      if (best && now - focus.updatedAt >= AGENCY_LIMITS.holdMs) {
        deferFocus(state, focus, now, '更高优先级的当前事项')
        const blocked = deferred.get(best.sourceKey)
        focus = {
          ...best, status: 'active', createdAt: now, updatedAt: now,
          lastReviewAt: 0, lastActionAt: 0,
          attempts: Math.max(0, Number(blocked?.attempts) || 0),
        }
        state.deferred = state.deferred.filter((x) => x.sourceKey !== best.sourceKey)
        state.focus = focus
        changed = true
      }
    }

    if (pruneDeferred(state, candidates, now)) changed = true
    // Remove outreach rows whose source vanished or completed.
    for (const key of Object.keys(state.outreach)) {
      const source = map.get(key)
      if (source && ['completed', 'cancelled', 'archived'].includes(source.status)) { delete state.outreach[key]; changed = true }
    }
    state.abandoned = state.abandoned.slice(-AGENCY_LIMITS.abandoned)
    state.recent = state.recent.slice(-AGENCY_LIMITS.recent)
    state.explored = Object.fromEntries(Object.entries(state.explored || {}).slice(-AGENCY_LIMITS.recent))
    state.updatedAt = now
    state.focus = focus
    if (changed) writeAgency(state, now)
    return { state, focus, candidates, changed }
  }, { staleMs: 5000 })
  if (result) return result
  // Another process may hold the lock for a few milliseconds. Wait briefly so
  // a concurrent tick reports the same focus instead of a transient null.
  for (let i = 0; i < 20; i++) {
    const current = readAgency(now)
    if (current.focus) return { state: current, focus: current.focus, candidates: [], changed: false }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
  }
  const current = readAgency(now)
  return { state: current, focus: current.focus, candidates: [], changed: false }
}

export function agencyContext(focus) {
  if (!focus || !focus.title) return ''
  const due = focus.dueLabel ? `，${focus.dueLabel}` : ''
  const nextAction = focus.nextStep || focus.internalPlan?.nextAction || ''
  const next = nextAction ? `，下一步：${nextAction}` : ''
  return `（心里在推进）${focus.title}${due}${next}。这是内部计划，只有实际发生才算完成，不要凭空说已经做了。`
}

/** A proactive pending follow-up; never a completed life fact. */
