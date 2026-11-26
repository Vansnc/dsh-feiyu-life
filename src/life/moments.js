// dsh-feiyu-life · today's small things (persisted, deterministic, bounded)
//
// A day plan answers "where is she and what is she doing". It does not give a
// day any texture: the parcel that arrived, the laundry still hanging, the
// edit stuck on one transition. This module keeps 0–2 such threads per date so
// they can continue, finish and stop repeating — without generating a fresh
// set of random events on every turn.
//
// Design rules:
//   · content is generic life texture, never persona copy or names unless the
//     caller explicitly passes known people;
//   · the file stores only template ids, start minutes and an optional known
//     person name, so a tampered file cannot inject arbitrary prompt text;
//   · one file per date, atomic write, hard size cap, retention cleanup;
//   · every choice is seeded by date + recent days, so the same day is stable
//     across restarts and tests can reproduce it.

import { readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { atomicWriteJson, readJsonBounded } from '../persistence/storage.js'

export const MOMENT_VERSION = 1
export const MOMENT_LIMITS = { perDay: 2, stages: 4, fileBytes: 64 * 1024, recentDays: 7 }
const datePattern = /^\d{4}-\d{2}-\d{2}\.json$/

const dshHome = () => process.env.DSH_HOME || join(homedir(), '.dsh')
export const momentsDir = () => join(dshHome(), 'feiyu-life-moments')
export const momentsPath = (ymd) => join(momentsDir(), `${ymd}.json`)

/**
 * Generic small things. `stages[0].after` is ignored; later stages are minutes
 * after the previous one. `window` is the local start-minute range.
 */
export const momentTemplates = [
  {
    id: 'package', title: '快递', weight: 1.4, window: [9 * 60, 12 * 60], notFlat: true,
    stages: [
      { text: '驿站发短信说快递到了，还没去拿' },
      { after: 180, text: '快递拿回来了，箱子搁在门口' },
      { after: 240, text: '箱子拆了，纸壳还没扔' },
    ],
  },
  {
    id: 'laundry', title: '洗衣服', weight: 1.1, window: [8 * 60, 11 * 60],
    stages: [
      { text: '换下来的衣服还在盆里泡着' },
      { after: 150, text: '衣服洗了，挂在阳台' },
      { after: 300, text: '衣服干了，还没收' },
    ],
  },
  {
    id: 'edit', title: '剪片', weight: 1.2, window: [13 * 60, 16 * 60], termOnly: true,
    stages: [
      { text: '片子剪到一半，卡在一个转场上' },
      { after: 150, text: '转场又换了一版，还是别扭' },
      { after: 240, text: '先导出一版，放着明天再看' },
    ],
  },
  {
    id: 'homework', title: '作业', weight: 0.9, window: [14 * 60, 19 * 60], termOnly: true,
    stages: [
      { text: '作业还剩一半，不想动' },
      { after: 120, text: '硬着头皮写了两页' },
      { after: 210, text: '写完了，字丑得不想看' },
    ],
  },
  {
    id: 'libraryBook', title: '借的书', weight: 0.8, window: [10 * 60, 15 * 60], termOnly: true, notFlat: true,
    stages: [
      { text: '图书馆借的书快到还书日了' },
      { after: 180, text: '书翻了一半，笔记没整理' },
      { after: 300, text: '先还了两本，剩一本没看完' },
    ],
  },
  {
    id: 'misplacedEarbuds', title: '找耳机', weight: 0.45, window: [10 * 60, 17 * 60],
    stages: [
      { text: '想听歌，摸了摸常放耳机的口袋，里面是空的' },
      { after: 45, text: '换到另一边口袋才摸到耳机盒' },
    ],
  },
  {
    id: 'charger', title: '充电线', weight: 0.8, window: [10 * 60, 20 * 60],
    stages: [
      { text: '充电线又接触不良，得找角度' },
      { after: 60, text: '换了根线，终于充上了' },
      { after: 120, text: '线缠成一团，塞回抽屉' },
    ],
  },
  {
    id: 'snack', title: '想吃甜的', weight: 1, window: [14 * 60, 18 * 60], bodyOnly: true, notFlat: true,
    stages: [
      { text: '想吃甜的，翻柜子只找到一块饼干' },
      { after: 90, text: '下楼买了杯热的，甜得有点腻' },
      { after: 180, text: '杯子搁在桌角，剩半杯' },
    ],
  },
  {
    id: 'cat', title: '楼下的猫', weight: 1, window: [15 * 60, 18 * 60], outingOnly: true, notFlat: true,
    stages: [
      { text: '楼下那只橘猫又蹲在门口' },
      { after: 60, text: '猫跟着走了两步，又停下' },
      { after: 150, text: '回来时它还在，蹲在台阶上' },
    ],
  },
  {
    id: 'person', title: '和认识的人', weight: 1, window: [17 * 60, 20 * 60], requiresPerson: true,
    stages: [
      { text: '{person}在问晚上吃什么' },
      { after: 60, text: '最后凑单点了同一家' },
      { after: 180, text: '吃完的盒子摞在一起' },
    ],
  },
  {
    id: 'throat', title: '嗓子', weight: 1.2, window: [8 * 60, 14 * 60], coldOnly: true,
    stages: [
      { text: '嗓子发紧，含着颗糖' },
      { after: 120, text: '热水喝了两杯，还是干' },
      { after: 240, text: '说话有点哑，懒得开口' },
    ],
  },
  {
    id: 'sleepy', title: '困', weight: 1.1, window: [9 * 60, 16 * 60], tiredOnly: true,
    stages: [
      { text: '坐着直打盹，书翻在同一页' },
      { after: 90, text: '趴了十分钟，脖子更酸' },
      { after: 180, text: '灌了杯咖啡，还是困' },
    ],
  },
]

const byId = new Map(momentTemplates.map((x) => [x.id, x]))
export const momentTitle = (id) => byId.get(String(id))?.title || ''

/**
 * Stage-level constraints. They keep a detail from claiming a place or an
 * outing that the full timeline does not support. Missing entries mean "any".
 */
export const momentStageRules = {
  package: { places: ['any', 'dorm', 'dorm'], outing: [false, true, true] },
  laundry: { places: ['dorm', 'dorm', 'dorm'] },
  edit: { places: ['dorm', 'dorm', 'dorm'] },
  homework: { places: ['any', 'any', 'any'] },
  libraryBook: { places: ['any', 'any', 'any'], outing: [false, false, true] },
  charger: { places: ['dorm', 'dorm', 'dorm'] },
  snack: { places: ['dorm', 'out', 'dorm'], outing: [false, true, false] },
  cat: { places: ['out', 'out', 'out'] },
  person: { places: ['any', 'any', 'any'], meal: [true, true, true] },
  throat: { places: ['any', 'any', 'any'] },
  sleepy: { places: ['any', 'any', 'any'] },
}
const dayKey = (ymd) => String(ymd || '')

function hashSeed(value) {
  let h = 2166136261
  for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function rng(seedValue) {
  let a = seedValue >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clampMinute = (n, min, max) => Math.max(min, Math.min(max, Math.round(Number(n) || 0)))
const cleanPerson = (value) => String(value || '').normalize('NFKC').replace(/[\r\n<>]/g, '').trim().slice(0, 12)

function eligible(template, flags, people) {
  if (!template) return false
  if (template.termOnly && !flags.term) return false
  if (template.outingOnly && !flags.outing) return false
  if (template.notFlat && flags.flat) return false
  if (template.bodyOnly && !(flags.cold || flags.period)) return false
  if (template.coldOnly && !flags.cold) return false
  if (template.tiredOnly && !flags.tired) return false
  if (template.requiresPerson && !(people || []).length) return false
  if (Array.isArray(template.months) && !template.months.includes(flags.month)) return false
  return true
}

function weightFor(template, flags, recentAges) {
  let weight = Number(template.weight) || 1
  const age = recentAges.get(template.id)
  if (Number.isFinite(age) && age <= 3) return 0
  if (Number.isFinite(age) && age <= 7) weight *= 0.25
  if (flags.flat && ['cat', 'person'].includes(template.id)) weight *= 0.5
  return weight
}

function pickWeighted(candidates, random) {
  const total = candidates.reduce((sum, x) => sum + x.weight, 0)
  if (total <= 0) return null
  let roll = random() * total
  for (const candidate of candidates) {
    roll -= candidate.weight
    if (roll <= 0) return candidate
  }
  return candidates[candidates.length - 1] || null
}

function stageTimes(template, start) {
  let at = clampMinute(start, 0, 1410)
  const stages = []
  for (let i = 0; i < template.stages.length && stages.length < MOMENT_LIMITS.stages; i++) {
    const stage = template.stages[i]
    if (i > 0) at = Math.max(at + 20, at + Math.max(20, Math.round(Number(stage.after) || 0)))
    at = Math.min(1410, at)
    stages.push({ at, text: String(stage.text || '').slice(0, 48) })
  }
  return stages
}

function renderText(text, person) {
  return String(text || '').replaceAll('{person}', person || '室友')
}

/**
 * Pure generation (no IO). Exported so tests and prompt builders can inspect a
 * day without touching the user's state.
 */
export function generateMoments(cfg, t, calendar = {}, options = {}) {
  calendar = calendar && typeof calendar === 'object' ? calendar : {}
  const ymd = dayKey(t && t.ymd)
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return { v: MOMENT_VERSION, date: '', createdAt: 0, items: [] }
  const flags = {
    month: Number(t.month) || Number(ymd.slice(5, 7)),
    term: options.term ?? Boolean(calendar.term && !calendar.holiday && !calendar.special),
    outing: options.outing ?? Boolean(options.deviation && options.deviation.outing),
    flat: Boolean(options.flat ?? (options.deviation && options.deviation.flat)),
    cold: Boolean(options.cold),
    period: Boolean(options.period),
    tired: Boolean(options.tired),
  }
  const people = (Array.isArray(options.people) ? options.people : []).map(cleanPerson).filter(Boolean)
  const person = people[0] || ''
  const recent = new Map()
  for (const row of Array.isArray(options.recent) ? options.recent : []) {
    const id = String(row && row.id || '')
    const age = Math.round(Number(row && row.age))
    if (byId.has(id) && Number.isFinite(age) && age > 0) recent.set(id, Math.min(age, 30))
  }
  const random = rng(hashSeed([ymd, 'moments', flags.term, flags.outing, flags.flat, flags.cold, flags.period, flags.tired, person].join('|')))
  const roll = random()
  let count = roll < 0.18 ? 0 : roll < 0.72 ? 1 : 2
  if (flags.flat || calendar.special) count = Math.min(count, 1)
  if (flags.cold || flags.period) count = Math.max(count, 1)

  const items = []
  const used = new Set()
  for (let i = 0; i < count; i++) {
    const candidates = momentTemplates
      .filter((template) => !used.has(template.id) && eligible(template, flags, people))
      .map((template) => ({ template, weight: weightFor(template, flags, recent) }))
      .filter((x) => x.weight > 0)
    const picked = pickWeighted(candidates, random)
    if (!picked) break
    used.add(picked.template.id)
    const [min, max] = picked.template.window
    let start = Math.round((min + random() * Math.max(0, max - min)) / 15) * 15
    if (items.length) start = Math.max(start, items[items.length - 1].start + 90)
    start = clampMinute(start, 0, 1340)
    items.push({
      id: picked.template.id,
      start,
      person: picked.template.requiresPerson ? person : '',
      stages: stageTimes(picked.template, start),
    })
  }
  items.sort((a, b) => a.start - b.start)
  return {
    v: MOMENT_VERSION,
    date: ymd,
    createdAt: Number(options.now) || Date.now(),
    items: items.slice(0, MOMENT_LIMITS.perDay),
  }
}

/** Validate a persisted file; only known template ids and bounded numbers survive. */
export function normalizeMoments(raw, ymd) {
  if (!raw || raw.v !== MOMENT_VERSION || String(raw.date || '') !== String(ymd || '')) return null
  if (!Array.isArray(raw.items)) return null
  const seen = new Set()
  const items = raw.items.flatMap((row) => {
    const id = String(row && row.id || '')
    const template = byId.get(id)
    if (!template || seen.has(id)) return []
    seen.add(id)
    const start = Number(row.start)
    if (!Number.isFinite(start) || start < 0 || start >= 1440) return []
    const person = template.requiresPerson ? cleanPerson(row.person) : ''
    if (template.requiresPerson && !person) return []
    return [{ id, start: Math.round(start), person, stages: stageTimes(template, Math.round(start)) }]
  }).sort((a, b) => a.start - b.start).slice(0, MOMENT_LIMITS.perDay)
  if (!items.length && Array.isArray(raw.items) && raw.items.length) return null
  return { v: MOMENT_VERSION, date: String(ymd), createdAt: Number(raw.createdAt) || Date.now(), items }
}

const cache = new Map()
const remember = (path, value, meta) => {
  cache.set(path, { ...meta, value })
  while (cache.size > 8) cache.delete(cache.keys().next().value)
}

export function readMoments(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))) return null
  const path = momentsPath(ymd)
  const hit = cache.get(path)
  try {
    const st = statSync(path)
    if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.value
  } catch { return null }
  const read = readJsonBounded(path, { maxBytes: MOMENT_LIMITS.fileBytes })
  if (!read.ok) return null
  const value = normalizeMoments(read.value, ymd)
  if (!value) return null
  remember(path, value, { mtimeMs: read.mtimeMs, size: read.size })
  return value
}

export function writeMoments(ymd, data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))) return false
  const normalized = normalizeMoments(data, ymd)
  if (!normalized) return false
  if (!atomicWriteJson(momentsPath(ymd), normalized)) return false
  try {
    const st = statSync(momentsPath(ymd))
    remember(momentsPath(ymd), normalized, { mtimeMs: st.mtimeMs, size: st.size })
  } catch {}
  return true
}

/** Ids of the last `days` days, used to suppress repeats. Never generates. */
export function recentMomentIds(ymd, days = MOMENT_LIMITS.recentDays) {
  const rows = []
  const base = Date.parse(`${ymd}T00:00:00Z`)
  if (!Number.isFinite(base)) return rows
  for (let i = 1; i <= Math.max(1, Math.min(30, days)); i++) {
    const day = new Date(base - i * 86400000).toISOString().slice(0, 10)
    const data = readMoments(day)
    if (!data) continue
    for (const item of data.items) rows.push({ id: item.id, age: i })
  }
  return rows
}

/** Read the persisted day, or create it once and persist it. */
export function ensureMoments(cfg, t, calendar = {}, options = {}) {
  if (!cfg || cfg.总开关 === false || !t || !t.ymd) return { v: MOMENT_VERSION, date: '', createdAt: 0, items: [] }
  const existing = readMoments(t.ymd)
  if (existing) return existing
  const recent = Array.isArray(options.recent) ? options.recent : recentMomentIds(t.ymd)
  const data = generateMoments(cfg, t, calendar, { ...options, recent, now: options.now || Date.now() })
  // Persist even an empty day: it records that this date was already decided,
  // so the same date cannot be re-rolled later in the day.
  writeMoments(t.ymd, data)
  return data
}

function outingBefore(stageAt, outings, nowMinute) {
  return (Array.isArray(outings) ? outings : []).some((o) => {
    if (!o || !Number.isFinite(Number(o.start)) || !Number.isFinite(Number(o.end))) return false
    // The stage text describes the state now. An outing that has already
    // started by now can support it even if the nominal stage time was earlier.
    return o.start <= nowMinute && (o.end >= stageAt - 180 || o.end >= nowMinute - 30)
  })
}

function mealNear(stageAt, meals, nowMinute) {
  return (Array.isArray(meals) ? meals : []).some((m) => {
    if (!m || !Number.isFinite(Number(m.start)) || !Number.isFinite(Number(m.end))) return false
    return m.start <= nowMinute + 60 && m.end >= stageAt - 180
  })
}

/** Latest stage that has begun, unless it is old or she is asleep. */
export function momentStage(item, minute, options = {}) {
  if (!item || !Array.isArray(item.stages) || !item.stages.length) return null
  if (options.asleep) return null
  const now = Math.max(0, Math.min(1440, Math.round(Number(minute) || 0)))
  let found = null
  for (let i = 0; i < item.stages.length; i++) {
    if (item.stages[i].at <= now) found = { ...item.stages[i], index: i }
    else break
  }
  if (!found) return null
  const age = now - found.at
  if (age > (Number(options.maxAgeMinutes) || 360)) return null
  return { ...found, text: renderText(found.text, item.person), ageMinutes: age }
}

/** One short line for the prompt, or null when nothing is worth mentioning. */
export function momentContext(data, minute, options = {}) {
  if (!data || !Array.isArray(data.items)) return null
  const currentCategory = String(options.currentCategory || 'any')
  let best = null
  for (const item of data.items) {
    const stage = momentStage(item, minute, options)
    if (!stage) continue
    const rules = momentStageRules[item.id] || {}
    const place = rules.places?.[stage.index] || 'any'
    if (place !== 'any' && currentCategory !== place) continue
    let impossible = false
    for (let i = 0; i <= stage.index; i++) {
      const at = item.stages[i]?.at
      if (rules.outing?.[i] && !outingBefore(at, options.outings, minute)) { impossible = true; break }
      if (rules.meal?.[i] && !mealNear(at, options.meals, minute)) { impossible = true; break }
    }
    if (impossible) continue
    if (!best || stage.at > best.stage.at) best = { item, stage }
  }
  return best ? { id: best.item.id, text: best.stage.text, title: byId.get(best.item.id)?.title || '', stageIndex: best.stage.index, ageMinutes: best.stage.ageMinutes } : null
}

/** Human-readable ids for the daily plan prompt (no file writes). */
export function momentSummary(ymd) {
  const data = readMoments(ymd)
  return data ? data.items.map((x) => byId.get(x.id)?.title).filter(Boolean) : []
}

export function cleanupMoments(retentionDays = 30, now = Date.now()) {
  const cutoff = now - Math.max(7, Number(retentionDays) || 30) * 86400000
  let removed = 0
  try {
    for (const name of readdirSync(momentsDir())) {
      if (!datePattern.test(name)) continue
      const path = join(momentsDir(), name)
      try {
        if (statSync(path).mtimeMs < cutoff) { unlinkSync(path); removed++ }
      } catch {}
    }
  } catch {}
  return removed
}
