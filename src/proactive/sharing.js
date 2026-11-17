// dsh-feiyu-life · initiative sharing candidates
//
// A share is only offered when a real, already-finished piece of the day can
// be named. Candidates never come from future plan segments, invented weather,
// unnamed people or places. The module is deliberately split into:
//   · pure candidate building/selection (easy to simulate and test);
//   · a small atomic ledger (dedupe, cooldown, daily quota, lease).
//
// Sending stays in index.js, on the plugin's existing initiative timer. This
// module never creates a timer and never calls an agent.

import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { atomicWriteJson, readJsonBounded, withLock } from '../persistence/storage.js'
import { momentTitle } from '../life/moments.js'

export const SHARING_VERSION = 1
export const SHARING_LIMITS = { recent: 60, failures: 40, pendingLeaseMs: 5 * 60 * 1000, ledgerBytes: 256 * 1024 }

export const defaultSharingConfig = {
  启用: true,
  每日上限: 2,
  全局冷却分钟: 1440,
  同类冷却分钟: 480,
  安静开始: 0,
  安静结束: 8,
  最低分: 84,
  近期对话分钟: 20,
  检查间隔分钟: 5,
}

const root = () => process.env.DSH_HOME || join(homedir(), '.dsh')
export const sharingPath = () => join(root(), 'feiyu-life-sharing.json')
const clamp = (value, min, max, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const text = (value, limit = 120) => String(value || '').trim().slice(0, limit)
const copy = (value) => JSON.parse(JSON.stringify(value))

export function normalizeSharingConfig(input, issues = []) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (input !== undefined && (typeof input !== 'object' || input === null || Array.isArray(input))) issues.push('主动分享必须是对象，已恢复默认')
  const cfg = {
    启用: raw.启用 !== false,
    每日上限: Math.round(clamp(raw.每日上限, 0, 6, defaultSharingConfig.每日上限)),
    全局冷却分钟: Math.round(clamp(raw.全局冷却分钟, 30, 1440, defaultSharingConfig.全局冷却分钟)),
    同类冷却分钟: Math.round(clamp(raw.同类冷却分钟, 60, 4320, defaultSharingConfig.同类冷却分钟)),
    安静开始: Math.round(clamp(raw.安静开始, 0, 23, defaultSharingConfig.安静开始)),
    安静结束: Math.round(clamp(raw.安静结束, 0, 23, defaultSharingConfig.安静结束)),
    最低分: Math.round(clamp(raw.最低分, 0, 100, defaultSharingConfig.最低分)),
    近期对话分钟: Math.round(clamp(raw.近期对话分钟, 5, 1440, defaultSharingConfig.近期对话分钟)),
    检查间隔分钟: Math.round(clamp(raw.检查间隔分钟, 1, 60, defaultSharingConfig.检查间隔分钟)),
  }
  for (const [key, label] of [['每日上限', '每日上限'], ['全局冷却分钟', '全局冷却'], ['同类冷却分钟', '同类冷却'], ['最低分', '最低分'], ['近期对话分钟', '近期对话窗口'], ['检查间隔分钟', '检查间隔']]) {
    if (raw[key] !== undefined && Number(raw[key]) !== cfg[key]) issues.push(`主动分享${label}超出范围，已修正`)
  }
  for (const key of ['安静开始', '安静结束']) {
    if (raw[key] !== undefined && Number(raw[key]) !== cfg[key]) issues.push(`主动分享${key}超出范围，已修正`)
  }
  return cfg
}

export function defaultSharingLedger(now = Date.now()) {
  return {
    v: SHARING_VERSION,
    updatedAt: now,
    date: '',
    dailyCount: 0,
    lastSharedAt: 0,
    recent: [],
    failures: {},
    pending: null,
  }
}

export function normalizeSharingLedger(raw, now = Date.now()) {
  if (!raw || raw.v !== SHARING_VERSION) return defaultSharingLedger(now)
  const pending = raw.pending && typeof raw.pending === 'object'
    ? {
        claimId: text(raw.pending.claimId, 80),
        eventId: text(raw.pending.eventId, 160),
        stageKey: text(raw.pending.stageKey, 180),
        kind: text(raw.pending.kind, 40),
        category: text(raw.pending.category, 80),
        title: text(raw.pending.title, 80),
        sourceKey: text(raw.pending.sourceKey, 160),
        sessionId: text(raw.pending.sessionId, 120),
        sourceUpdatedAt: Math.max(0, Number(raw.pending.sourceUpdatedAt) || 0),
        facts: Array.isArray(raw.pending.facts) ? raw.pending.facts.map((x) => text(x, 160)).filter(Boolean).slice(0, 4) : [],
        tone: text(raw.pending.tone, 40),
        score: Math.round(clamp(raw.pending.score, 0, 100, 0)),
        followup: raw.pending.followup === true,
        atMinute: Math.max(0, Math.round(Number(raw.pending.atMinute) || 0)),
        claimedAt: Math.max(0, Number(raw.pending.claimedAt) || 0),
        leaseUntil: Math.max(0, Number(raw.pending.leaseUntil) || 0),
        attempts: Math.max(0, Math.round(Number(raw.pending.attempts) || 0)),
      }
    : null
  const failures = {}
  if (raw.failures && typeof raw.failures === 'object' && !Array.isArray(raw.failures)) {
    for (const [key, value] of Object.entries(raw.failures).slice(0, SHARING_LIMITS.failures)) {
      const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)))
      if (key && n) failures[text(key, 160)] = n
    }
  }
  return {
    v: SHARING_VERSION,
    updatedAt: Math.max(0, Number(raw.updatedAt) || now),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date || '')) ? String(raw.date) : '',
    dailyCount: Math.max(0, Math.round(Number(raw.dailyCount) || 0)),
    lastSharedAt: Math.max(0, Number(raw.lastSharedAt) || 0),
    recent: (Array.isArray(raw.recent) ? raw.recent : []).flatMap((row) => {
      if (!row || !row.eventId || !row.stageKey) return []
      return [{
        eventId: text(row.eventId, 160),
        stageKey: text(row.stageKey, 180),
        kind: text(row.kind, 40),
        category: text(row.category, 80),
        title: text(row.title, 80),
        sourceKey: text(row.sourceKey, 160),
        sessionId: text(row.sessionId, 120),
        sourceUpdatedAt: Math.max(0, Number(row.sourceUpdatedAt) || 0),
        at: Math.max(0, Number(row.at) || 0),
        followup: row.followup === true,
      }]
    }).slice(-SHARING_LIMITS.recent),
    failures,
    pending: pending && pending.claimId && pending.eventId ? pending : null,
  }
}

export function readSharing(now = Date.now()) {
  const read = readJsonBounded(sharingPath(), { maxBytes: SHARING_LIMITS.ledgerBytes })
  if (!read.ok) return defaultSharingLedger(now)
  return normalizeSharingLedger(read.value, now)
}

export function writeSharing(value) {
  return atomicWriteJson(sharingPath(), normalizeSharingLedger(value))
}

export function localDate(now, timeZone = 'Asia/Shanghai') {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now))
    const get = (type) => parts.find((x) => x.type === type)?.value || ''
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch { return new Date(now).toISOString().slice(0, 10) }
}

function localHour(now, timeZone = 'Asia/Shanghai') {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, hour: '2-digit', hour12: false }).formatToParts(new Date(now))
    return Number(parts.find((x) => x.type === 'hour')?.value || 0) % 24
  } catch { return new Date(now).getHours() }
}

function inQuietHours(hour, start, end) {
  const a = Math.round(clamp(start, 0, 23, 0))
  const b = Math.round(clamp(end, 0, 23, 0))
  if (a === b) return false
  return a < b ? hour >= a && hour < b : hour >= a || hour < b
}

function freshness(ageMinutes) {
  if (!Number.isFinite(ageMinutes)) return 0
  if (ageMinutes <= 10) return 14
  if (ageMinutes <= 30) return 10
  if (ageMinutes <= 60) return 6
  if (ageMinutes <= 120) return 2
  return 0
}

function clampScore(n) { return Math.max(0, Math.min(100, Math.round(Number(n) || 0))) }

function completedScore(row, age, deviation) {
  const what = String(row.what || '')
  if (!what || row.source === 'travel' || /睡|洗澡|冲澡|洗漱|刷牙|洗脸/.test(what)) return 0
  if (/没安排|闲着|翘了/.test(what) && !/出门|外面/.test(what)) return 0
  // A negation such as "一天没出门" is not an outing, and lying in bed is not
  // worth proactively reporting unless it was a deliberate adjustment.
  const inactivity = /一天没出门|在宿舍躺着|躺床上|窝在|刷手机|躺着/.test(what)
  if (inactivity && row.source !== 'adjust') return 0
  let score = 52 + freshness(age)
  if (/出门|外面|街上|逛|拍照|超市|便利店|猫|快递|面试|答辩|作品|老师|下课|见|社团/.test(what)) score += 14
  if (row.behavior === 'photo' || row.behavior === 'walk') score += 8
  if (row.behavior === 'eat') score += 4
  if (row.source === 'adjust') score += 16
  if (deviation) score += 4
  return clampScore(score)
}

function relevanceScore(candidate, recentText) {
  const textValue = String(recentText || '')
  if (!textValue) return 0
  const groups = {
    'completed:eat': ['吃', '饿', '饭', '外卖', '食堂'],
    'completed:walk': ['出门', '外面', '逛', '走'],
    'completed:photo': ['拍照', '照片', '相机'],
    'completed:study': ['课', '作业', '老师', '复习', '考试'],
    body: ['累', '困', '冷', '疼', '不舒服', '睡'],
    continuity: ['做完', '进度', '明天', '任务', '答应'],
    'moment:package': ['快递', '取件', '包裹'],
    'moment:laundry': ['衣服', '洗', '阳台'],
    'moment:edit': ['片子', '剪', '转场'],
    'moment:homework': ['作业', '写', '课'],
    'moment:libraryBook': ['书', '图书馆', '还书'],
    'moment:charger': ['充电', '线'],
    'moment:snack': ['吃', '甜', '饿'],
    'moment:cat': ['猫', '楼下'],
    'moment:person': ['吃', '外卖', '室友', '朋友'],
    'moment:throat': ['嗓子', '感冒', '咳'],
    'moment:sleepy': ['困', '睡', '累'],
  }
  const words = groups[candidate.category] || []
  return words.some((word) => textValue.includes(word)) ? 8 : 0
}

/**
 * Pure candidate construction. Input facts must already be completed; future
 * timeline rows and future moment stages are rejected here.
 */
export function buildCandidates(input = {}) {
  const now = Number(input.now) || Date.now()
  const nowMinute = Math.max(0, Math.min(1440, Math.round(Number(input.nowMinute) || 0)))
  const date = String(input.date || '')
  const life = input.life || {}
  const ledger = normalizeSharingLedger(input.ledger || {}, now)
  const recent = new Set((ledger.recent || []).map((x) => x.eventId))
  const followupAllowed = new Set(['package', 'libraryBook', 'edit', 'homework', 'person', 'snack', 'laundry'])
  const momentShareScore = { package: 4, cat: 2, edit: 2, laundry: 0, homework: 0, libraryBook: 1, person: 1, snack: 0, charger: -4, throat: -6, sleepy: -4 }
  const candidates = []

  // A moment is only shared at a later stage, and only when the generated
  // context considered it compatible with the timeline/current place.
  const moment = life.moment
  if (moment && Number.isFinite(Number(moment.stageIndex)) && Number(moment.stageIndex) >= 1 && Number(moment.ageMinutes) <= 180) {
    const id = String(moment.id || '')
    if (id && (!recent.has(`moment:${date}:${id}`) || followupAllowed.has(id))) {
      const eventId = `moment:${date}:${id}`
      const stageKey = `${eventId}:${moment.stageIndex}`
      const prior = recent.has(eventId)
      const score = clampScore(76 + Number(moment.stageIndex) * 4 + (prior ? 14 : 0) + freshness(Number(moment.ageMinutes)) + Number(momentShareScore[id] || 0))
      candidates.push({
        eventId,
        stageKey,
        kind: 'moment',
        category: `moment:${id}`,
        title: moment.title || momentTitle(id),
        facts: [text(moment.text, 160)],
        tone: '随口',
        score,
        followup: prior,
        atMinute: nowMinute - Math.max(0, Number(moment.ageMinutes) || 0),
      })
    }
  }

  // Completed timeline rows only. A future row cannot become a candidate even
  // if it appears in the plan.
  for (const row of Array.isArray(life.timeline) ? life.timeline : []) {
    const end = Number(row.end)
    if (!Number.isFinite(end) || end > nowMinute) continue
    const age = nowMinute - end
    if (age < 0 || age > 120) continue
    const score = completedScore(row, age, Boolean(life.deviation && (life.deviation.flat || life.deviation.outing || life.deviation.skipAfternoon)))
    if (!score) continue
    const what = text(row.what, 120)
    const eventId = `segment:${date}:${Number(row.start) || 0}:${what}`
    const stageKey = eventId
    if (recent.has(eventId)) continue
    const category = `completed:${row.behavior || 'activity'}`
    candidates.push({
      eventId, stageKey, kind: 'completed', category,
      title: what, facts: [what], tone: row.source === 'adjust' ? '有点意外' : '轻描淡写',
      score, followup: false, atMinute: end,
    })
  }

  // Body changes are candidates only on the first day, not every day of a
  // multi-day cold/period.
  if (life.cold && Number(life.cold.day) === 1) {
    const eventId = `body:${date}:cold`
    if (!recent.has(eventId)) candidates.push({
      eventId, stageKey: eventId, kind: 'body', category: 'body',
      title: '感冒', facts: ['感冒了，嗓子有点紧，人也发懒'], tone: '有点累', score: 86, followup: false, atMinute: nowMinute,
    })
  }
  if (Number(life.period) === 1) {
    const eventId = `body:${date}:period`
    if (!recent.has(eventId)) candidates.push({
      eventId, stageKey: eventId, kind: 'body', category: 'body',
      title: '身体', facts: ['来例假了，腰有点酸'], tone: '有点累', score: 88, followup: false, atMinute: nowMinute,
    })
  }

  // Completed continuity changes are already real events, never plans.
  for (const change of Array.isArray(input.continuityChanges) ? input.continuityChanges : []) {
    const at = Number(change && change.at)
    if (!Number.isFinite(at) || at > now || now - at > 120 * 60000) continue
    if (!/完成|更新|推进|complet|settle/.test(String(change.reason || ''))) continue
    const entityId = text(change.entityId || change.id, 120)
    if (!entityId) continue
    const eventId = `continuity:${date}:${entityId}:${at}`
    if (recent.has(eventId)) continue
    candidates.push({
      eventId, stageKey: eventId, kind: 'continuity', category: 'continuity',
      title: text(change.reason, 80) || '今天推进的事',
      facts: [text(change.reason, 140) || '之前挂着的一件事有了进展'],
      tone: '想起', score: 86, followup: false, atMinute: nowMinute,
    })
  }

  for (const candidate of candidates) candidate.score = clampScore(candidate.score + relevanceScore(candidate, input.recentText))
  return candidates.sort((a, b) => b.score - a.score || b.atMinute - a.atMinute || a.eventId.localeCompare(b.eventId))
}

/** Pure suppression/scoring gate, also used by the 14-day simulation. */
export function selectShareCandidate(input = {}) {
  const config = normalizeSharingConfig(input.config)
  const now = Number(input.now) || Date.now()
  const timeZone = String(input.timeZone || 'Asia/Shanghai')
  if (!config.启用) return { ok: false, reason: 'disabled' }
  const ledger = normalizeSharingLedger(input.ledger || {}, now)
  if (ledger.pending && Number(ledger.pending.leaseUntil) > now) return { ok: false, reason: 'claim-active' }
  if (inQuietHours(localHour(now, timeZone), config.安静开始, config.安静结束)) return { ok: false, reason: 'quiet-hours' }
  const date = localDate(now, timeZone)
  const count = ledger.date === date ? Number(ledger.dailyCount) || 0 : 0
  if (count >= config.每日上限) return { ok: false, reason: 'daily-limit' }
  if (input.agentBusy) return { ok: false, reason: 'busy' }
  if (input.lastHumanAt && now - input.lastHumanAt < config.近期对话分钟 * 60000) return { ok: false, reason: 'recent-conversation' }
  if (input.asleep || input.behavior === 'sleep' || /睡着|午睡|补觉|睡熟|洗澡|冲澡|洗漱|刷牙|洗脸/.test(String(input.what || ''))) return { ok: false, reason: 'sleep-or-bath' }
  if (input.phone === '不在手边') return { ok: false, reason: 'phone-away' }
  if (input.currentCategory === 'class' || input.behavior === 'study' && /课|自习|复习|背书/.test(String(input.what || ''))) return { ok: false, reason: 'class' }

  const recentKeys = new Set((ledger.recent || []).map((x) => x.stageKey))
  const recentCategories = new Map()
  const priorEventAt = new Map()
  for (const row of ledger.recent || []) {
    const at = Number(row.at) || 0
    if (row.eventId) priorEventAt.set(row.eventId, Math.max(at, priorEventAt.get(row.eventId) || 0))
    if (!row.category) continue
    if (!recentCategories.has(row.category) || at > recentCategories.get(row.category)) recentCategories.set(row.category, at)
  }
  const viable = (Array.isArray(input.candidates) ? input.candidates : []).filter((candidate) => {
    if (!candidate || candidate.score < config.最低分) return false
    if (recentKeys.has(candidate.stageKey)) return false
    if (Number(ledger.failures?.[candidate.eventId]) >= 2) return false
    const priorAt = priorEventAt.get(candidate.eventId)
    if (candidate.followup && !priorAt) return false
    const lastCategory = recentCategories.get(candidate.category)
    // A follow-up is allowed to reuse its own category; it is a new stage of
    // the same event, not a repeat of a different ordinary moment.
    if (lastCategory && now - lastCategory < config.同类冷却分钟 * 60000 && !candidate.followup) return false
    return true
  }).sort((a, b) => b.score - a.score || b.atMinute - a.atMinute || a.eventId.localeCompare(b.eventId))
  if (!viable.length) {
    const list = Array.isArray(input.candidates) ? input.candidates : []
    if (!list.length) return { ok: false, reason: 'no-candidate' }
    return { ok: false, reason: list.some((x) => x.score >= config.最低分) ? 'deduped-or-cooldown' : 'below-min-score' }
  }
  // Global cooldown applies to new events, not to a genuinely new stage of an
  // event already shared earlier today. The follow-up still needs a short gap,
  // and the daily quota still applies.
  if (ledger.lastSharedAt && now - ledger.lastSharedAt < config.全局冷却分钟 * 60000) {
    const followup = viable.find((candidate) => {
      const priorAt = priorEventAt.get(candidate.eventId)
      return candidate.followup && priorAt && now - priorAt >= 60 * 60000
    })
    if (!followup) return { ok: false, reason: 'global-cooldown' }
    return { ok: true, candidate: followup }
  }
  return { ok: true, candidate: viable[0] }
}

/**
 * Claim a candidate with a lease. The caller must commit after followup
 * resolves, or release on failure. Two pollers cannot claim at once.
 */
export function takeShare(input = {}) {
  const now = Number(input.now) || Date.now()
  const config = normalizeSharingConfig(input.config)
  const result = withLock(sharingPath() + '.lock', () => {
    const ledger = readSharing(now)
    let changed = false
    if (ledger.pending && Number(ledger.pending.leaseUntil) <= now) {
      ledger.pending = null
      changed = true
    }
    const selection = selectShareCandidate({ ...input, config, ledger, now })
    if (!selection.ok) {
      if (changed) writeSharing(ledger)
      return selection
    }
    const candidate = selection.candidate
    const claimId = randomUUID()
    ledger.pending = {
      ...candidate,
      claimId,
      claimedAt: now,
      leaseUntil: now + SHARING_LIMITS.pendingLeaseMs,
      attempts: Math.max(0, Number(ledger.failures?.[candidate.eventId]) || 0),
    }
    ledger.updatedAt = now
    if (!writeSharing(ledger)) return { ok: false, reason: 'ledger-write-failed' }
    return { ok: true, claim: copy(ledger.pending), config }
  }, { staleMs: 5000 })
  return result === undefined ? { ok: false, reason: 'locked' } : result
}

/** Mark a claimed candidate as delivered only after the framework accepted it. */
export function commitShare(claimId, options = {}) {
  const now = Number(options.now) || Date.now()
  const timeZone = String(options.timeZone || 'Asia/Shanghai')
  const result = withLock(sharingPath() + '.lock', () => {
    const ledger = readSharing(now)
    const pending = ledger.pending
    if (!pending || String(pending.claimId) !== String(claimId)) return { ok: false, reason: 'stale-claim' }
    if (Number(pending.leaseUntil) + 60000 < now) return { ok: false, reason: 'lease-expired' }
    const date = localDate(now, timeZone)
    const previous = ledger.date === date ? Number(ledger.dailyCount) || 0 : 0
    ledger.date = date
    ledger.dailyCount = previous + 1
    ledger.lastSharedAt = now
    ledger.recent = [...(ledger.recent || []), {
      eventId: pending.eventId, stageKey: pending.stageKey, kind: pending.kind,
      category: pending.category, title: pending.title, sourceKey: pending.sourceKey,
      sessionId: pending.sessionId, sourceUpdatedAt: pending.sourceUpdatedAt,
      at: now, followup: pending.followup === true,
    }].slice(-SHARING_LIMITS.recent)
    ledger.pending = null
    ledger.updatedAt = now
    return writeSharing(ledger) ? { ok: true, dailyCount: ledger.dailyCount, eventId: pending.eventId } : { ok: false, reason: 'ledger-write-failed' }
  }, { staleMs: 5000 })
  return result === undefined ? { ok: false, reason: 'locked' } : result
}

/** Give a claimed candidate back after a failed delivery; bounded retries. */
export function releaseShare(claimId, reason = 'delivery-failed', options = {}) {
  const now = Number(options.now) || Date.now()
  const result = withLock(sharingPath() + '.lock', () => {
    const ledger = readSharing(now)
    const pending = ledger.pending
    if (!pending || String(pending.claimId) !== String(claimId)) return { ok: false, reason: 'stale-claim' }
    ledger.failures = { ...(ledger.failures || {}) }
    const key = pending.eventId
    ledger.failures[key] = Math.min(5, Math.max(0, Number(ledger.failures[key]) || 0) + 1)
    ledger.pending = null
    ledger.updatedAt = now
    return writeSharing(ledger) ? { ok: true, reason: text(reason, 80), attempts: ledger.failures[key] } : { ok: false, reason: 'ledger-write-failed' }
  }, { staleMs: 5000 })
  return result === undefined ? { ok: false, reason: 'locked' } : result
}

export function sharingStatus(now = Date.now()) {
  const ledger = readSharing(now)
  return {
    ledger: {
      date: ledger.date,
      dailyCount: ledger.dailyCount,
      lastSharedAt: ledger.lastSharedAt,
      recent: ledger.recent.slice(-12),
      pending: ledger.pending,
    },
    limits: { ...SHARING_LIMITS },
  }
}

/** Short, first-person, non-coercive context for the model. */
export function buildSharePrompt(candidate, options = {}) {
  if (!candidate) return ''
  const facts = (Array.isArray(candidate.facts) ? candidate.facts : []).map((x) => text(x, 160)).filter(Boolean)
  const lines = candidate.kind === 'followup'
    ? [
        '<feiyu-share>',
        '这是你心里记着、还没完成的事，不是已经发生的结果：',
        ...facts.map((fact) => `- ${fact}`),
        '如果想提，就自然问一句或关心一下，1–2 句口语；不要声称已经做完，也不要催、不要一连串追问。不想提也可以先放着。',
        '</feiyu-share>',
      ]
    : [
        '<feiyu-share>',
        '这是你自己生活里刚发生、可以追溯的一件小事，不是对方发来的，也不是计划：',
        ...facts.map((fact) => `- ${fact}`),
      ]
  if (candidate.kind !== 'followup' && candidate.followup) lines.push('- 这是你之前提过的同一件事的后续，可以自然承接，但不要当成一件全新的陌生事。')
  if (candidate.kind !== 'followup') lines.push('如果你想分享，就用 1–2 句口语说一句；不强制提问或称呼，不报时间、不列清单、不解释来源，也别每次都用“刚刚/突然/对了”开头。他没回也可以放下。')
  if (candidate.kind !== 'followup') lines.push('</feiyu-share>')
  return lines.join('\n')
}
