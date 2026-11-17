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
import { atomicWriteJson, readJsonBounded, withLock } from '../../persistence/storage.js'

// State schema, normalization, storage and small shared helpers.

export const AGENCY_VERSION = 2
export const AGENCY_LIMITS = {
  recent: 24, deferred: 24, abandoned: 24, executions: 40, candidates: 40, fileBytes: 256 * 1024,
  holdMs: 15 * 60 * 1000, deferMs: 30 * 60 * 1000, reviewIntervalMs: 30 * 60 * 1000,
  followupWaitMs: 48 * 3600000, ignoredRetryMs: 72 * 3600000, newFactWaitMs: 30 * 60 * 1000,
}
const root = () => process.env.DSH_HOME || join(homedir(), '.dsh')
export const agencyPath = () => join(root(), 'feiyu-life-agency.json')
export const clamp = (n, a, b, fallback = 0) => {
  const value = Number(n)
  return Number.isFinite(value) ? Math.max(a, Math.min(b, value)) : fallback
}
export const text = (value, max = 160) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max)
export const negativeReply = /(别催|不用催|别再提|不想提|别问|别管|没兴趣)/
export const sensitiveText = /密码|口令|验证码|私钥|助记词|api[ _-]?key|access[ _-]?token|secret|身份证|银行卡|信用卡/i
export const stopTopic = new Set(['事情', '这个', '那个', '一下', '最近', '自己', '问题', '东西', '时候', '还是', '可以'])

/** Pull a reply reference only if the host payload actually exposes one. */
export function inboxReplyReference(payload) {
  const message = payload?.message || payload?.data?.message || payload?.data?.item || payload || {}
  return text(message.replyTo || message.reply_to || message.parentId || message.parent_id || message.source?.replyTo || message.source?.parentId || payload?.replyTo || '', 180)
}

export function topicMatches(body, row) {
  const haystack = String(body || '').replace(/\s+/g, '')
  if (!haystack) return false
  const topic = text(row?.topic, 160)
  if (topic && topic.length >= 2) {
    if (haystack.includes(topic)) return true
    const parts = topic.split(/[，。！？、；：,.!?;:\s/|]+/).filter((x) => x.length >= 2 && !stopTopic.has(x))
    if (parts.some((x) => haystack.includes(x))) return true
  }
  // A source key is not user-facing, but its last meaningful segment can be
  // an explicit referent in Chinese (e.g. task title already in topic).
  const source = text(row?.lastStage, 180)
  if (source && haystack.includes(source)) return true
  return false
}

export function defaultAgency(now = Date.now()) {
  return {
    v: AGENCY_VERSION, updatedAt: now, focus: null, deferred: [], abandoned: [],
    outreach: {}, executions: [], recent: [], explored: {},
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
    sessionId: text(x?.sessionId, 120),
    topic: text(x?.topic, 160),
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
    explored: Object.fromEntries(Object.entries(raw.explored && typeof raw.explored === 'object' ? raw.explored : {}).flatMap(([key, value]) => {
      const at = Math.max(0, Number(value) || 0)
      return key && at ? [[text(key, 160), at]] : []
    }).slice(-AGENCY_LIMITS.recent)),
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

