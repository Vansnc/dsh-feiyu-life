// dsh-feiyu-life · native inner state and one-pass turn reflection
//
// Conversation text is sent to the selected DSH model only for the reflection
// call. The local event ledger keeps the outcome and provenance, never a copy
// of the transcript. Reflection failures are audit-only and never block chat.

import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { pickModel } from './gen.js'
import { withStreamTimeout } from './runtime.js'
import { normalizeCognition } from './mind.js'

export const AFFECT_VERSION = 1
const root = () => process.env.DSH_HOME || join(homedir(), '.dsh')
export const affectPath = () => join(root(), 'feiyu-life-affect.json')
export const eventsDir = () => join(root(), 'feiyu-life-events')
const clamp = (n, a, b, fallback = 0) => {
  const value = Number(n)
  return Number.isFinite(value) ? Math.max(a, Math.min(b, value)) : fallback
}
const text = (value, max = 160) => String(value || '').trim().slice(0, max)
const copy = (value) => JSON.parse(JSON.stringify(value))
const SECRET_PATTERN = /密码|口令|验证码|私钥|助记词|api[ _-]?key|access[ _-]?token|secret|身份证|银行卡|信用卡/i
const safeCandidate = (item, fields) => {
  if (!item || typeof item !== 'object') return item
  const copyItem = copy(item)
  if (!SECRET_PATTERN.test(JSON.stringify(copyItem))) return copyItem
  for (const field of fields) if (field in copyItem) copyItem[field] = '[敏感内容已拦截]'
  return copyItem
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  renameSync(tmp, path)
}

function localDate(now = Date.now(), timeZone = 'Asia/Shanghai') {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now))
  } catch { return new Date(now).toISOString().slice(0, 10) }
}

export function defaultAffect(config = {}, now = Date.now()) {
  const baseline = clamp(config?.基线心情, 20, 80, 55)
  return {
    v: AFFECT_VERSION,
    valence: baseline,
    arousal: 35,
    baseline,
    dimensions: { joy: 0, calm: 20, worry: 0, sadness: 0 },
    updatedAt: now,
    lastEventAt: 0,
    lastReason: '',
    lastDelta: 0,
    lastConfidence: 0,
    timeline: [],
    appliedEvents: [],
  }
}

export function normalizeAffect(raw, config = {}, now = Date.now()) {
  const base = defaultAffect(config, now)
  if (!raw || typeof raw !== 'object') return base
  const dimensions = raw.dimensions && typeof raw.dimensions === 'object' ? raw.dimensions : {}
  return {
    v: AFFECT_VERSION,
    valence: clamp(raw.valence, 0, 100, base.valence),
    arousal: clamp(raw.arousal, 0, 100, base.arousal),
    baseline: clamp(config?.基线心情 ?? raw.baseline, 20, 80, base.baseline),
    dimensions: {
      joy: clamp(dimensions.joy, 0, 100), calm: clamp(dimensions.calm, 0, 100),
      worry: clamp(dimensions.worry, 0, 100), sadness: clamp(dimensions.sadness, 0, 100),
    },
    updatedAt: Math.max(0, Number(raw.updatedAt) || now),
    lastEventAt: Math.max(0, Number(raw.lastEventAt) || 0),
    lastReason: text(raw.lastReason, 160),
    lastDelta: clamp(raw.lastDelta, -20, 20),
    lastConfidence: clamp(raw.lastConfidence, 0, 1),
    timeline: (Array.isArray(raw.timeline) ? raw.timeline : []).slice(-120),
    appliedEvents: (Array.isArray(raw.appliedEvents) ? raw.appliedEvents : []).map(String).slice(-1000),
  }
}

/** Return a decayed view. Reading never rewrites the state file. */
export function decayedAffect(state, config = {}, now = Date.now()) {
  const out = normalizeAffect(state, config, now)
  const hours = Math.max(0, now - out.updatedAt) / 3600000
  const halfLife = clamp(config?.回稳半衰期小时, 1, 72, 8)
  const factor = Math.pow(0.5, hours / halfLife)
  out.valence = out.baseline + (out.valence - out.baseline) * factor
  out.arousal = 35 + (out.arousal - 35) * factor
  for (const key of Object.keys(out.dimensions)) out.dimensions[key] *= factor
  out.updatedAt = now
  return out
}

export function readAffect(config = {}, now = Date.now()) {
  try { return decayedAffect(JSON.parse(readFileSync(affectPath(), 'utf8')), config, now) } catch {
    try { return decayedAffect(JSON.parse(readFileSync(affectPath() + '.bak', 'utf8')), config, now) } catch { return defaultAffect(config, now) }
  }
}

function writeAffect(value) {
  try { if (existsSync(affectPath())) writeFileSync(affectPath() + '.bak', readFileSync(affectPath())) } catch {}
  atomicJson(affectPath(), value)
  return value
}

export function resetAffect(config = {}, now = Date.now()) { return writeAffect(defaultAffect(config, now)) }

export function normalizeReflection(raw) {
  if (!raw || typeof raw !== 'object') return null
  const affect = raw.affect && typeof raw.affect === 'object' ? raw.affect : raw
  const reason = text(affect.reason, 160)
  if (!reason) return null
  const dims = affect.dimensions && typeof affect.dimensions === 'object' ? affect.dimensions : {}
  const cognition = normalizeCognition(raw)
  return {
    affect: {
      valenceDelta: clamp(affect.valenceDelta, -12, 12),
      arousalDelta: clamp(affect.arousalDelta, -12, 12),
      dimensions: {
        joy: clamp(dims.joy, 0, 20), calm: clamp(dims.calm, 0, 20),
        worry: clamp(dims.worry, 0, 20), sadness: clamp(dims.sadness, 0, 20),
      },
      reason,
      confidence: clamp(affect.confidence, 0, 1, 0.5),
    },
    ...cognition,
  }
}

export function applyReflection(eventId, reflection, config = {}, now = Date.now()) {
  const id = text(eventId, 100)
  if (!id || !reflection?.affect) return { applied: false, state: readAffect(config, now) }
  const state = readAffect(config, now)
  if (state.appliedEvents.includes(id)) return { applied: false, state }
  const a = reflection.affect
  state.valence = clamp(state.valence + a.valenceDelta, 0, 100, state.valence)
  state.arousal = clamp(state.arousal + a.arousalDelta, 0, 100, state.arousal)
  for (const key of Object.keys(state.dimensions)) state.dimensions[key] = clamp(state.dimensions[key] + Number(a.dimensions?.[key] || 0), 0, 100)
  state.lastEventAt = now
  state.lastReason = text(a.reason, 160)
  state.lastDelta = a.valenceDelta
  state.lastConfidence = a.confidence
  state.updatedAt = now
  state.appliedEvents = [...state.appliedEvents, id].slice(-1000)
  state.timeline = [...state.timeline, {
    eventId: id, at: now, valence: Math.round(state.valence * 10) / 10,
    arousal: Math.round(state.arousal * 10) / 10, delta: a.valenceDelta,
    reason: state.lastReason, confidence: a.confidence,
  }].slice(-120)
  return { applied: true, state: writeAffect(state) }
}

export function affectLabel(state) {
  const v = Number(state?.valence) || 50
  const a = Number(state?.arousal) || 35
  if (v <= 30 && a >= 55) return '烦躁紧绷'
  if (v <= 35) return '有点低落'
  if (v >= 72 && a >= 55) return '兴奋开心'
  if (v >= 68) return '心情不错'
  if (a >= 65) return '有点亢奋'
  if (a <= 22) return '安静松弛'
  return '平静普通'
}

export function affectContext(state, config = {}, now = Date.now()) {
  const view = decayedAffect(state, config, now)
  const threshold = clamp(config?.注入阈值, 1, 20, 6)
  const significant = Math.abs(view.valence - view.baseline) >= threshold || Math.abs(view.arousal - 35) >= threshold || (view.lastEventAt && now - view.lastEventAt < 2 * 3600000 && Math.abs(view.lastDelta) >= threshold)
  if (!significant) return ''
  const reason = view.lastReason ? `，主要因为${view.lastReason}` : ''
  return `（此刻内在状态）${affectLabel(view)}${reason}。这是情绪底色，不要逐字播报，也不要让它覆盖事实与用户指令。`
}

function eventPath(date) { return join(eventsDir(), `${date}.json`) }

export function readEvents({ date, timeZone = 'Asia/Shanghai', now = Date.now(), limit = 50 } = {}) {
  const day = date || localDate(now, timeZone)
  try {
    const value = JSON.parse(readFileSync(eventPath(day), 'utf8'))
    return (Array.isArray(value?.events) ? value.events : []).slice(-Math.max(1, Math.min(200, limit)))
  } catch { return [] }
}

export function appendEvent(event, { timeZone = 'Asia/Shanghai', maxEvents = 300 } = {}) {
  const at = Math.max(0, Number(event?.at) || Date.now())
  const date = text(event?.date, 10) || localDate(at, timeZone)
  const path = eventPath(date)
  let current = { v: 1, date, events: [] }
  try { current = JSON.parse(readFileSync(path, 'utf8')) } catch {}
  current.events = Array.isArray(current.events) ? current.events : []
  const id = text(event?.id, 100) || randomUUID()
  if (current.events.some((x) => x.id === id)) return { added: false, event: current.events.find((x) => x.id === id) }
  const clean = {
    id, at, type: text(event?.type, 40) || 'unknown', source: text(event?.source, 60),
    status: ['applied', 'failed', 'settled'].includes(event?.status) ? event.status : 'applied',
    reason: text(event?.reason, 180), model: text(event?.model, 100),
    affect: event?.affect ? copy(event.affect) : undefined,
    memoryCandidates: (Array.isArray(event?.memoryCandidates) ? event.memoryCandidates : []).slice(0, 3).map((item) => item?.sensitivity === 'normal' ? item : { ...item, summary: '[隐私候选已拦截]' }),
    relationshipCandidates: (Array.isArray(event?.relationshipCandidates) ? event.relationshipCandidates : []).slice(0, 3).map((x) => safeCandidate(x, ['person', 'reason'])),
    preferenceCandidates: (Array.isArray(event?.preferenceCandidates) ? event.preferenceCandidates : []).slice(0, 4).map((x) => safeCandidate(x, ['key', 'value', 'evidence'])),
    goalCandidates: (Array.isArray(event?.goalCandidates) ? event.goalCandidates : []).slice(0, 2).map((x) => safeCandidate(x, ['title', 'reason', 'nextStep'])),
    identityEvidence: (Array.isArray(event?.identityEvidence) ? event.identityEvidence : []).slice(0, 3).map((x) => safeCandidate(x, ['trait', 'reason'])),
    initiative: event?.initiative && typeof event.initiative === 'object' ? safeCandidate(event.initiative, ['reason', 'topic']) : undefined,
    usage: event?.usage && typeof event.usage === 'object' ? copy(event.usage) : undefined,
    meta: event?.meta && typeof event.meta === 'object' ? copy(event.meta) : undefined,
  }
  current.events = [...current.events, clean].slice(-Math.max(20, Math.min(1000, maxEvents)))
  current.v = 1; current.date = date
  atomicJson(path, current)
  return { added: true, event: clean }
}

export function eventId(parts) {
  return createHash('sha256').update(parts.map((x) => String(x || '')).join('\u241f')).digest('hex').slice(0, 32)
}

export function eventText(value) {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(eventText).filter(Boolean).join('\n').trim()
  if (!value || typeof value !== 'object') return ''
  if (value.type === 'text' && typeof value.text === 'string') return value.text.trim()
  for (const key of ['content', 'message', 'item', 'event', 'value', 'data']) {
    const found = eventText(value[key])
    if (found) return found
  }
  return ''
}

export function sourceKind(value) {
  const source = value?.source || value?.message?.source || value?.item?.source || value?.event?.source || value?.data?.message?.source || value?.data?.item?.source
  const kind = text(source?.kind || value?.kind || '', 60).toLowerCase()
  if (kind === 'plugin' && source?.plugin) return text(source.plugin, 60).toLowerCase()
  return kind || text(source?.plugin || '', 60).toLowerCase()
}

export function shouldReflect(mode, userText, replyText, kind = '') {
  if (mode === '关闭') return false
  const user = text(userText, 2000)
  const reply = text(replyText, 2000)
  if (!user || !reply) return false
  if (/runtime-context|time-context|system|tool-result|feiyu-life-initiative|speak-up/.test(kind)) return false
  if (mode === '每轮') return true
  return user.length >= 8 || /[？！!?]|难过|开心|喜欢|讨厌|害怕|焦虑|生气|谢谢|对不起|想你|爱你|承诺|记住|以后|明天|昨天|今天/.test(user)
}

export function buildReflectionPrompt({ userText, replyText, source = 'human' }) {
  return [
    '请复盘刚结束的一轮对话。你不是在回复用户，而是在更新角色的内在状态。',
    '只根据本轮文本判断，不补写事实；计划、假设和玩笑不算已经发生。',
    '所有候选都只是证据：必须忠于本轮文字，敏感信息标 sensitive，没明确表达的用户偏好和目标不得标 explicit。',
    '目标只允许 scope=virtual 或 local；现实行动、联系他人、消费、任意文件操作都不能成为自主目标。',
    `来源：${text(source, 40) || 'human'}`,
    `用户输入：${text(userText, 700)}`,
    `角色回复：${text(replyText, 700)}`,
    'JSON 要紧凑、一行输出；候选数组可以为空（[]），不要为了让数组非空而编造；不要输出解释或代码块。',
    '',
    '只输出 JSON：',
    '{"affect":{"valenceDelta":-12到12,"arousalDelta":-12到12,"dimensions":{"joy":0到20,"calm":0到20,"worry":0到20,"sadness":0到20},"reason":"一句可审计的变化原因","confidence":0到1},"memoryCandidates":[{"summary":"可独立理解的候选","kind":"episode|fact|preference|promise|relationship","subject":"user|self|relationship|world","importance":0到1,"confidence":0到1,"sensitivity":"normal|private|sensitive","explicit":false,"ttlDays":365}],"preferenceCandidates":[{"owner":"self|user","key":"偏好方面","value":"偏好内容","confidence":0到1,"evidence":"证据","explicit":false}],"goalCandidates":[{"title":"目标","reason":"原因","nextStep":"下一步","scope":"virtual|local","confidence":0到1,"explicit":false}],"identityEvidence":[{"trait":"特质","polarity":"for|against","reason":"证据","confidence":0到1}],"relationshipCandidates":[{"person":"对方称呼","tone":"warm|neutral|tense","reason":"原因"}],"initiative":{"desire":0到1,"reason":"想主动说的原因","topic":"以后可自然提起的话题"}}',
  ].join('\n')
}

function parseJson(value) {
  const raw = String(value || '').replace(/```(?:json|JSON)?/g, '').trim()
  try { return JSON.parse(raw) } catch {}
  // 从第一个 { 开始做括号匹配，避开前后解释文字；字符串内的花括号不计
  const start = raw.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try { return JSON.parse(raw.slice(start, i + 1)) } catch { return null }
      }
    }
  }
  return null
}

export async function reflectTurn(ctx, agent, { userText, replyText, source = 'human', config = {}, timeoutSeconds = 45 } = {}) {
  const override = config?.反思Provider && config?.反思模型 ? { 模型: { provider: config.反思Provider, model: config.反思模型 } } : {}
  const target = pickModel(agent, override)
  if (!target || !ctx?.llm?.stream) throw new Error('reflection model unavailable')
  const req = {
    provider: target.provider, model: target.model,
    system: '你是角色状态复盘器。只输出严格 JSON，不与用户对话。',
    messages: [{ role: 'user', id: randomUUID(), content: [{ type: 'text', text: buildReflectionPrompt({ userText, replyText, source }) }], source: { kind: 'plugin', plugin: 'dsh-feiyu-life' } }],
    sessionId: String(agent?.session?.id || ''), maxTokens: 1800, temperature: 0.2, reasoningEffort: 'low',
  }
  let out = ''; let usage
  const timeoutMs = clamp(timeoutSeconds, 10, 120, 45) * 1000
  for await (const chunk of withStreamTimeout(ctx.llm.stream(req), timeoutMs, 'turn reflection model')) {
    if (chunk?.type === 'text-delta') out += chunk.text || ''
    else if (chunk?.type === 'usage') usage = chunk.usage
    else if (chunk?.type === 'finish' && ['error', 'aborted'].includes(chunk.reason?.kind)) throw new Error(`reflection ${chunk.reason.kind}`)
  }
  const reflection = normalizeReflection(parseJson(out))
  if (!reflection) throw new Error('invalid reflection JSON')
  return { reflection, usage, model: `${target.provider}/${target.model}` }
}

export function reflectionUsage(config = {}, now = Date.now(), timeZone = 'Asia/Shanghai') {
  const events = readEvents({ now, timeZone, limit: 300 })
  const attempted = events.filter((x) => x.type === 'turn.reflection' && ['applied', 'failed'].includes(x.status)).length
  return { attempted, limit: Math.round(clamp(config?.每日反思上限, 1, 200, 30)), remaining: Math.max(0, Math.round(clamp(config?.每日反思上限, 1, 200, 30)) - attempted) }
}

export function recordLifeSettlement(date, result, { timeZone = 'Asia/Shanghai', now = Date.now() } = {}) {
  const applied = Math.max(0, Number(result?.applied) || 0)
  if (!applied) return { added: false }
  const ids = Array.isArray(result?.effectIds) ? result.effectIds
    : (Array.isArray(result?.state?.appliedEffects) ? result.state.appliedEffects.slice(-applied) : [])
  const id = eventId(['life.settled', date, ...ids, applied])
  return appendEvent({ id, date, at: now, type: 'life.settled', source: 'final-timeline', status: 'settled', reason: `最终真实时间线结算了 ${applied} 项变化`, meta: { applied } }, { timeZone })
}

export function cleanupEvents(retentionDays = 180, now = Date.now()) {
  const cutoff = now - Math.max(7, Number(retentionDays) || 180) * 86400000
  let removed = 0
  try {
    for (const name of readdirSync(eventsDir())) {
      if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) continue
      const path = join(eventsDir(), name)
      if (statSync(path).mtimeMs < cutoff) { unlinkSync(path); removed++ }
    }
  } catch {}
  return removed
}
