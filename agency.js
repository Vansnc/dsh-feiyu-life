// dsh-feiyu-life · internal agenda / drive loop
//
// This is not a second proactive sender and it never performs a real-world
// action. It keeps one short-lived focus derived from real unfinished things
// (continuity tasks/commitments/threads, explicit self goals, low energy) and
// lets that focus influence context and follow-up candidates. A source is only
// marked done when its actual continuity/mind state is completed.

import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { atomicWriteJson, readJsonBounded, withLock } from './storage.js'

export const AGENCY_VERSION = 1
export const AGENCY_LIMITS = { recent: 24, deferred: 24, fileBytes: 256 * 1024, holdMs: 15 * 60 * 1000, deferMs: 30 * 60 * 1000 }
const root = () => process.env.DSH_HOME || join(homedir(), '.dsh')
export const agencyPath = () => join(root(), 'feiyu-life-agency.json')
const clamp = (n, a, b, fallback = 0) => {
  const value = Number(n)
  return Number.isFinite(value) ? Math.max(a, Math.min(b, value)) : fallback
}
const text = (value, max = 160) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max)
const copy = (value) => JSON.parse(JSON.stringify(value))

export function defaultAgency(now = Date.now()) {
  return { v: AGENCY_VERSION, updatedAt: now, focus: null, deferred: [], recent: [] }
}

function normalizePlan(x, now = Date.now()) {
  if (!x || typeof x !== 'object') return null
  const sourceKey = text(x.sourceKey, 160)
  const title = text(x.title, 120)
  if (!sourceKey || !title) return null
  const status = ['active', 'deferred', 'done', 'abandoned'].includes(x.status) ? x.status : 'active'
  return {
    id: text(x.id, 80) || `agc-${randomUUID()}`,
    sourceKey,
    sourceId: text(x.sourceId, 120),
    sourceType: ['task', 'commitment', 'thread', 'goal', 'rest'].includes(x.sourceType) ? x.sourceType : 'task',
    title,
    detail: text(x.detail, 180),
    nextStep: text(x.nextStep, 160),
    dueAt: Math.max(0, Number(x.dueAt) || 0),
    dueLabel: text(x.dueLabel, 60),
    priority: clamp(x.priority, 0, 100, 50),
    score: clamp(x.score, 0, 100, 50),
    cost: clamp(x.cost, 1, 5, 2),
    risk: clamp(x.risk, 0, 3, 0),
    status,
    steps: (Array.isArray(x.steps) ? x.steps : []).flatMap((step) => {
      const label = text(step?.label, 120)
      if (!label) return []
      return [{ label, status: ['pending', 'active', 'done', 'skipped'].includes(step?.status) ? step.status : 'pending', evidence: text(step?.evidence, 160) }]
    }).slice(0, 4),
    stepIndex: Math.max(0, Math.round(Number(x.stepIndex) || 0)),
    progress: clamp(x.progress, 0, 100, 0),
    createdAt: Math.max(0, Number(x.createdAt) || now),
    updatedAt: Math.max(0, Number(x.updatedAt) || now),
    reason: text(x.reason, 160),
    attempts: Math.max(0, Math.round(Number(x.attempts) || 0)),
  }
}

export function normalizeAgency(raw, now = Date.now()) {
  if (!raw || raw.v !== AGENCY_VERSION) return defaultAgency(now)
  const focus = normalizePlan(raw.focus, now)
  const deferred = (Array.isArray(raw.deferred) ? raw.deferred : []).flatMap((x) => {
    const sourceKey = text(x?.sourceKey, 160)
    if (!sourceKey) return []
    return [{ sourceKey, until: Math.max(0, Number(x.until) || 0), attempts: Math.max(0, Math.round(Number(x.attempts) || 0)) }]
  }).slice(-AGENCY_LIMITS.deferred)
  const recent = (Array.isArray(raw.recent) ? raw.recent : []).flatMap((x) => {
    const title = text(x?.title, 120)
    if (!title) return []
    return [{ at: Math.max(0, Number(x.at) || 0), sourceKey: text(x.sourceKey, 160), title, status: text(x.status, 24) || 'done' }]
  }).slice(-AGENCY_LIMITS.recent)
  return {
    v: AGENCY_VERSION,
    updatedAt: Math.max(0, Number(raw.updatedAt) || now),
    focus: focus && ['active', 'deferred'].includes(focus.status) ? focus : null,
    deferred,
    recent,
  }
}

export function readAgency(now = Date.now()) {
  const read = readJsonBounded(agencyPath(), { maxBytes: AGENCY_LIMITS.fileBytes })
  return read.ok ? normalizeAgency(read.value, now) : defaultAgency(now)
}

export function writeAgency(value, now = Date.now()) {
  return atomicWriteJson(agencyPath(), normalizeAgency(value, now))
}

function sourceMap(continuity, mind, candidates = []) {
  const map = new Map()
  for (const entity of Array.isArray(candidates) ? candidates : []) {
    if (entity?.sourceType === 'rest') map.set(entity.sourceKey, { ...entity, status: 'active' })
  }
  // Include non-active rows so a completed/paused source can close a focus.
  for (const [kind, list] of [['task', continuity?.tasks], ['commitment', continuity?.commitments], ['thread', continuity?.threads]]) {
    for (const entity of Array.isArray(list) ? list : []) {
      const key = `continuity:${kind}:${entity.id}`
      if (!map.has(key)) map.set(key, { ...entity, sourceType: kind })
    }
  }
  for (const goal of Array.isArray(mind?.goals) ? mind.goals : []) {
    map.set(`mind:goal:${goal.id}`, { ...goal, sourceType: 'goal' })
  }
  return map
}

function dueRank(entity, now) {
  const due = Number(entity?.dueAt) || 0
  if (!due) return 5
  const delta = due - now
  if (delta < 0) return 0
  if (delta <= 6 * 3600000) return 1
  if (delta <= 36 * 3600000) return 2
  return 3
}

function candidateForEntity(entity, sourceKey, now) {
  const type = entity.sourceType
  if (type === 'goal' && entity.status !== 'active') return null
  if (type === 'goal' && entity.scope && !['virtual', 'local'].includes(entity.scope)) return null
  if (['task', 'commitment', 'thread'].includes(type) && !['open', 'active', 'paused'].includes(entity.status)) return null
  if (type === 'thread' && entity.status !== 'active') return null
  const due = dueRank(entity, now)
  const dueAt = Math.max(0, Number(entity.dueAt) || 0)
  let score = type === 'commitment' ? 64 : type === 'task' ? 58 : type === 'thread' ? 62 : 55
  if (due === 0) score += 26
  else if (due === 1) score += 18
  else if (due === 2) score += 8
  if (type === 'thread') score += Math.max(0, 100 - (Number(entity.progress) || 0)) * 0.08
  if (entity.nextStep) score += 4
  if (entity.personId) score += 3
  if (type === 'goal' && Number(entity.progress) > 70) score += 3
  const cost = type === 'task' ? 1 : type === 'commitment' ? 2 : type === 'thread' ? 3 : 2
  score -= cost * 4
  const steps = []
  if (entity.nextStep) steps.push({ label: `下一步：${entity.nextStep}`, status: 'active', evidence: '' })
  else steps.push({ label: `先记着：${entity.title}`, status: 'active', evidence: '' })
  if (type === 'thread') steps.push({ label: '看到实际进度再更新', status: 'pending', evidence: '' })
  else steps.push({ label: '完成后再确认', status: 'pending', evidence: '' })
  return {
    id: `agc-${sourceKey.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48)}`,
    sourceKey,
    sourceId: text(entity.id, 120),
    sourceType: type,
    title: text(entity.title, 120),
    detail: text(entity.detail, 180),
    nextStep: text(entity.nextStep, 160),
    dueAt,
    dueLabel: dueAt ? (due === 0 ? '已经逾期' : due === 1 ? '今天到期' : due === 2 ? '这两天到期' : '有期限') : '',
    priority: type === 'commitment' ? 80 : type === 'task' ? 70 : type === 'thread' ? 72 : 60,
    score: clamp(score, 0, 100, 50),
    cost,
    risk: 0,
    steps,
    stepIndex: 0,
    progress: clamp(entity.progress, 0, 100, 0),
    reason: dueAt ? '有实际截止时间' : (entity.nextStep ? '有明确下一步' : '还没完成'),
  }
}

/** Pure candidate construction from real open sources and low-energy state. */
export function buildAgencyCandidates({ now = Date.now(), continuity, mind, vitality = {}, affect = {} } = {}) {
  const map = sourceMap(continuity, mind)
  const out = []
  for (const [sourceKey, entity] of map) {
    const candidate = candidateForEntity(entity, sourceKey, now)
    if (candidate && candidate.title) out.push(candidate)
  }
  if (Number(vitality.energy) < 45 && !out.some((x) => x.sourceType === 'rest')) {
    out.push({
      id: 'agc-rest', sourceKey: 'life:rest', sourceId: 'rest', sourceType: 'rest',
      title: '给自己留点空隙', detail: '精力偏低', nextStep: '先休息一下，别硬撑', dueAt: 0, dueLabel: '',
      priority: 55, score: 56, cost: 1, risk: 0,
      steps: [{ label: '先休息一下，别硬撑', status: 'active', evidence: '' }], stepIndex: 0,
      progress: 0, reason: '精力偏低',
    })
  }
  if (Number(affect.valence) < 35 && !out.some((x) => x.sourceKey === 'life:rest')) {
    out.push({
      id: 'agc-rest-mood', sourceKey: 'life:rest-mood', sourceId: 'rest-mood', sourceType: 'rest',
      title: '缓一缓', detail: '情绪偏低', nextStep: '不急着处理所有事', dueAt: 0, dueLabel: '',
      priority: 50, score: 50, cost: 1, risk: 0,
      steps: [{ label: '不急着处理所有事', status: 'active', evidence: '' }], stepIndex: 0,
      progress: 0, reason: '情绪偏低',
    })
  }
  return out.sort((a, b) => b.score - a.score || a.sourceKey.localeCompare(b.sourceKey))
}

function sameFocus(a, b) {
  return Boolean(a && b && a.sourceKey === b.sourceKey)
}

/**
 * Advance one focus. It is safe to call repeatedly: no change means no write.
 * It never marks a source complete without the source's own status.
 */
export function tickAgency(input = {}) {
  const now = Number(input.now) || Date.now()
  const lock = withLock(agencyPath() + '.lock', () => {
    const state = readAgency(now)
    const candidates = buildAgencyCandidates({ ...input, now })
    const map = sourceMap(input.continuity, input.mind, candidates)
    const deferred = new Map((state.deferred || []).map((x) => [x.sourceKey, x]))
    let changed = false

    let focus = state.focus
    if (focus) {
      const source = map.get(focus.sourceKey)
      if (!source) {
        state.recent.push({ at: now, sourceKey: focus.sourceKey, title: focus.title, status: 'closed' })
        state.recent = state.recent.slice(-AGENCY_LIMITS.recent)
        focus = null
        changed = true
      } else if (focus.sourceType === 'rest') {
        // A low-energy rest focus stays stable until the energy state that
        // produced it disappears; it is not re-scored every tick.
      } else {
        const done = (source.status === 'completed' || source.status === 'cancelled' || source.status === 'archived')
        const paused = source.status === 'paused'
        if (done) {
          state.recent.push({ at: now, sourceKey: focus.sourceKey, title: focus.title, status: 'done' })
          state.recent = state.recent.slice(-AGENCY_LIMITS.recent)
          focus = null
          changed = true
        } else if (paused) {
          state.deferred.push({ sourceKey: focus.sourceKey, until: now + AGENCY_LIMITS.deferMs, attempts: focus.attempts + 1 })
          focus = null
          changed = true
        } else {
          const next = candidateForEntity({ ...source, sourceType: source.sourceType }, focus.sourceKey, now)
          if (next) {
            const progressChanged = next.progress !== focus.progress
            const updated = { ...focus, ...next, status: 'active', createdAt: focus.createdAt, updatedAt: progressChanged ? now : focus.updatedAt, attempts: focus.attempts }
            if (progressChanged) {
              updated.steps = updated.steps.map((step, i) => ({ ...step, status: i === 0 ? 'done' : 'active' }))
              updated.stepIndex = Math.min(1, updated.steps.length - 1)
            }
            if (JSON.stringify(updated) !== JSON.stringify(focus)) { focus = updated; changed = true }
          }
        }
      }
    }

    if (!focus) {
      const available = candidates.filter((c) => {
        const blocked = deferred.get(c.sourceKey)
        return !blocked || (blocked.until <= now && blocked.attempts < 3)
      })
      const best = available.find((c) => c.score >= 50)
      if (best) {
        focus = {
          ...best, status: 'active', createdAt: now, updatedAt: now,
          attempts: Math.max(0, Number(deferred.get(best.sourceKey)?.attempts) || 0),
        }
        state.focus = focus
        changed = true
      }
    } else {
      const best = candidates.find((c) => c.score >= focus.score + 8 && c.sourceKey !== focus.sourceKey)
      if (best && now - focus.updatedAt >= AGENCY_LIMITS.holdMs) {
        state.deferred.push({ sourceKey: focus.sourceKey, until: now + AGENCY_LIMITS.deferMs, attempts: focus.attempts + 1 })
        focus = { ...best, status: 'active', createdAt: now, updatedAt: now, attempts: Math.max(0, Number(deferred.get(best.sourceKey)?.attempts) || 0) }
        state.focus = focus
        changed = true
      }
    }

    state.deferred = (state.deferred || []).filter((x) => {
      if (x.attempts >= 3) return now - x.until < 7 * 86400000
      return true
    }).slice(-AGENCY_LIMITS.deferred)
    state.recent = (state.recent || []).slice(-AGENCY_LIMITS.recent)
    state.updatedAt = now
    state.focus = focus
    if (changed) writeAgency(state, now)
    return { state, focus, candidates, changed }
  }, { staleMs: 5000 })
  return lock ?? { state: readAgency(now), focus: readAgency(now).focus, candidates: [], changed: false }
}

export function agencyContext(focus) {
  if (!focus || !focus.title) return ''
  const due = focus.dueLabel ? `，${focus.dueLabel}` : ''
  const next = focus.nextStep ? `，下一步：${focus.nextStep}` : ''
  return `（心里在推进）${focus.title}${due}${next}。这是内部计划，只有实际发生才算完成，不要凭空说已经做了。`
}

/** A proactive follow-up candidate: pending, not a completed life fact. */
export function agencyShareCandidates(focus, options = {}) {
  if (!focus || !focus.title || focus.sourceType === 'rest') return []
  const now = Number(options.now) || Date.now()
  const date = String(options.date || '')
  if (!date) return []
  const urgent = Number(focus.dueAt) > 0 && focus.dueAt - now <= 36 * 3600000
  const score = clamp(urgent ? 86 : focus.nextStep ? 84 : 76, 0, 100, 0)
  if (score < 84) return []
  const fact = focus.dueLabel
    ? `你之前记着「${focus.title}」，${focus.dueLabel}`
    : `你心里还挂着「${focus.title}」，下一步是${focus.nextStep || '继续推进'}`
  return [{
    eventId: `agency:${focus.sourceKey}`,
    stageKey: `agency:${focus.sourceKey}:${date}:${focus.stepIndex}`,
    kind: 'followup', category: `agency:${focus.sourceType}`,
    title: focus.title, facts: [fact], tone: '关心', score,
    followup: false, atMinute: options.nowMinute || 0,
  }]
}

export function agencyStatus(now = Date.now()) { return readAgency(now) }
