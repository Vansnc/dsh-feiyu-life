// dsh-feiyu-life · daily plan (template layer, no model)
//
// Lifted from the dsh-daily-schedule idea (MIT), but without any model call:
//   · pick a day type (schoolDay / offDay / weekendHome / weekendOut / outing /
//     special / vacation / festival);
//   · flatten timetable + routine table into a full 00:00-24:00 timeline;
//   · give every segment an outfit;
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

const plansDir = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'feiyu-life-days')
const historyDir = (ymd) => join(plansDir(), 'history', ymd)
const dateFile = /^\d{4}-\d{2}-\d{2}\.json$/

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

const defaultWardrobe = {
  sleep: ['睡衣'],
  bath: ['睡衣', '浴巾裹着'],
  class: ['藏青卫衣', '白T加开衫', '灰毛衣', '牛仔外套'],
  home: ['宽松T恤', '珊瑚绒睡衣', '旧卫衣'],
  out: ['黑大衣', '军绿夹克', '牛仔外套'],
  eat: ['宽松T恤', '卫衣'],
}

function occasion(what) {
  const s = String(what || '')
  if (/睡/.test(s)) return 'sleep'
  if (/洗澡/.test(s)) return 'bath'
  if (/上课|专业课|教室|图书馆|自习|背书/.test(s)) return 'class'
  if (/食堂|吃饭|外卖|晚饭|午饭/.test(s)) return 'eat'
  if (/出门|外面|街上|拍照|逛|超市|便利店|地铁|公交/.test(s)) return 'out'
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
  const classes = (cfg.课表 || {})[t.weekday] || []
  if (classes.length) return { id: 'schoolDay', name: '上课日' }
  if (t.weekday >= 6) return r() < 0.55 ? { id: 'weekendHome', name: '周末·宅家' } : { id: 'outing', name: '周末·出门' }
  return r() < 0.6 ? { id: 'offDay', name: '没课日' } : { id: 'outing', name: '出门转转' }
}

function withOutfit(items, cfg, t) {
  return items.map((x, i) => ({ ...x, outfit: x.outfit || pickOutfit(cfg.衣柜, occasion(x.what), hashSeed(t.ymd, 'o' + i)) }))
}

/**
 * Flatten timetable + routine into today's timeline (with outfits).
 * Returns [{ start, end, what, phone, outfit }].
 */
export function timeline(cfg, t, calendar, deviation = {}, type = null) {
  if (deviation.flat) {
    return withOutfit([
      { start: 0, end: 11 * 60, what: '睡着，今天没打算起', phone: '在床头' },
      { start: 11 * 60, end: 14 * 60, what: '窝在床上刷手机', phone: '在手' },
      { start: 14 * 60, end: 19 * 60, what: '在宿舍躺着，一天没出门', phone: '在手' },
      { start: 19 * 60, end: 24 * 60, what: '点了个外卖，还是躺着', phone: '在手' },
    ].map((x) => ({ ...x, outfit: '' })), cfg, t)
  }
  const classes = calendar.holiday ? [] : ((cfg.课表 || {})[t.weekday] || [])
  const routine = cfg[calendar.routine] || fallbackDay()
  const segs = []
  for (const b of [...routine, ...classes]) {
    if (!Array.isArray(b) || b.length < 2) continue
    let start = toMinute(b[0])
    let end = toMinute(b[1])
    if (start < 0 || end < 0) continue
    if (end <= start) end += 1440
    segs.push({ start, end, what: String(b[2] || '闲着'), phone: String(b[3] || '在手'), timetabled: classes.includes(b) })
  }
  if (deviation.skipAfternoon) for (const x of segs) if (x.timetabled && x.start >= 12 * 60) x.what = '翘了，在宿舍躺着'
  if ((deviation.outing || (type && type.id === 'outing')) && !deviation.flat) {
    segs.push({ start: 15 * 60, end: 18 * 60, what: '出门了，带着相机', phone: '在手', inserted: true })
  }
  segs.sort((a, b) => a.start - b.start)
  // timetable / inserted segments cover routine segments (timetable wins), so the
  // timeline never overlaps itself and the chart reads cleanly.
  const covers = segs.filter((x) => x.timetabled || x.inserted)
  const bases = segs.filter((x) => !x.timetabled && !x.inserted)
  const rest = []
  for (const d of bases) {
    let parts = [d]
    for (const g of covers) {
      const next = []
      for (const r of parts) {
        if (g.end <= r.start || g.start >= r.end) { next.push(r); continue }
        if (g.start > r.start) next.push({ ...r, end: g.start })
        if (g.end < r.end) next.push({ ...r, start: g.end })
      }
      parts = next
    }
    rest.push(...parts)
  }
  const merged = [...rest, ...covers].sort((a, b) => a.start - b.start)
  return merged.map((x, i) => ({
    start: x.start, end: x.end, what: x.what, phone: x.phone,
    outfit: x.outfit || pickOutfit(cfg.衣柜, occasion(x.what), hashSeed(t.ymd, 'o' + i)),
  }))
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

export function findAt(items, minute) {
  for (const x of items) if (minute >= x.start && minute < x.end) return x
  return null
}

export function planPath(ymd) {
  return join(plansDir(), ymd + '.json')
}

/** Write a plan (model-generated plans go through here too). */
export function writePlan(ymd, data) {
  try {
    mkdirSync(plansDir(), { recursive: true })
    const target = planPath(ymd)
    const tmp = target + '.tmp'
    writeFileSync(tmp, JSON.stringify({ v: 1, date: ymd, ...data }, null, 2), 'utf8')
    renameSync(tmp, target)
    return true
  } catch { return false }
}

export function deletePlan(ymd) {
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
      try { if (statSync(path).mtimeMs < cutoff) { unlinkSync(path); removed++ } } catch {}
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
  })).filter((x) => x.end > x.start)
  if (!items.length) return null
  return {
    ...data,
    type: data.type
      ? { id: String(data.type.id || ''), name: String((data.type.name ?? data.type.名 ?? data.type.id) || '') }
      : null,
    items,
  }
}

/**
 * Read or build today's plan. Never writes from here: injecting is synchronous,
 * and writing the template early would block the model version from landing.
 * Persisting is owned by index.js (model first, template fallback).
 */
export function dailyPlan(cfg, t, calendar, deviation, type) {
  const file = join(plansDir(), t.ymd + '.json')
  if (existsSync(file)) {
    try {
      const data = normalizePlan(JSON.parse(readFileSync(file, 'utf8')))
      if (data) return data
    } catch {}
  }
  return {
    v: 1,
    date: t.ymd,
    type,
    items: timeline(cfg, t, calendar, deviation, type),
    wardrobe: cfg.衣柜 ? 'cfg' : 'default',
  }
}
