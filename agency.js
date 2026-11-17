// dsh-feiyu-life · internal agenda / drive loop
//
// This is not a second proactive sender and it never performs a real-world
// action. It keeps one short-lived focus derived from real unfinished things
// (continuity tasks/commitments/threads, explicit self goals, needs and
// affects), executes only a bounded internal review step when the focus is a
// goal/thread, and lets that focus influence context and follow-up candidates.
// A source is only marked done when its actual continuity/mind state says so.

import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { atomicWriteJson, readJsonBounded, withLock } from './storage.js'

export const AGENCY_VERSION = 2
export const AGENCY_LIMITS = {
  recent: 24, deferred: 24, abandoned: 24, executions: 40, candidates: 40, fileBytes: 256 * 1024,
  holdMs: 15 * 60 * 1000, deferMs: 30 * 60 * 1000, reviewIntervalMs: 30 * 60 * 1000,
  followupWaitMs: 48 * 3600000, ignoredRetryMs: 72 * 3600000, newFactWaitMs: 30 * 60 * 1000,
}
const root = () => process.env.DSH_HOME || join(homedir(), '.dsh')
export const agencyPath = () => join(root(), 'feiyu-life-agency.json')
const clamp = (n, a, b, fallback = 0) => {
  const value = Number(n)
  return Number.isFinite(value) ? Math.max(a, Math.min(b, value)) : fallback
}
const text = (value, max = 160) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max)
const negativeReply = /(不用|别催|别问|不想提|别提|烦|算了|没兴趣|别管)/
const sensitiveText = /密码|口令|验证码|私钥|助记词|api[ _-]?key|access[ _-]?token|secret|身份证|银行卡|信用卡/i

export function defaultAgency(now = Date.now()) {
  return {
    v: AGENCY_VERSION, updatedAt: now, focus: null, deferred: [], abandoned: [],
    outreach: {}, executions: [], recent: [],
  }
}

function normalizeStep(x, index = 0) {
  const label = text(x?.label, 120)
  if (!label) return null
  const inferred = /复盘/.test(label) ? 'review' : /下一步|继续推进/.test(label) ? 'wait' : 'wait'
  return {
    label,
    status: ['pending', 'active', 'done', 'skipped'].includes(x?.status) ? x.status : 'pending',
    kind: ['review', 'wait', 'confirm', 'rest'].includes(x?.kind) ? x.kind : inferred,
    evidence: text(x?.evidence, 180),
  }
}

function normalizePlan(x, now = Date.now()) {
  if (!x || typeof x !== 'object') return null
  const sourceKey = text(x.sourceKey, 160)
  const title = text(x.title, 120)
  if (!sourceKey || !title) return null
  return {
    id: text(x.id, 80) || `agc-${randomUUID()}`,
    sourceKey,
    sourceId: text(x.sourceId, 120),
    sourceType: ['task', 'commitment', 'thread', 'goal', 'rest', 'interest', 'relationship'].includes(x.sourceType) ? x.sourceType : 'task',
    scope: ['virtual', 'local'].includes(x.scope) ? x.scope : '',
    title,
    detail: text(x.detail, 180),
    nextStep: text(x.nextStep, 160),
    dueAt: Math.max(0, Number(x.dueAt) || 0),
    dueLabel: text(x.dueLabel, 60),
    sourceUpdatedAt: Math.max(0, Number(x.sourceUpdatedAt) || 0),
    expiresAt: Math.max(0, Number(x.expiresAt) || 0),
    priority: clamp(x.priority, 0, 100, 50),
    score: clamp(x.score, 0, 100, 50),
    cost: clamp(x.cost, 1, 5, 2),
    risk: clamp(x.risk, 0, 3, 0),
    status: ['active', 'deferred', 'done', 'abandoned'].includes(x.status) ? x.status : 'active',
    steps: (Array.isArray(x.steps) ? x.steps : []).map(normalizeStep).filter(Boolean).slice(0, 4),
    stepIndex: Math.max(0, Math.round(Number(x.stepIndex) || 0)),
    progress: clamp(x.progress, 0, 100, 0),
    createdAt: Math.max(0, Number(x.createdAt) || now),
    updatedAt: Math.max(0, Number(x.updatedAt) || now),
    lastReviewAt: Math.max(0, Number(x.lastReviewAt) || 0),
    lastActionAt: Math.max(0, Number(x.lastActionAt) || 0),
    internalPlan: x?.internalPlan && typeof x.internalPlan === 'object' ? {
      at: Math.max(0, Number(x.internalPlan.at) || 0),
      nextAction: text(x.internalPlan.nextAction, 160),
      evidence: text(x.internalPlan.evidence, 220),
    } : null,
    reason: text(x.reason, 160),
    pendingProgress: text(x.pendingProgress, 80),
    attempts: Math.max(0, Math.round(Number(x.attempts) || 0)),
  }
}

function normalizeDeferred(x) {
  const sourceKey = text(x?.sourceKey, 160)
  if (!sourceKey) return null
  return {
    sourceKey,
    until: Math.max(0, Number(x.until) || 0),
    attempts: Math.max(0, Math.round(Number(x.attempts) || 0)),
    reason: text(x?.reason, 160),
    lastSourceUpdatedAt: Math.max(0, Number(x?.lastSourceUpdatedAt) || 0),
  }
}

function normalizeAbandoned(x) {
  const sourceKey = text(x?.sourceKey, 160)
  if (!sourceKey) return null
  return {
    sourceKey, at: Math.max(0, Number(x.at) || 0), reason: text(x.reason, 160),
    lastSourceUpdatedAt: Math.max(0, Number(x.lastSourceUpdatedAt) || 0),
  }
}

function normalizeOutreach(x) {
  const lastAt = Math.max(0, Number(x?.lastAt) || 0)
  if (!lastAt) return null
  return {
    lastAt,
    count: Math.max(0, Math.round(Number(x?.count) || 0)),
    status: ['awaiting', 'responded', 'ignored', 'declined'].includes(x?.status) ? x.status : 'awaiting',
    lastStage: text(x?.lastStage, 180),
    lastSourceUpdatedAt: Math.max(0, Number(x?.lastSourceUpdatedAt) || 0),
    nextAt: Math.max(0, Number(x?.nextAt) || 0),
  }
}

export function normalizeAgency(raw, now = Date.now()) {
  if (!raw || ![1, AGENCY_VERSION].includes(Number(raw.v))) return defaultAgency(now)
  const outreach = {}
  if (raw.outreach && typeof raw.outreach === 'object') {
    for (const [key, value] of Object.entries(raw.outreach)) {
      const clean = normalizeOutreach(value)
      if (clean && key) outreach[text(key, 160)] = clean
    }
  }
  const focus = normalizePlan(raw.focus, now)
  return {
    v: AGENCY_VERSION,
    updatedAt: Math.max(0, Number(raw.updatedAt) || now),
    focus: focus && ['active', 'deferred'].includes(focus.status) ? focus : null,
    deferred: (Array.isArray(raw.deferred) ? raw.deferred : []).map(normalizeDeferred).filter(Boolean).slice(-AGENCY_LIMITS.deferred),
    abandoned: (Array.isArray(raw.abandoned) ? raw.abandoned : []).map(normalizeAbandoned).filter(Boolean).slice(-AGENCY_LIMITS.abandoned),
    outreach: Object.fromEntries(Object.entries(outreach).slice(-AGENCY_LIMITS.recent)),
    executions: (Array.isArray(raw.executions) ? raw.executions : []).flatMap((x) => {
      const sourceKey = text(x?.sourceKey, 160); const action = text(x?.action, 40); const evidence = text(x?.evidence, 220)
      return sourceKey && action && evidence ? [{ at: Math.max(0, Number(x?.at) || 0), sourceKey, action, evidence }] : []
    }).slice(-AGENCY_LIMITS.executions),
    recent: (Array.isArray(raw.recent) ? raw.recent : []).flatMap((x) => {
      const title = text(x?.title, 120)
      return title ? [{ at: Math.max(0, Number(x.at) || 0), sourceKey: text(x.sourceKey, 160), title, status: text(x.status, 24) || 'done' }] : []
    }).slice(-AGENCY_LIMITS.recent),
  }
}

export function readAgency(now = Date.now()) {
  const read = readJsonBounded(agencyPath(), { maxBytes: AGENCY_LIMITS.fileBytes })
  if (!read.ok) return defaultAgency(now)
  const clean = normalizeAgency(read.value, now)
  if (Number(read.value?.v) !== AGENCY_VERSION) {
    // v1 had no outreach/abandoned/executions; migrate once instead of
    // treating the old file as permanently empty.
    try { writeAgency(clean, now) } catch {}
  }
  return clean
}

export function writeAgency(value, now = Date.now()) {
  return atomicWriteJson(agencyPath(), normalizeAgency(value, now))
}

function sourceMap(continuity, mind, candidates = []) {
  const map = new Map()
  for (const entity of Array.isArray(candidates) ? candidates : []) {
    if (!map.has(entity?.sourceKey)) map.set(entity.sourceKey, { ...entity, status: 'active' })
  }
  for (const [kind, list] of [['task', continuity?.tasks], ['commitment', continuity?.commitments], ['thread', continuity?.threads]]) {
    for (const entity of Array.isArray(list) ? list.slice(-20) : []) {
      map.set(`continuity:${kind}:${entity.id}`, {
        ...entity, sourceType: kind,
        sourceUpdatedAt: Math.max(0, Number(entity.updatedAt) || 0),
      })
    }
  }
  for (const goal of Array.isArray(mind?.goals) ? mind.goals.slice(-20) : []) {
    map.set(`mind:goal:${goal.id}`, {
      ...goal, sourceType: 'goal', sourceUpdatedAt: Math.max(0, Number(goal.updatedAt) || 0),
    })
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

function stepsFor(entity, type) {
  if (type === 'rest') return [{ label: text(entity.nextStep, 120) || '先休息一下', kind: 'rest', status: 'active', evidence: '' }]
  if (type === 'goal' || type === 'thread') {
    return [
      { label: `复盘：${text(entity.title, 100)}`, kind: 'review', status: 'active', evidence: '' },
      { label: entity.nextStep ? `下一步：${text(entity.nextStep, 120)}` : '等待真实进展', kind: 'wait', status: 'pending', evidence: '' },
    ]
  }
  return [
    { label: '等待合适时机', kind: 'wait', status: 'active', evidence: '' },
    { label: '完成后再确认', kind: 'confirm', status: 'pending', evidence: '' },
  ]
}

function candidateForEntity(entity, sourceKey, now) {
  const type = entity.sourceType
  if (type === 'goal' && entity.status !== 'active') return null
  if (type === 'goal' && entity.scope && !['virtual', 'local'].includes(entity.scope)) return null
  if (['task', 'commitment'].includes(type) && !['open', 'paused'].includes(entity.status)) return null
  if (type === 'thread' && entity.status !== 'active') return null
  const due = dueRank(entity, now)
  const dueAt = Math.max(0, Number(entity.dueAt) || 0)
  let score = type === 'commitment' ? 64 : type === 'task' ? 58 : type === 'thread' ? 62 : 54
  if (due === 0) score += 26
  else if (due === 1) score += 18
  else if (due === 2) score += 8
  if (type === 'thread') score += Math.max(0, 100 - (Number(entity.progress) || 0)) * 0.08
  if (entity.nextStep) score += 4
  if (entity.personId) score += 3
  if (type === 'goal' && Number(entity.progress) > 70) score += 3
  const cost = type === 'task' ? 1 : type === 'commitment' ? 2 : type === 'thread' ? 3 : 2
  score -= cost * 4
  return {
    id: `agc-${sourceKey.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48)}`,
    sourceKey,
    sourceId: text(entity.id, 120),
    sourceType: type,
    scope: ['virtual', 'local'].includes(entity.scope) ? entity.scope : '',
    title: text(entity.title, 120),
    detail: text(entity.detail, 180),
    nextStep: text(entity.nextStep, 160),
    dueAt,
    dueLabel: dueAt ? (due === 0 ? '已经逾期' : due === 1 ? '今天到期' : due === 2 ? '这两天到期' : '有期限') : '',
    sourceUpdatedAt: Math.max(0, Number(entity.sourceUpdatedAt || entity.updatedAt) || 0),
    expiresAt: 0,
    priority: type === 'commitment' ? 80 : type === 'task' ? 70 : type === 'thread' ? 72 : 60,
    score: clamp(score, 0, 100, 50),
    cost,
    risk: 0,
    steps: stepsFor(entity, type),
    stepIndex: 0,
    progress: clamp(entity.progress, 0, 100, 0),
    reason: dueAt ? '有实际截止时间' : (entity.nextStep ? '有明确下一步' : '还没完成'),
  }
}

/** Pure candidates from persisted sources; no invented people/places/weather. */
export function buildAgencyCandidates({ now = Date.now(), continuity, mind, vitality = {}, affect = {}, events = [] } = {}) {
  const map = sourceMap(continuity, mind)
  const out = []
  for (const [sourceKey, entity] of map) {
    const candidate = candidateForEntity(entity, sourceKey, now)
    if (candidate && candidate.title) out.push(candidate)
  }
  if (Number(vitality.energy) < 45) {
    out.push({
      id: 'agc-need-energy', sourceKey: 'needs:energy', sourceId: 'energy', sourceType: 'rest',
      title: '给自己留点空隙', detail: '精力偏低', nextStep: '先休息一下，别硬撑',
      dueAt: 0, dueLabel: '', sourceUpdatedAt: now, expiresAt: now + 12 * 3600000,
      priority: 55, score: 56, cost: 1, risk: 0,
      steps: [{ label: '先休息一下，别硬撑', kind: 'rest', status: 'active', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '精力偏低',
    })
  }
  if (Number(affect.valence) < 35) {
    out.push({
      id: 'agc-need-mood', sourceKey: 'needs:mood', sourceId: 'mood', sourceType: 'rest',
      title: '缓一缓', detail: '情绪偏低', nextStep: '不急着处理所有事',
      dueAt: 0, dueLabel: '', sourceUpdatedAt: now, expiresAt: now + 12 * 3600000,
      priority: 50, score: 50, cost: 1, risk: 0,
      steps: [{ label: '不急着处理所有事', kind: 'rest', status: 'active', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '情绪偏低',
    })
  }
  if (Number(continuity?.needs?.stress) > 75) {
    out.push({
      id: 'agc-need-stress', sourceKey: 'needs:stress', sourceId: 'stress', sourceType: 'rest',
      title: '松一口气', detail: '压力偏高', nextStep: '先把手头的事放一放',
      dueAt: 0, dueLabel: '', sourceUpdatedAt: Number(continuity?.needs?.updatedAt) || now,
      expiresAt: now + 6 * 3600000, priority: 45, score: 48, cost: 1, risk: 0,
      steps: [{ label: '先把手头的事放一放', kind: 'rest', status: 'active', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '压力偏高',
    })
  }
  if (Number(continuity?.needs?.socialNeed) > 70) {
    out.push({
      id: 'agc-need-social', sourceKey: 'needs:social', sourceId: 'social', sourceType: 'relationship',
      title: '想找人说说话', detail: '社交需求偏高', nextStep: '找合适的时机和人聊两句',
      dueAt: 0, dueLabel: '', sourceUpdatedAt: Number(continuity?.needs?.updatedAt) || now,
      expiresAt: now + 6 * 3600000, priority: 45, score: 45, cost: 2, risk: 0,
      steps: [{ label: '等一个不打扰人的时机', kind: 'wait', status: 'active', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '社交需求偏高',
    })
  }
  for (const memory of Array.isArray(mind?.memories) ? mind.memories.slice(-8) : []) {
    if (memory.kind !== 'promise' || memory.status !== 'active' || !memory.summary || sensitiveText.test(memory.summary)) continue
    const sourceKey = `mind:promise:${memory.id}`
    out.push({
      id: `agc-${sourceKey.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48)}`,
      sourceKey, sourceId: text(memory.id, 120), sourceType: 'task',
      title: `答应过：${text(memory.summary, 100)}`, detail: '一个明确的承诺',
      nextStep: '', dueAt: 0, dueLabel: '', sourceUpdatedAt: Number(memory.updatedAt) || 0,
      expiresAt: Number(memory.expiresAt) || now + 7 * 86400000, priority: 45, score: 45, cost: 1, risk: 0,
      steps: [{ label: '等合适的时机兑现', kind: 'wait', status: 'active', evidence: '' }, { label: '兑现后再确认', kind: 'confirm', status: 'pending', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '明确承诺',
    })
  }
  for (const person of Array.isArray(continuity?.people) ? continuity.people.slice(-12) : []) {
    if (person.status !== 'active' || !person.notes || sensitiveText.test(person.notes) || Number(person.updatedAt) < now - 7 * 86400000) continue
    const sourceKey = `relationship:${person.id}`
    out.push({
      id: `agc-${sourceKey.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48)}`,
      sourceKey, sourceId: text(person.id, 120), sourceType: 'relationship',
      title: `想起${text(person.name, 40)}: ${text(person.notes, 100)}`, detail: '最近记录的关系',
      nextStep: '', dueAt: 0, dueLabel: '', sourceUpdatedAt: Number(person.updatedAt) || 0,
      expiresAt: now + 3 * 86400000, priority: 35, score: 42, cost: 1, risk: 0,
      steps: [{ label: '等自然的话题出现', kind: 'wait', status: 'active', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '最近记录的关系',
    })
  }
  // Persisted self preferences are low-priority interests, not requests for
  // the user to do anything. TTL keeps them from becoming permanent clutter.
  for (const pref of Array.isArray(mind?.preferences) ? mind.preferences.slice(-12) : []) {
    if (pref.owner !== 'self' || pref.status !== 'active' || !pref.key || sensitiveText.test(`${pref.key} ${pref.value}`)) continue
    const sourceKey = `mind:preference:${pref.id || pref.key}`
    out.push({
      id: `agc-${sourceKey.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48)}`,
      sourceKey, sourceId: text(pref.id || pref.key, 120), sourceType: 'interest',
      title: `想${text(pref.key, 60)}：${text(pref.value, 100)}`, detail: '自己的偏好',
      nextStep: '', dueAt: 0, dueLabel: '', sourceUpdatedAt: Number(pref.updatedAt) || 0,
      expiresAt: now + 7 * 86400000, priority: 40, score: 40, cost: 1, risk: 0,
      steps: [{ label: '留到合适的空闲再说', kind: 'wait', status: 'active', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '自己的偏好',
    })
  }
  // A persisted recent event can become a quiet reflection candidate. It is
  // intentionally low priority and expires quickly; it never invents details.
  for (const event of Array.isArray(events) ? events.slice(-4) : []) {
    const summary = text(event?.summary || event?.reason || event?.text, 120)
    if (!summary || !event?.id || sensitiveText.test(summary)) continue
    const at = Math.max(0, Number(event.at) || now)
    out.push({
      id: `agc-event-${String(event.id).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40)}`,
      sourceKey: `event:${event.id}`, sourceId: text(event.id, 120), sourceType: 'interest',
      title: `想起：${summary}`, detail: '最近落盘的经历', nextStep: '', dueAt: 0, dueLabel: '',
      sourceUpdatedAt: at, expiresAt: at + 24 * 3600000, priority: 35, score: 38, cost: 1, risk: 0,
      steps: [{ label: '只是想一想，不急着说', kind: 'wait', status: 'active', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '近期经历',
    })
  }
  return out.sort((a, b) => b.score - a.score || a.sourceKey.localeCompare(b.sourceKey)).slice(0, AGENCY_LIMITS.candidates)
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function mergeSteps(existing = [], incoming = []) {
  return incoming.map((step, i) => {
    const old = existing[i]
    if (old && (old.status === 'done' || old.status === 'skipped')) {
      return { ...step, label: old.label, status: old.status, evidence: old.evidence }
    }
    if (old && old.status === 'active' && step.status === 'pending') return { ...step, status: 'active' }
    return { ...step }
  })
}

function advanceProgress(steps, evidence, now) {
  // A review step is the safe internal action. Do not advance a waiting step
  // before that review has actually been recorded.
  if (steps.some((x) => x.kind === 'review' && x.status !== 'done')) return { steps, stepIndex: 0 }
  const index = steps.findIndex((x) => x.status === 'active' && x.kind !== 'review')
  if (index < 0) return { steps, stepIndex: 0 }
  const updated = steps.map((x, i) => i === index ? { ...x, status: 'done', evidence } : x)
  const next = updated[index + 1]
  if (next && next.status === 'pending') next.status = 'active'
  return { steps: updated, stepIndex: Math.min(updated.length - 1, index + 1) }
}

function executeReview(state, focus, now) {
  if (!focus || !['goal', 'thread'].includes(focus.sourceType)) return false
  if (focus.lastReviewAt && now - focus.lastReviewAt < AGENCY_LIMITS.reviewIntervalMs) return false
  const index = focus.steps.findIndex((x) => x.kind === 'review' && x.status !== 'done')
  if (index < 0) return false
  const evidence = `内部复盘：${focus.title}${focus.nextStep ? `，下一步仍是 ${focus.nextStep}` : ''}；没有外部事实，不记为完成。`
  focus.steps = focus.steps.map((x, i) => i === index ? { ...x, status: 'done', evidence } : x)
  const next = focus.steps[index + 1]
  if (next && next.status === 'pending') next.status = 'active'
  focus.stepIndex = Math.min(focus.steps.length - 1, index + 1)
  focus.lastReviewAt = now
  focus.lastActionAt = now
  if (focus.pendingProgress) {
    const advanced = advanceProgress(focus.steps, focus.pendingProgress, now)
    focus.steps = advanced.steps
    focus.stepIndex = Math.max(focus.stepIndex, advanced.stepIndex)
    focus.pendingProgress = ''
  }
  focus.reason = '内部复盘完成，等待真实进展'
  focus.internalPlan = {
    at: now,
    nextAction: focus.nextStep || '等待真实进展',
    evidence,
  }
  state.executions.push({ at: now, sourceKey: focus.sourceKey, action: 'review', evidence })
  state.executions = state.executions.slice(-AGENCY_LIMITS.executions)
  return true
}

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

function outreachFor(state, sourceKey) {
  return state.outreach[sourceKey] || null
}

function updateOutreachTimeouts(state, now) {
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

export function tickAgency(input = {}) {
  const now = Number(input.now) || Date.now()
  const result = withLock(agencyPath() + '.lock', () => {
    const state = readAgency(now)
    const candidates = buildAgencyCandidates({ ...input, now })
    const map = sourceMap(input.continuity, input.mind, candidates)
    const deferred = new Map(state.deferred.map((x) => [x.sourceKey, x]))
    let changed = updateOutreachTimeouts(state, now)

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

    if (focus && executeReview(state, focus, now)) changed = true

    if (!focus) {
      const available = candidates.filter((c) => {
        if (c.expiresAt && c.expiresAt <= now) return false
        if (isAbandoned(state, c)) return false
        const blocked = deferred.get(c.sourceKey)
        if (blocked) {
          const fresh = c.sourceUpdatedAt > blocked.lastSourceUpdatedAt
          return fresh || (blocked.until <= now && blocked.attempts < 3)
        }
        return true
      })
      const best = available.find((c) => c.score >= 50)
      if (best) {
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
    } else {
      const best = candidates
        .filter((c) => !c.expiresAt || c.expiresAt > now)
        .find((c) => c.score >= focus.score + 8 && c.sourceKey !== focus.sourceKey && !isAbandoned(state, c))
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
  const body = text(value, 400)
  const result = withLock(agencyPath() + '.lock', () => {
    const state = readAgency(now)
    let changed = false
    for (const row of Object.values(state.outreach)) {
      if (row.status !== 'awaiting' && row.status !== 'ignored') continue
      if (negativeReply.test(body)) {
        row.status = 'declined'
        row.nextAt = now
      } else {
        row.status = 'responded'
        row.nextAt = 0
      }
      changed = true
    }
    if (changed) { state.updatedAt = now; writeAgency(state, now) }
    return { ok: true, changed }
  }, { staleMs: 5000 })
  return result || { ok: false, reason: 'locked' }
}

export function agencyStatus(now = Date.now()) { return readAgency(now) }
