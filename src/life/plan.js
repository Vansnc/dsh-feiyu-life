// dsh-feiyu-life · daily plan (template layer, no model)
//
//   · pick a day type (schoolDay / offDay / weekendHome / weekendOut / outing /
//     special / vacation / festival);
//   · flatten timetable + routine table into a full 00:00-24:00 timeline;
//   · resolve every overlap deterministically (timetable > temporary outing >
//     routine), so `segmentAt` can never hit two segments;
//   · give every segment an outfit that matches the place and activity;
//   · cache the plan per date under ~/.dsh/feiyu-life-days/<date>.json.
//
// Everything is seeded pseudo-random: no network, no tokens, survives restarts.
// Identifiers are English. Persisted config keys stay Chinese.

import {
  readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync,
  readdirSync, statSync, copyFileSync, rmdirSync,
} from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { readJsonBounded } from '../persistence/storage.js'

const plansDir = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'feiyu-life-days')
const historyDir = (ymd) => join(plansDir(), 'history', ymd)
const dateFile = /^\d{4}-\d{2}-\d{2}\.json$/
const PLAN_MAX_BYTES = 2 * 1024 * 1024
const MAX_HISTORY_PER_DAY = 10

export function toMinute(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim())
  if (!m) return -1
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (minute > 59 || hour > 24 || (hour === 24 && minute !== 0)) return -1
  return hour * 60 + minute
}

function hashSeed(s, salt = '') {
  let h = 2166136261
  for (const c of String(s) + '|' + salt) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
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

export const defaultWardrobe = {
  sleep: ['睡衣'],
  bath: ['睡衣', '浴巾裹着'],
  class: ['藏青卫衣', '白T加开衫', '灰毛衣', '牛仔外套'],
  home: ['宽松T恤', '珊瑚绒睡衣', '旧卫衣'],
  out: ['黑大衣', '军绿夹克', '牛仔外套'],
  eat: ['宽松T恤', '卫衣'],
}

const wardrobeKeys = Object.keys(defaultWardrobe)

/** Keep wardrobe arrays bounded and non-empty; unknown keys are ignored. */
export function normalizeWardrobe(input) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const out = {}
  for (const key of wardrobeKeys) {
    const list = Array.isArray(raw[key]) ? raw[key] : defaultWardrobe[key]
    const clean = [...new Set(list.map((x) => String(x || '').trim().slice(0, 12)).filter(Boolean))].slice(0, 12)
    out[key] = clean.length ? clean : [...defaultWardrobe[key]]
  }
  return out
}

function looksLikeHome(text) {
  return /(?:没|不|未)(?:有|怎么)?出门|一天没出门|在宿舍|宿舍里|床上|被窝|窝在|躺着|不出门|宅/.test(text)
}

/** Outfit occasion, preferring explicit behaviour and place over keyword luck. */
export function occasion(what, behavior = '', locationId = '') {
  const s = String(what || '')
  if (behavior === 'sleep') return 'sleep'
  if (behavior === 'bath') return 'bath'
  if (locationId === 'dorm') return 'home'
  if (locationId === 'canteen' || locationId === 'mcdonalds') return 'eat'
  if (['classroom', 'library', 'cafe'].includes(locationId)) return 'class'
  if (['outdoor', 'mall', 'shop'].includes(locationId)) return 'out'
  if (looksLikeHome(s)) return 'home'
  if (/睡|床|被窝/.test(s)) return 'sleep'
  if (/洗澡|冲澡|洗漱|刷牙|洗脸|面膜|洗头/.test(s)) return 'bath'
  if (/上课|专业课|教室|图书馆|自习|背书|课件|写作业|复习/.test(s)) return 'class'
  if (/食堂|吃饭|早饭|午饭|晚饭|外卖|夜宵|吃面|吃粉/.test(s)) return 'eat'
  if (/出门|外面|街上|拍照|逛|超市|便利店|地铁|公交|公园|商场/.test(s)) return 'out'
  if (behavior === 'study') return 'class'
  if (behavior === 'eat') return 'eat'
  if (behavior === 'walk' || behavior === 'photo') return 'out'
  return 'home'
}

function pickOutfit(wardrobe, occ, seedValue) {
  const pool = (wardrobe && wardrobe[occ]) || defaultWardrobe[occ] || ['卫衣']
  return pool[Math.floor(rng(seedValue)() * pool.length) % pool.length]
}

/** Day type: { id, name } */
export function dayType(cfg, t, calendar) {
  const r = rng(hashSeed(t.ymd, 'daytype'))
  if (calendar.special) return { id: 'special', name: calendar.special.名 || '特殊日' }
  if (calendar.vacation) return { id: 'vacation', name: calendar.vacation.名 || '假期' }
  if (calendar.festival && calendar.festival.起) return { id: 'festival', name: calendar.festival.名 || '节日' }
  const classes = calendar.term && !calendar.holiday && !calendar.special
    ? ((cfg.课表 || {})[t.weekday] || []) : []
  if (classes.length) return { id: 'schoolDay', name: '上课日' }
  if (t.weekday >= 6) return r() < 0.55 ? { id: 'weekendHome', name: '周末·宅家' } : { id: 'outing', name: '周末·出门' }
  return r() < 0.6 ? { id: 'offDay', name: '没课日' } : { id: 'outing', name: '出门转转' }
}

function parseRows(rows) {
  const out = []
  if (!Array.isArray(rows)) return out
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue
    let start = toMinute(row[0])
    let end = toMinute(row[1])
    if (start < 0 || end < 0 || start >= 1440) continue
    if (end <= start) end += 1440
    if (end > 1440) end = 1440
    if (end <= start) continue
    out.push({
      start,
      end,
      what: String(row[2] || '闲着').trim().slice(0, 80) || '闲着',
      phone: ['在手', '静音', '在床头', '不在手边'].includes(String(row[3])) ? String(row[3]) : '在手',
    })
  }
  return out
}

/**
 * A routine table always becomes a gapless, non-overlapping 00:00–24:00 day.
 * Gaps inherit the previous activity; a missing prefix becomes sleep; a missing
 * tail extends the last activity. Validity issues are still reported by
 * validateConfig(); runtime never falls back to "闲着" just because of a typo.
 */
export function normalizeRoutine(cfg, routineName) {
  const source = cfg && cfg[routineName]
  const parsed = parseRows(source).sort((a, b) => a.start - b.start || b.end - a.end)
  const rows = parsed.length ? parsed : parseRows(fallbackDay()).sort((a, b) => a.start - b.start)
  const out = []
  let cursor = 0
  let previous = null
  for (const row of rows) {
    if (row.end <= cursor) continue
    if (row.start > cursor) {
      out.push(routineGap(previous, cursor, row.start))
    }
    const start = Math.max(cursor, row.start)
    if (row.end > start) {
      const piece = { ...row, start }
      out.push(piece)
      previous = piece
      cursor = row.end
    }
    if (cursor >= 1440) break
  }
  if (cursor < 1440) out.push(routineGap(previous, cursor, 1440))
  return out
}

function routineGap(previous, start, end) {
  if (!previous) return { start, end, what: '还睡着', phone: '在床头', behavior: 'sleep', locationId: 'dorm', outfit: '睡衣' }
  if (end - start <= 30) return { ...previous, start, end }
  return { start, end, what: '没安排，随便待着', phone: '在手', behavior: 'idle', outfit: previous.outfit || '' }
}

/** Classes overlapping each other are trimmed later-first; the earliest wins. */
export function normalizeClasses(rows) {
  const parsed = parseRows(rows).sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))
  const accepted = []
  for (const row of parsed) {
    let start = row.start
    for (const prev of accepted) {
      if (prev.end <= start || prev.start >= row.end) continue
      if (prev.start <= start) start = Math.max(start, prev.end)
      // A later class that starts inside an earlier one is pushed to its end.
    }
    if (start >= row.end) continue
    accepted.push({ ...row, start })
  }
  return accepted.sort((a, b) => a.start - b.start)
}

function subtractInterval(interval, covers) {
  let parts = [{ ...interval }]
  for (const cover of covers) {
    const next = []
    for (const part of parts) {
      if (cover.end <= part.start || cover.start >= part.end) { next.push(part); continue }
      if (cover.start > part.start) next.push({ ...part, end: Math.min(part.end, cover.start) })
      if (cover.end < part.end) next.push({ ...part, start: Math.max(part.start, cover.end) })
    }
    parts = next
  }
  return parts.filter((x) => x.end > x.start)
}

/** Resolve covers in priority order; later covers only fill what is left. */
function resolveCovers(covers) {
  const ordered = covers.slice().sort((a, b) => (a.priority - b.priority) || (a.start - b.start) || ((b.end - b.start) - (a.end - a.start)))
  const accepted = []
  for (const cover of ordered) {
    for (const part of subtractInterval(cover, accepted)) accepted.push({ ...cover, ...part })
  }
  return accepted.sort((a, b) => a.start - b.start)
}

function findOutingWindow(start, end, classes) {
  const pieces = subtractInterval({ start, end }, classes).filter((x) => x.end - x.start >= 45)
  if (pieces.length) {
    pieces.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start)
    return pieces[0]
  }
  if (!classes.length) return { start, end }
  const lastEnd = classes.reduce((max, x) => Math.max(max, x.end), 0)
  const after = Math.max(start, lastEnd)
  const until = Math.min(21 * 60, after + 90)
  return until - after >= 30 ? { start: after, end: until } : null
}

function flatTimeline(cfg, t) {
  const rows = [
    { start: 0, end: 630, what: '睡着，今天没打算起', phone: '在床头', behavior: 'sleep', locationId: 'dorm', outfit: '睡衣' },
    { start: 630, end: 840, what: '窝在床上刷手机', phone: '在手', behavior: 'phone', locationId: 'dorm', outfit: '旧卫衣' },
    { start: 840, end: 1020, what: '在宿舍躺着，一天没出门', phone: '在手', behavior: 'idle', locationId: 'dorm', outfit: '旧卫衣' },
    { start: 1020, end: 1080, what: '外卖到了，坐在床边吃', phone: '在手', behavior: 'eat', locationId: 'dorm', outfit: '旧卫衣' },
    { start: 1080, end: 1440, what: '又躺回去刷手机', phone: '在手', behavior: 'phone', locationId: 'dorm', outfit: '旧卫衣' },
  ]
  return rows.map((x) => ({ ...x, outfit: x.outfit || pickOutfit(cfg.衣柜, occasion(x.what, x.behavior, x.locationId), hashSeed(t.ymd, 'flat' + x.start)) }))
}

function withOutfit(items, cfg, t) {
  return items.map((x) => ({
    ...x,
    outfit: x.outfit || pickOutfit(cfg.衣柜, occasion(x.what, x.behavior, x.locationId), hashSeed(t.ymd, 'o' + x.start + '|' + x.what)),
  }))
}

/**
 * Flatten timetable + routine into today's timeline (with outfits).
 * Returns [{ start, end, what, phone, outfit }] covering 00:00–24:00.
 */
export function timeline(cfg, t, calendar, deviation = {}, type = null) {
  if (deviation.flat) return withOutfit(flatTimeline(cfg, t), cfg, t)
  const routine = normalizeRoutine(cfg, calendar.routine)
  const classes = calendar.term && !calendar.holiday && !calendar.special
    ? normalizeClasses((cfg.课表 || {})[t.weekday] || [])
    : []
  const covers = classes.map((row) => {
    const skipped = deviation.skipAfternoon && row.start >= 12 * 60
    return skipped
      ? { ...row, what: '翘了，在宿舍躺着', phone: '在手', behavior: 'idle', locationId: 'dorm', outfit: pickOutfit(cfg.衣柜, 'home', hashSeed(t.ymd, 'skip' + row.start)), priority: 0, timetabled: true }
      : { ...row, priority: 0, timetabled: true }
  })
  const resolvedClasses = resolveCovers(covers)
  if (deviation.outing || (type && type.id === 'outing')) {
    const window = findOutingWindow(15 * 60, 18 * 60, resolvedClasses)
    if (window) {
      const meal = window.start < 19 * 60 && window.end > 18 * 60
      covers.push({
        ...window,
        what: window.end - window.start >= 90
          ? (meal ? '出门走了走，顺便在外面吃了' : '出门了，带着相机')
          : '下课后出去走了一圈',
        phone: '在手',
        behavior: 'walk',
        locationId: 'outdoor',
        priority: 1,
        inserted: true,
      })
    }
  }
  const resolved = resolveCovers(covers)
  const base = []
  for (const row of routine) {
    for (const part of subtractInterval(row, resolved)) base.push({ ...part, timetabled: false })
  }
  const merged = [...base, ...resolved].sort((a, b) => a.start - b.start || (a.priority || 0) - (b.priority || 0))
  return withOutfit(merged, cfg, t)
}

function fallbackDay() {
  return [
    ['00:00', '01:30', '躺床上刷手机', '在手'],
    ['01:30', '09:00', '睡着了', '在床头'],
    ['09:00', '12:00', '在宿舍磨蹭', '在手'],
    ['12:00', '13:00', '食堂吃饭', '在手'],
    ['13:00', '14:00', '午睡', '不在手边'],
    ['14:00', '18:00', '剪片子、修图', '在手'],
    ['18:00', '19:00', '吃晚饭', '在手'],
    ['19:00', '23:30', '修图、刷 B 站', '在手'],
    ['23:30', '24:00', '洗澡', '不在手边'],
  ]
}



/** Schedule-only fingerprint: changing the timetable does not need a model call. */
export function scheduleRevision(cfg) {
  const c = cfg || {}
  const subset = {
    时区: c.时区 || '',
    日常: c.日常 || [], 晚起: c.晚起 || [], 假期: c.假期 || [], 备考: c.备考 || [],
    课表: c.课表 || {}, 晚起日: c.晚起日 || [],
    校历: c.校历 || {}, 节日: c.节日 || [],
    偏离: c.偏离 || {}, 经期: c.经期 || {},
  }
  const body = JSON.stringify(subset)
  return hashSeed(body, 'schedule-a').toString(36) + hashSeed(body, 'schedule-b').toString(36)
}

function planCategory(x) {
  return occasion(x && x.what, x && x.behavior, x && x.locationId)
}

function cellKey(x) {
  return `${x.start}|${x.end}|${x.what || ''}|${x.source || ''}`
}


/**
 * Keep 00:00→now exactly as it was; rebuild only the future from the new
 * schedule. Existing future content is reused when it belongs to the same
 * activity category, so a timetable change moves boundaries instead of
 * rerolling the whole day. No model call is involved.
 */
export function mergeFutureItems(oldItems, newItems, nowMinute) {
  const old = (Array.isArray(oldItems) ? oldItems : []).slice().sort((a, b) => a.start - b.start)
  const next = (Array.isArray(newItems) ? newItems : []).slice().sort((a, b) => a.start - b.start)
  if (!old.length || !next.length) return old
  const minute = Math.max(0, Math.min(1440, Math.round(Number(nowMinute) || 0)))
  const frozen = old.filter((x) => x.start <= minute)
  const boundary = frozen.length ? Math.max(...frozen.map((x) => x.end)) : 0
  if (boundary >= 1440) return old
  const usedOld = new Set()
  const usedLinks = new Set()
  for (const row of frozen) {
    for (const link of Array.isArray(row.links) ? row.links : []) usedLinks.add(`${link.type}:${link.id}`)
  }
  const oldFuture = old.filter((x) => x.end > boundary)
  const future = []
  for (const row of next) {
    const start = Math.max(boundary, row.start)
    if (row.end <= start) continue
    const candidate = { ...row, start }
    const pieces = []
    let cursor = start
    for (const previous of oldFuture) {
      if (previous.start >= row.end) break
      if (previous.end <= cursor) continue
      const pieceStart = Math.max(cursor, previous.start)
      if (pieceStart > cursor) pieces.push({ ...candidate, start: cursor, end: pieceStart })
      const pieceEnd = Math.min(row.end, previous.end)
      if (pieceEnd <= pieceStart) { cursor = Math.max(cursor, pieceEnd); continue }
      if (planCategory(previous) === planCategory(row) && previous.what) {
        const intact = previous.start >= start && previous.end <= row.end && !usedOld.has(cellKey(previous))
        if (intact) usedOld.add(cellKey(previous))
        const links = intact ? (Array.isArray(previous.links) ? previous.links : []).filter((link) => {
          const key = `${link.type}:${link.id}`
          if (usedLinks.has(key)) return false
          usedLinks.add(key)
          return true
        }) : []
        pieces.push({
          ...candidate,
          start: pieceStart,
          end: pieceEnd,
          what: previous.what,
          phone: previous.phone || candidate.phone,
          outfit: previous.outfit || candidate.outfit || '',
          locationId: previous.locationId || candidate.locationId || '',
          behavior: previous.behavior || candidate.behavior || '',
          links,
          people: intact && Array.isArray(previous.people) ? previous.people : [],
        })
      } else {
        pieces.push({ ...candidate, start: pieceStart, end: pieceEnd })
      }
      cursor = Math.max(cursor, pieceEnd)
      if (cursor >= row.end) break
    }
    if (cursor < row.end) pieces.push({ ...candidate, start: cursor, end: row.end })
    // Collapse adjacent identical pieces produced by one old row.
    for (const piece of pieces) {
      const last = future[future.length - 1]
      if (last && last.end === piece.start && last.what === piece.what && last.phone === piece.phone && last.outfit === piece.outfit && last.locationId === piece.locationId && last.behavior === piece.behavior) {
        last.end = piece.end
        last.links = [...(last.links || []), ...(piece.links || [])]
        last.people = [...(last.people || []), ...(piece.people || [])]
      } else future.push(piece)
    }
  }
  if (!future.length) return old
  const merged = [...frozen, ...future].sort((a, b) => a.start - b.start)
  // If the new schedule did not actually change the future, keep the exact old
  // array identity so callers can tell that nothing needs persisting.
  const relationKey = (x) => JSON.stringify([x.links || [], x.people || []])
  const same = merged.length === old.length && merged.every((x, i) => cellKey(x) === cellKey(old[i]) && x.outfit === old[i].outfit && x.phone === old[i].phone && relationKey(x) === relationKey(old[i]))
  return same ? old : merged
}
export function findAt(items, minute) {
  for (const x of items) if (minute >= x.start && minute < x.end) return x
  return null
}

export function planPath(ymd) {
  return join(plansDir(), ymd + '.json')
}

const planCache = new Map()
function rememberPlan(path, value, meta) {
  planCache.set(path, { ...meta, value })
  while (planCache.size > 8) planCache.delete(planCache.keys().next().value)
}
function forgetPlan(path) { planCache.delete(path) }

/** Write a plan (model-generated plans go through here too). */
export function writePlan(ymd, data) {
  try {
    mkdirSync(plansDir(), { recursive: true })
    const target = planPath(ymd)
    const tmp = target + '.' + process.pid + '.' + Date.now() + '.tmp'
    writeFileSync(tmp, JSON.stringify({ v: 1, date: ymd, ...data }, null, 2), 'utf8')
    renameSync(tmp, target)
    forgetPlan(target)
    return true
  } catch { return false }
}

export function deletePlan(ymd) {
  forgetPlan(planPath(ymd))
  try { unlinkSync(planPath(ymd)); return true } catch (e) { return e && e.code === 'ENOENT' }
}

/** Keep the current file before regeneration so the user can undo it. */
export function archivePlan(ymd) {
  const source = planPath(ymd)
  if (!existsSync(source)) return null
  try {
    const dir = historyDir(ymd)
    mkdirSync(dir, { recursive: true })
    const target = join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`)
    copyFileSync(source, target)
    // Regeneration is a user action, but a stuck client must not grow a folder forever.
    const history = listPlanHistory(ymd)
    for (const row of history.slice(MAX_HISTORY_PER_DAY)) {
      try { unlinkSync(row.path) } catch {}
    }
    return target
  } catch { return null }
}

export function listPlanHistory(ymd) {
  try {
    return readdirSync(historyDir(ymd))
      .filter((name) => /^\d{10,}-[a-z0-9]+\.json$/.test(name))
      .map((name) => {
        const path = join(historyDir(ymd), name)
        const st = statSync(path)
        return { name, path, time: st.mtimeMs }
      })
      .sort((a, b) => b.time - a.time)
  } catch { return [] }
}

/** Restore and consume the latest pre-regeneration copy. */
export function restoreLatestPlan(ymd) {
  const latest = listPlanHistory(ymd)[0]
  if (!latest) return false
  try {
    const data = JSON.parse(readFileSync(latest.path, 'utf8'))
    if (!normalizePlan(data) || !writePlan(ymd, data)) return false
    unlinkSync(latest.path)
    return true
  } catch { return false }
}

/** Remove expired plans and regeneration snapshots. Returns the number removed. */
export function cleanupPlans(retentionDays = 180, now = Date.now()) {
  const cutoff = now - Math.max(7, Number(retentionDays) || 180) * 86400000
  let removed = 0
  try {
    for (const name of readdirSync(plansDir())) {
      if (!dateFile.test(name)) continue
      const path = join(plansDir(), name)
      try { if (statSync(path).mtimeMs < cutoff) { unlinkSync(path); removed++; forgetPlan(path) } } catch {}
    }
  } catch {}
  const root = join(plansDir(), 'history')
  try {
    for (const ymd of readdirSync(root)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue
      const dir = join(root, ymd)
      try {
        for (const name of readdirSync(dir)) {
          if (!/^\d{10,}-[a-z0-9]+\.json$/.test(name)) continue
          const path = join(dir, name)
          try { if (statSync(path).mtimeMs < cutoff) { unlinkSync(path); removed++ } } catch {}
        }
        if (!readdirSync(dir).length) rmdirSync(dir)
      } catch {}
    }
  } catch {}
  return removed
}

/** Accept both the new English shape and older Chinese-shaped plans. */
function normalizePlan(data) {
  if (!data || !Array.isArray(data.items) || !data.items.length) return null
  const items = data.items.map((x) => ({
    start: Number(x.start ?? x.起) || 0,
    end: Number(x.end ?? x.止) || 0,
    what: String(x.what ?? x.在 ?? ''),
    phone: String(x.phone ?? x.手机 ?? '在手'),
    outfit: String(x.outfit ?? x.穿 ?? ''),
    locationId: String(x.locationId ?? x.地点 ?? ''),
    behavior: String(x.behavior ?? x.行为 ?? ''),
    links: Array.isArray(x.links) ? x.links.map((link) => ({
      type: String(link?.type || ''),
      id: String(link?.id || ''),
      progressDelta: Number(link?.progressDelta) || undefined,
    })).filter((link) => ['thread', 'task', 'commitment'].includes(link.type) && link.id) : [],
    people: Array.isArray(x.people) ? x.people.map((person) => ({
      id: String(person?.id || ''),
      tone: ['warm', 'tense'].includes(String(person?.tone || '')) ? String(person.tone) : 'neutral',
    })).filter((person) => person.id).slice(0, 3) : [],
  })).filter((x) => x.end > x.start)
  if (!items.length) return null
  return {
    ...data,
    type: data.type
      ? { id: String(data.type.id || ''), name: String((data.type.name ?? data.type.名 ?? data.type.id) || '') }
      : null,
    items: repairCoverage(items),
  }
}

/**
 * Old/model plans occasionally overlap or leave a gap. Repair once at the read
 * boundary: earlier segments win, a gap continues the previous activity, and a
 * missing prefix/tail becomes sleep / the last activity. This keeps
 * `segmentAt` single-valued even for plans written by an older version.
 */
function repairCoverage(items) {
  const sorted = items.slice().sort((a, b) => a.start - b.start || b.end - a.end)
  const out = []
  let cursor = 0
  for (const row of sorted) {
    if (cursor >= 1440) break
    const start = Math.max(cursor, Number(row.start) || 0)
    const end = Math.min(1440, Number(row.end) || 0)
    if (end <= start) continue
    if (start > cursor) {
      out.push(gapSegment(out[out.length - 1], cursor, start))
    }
    out.push({ ...row, start, end })
    cursor = end
  }
  if (cursor < 1440) out.push(gapSegment(out[out.length - 1], cursor, 1440))
  return out
}

/** A synthetic continuation must never carry real links/people. */
function gapSegment(previous, start, end) {
  if (!previous) return { start, end, what: '还睡着', phone: '在床头', outfit: '睡衣', behavior: 'sleep', locationId: 'dorm' }
  const { links, people, ...base } = previous
  if (end - start > 30 && !/睡/.test(previous.what)) {
    return { start, end, what: '没安排，随便待着', phone: '在手', outfit: previous.outfit || '', behavior: 'idle', links: [], people: [] }
  }
  return { ...base, start, end, links: [], people: [] }
}

/** Read and normalize a persisted plan without building a new one. */
export function readPlan(ymd) {
  const path = planPath(ymd)
  const read = readJsonBounded(path, { maxBytes: PLAN_MAX_BYTES })
  if (!read.ok) { forgetPlan(path); return null }
  const hit = planCache.get(path)
  if (hit && hit.mtimeMs === read.mtimeMs && hit.size === read.size) return hit.value
  const data = normalizePlan(read.value)
  if (!data) { forgetPlan(path); return null }
  rememberPlan(path, data, { mtimeMs: read.mtimeMs, size: read.size })
  return data
}

/**
 * Read or build today's plan. Never writes from here: injecting is synchronous,
 * and writing the template early would block the model version from landing.
 * Persisting is owned by index.js (model first, template fallback).
 */
export function dailyPlan(cfg, t, calendar, deviation, type, options = {}) {
  const persisted = readPlan(t.ymd)
  if (persisted) {
    if (!options.mergeFuture || !Number.isFinite(Number(options.nowMinute))) return persisted
    const revision = scheduleRevision(cfg)
    if (String(persisted.scheduleRevision || '') === revision) return persisted
    const rebuilt = timeline(cfg, t, calendar, deviation, type)
    const items = mergeFutureItems(persisted.items, rebuilt, Number(options.nowMinute))
    if (items === persisted.items) return persisted
    return { ...persisted, items, mergedSchedule: revision }
  }
  return {
    v: 1,
    date: t.ymd,
    type,
    items: timeline(cfg, t, calendar, deviation, type),
    wardrobe: cfg.衣柜 ? 'cfg' : 'default',
  }
}

/** Every actual minute of the day must have exactly one segment. */
export function timelineCoverage(items) {
  const gaps = []
  const overlaps = []
  let cursor = 0
  const sorted = (items || []).slice().sort((a, b) => a.start - b.start)
  for (const row of sorted) {
    if (row.start > cursor) gaps.push([cursor, row.start])
    if (row.start < cursor) overlaps.push([row.start, Math.min(cursor, row.end)])
    cursor = Math.max(cursor, row.end)
  }
  if (cursor < 1440) gaps.push([cursor, 1440])
  return { complete: !gaps.length && !overlaps.length, gaps, overlaps }
}
