import { AGENCY_LIMITS, agencyPath, readAgency, writeAgency, defaultAgency, clamp, text, negativeReply, topicMatches, inboxReplyReference } from './schema.js'
import { withLock } from '../../persistence/storage.js'

function outreachFor(state, sourceKey) {
  return state.outreach[sourceKey] || null
}

export function updateOutreachTimeouts(state, now) {
  let changed = false
  for (const [key, row] of Object.entries(state.outreach)) {
    if (row.status === 'awaiting' && now - row.lastAt >= AGENCY_LIMITS.followupWaitMs) {
      row.status = 'ignored'
      row.nextAt = now + AGENCY_LIMITS.ignoredRetryMs
      changed = true
    } else if (row.status === 'ignored' && row.count >= 2 && now >= row.nextAt) {
      row.status = 'declined'
      row.nextAt = now
      changed = true
    }
    if (!row.lastAt && !row.status) delete state.outreach[key]
  }
  return changed
}

export function reconcileSharingOutreach(state, rows, now) {
  let changed = false
  for (const row of Array.isArray(rows) ? rows : []) {
    const sourceKey = text(row?.sourceKey, 160)
    const stageKey = text(row?.stageKey, 180)
    const at = Math.max(0, Number(row?.at) || 0)
    if (!sourceKey || !stageKey || !at || String(row?.kind || '') !== 'followup') continue
    const previous = state.outreach[sourceKey]
    if (previous && previous.lastStage === stageKey) {
      if (!previous.sessionId && row.sessionId) {
        previous.sessionId = text(row.sessionId, 120)
        previous.topic = text(row.title, 160)
        changed = true
      }
      continue
    }
    if (previous && previous.lastAt >= at) continue
    state.outreach[sourceKey] = {
      lastAt: at,
      count: Math.max(1, Number(previous?.count) || 0) + (previous ? 1 : 0),
      status: 'awaiting',
      lastStage: stageKey,
      lastSourceUpdatedAt: Math.max(0, Number(previous?.lastSourceUpdatedAt) || 0, Number(row?.sourceUpdatedAt) || 0),
      nextAt: 0,
      sessionId: text(row?.sessionId, 120),
      topic: text(row?.title, 160),
    }
    changed = true
  }
  return changed
}


export function agencyShareCandidates(focus, options = {}) {
  if (!focus || !focus.title || focus.sourceType === 'rest' || focus.sourceType === 'interest') return []
  const now = Number(options.now) || Date.now()
  const date = String(options.date || '')
  if (!date) return []
  const state = options.state || defaultAgency(now)
  const out = outreachFor(state, focus.sourceKey)
  const sourceUpdatedAt = Math.max(0, Number(focus.sourceUpdatedAt || 0))
  if (out) {
    if (out.status === 'declined' && sourceUpdatedAt <= out.lastSourceUpdatedAt) return []
    if (out.status === 'responded' && sourceUpdatedAt <= out.lastSourceUpdatedAt) return []
    if (out.status === 'awaiting' && now - out.lastAt < AGENCY_LIMITS.followupWaitMs) return []
    if (out.status === 'ignored' && now < out.nextAt) return []
    if (out.count >= 2 && sourceUpdatedAt <= out.lastSourceUpdatedAt) return []
    if (sourceUpdatedAt > out.lastSourceUpdatedAt && now - out.lastAt < AGENCY_LIMITS.newFactWaitMs) return []
  }
  const urgent = Number(focus.dueAt) > 0 && focus.dueAt - now <= 36 * 3600000
  const score = clamp(urgent ? 86 : focus.nextStep ? 84 : 76, 0, 100, 0)
  if (score < 84) return []
  const fact = focus.dueLabel
    ? `你之前记着「${focus.title}」，${focus.dueLabel}`
    : `你心里还挂着「${focus.title}」，下一步是${focus.nextStep || '继续推进'}`
  return [{
    eventId: `agency:${focus.sourceKey}`,
    stageKey: `agency:${focus.sourceKey}:${out?.count || 0}`,
    kind: 'followup', category: `agency:${focus.sourceType}`,
    title: focus.title, facts: [fact], tone: '关心', score,
    followup: false, atMinute: options.nowMinute || 0, sourceKey: focus.sourceKey,
    sessionId: text(options.sessionId, 120),
    sourceUpdatedAt,
  }]
}

/** Record a successful enqueue so the same pending source waits for a reply. */
export function markAgencyOutreach(candidate, options = {}) {
  const now = Number(options.now) || Date.now()
  const sourceKey = text(candidate?.sourceKey, 160)
  if (!sourceKey) return { ok: false, reason: 'no-source' }
  const result = withLock(agencyPath() + '.lock', () => {
    const state = readAgency(now)
    const focus = state.focus && state.focus.sourceKey === sourceKey ? state.focus : null
    const previous = state.outreach[sourceKey]
    state.outreach[sourceKey] = {
      lastAt: now,
      count: Math.max(0, Number(previous?.count) || 0) + 1,
      status: 'awaiting',
      lastStage: text(candidate.stageKey, 180),
      lastSourceUpdatedAt: Math.max(0, Number(focus?.sourceUpdatedAt || candidate.sourceUpdatedAt) || 0),
      nextAt: 0,
      sessionId: text(options.sessionId, 120),
      topic: text(options.topic || candidate.title, 160),
    }
    state.updatedAt = now
    writeAgency(state, now)
    return { ok: true, outreach: state.outreach[sourceKey] }
  }, { staleMs: 5000 })
  return result || { ok: false, reason: 'locked' }
}

/** Consume a human message: a reply clears the wait; a refusal suppresses. */
export function observeAgencyReply(value, options = {}) {
  const now = Number(options.now) || Date.now()
  const sessionId = text(options.sessionId, 120)
  const replyTo = text(options.replyTo, 180)
  const body = text(value, 400)
  if (!sessionId) return { ok: false, changed: false, reason: 'no-session' }
  const result = withLock(agencyPath() + '.lock', () => {
    const state = readAgency(now)
    const rows = Object.values(state.outreach)
      .filter((row) => row.sessionId === sessionId)
      .filter((row) => row.status === 'awaiting' || row.status === 'ignored')
      .filter((row) => now - row.lastAt <= AGENCY_LIMITS.followupWaitMs)
      .sort((a, b) => b.lastAt - a.lastAt)
    let row = null
    if (replyTo) {
      // Explicit reference is the only reliable association.
      row = rows.find((x) => x.lastStage === replyTo || x.topic === replyTo) || null
      if (!row) return { ok: true, changed: false, reason: 'unassociated' }
    } else {
      // Otherwise require the text itself to point at the topic. An arbitrary
      // same-session message is not evidence that the pending item was answered.
      row = rows.find((x) => topicMatches(body, x)) || null
      if (!row) {
        // A short, strong refusal immediately after a single pending item can
        // be treated as a refusal of that only item. It never touches siblings.
        if (negativeReply.test(body)) {
          const recent = rows.filter((x) => now - x.lastAt <= 10 * 60000)
          if (recent.length === 1) row = recent[0]
        }
        if (!row) return { ok: true, changed: false, reason: 'unassociated' }
      }
    }
    if (negativeReply.test(body)) {
      row.status = 'declined'
      row.nextAt = now
    } else {
      row.status = 'responded'
      row.nextAt = 0
    }
    state.updatedAt = now
    writeAgency(state, now)
    return { ok: true, changed: true, sourceKey: row.lastStage || row.topic || '' }
  }, { staleMs: 5000 })
  return result || { ok: false, reason: 'locked' }
}

/** Production inbox adapter: only exposes a reply reference when payload has one. */
export function handleAgencyInboxReply(value, payload, sessionId, options = {}) {
  return observeAgencyReply(value, {
    ...options,
    sessionId,
    replyTo: inboxReplyReference(payload),
  })
}

