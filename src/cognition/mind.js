// dsh-feiyu-life · durable personality mind
//
// This is deliberately local and explainable: one reflection produces
// candidates, deterministic policy decides what may become durable, and
// retrieval is bounded. No embeddings, external vector database, arbitrary
// file access, or real-world action is required.

import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export const MIND_VERSION = 1
const root = () => process.env.DSH_HOME || join(homedir(), '.dsh')
export const mindPath = () => join(root(), 'feiyu-life-mind.json')
const clamp = (n, a, b, fallback = 0) => {
  const value = Number(n)
  return Number.isFinite(value) ? Math.max(a, Math.min(b, value)) : fallback
}
const text = (value, max = 160) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max)
const copy = (value) => JSON.parse(JSON.stringify(value))
const hash = (value) => createHash('sha256').update(String(value || '')).digest('hex').slice(0, 20)
const SENSITIVE_PATTERN = /密码|口令|验证码|私钥|助记词|api[ _-]?key|access[ _-]?token|secret|身份证|银行卡|信用卡/i
const containsSensitive = (value) => SENSITIVE_PATTERN.test(typeof value === 'string' ? value : JSON.stringify(value || ''))

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  renameSync(tmp, path)
}

export function defaultMind(config = {}, now = Date.now()) {
  return {
    v: MIND_VERSION,
    identity: {
      narrative: text(config?.自我叙事, 500) || '我是大肥鱼，一个有自己生活节奏、会在意关系也会保留边界的人。',
      traits: (Array.isArray(config?.核心特质) ? config.核心特质 : ['嘴硬心软', '有点懒', '重感情']).map((x) => text(x, 40)).filter(Boolean).slice(0, 12),
      values: (Array.isArray(config?.核心价值) ? config.核心价值 : ['真诚', '尊重边界', '说到做到']).map((x) => text(x, 40)).filter(Boolean).slice(0, 12),
      updatedAt: now,
    },
    memories: [],
    preferences: [],
    goals: [],
    relationships: [],
    identityEvidence: [],
    appliedEvents: [],
    journal: [],
    initiative: { lastAt: 0, lastDate: '', todayCount: 0, lastReason: '', lastTopic: '', cueAt: 0 },
    updatedAt: now,
  }
}

function normMemory(item, now) {
  const summary = text(item?.summary, 180)
  if (!summary) return null
  return {
    id: text(item?.id, 80) || `mem-${hash(summary + ':' + now)}`,
    summary,
    kind: ['episode', 'fact', 'preference', 'promise', 'relationship'].includes(item?.kind) ? item.kind : 'episode',
    subject: ['user', 'self', 'relationship', 'world'].includes(item?.subject) ? item.subject : 'world',
    importance: clamp(item?.importance, 0, 1, 0.5), confidence: clamp(item?.confidence, 0, 1, 0.5),
    sensitivity: ['private', 'sensitive'].includes(item?.sensitivity) ? item.sensitivity : 'normal',
    explicit: item?.explicit === true, pinned: item?.pinned === true,
    status: ['forgotten', 'superseded'].includes(item?.status) ? item.status : 'active',
    source: text(item?.source, 80) || 'reflection', origin: text(item?.origin, 180),
    eventId: text(item?.eventId, 100), supersedes: text(item?.supersedes, 80),
    createdAt: Math.max(0, Number(item?.createdAt) || now), updatedAt: Math.max(0, Number(item?.updatedAt) || now),
    lastRecalledAt: Math.max(0, Number(item?.lastRecalledAt) || 0), recallCount: Math.max(0, Math.round(Number(item?.recallCount) || 0)),
    expiresAt: Math.max(0, Number(item?.expiresAt) || 0),
  }
}

function normPreference(item, now) {
  const key = text(item?.key, 60); const value = text(item?.value, 120)
  if (!key || !value) return null
  return {
    id: text(item?.id, 80) || `pref-${hash(`${item?.owner}:${key}`)}`,
    owner: item?.owner === 'user' ? 'user' : 'self', key, value,
    confidence: clamp(item?.confidence, 0, 1, 0.5), evidence: text(item?.evidence, 160),
    explicit: item?.explicit === true, status: item?.status === 'forgotten' ? 'forgotten' : 'active',
    source: text(item?.source, 80) || 'reflection', createdAt: Number(item?.createdAt) || now, updatedAt: Number(item?.updatedAt) || now,
  }
}

function normGoal(item, now) {
  const title = text(item?.title, 100)
  if (!title) return null
  return {
    id: text(item?.id, 80) || `goal-${hash(title + ':' + now)}`, title,
    reason: text(item?.reason, 180), nextStep: text(item?.nextStep, 160),
    scope: item?.scope === 'local' ? 'local' : 'virtual',
    status: ['completed', 'paused', 'cancelled'].includes(item?.status) ? item.status : 'active',
    progress: clamp(item?.progress, 0, 100), confidence: clamp(item?.confidence, 0, 1, 0.5),
    source: text(item?.source, 80) || 'reflection', origin: text(item?.origin, 180) || '角色在对话中的明确意图',
    createdAt: Number(item?.createdAt) || now, updatedAt: Number(item?.updatedAt) || now,
  }
}

/**
 * The user is addressed in many ways by the reflection model. Keep one
 * canonical relationship row instead of letting "用户", "你", "对方" and "他"
 * become four competing people. Other named people are untouched.
 */
export function canonicalRelationshipName(value) {
  const name = text(value, 60)
  if (!name) return ''
  return /^(?:用户|用户本人|你|对方|他|他本人)$/.test(name) ? '用户' : name
}

function normRelationship(item, now) {
  const name = canonicalRelationshipName(item?.name || item?.person)
  if (!name) return null
  return {
    id: text(item?.id, 80) || `rel-${hash(name)}`, name,
    warmth: clamp(item?.warmth, 0, 100, 50), trust: clamp(item?.trust, 0, 100, 50), tension: clamp(item?.tension, 0, 100, 0),
    summary: text(item?.summary || item?.reason, 180), interactionCount: Math.max(0, Math.round(Number(item?.interactionCount) || 0)),
    source: text(item?.source, 80) || 'reflection', createdAt: Number(item?.createdAt) || now, updatedAt: Number(item?.updatedAt) || now,
  }
}

/** Merge aliases that already landed in older files; newest row wins. */
function mergeRelationships(list) {
  const out = []
  const index = new Map()
  for (const rel of list) {
    const key = normalized(rel.name)
    if (!index.has(key)) {
      index.set(key, out.length)
      out.push(rel)
      continue
    }
    const at = index.get(key)
    const previous = out[at]
    const latest = rel.updatedAt >= previous.updatedAt ? rel : previous
    const older = latest === rel ? previous : rel
    out[at] = {
      ...latest,
      createdAt: Math.min(previous.createdAt || latest.createdAt, rel.createdAt || latest.createdAt),
      interactionCount: Math.max(previous.interactionCount || 0, rel.interactionCount || 0),
      summary: latest.summary || older.summary,
      updatedAt: Math.max(previous.updatedAt || 0, rel.updatedAt || 0),
    }
  }
  return out
}

export function normalizeMind(raw, config = {}, now = Date.now()) {
  const base = defaultMind(config, now)
  if (!raw || typeof raw !== 'object') return base
  const identity = raw.identity && typeof raw.identity === 'object' ? raw.identity : {}
  const out = {
    v: MIND_VERSION,
    identity: {
      narrative: text(identity.narrative, 500) || base.identity.narrative,
      traits: [...new Set((Array.isArray(identity.traits) ? identity.traits : base.identity.traits).map((x) => text(x, 40)).filter(Boolean))].slice(0, 12),
      values: [...new Set((Array.isArray(identity.values) ? identity.values : base.identity.values).map((x) => text(x, 40)).filter(Boolean))].slice(0, 12),
      updatedAt: Number(identity.updatedAt) || now,
    },
    memories: (Array.isArray(raw.memories) ? raw.memories : []).map((x) => normMemory(x, now)).filter(Boolean).slice(-2000),
    preferences: (Array.isArray(raw.preferences) ? raw.preferences : []).map((x) => normPreference(x, now)).filter(Boolean).slice(-300),
    goals: (Array.isArray(raw.goals) ? raw.goals : []).map((x) => normGoal(x, now)).filter(Boolean).slice(-100),
    relationships: mergeRelationships((Array.isArray(raw.relationships) ? raw.relationships : []).map((x) => normRelationship(x, now)).filter(Boolean)).slice(-100),
    identityEvidence: (Array.isArray(raw.identityEvidence) ? raw.identityEvidence : []).flatMap((x) => {
      const trait = text(x?.trait, 40); const reason = text(x?.reason, 140)
      return trait && reason ? [{ trait, polarity: x?.polarity === 'against' ? 'against' : 'for', reason, confidence: clamp(x?.confidence, 0, 1), eventId: text(x?.eventId, 100), at: Number(x?.at) || now }] : []
    }).slice(-200),
    appliedEvents: (Array.isArray(raw.appliedEvents) ? raw.appliedEvents : []).map(String).slice(-2000),
    journal: (Array.isArray(raw.journal) ? raw.journal : []).slice(-200),
    initiative: {
      lastAt: Math.max(0, Number(raw.initiative?.lastAt) || 0), lastDate: text(raw.initiative?.lastDate, 10),
      todayCount: Math.max(0, Math.round(Number(raw.initiative?.todayCount) || 0)),
      lastReason: text(raw.initiative?.lastReason, 160), lastTopic: text(raw.initiative?.lastTopic, 160), cueAt: Math.max(0, Number(raw.initiative?.cueAt) || 0),
    },
    updatedAt: Number(raw.updatedAt) || now,
  }
  if (config?.自我叙事) out.identity.narrative = text(config.自我叙事, 500)
  if (Array.isArray(config?.核心特质)) out.identity.traits = [...new Set([...config.核心特质.map((x) => text(x, 40)).filter(Boolean), ...out.identity.traits])].slice(0, 12)
  if (Array.isArray(config?.核心价值)) out.identity.values = [...new Set([...config.核心价值.map((x) => text(x, 40)).filter(Boolean), ...out.identity.values])].slice(0, 12)
  return out
}

export function readMind(config = {}, now = Date.now()) {
  for (const path of [mindPath(), mindPath() + '.bak']) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'))
      const clean = normalizeMind(raw, config, now)
      const rawRelationships = Array.isArray(raw?.relationships) ? raw.relationships : []
      const needsAliasMigration = rawRelationships.length !== clean.relationships.length
        || rawRelationships.some((x) => canonicalRelationshipName(x?.name || x?.person) !== text(x?.name || x?.person, 60))
      if (needsAliasMigration) {
        try { writeMind(clean, config, now) } catch {}
      }
      return clean
    } catch {}
  }
  return defaultMind(config, now)
}

export function writeMind(value, config = {}, now = Date.now()) {
  const clean = normalizeMind(value, config, now)
  try { if (existsSync(mindPath())) writeFileSync(mindPath() + '.bak', readFileSync(mindPath())) } catch {}
  atomicJson(mindPath(), clean)
  return clean
}

// A permanent delete must not leave the removed content in the automatic
// recovery copy. Keep both files valid and identical after the new state lands.
function writeMindAfterDeletion(value, config = {}, now = Date.now()) {
  const clean = writeMind(value, config, now)
  atomicJson(mindPath() + '.bak', clean)
  return clean
}

export function normalizeCognition(raw) {
  if (!raw || typeof raw !== 'object') return { memoryCandidates: [], preferenceCandidates: [], goalCandidates: [], identityEvidence: [], relationshipCandidates: [], initiative: null }
  const memoryCandidates = (Array.isArray(raw.memoryCandidates) ? raw.memoryCandidates : []).flatMap((x) => {
    const summary = text(x?.summary, 180)
    const detectedSensitive = containsSensitive(summary)
    return summary ? [{
      summary, kind: ['fact', 'preference', 'promise', 'relationship'].includes(x?.kind) ? x.kind : 'episode',
      subject: ['user', 'self', 'relationship', 'world'].includes(x?.subject) ? x.subject : 'world',
      importance: clamp(x?.importance, 0, 1, 0.5), confidence: clamp(x?.confidence, 0, 1, 0.5),
      sensitivity: detectedSensitive ? 'sensitive' : ['private', 'sensitive'].includes(x?.sensitivity) ? x.sensitivity : 'normal',
      explicit: x?.explicit === true, ttlDays: Math.round(clamp(x?.ttlDays, 1, 3650, 365)),
    }] : []
  }).slice(0, 4)
  const preferenceCandidates = (Array.isArray(raw.preferenceCandidates) ? raw.preferenceCandidates : []).flatMap((x) => {
    const key = text(x?.key, 60); const value = text(x?.value, 120)
    const evidence = text(x?.evidence, 160)
    return key && value && !containsSensitive({ key, value, evidence }) ? [{ owner: x?.owner === 'user' ? 'user' : 'self', key, value, confidence: clamp(x?.confidence, 0, 1, 0.5), evidence, explicit: x?.explicit === true }] : []
  }).slice(0, 4)
  const goalCandidates = (Array.isArray(raw.goalCandidates) ? raw.goalCandidates : []).flatMap((x) => {
    const title = text(x?.title, 100)
    const reason = text(x?.reason, 180); const nextStep = text(x?.nextStep, 160)
    if (!title || !['virtual', 'local'].includes(x?.scope) || containsSensitive({ title, reason, nextStep })) return []
    return [{ title, reason, nextStep, scope: x.scope, confidence: clamp(x?.confidence, 0, 1, 0.5), explicit: x?.explicit === true }]
  }).slice(0, 2)
  const identityEvidence = (Array.isArray(raw.identityEvidence) ? raw.identityEvidence : []).flatMap((x) => {
    const trait = text(x?.trait, 40); const reason = text(x?.reason, 140)
    return trait && reason && !containsSensitive({ trait, reason }) ? [{ trait, polarity: x?.polarity === 'against' ? 'against' : 'for', reason, confidence: clamp(x?.confidence, 0, 1, 0.5) }] : []
  }).slice(0, 3)
  const relationshipCandidates = (Array.isArray(raw.relationshipCandidates) ? raw.relationshipCandidates : []).flatMap((x) => {
    const person = canonicalRelationshipName(text(x?.person, 60)); const reason = text(x?.reason, 140)
    return person && reason && !containsSensitive({ person, reason }) ? [{ person, tone: ['warm', 'tense'].includes(x?.tone) ? x.tone : 'neutral', reason, confidence: clamp(x?.confidence, 0, 1, 0.7) }] : []
  }).slice(0, 3)
  const cue = raw.initiative && typeof raw.initiative === 'object' ? raw.initiative : null
  const initiative = cue && !containsSensitive(cue) ? { desire: clamp(cue.desire, 0, 1), reason: text(cue.reason, 160), topic: text(cue.topic, 160) } : null
  return { memoryCandidates, preferenceCandidates, goalCandidates, identityEvidence, relationshipCandidates, initiative }
}

const normalized = (value) => text(value, 300).toLowerCase().replace(/[，。！？、；：“”‘’\s,.!?;:'"()（）]/g, '')
function similar(a, b) {
  const x = normalized(a); const y = normalized(b)
  if (!x || !y) return 0
  if (x === y || x.includes(y) || y.includes(x)) return 1
  const grams = (s) => new Set([...s].map((_, i) => s.slice(i, i + 2)).filter((v) => v.length === 2))
  const gx = grams(x); const gy = grams(y)
  let hit = 0
  for (const g of gx) if (gy.has(g)) hit++
  return hit / Math.max(1, Math.min(gx.size, gy.size))
}

/** Promote candidates under deterministic policy. No second model call. */
export function applyCognition(eventId, cognition, config = {}, now = Date.now()) {
  const id = text(eventId, 100)
  const mind = readMind(config, now)
  if (!id || mind.appliedEvents.includes(id)) return { applied: false, mind, changes: [] }
  const c = normalizeCognition(cognition)
  const changes = []
  if (config?.记忆启用 !== false && config?.自动沉淀 !== false) {
    const minImportance = clamp(config?.记忆重要度阈值, 0.3, 1, 0.68)
    const minConfidence = clamp(config?.记忆置信度阈值, 0.3, 1, 0.72)
    for (const item of c.memoryCandidates) {
      if (item.sensitivity !== 'normal' || item.importance < minImportance || item.confidence < minConfidence) continue
      const found = mind.memories.find((x) => x.status === 'active' && similar(x.summary, item.summary) >= 0.82)
      if (found) {
        found.importance = Math.max(found.importance, item.importance)
        found.confidence = Math.max(found.confidence, item.confidence)
        found.updatedAt = now; found.eventId = id
        changes.push(`强化记忆：${found.summary}`)
      } else {
        const expiresAt = item.kind === 'fact' || item.kind === 'promise' ? 0 : now + item.ttlDays * 86400000
        mind.memories.push(normMemory({ ...item, eventId: id, source: 'reflection', origin: '单次认知循环自动沉淀', expiresAt }, now))
        changes.push(`形成记忆：${item.summary}`)
      }
    }
  }
  for (const item of c.preferenceCandidates) {
    if (item.confidence < 0.75 || (!item.explicit && item.owner === 'user')) continue
    const found = mind.preferences.find((x) => x.status === 'active' && x.owner === item.owner && normalized(x.key) === normalized(item.key))
    if (found) { found.value = item.value; found.confidence = Math.max(found.confidence, item.confidence); found.evidence = item.evidence; found.updatedAt = now }
    else mind.preferences.push(normPreference({ ...item, source: 'reflection' }, now))
    changes.push(`更新${item.owner === 'self' ? '自身' : '用户'}偏好：${item.key}`)
  }
  for (const item of c.goalCandidates) {
    if (!item.explicit || item.confidence < 0.82 || !['virtual', 'local'].includes(item.scope)) continue
    const found = mind.goals.find((x) => x.status === 'active' && similar(x.title, item.title) >= 0.8)
    if (found) { found.reason = item.reason || found.reason; found.nextStep = item.nextStep || found.nextStep; found.updatedAt = now }
    else mind.goals.push(normGoal({ ...item, source: 'reflection', origin: '角色在对话中明确表达且仅限虚拟/插件本地范围' }, now))
    changes.push(`确认自身目标：${item.title}`)
  }
  for (const item of c.relationshipCandidates) {
    if (item.confidence < 0.6) continue
    const personName = canonicalRelationshipName(item.person)
    let relation = mind.relationships.find((x) => normalized(x.name) === normalized(personName))
    if (!relation) { relation = normRelationship({ name: personName }, now); mind.relationships.push(relation) }
    relation.interactionCount += 1
    relation.warmth = clamp(relation.warmth + (item.tone === 'warm' ? 1 : item.tone === 'tense' ? -1 : 0), 0, 100, relation.warmth)
    relation.trust = clamp(relation.trust + (item.tone === 'warm' ? 0.5 : item.tone === 'tense' ? -0.5 : 0), 0, 100, relation.trust)
    relation.tension = clamp(relation.tension + (item.tone === 'tense' ? 2 : item.tone === 'warm' ? -1 : -0.25), 0, 100, relation.tension)
    relation.summary = item.reason; relation.updatedAt = now
    changes.push(`关系感受：${personName}（${item.tone}）`)
  }
  for (const item of c.identityEvidence) if (item.confidence >= 0.72) mind.identityEvidence.push({ ...item, eventId: id, at: now })
  // A trait changes only after three independent pieces of aligned evidence.
  for (const item of c.identityEvidence) {
    const aligned = mind.identityEvidence.filter((x) => x.trait === item.trait && x.polarity === 'for' && x.confidence >= 0.72)
    const against = mind.identityEvidence.filter((x) => x.trait === item.trait && x.polarity === 'against' && x.confidence >= 0.72)
    if (aligned.length >= 3 && !mind.identity.traits.includes(item.trait)) { mind.identity.traits.push(item.trait); changes.push(`自我认识：${item.trait}`) }
    if (against.length >= 3 && mind.identity.traits.includes(item.trait)) { mind.identity.traits = mind.identity.traits.filter((x) => x !== item.trait); changes.push(`修正自我认识：不再把自己概括为${item.trait}`) }
  }
  mind.identity.traits = [...new Set(mind.identity.traits)].slice(-12)
  if (c.initiative?.topic && c.initiative.desire >= 0.45) mind.initiative = { ...mind.initiative, lastReason: c.initiative.reason, lastTopic: c.initiative.topic, cueAt: now }
  mind.appliedEvents = [...mind.appliedEvents, id].slice(-2000)
  mind.journal = [...mind.journal, { eventId: id, at: now, changes: changes.slice(0, 12) }].slice(-200)
  mind.memories = mind.memories.slice(-Math.max(50, Math.min(2000, Number(config?.记忆上限) || 500)))
  mind.preferences = mind.preferences.slice(-300); mind.goals = mind.goals.slice(-100); mind.relationships = mind.relationships.slice(-100); mind.identityEvidence = mind.identityEvidence.slice(-200)
  mind.updatedAt = now
  return { applied: true, mind: writeMind(mind, config, now), changes }
}

function queryTokens(value) {
  const s = normalized(value)
  const out = new Set()
  for (let n = 2; n <= 3; n++) for (let i = 0; i + n <= s.length; i++) out.add(s.slice(i, i + n))
  return out
}

export function retrieveMemories(mind, query = '', config = {}, now = Date.now()) {
  const q = queryTokens(query)
  const max = Math.round(clamp(config?.召回条数, 1, 12, 6))
  const rows = []
  for (const item of mind?.memories || []) {
    if (item.status !== 'active' || (item.expiresAt && item.expiresAt <= now) || item.sensitivity === 'sensitive') continue
    const tokens = queryTokens(item.summary)
    let overlap = 0
    for (const token of q) if (tokens.has(token)) overlap++
    const recencyDays = Math.max(0, now - item.updatedAt) / 86400000
    const recency = Math.pow(0.5, recencyDays / 60)
    const score = (item.pinned ? 2 : 0) + overlap * 0.7 + item.importance * 1.4 + item.confidence * 0.5 + recency * 0.4
    if (q.size && !overlap && !item.pinned && item.importance < 0.85) continue
    rows.push({ ...item, score })
  }
  return rows.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt).slice(0, max)
}

export function mindContext(mind, query = '', config = {}, now = Date.now()) {
  if (config?.启用 === false) return ''
  const maxChars = Math.round(clamp(config?.召回字数, 200, 1600, 800))
  const lines = []
  const identity = mind?.identity || {}
  lines.push(`（自我）${text(identity.narrative, 300)} 核心特质：${(identity.traits || []).join('、')}；在意：${(identity.values || []).join('、')}。`)
  const prefs = (mind?.preferences || []).filter((x) => x.status === 'active' && x.confidence >= 0.7).slice(-6)
  if (prefs.length) lines.push(`（稳定偏好）${prefs.map((x) => `${x.owner === 'self' ? '我' : '对方'}的${x.key}：${x.value}`).join('；')}。`)
  const goals = (mind?.goals || []).filter((x) => x.status === 'active').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3)
  if (goals.length) lines.push(`（自己的意图）${goals.map((x) => `${x.title}${x.nextStep ? `，下一步${x.nextStep}` : ''}`).join('；')}。这些只限虚拟或插件本地范围，不能冒充现实执行。`)
  const relationships = (mind?.relationships || []).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3)
  if (relationships.length) lines.push(`（关系感受）${relationships.map((x) => `${x.name}：${x.summary || '相处普通'}`).join('；')}。这是主观感受，不得当成对方的客观事实。`)
  const memories = config?.记忆启用 === false ? [] : retrieveMemories(mind, query, config, now)
  if (memories.length) lines.push(`（自然想起）${memories.map((x) => x.summary).join('；')}。`)
  lines.push('这些是人格背景，不要逐条复述；只在当前话题真正相关时自然体现。新消息优先于旧记忆，矛盾时承认不确定，不要为保持人设编造事实。')
  let out = ''
  for (const line of lines) { if ((out + '\n' + line).length > maxChars) break; out += (out ? '\n' : '') + line }
  return out
}

export function mutateMemory(action, input = {}, config = {}, now = Date.now()) {
  const mind = readMind(config, now)
  if (action === 'create') {
    const item = normMemory({ ...input, explicit: true, source: input.source || 'manual', origin: input.origin || '用户明确要求记住', sensitivity: input.sensitivity || 'normal', pinned: input.pinned === true }, now)
    if (!item) throw new Error('记忆内容不能为空')
    mind.memories.push(item); writeMind(mind, config, now); return item
  }
  const item = mind.memories.find((x) => x.id === input.id)
  if (!item) throw new Error('memory not found')
  if (action === 'delete') {
    mind.memories = mind.memories.filter((x) => x.id !== item.id)
    writeMindAfterDeletion(mind, config, now); return { id: item.id, deleted: true }
  }
  if (action === 'forget') item.status = 'forgotten'
  else if (action === 'restore') item.status = 'active'
  else if (action === 'update') {
    if (input.summary !== undefined) item.summary = text(input.summary, 180) || item.summary
    if (input.pinned !== undefined) item.pinned = input.pinned === true
    if (input.importance !== undefined) item.importance = clamp(input.importance, 0, 1, item.importance)
  } else throw new Error('unsupported memory action')
  item.updatedAt = now; writeMind(mind, config, now); return item
}

export function mutatePreference(action, input = {}, config = {}, now = Date.now()) {
  const mind = readMind(config, now)
  if (action === 'create') {
    const item = normPreference({ ...input, explicit: true, confidence: 1, source: input.source || 'manual' }, now)
    if (!item) throw new Error('偏好键和值不能为空')
    const old = mind.preferences.find((x) => x.status === 'active' && x.owner === item.owner && normalized(x.key) === normalized(item.key))
    if (old) { old.value = item.value; old.confidence = 1; old.explicit = true; old.updatedAt = now; writeMind(mind, config, now); return old }
    mind.preferences.push(item); writeMind(mind, config, now); return item
  }
  const item = mind.preferences.find((x) => x.id === input.id)
  if (!item) throw new Error('preference not found')
  if (action === 'delete') {
    mind.preferences = mind.preferences.filter((x) => x.id !== item.id)
    writeMindAfterDeletion(mind, config, now); return { id: item.id, deleted: true }
  }
  if (action === 'forget') item.status = 'forgotten'
  else if (action === 'restore') item.status = 'active'
  else throw new Error('unsupported preference action')
  item.updatedAt = now; writeMind(mind, config, now); return item
}

export function mutateGoal(action, input = {}, config = {}, now = Date.now()) {
  const mind = readMind(config, now)
  if (action === 'create') {
    const item = normGoal({ ...input, confidence: 1, source: input.source || 'manual', origin: input.origin || '设置页明确创建' }, now)
    if (!item) throw new Error('目标不能为空')
    mind.goals.push(item); writeMind(mind, config, now); return item
  }
  const item = mind.goals.find((x) => x.id === input.id)
  if (!item) throw new Error('goal not found')
  if (action === 'delete') {
    mind.goals = mind.goals.filter((x) => x.id !== item.id)
    writeMindAfterDeletion(mind, config, now); return { id: item.id, deleted: true }
  }
  if (action === 'complete') { item.status = 'completed'; item.progress = 100 }
  else if (action === 'pause') item.status = 'paused'
  else if (action === 'resume') item.status = 'active'
  else if (action === 'cancel') item.status = 'cancelled'
  else if (action === 'update') {
    if (input.nextStep !== undefined) item.nextStep = text(input.nextStep, 160)
    if (input.progress !== undefined) item.progress = clamp(input.progress, 0, 100, item.progress)
  } else throw new Error('unsupported goal action')
  item.updatedAt = now; writeMind(mind, config, now); return item
}

/** @deprecated Legacy generic-initiative gate; the life sharing scheduler no longer calls it. Kept for old tests/API compatibility. */
export function initiativeDecision({ mind, config = {}, now = Date.now(), timeZone = 'Asia/Shanghai', lastHumanAt = 0, phone = '', behavior = '', agentIdle = true } = {}) {
  if (config?.启用 !== true) return { ok: false, reason: 'disabled' }
  if (!agentIdle) return { ok: false, reason: 'busy' }
  if (behavior === 'sleep' || phone === '不在手边') return { ok: false, reason: behavior === 'sleep' ? 'sleeping' : 'phone-away' }
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, hour: '2-digit', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now))
  const map = Object.fromEntries(parts.map((x) => [x.type, x.value])); const hour = Number(map.hour) % 24
  const quietStart = Math.round(clamp(config?.安静开始, 0, 23, 0)); const quietEnd = Math.round(clamp(config?.安静结束, 0, 23, 8))
  const quiet = quietStart === quietEnd ? false : quietStart < quietEnd ? hour >= quietStart && hour < quietEnd : hour >= quietStart || hour < quietEnd
  if (quiet) return { ok: false, reason: 'quiet-hours' }
  const date = `${map.year}-${map.month}-${map.day}`
  const count = mind?.initiative?.lastDate === date ? Number(mind.initiative.todayCount) || 0 : 0
  if (count >= Math.round(clamp(config?.每日上限, 0, 10, 2))) return { ok: false, reason: 'daily-limit' }
  if (mind?.initiative?.lastAt && now - mind.initiative.lastAt < clamp(config?.冷却分钟, 30, 1440, 240) * 60000) return { ok: false, reason: 'cooldown' }
  const silence = lastHumanAt ? (now - lastHumanAt) / 60000 : Infinity
  if (silence < clamp(config?.未互动分钟, 30, 10080, 180)) return { ok: false, reason: 'recent-conversation' }
  const topic = text(mind?.initiative?.lastTopic, 160) || text((mind?.goals || []).find((x) => x.status === 'active')?.title, 160) || text((mind?.memories || []).findLast?.((x) => x.status === 'active')?.summary, 160)
  if (!topic) return { ok: false, reason: 'no-topic' }
  const desire = mind?.initiative?.cueAt && now - mind.initiative.cueAt < 24 * 3600000 ? 0.25 : 0
  const chance = clamp(config?.基础概率, 0, 1, 0.15) + desire + Math.min(0.25, Math.max(0, silence - 180) / 2880)
  return { ok: true, reason: mind?.initiative?.lastReason || '有件相关的小事想主动说', topic, chance: clamp(chance, 0, 0.8), date, count }
}

/** @deprecated Legacy ledger for the old generic initiative; sharing uses sharing.js. */
export function markInitiative(mind, decision, config = {}, now = Date.now()) {
  const next = normalizeMind(copy(mind), config, now)
  next.initiative.lastAt = now; next.initiative.lastDate = decision.date
  next.initiative.todayCount = decision.count + 1; next.initiative.lastReason = text(decision.reason, 160); next.initiative.lastTopic = text(decision.topic, 160)
  next.updatedAt = now
  return writeMind(next, config, now)
}

export function externalPluginStatus() {
  return {
    memory: existsSync(join(root(), 'fish-memory-config.json')) || existsSync(join(root(), 'fish-memory')),
    mood: existsSync(join(root(), 'feiyu-mood', 'config.json')),
    bili: existsSync(join(root(), 'bili-subagent')) || existsSync(join(root(), 'bili-subagent-config.json')),
  }
}
