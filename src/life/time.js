// Pure time, calendar, body-cycle and sleep-projection helpers.
import { readPlan, normalizeRoutine } from './plan.js'
const sleepText = /(?:睡着|午睡|补觉|还睡着|睡熟|睡了|睡到|睡觉)/

export function pad2(n) { return String(n).padStart(2, '0') }

export function minuteLabel(minute) {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}

export const clockOf = (minute) => minuteLabel(minute)

export function zonedNow(now, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  })
  const parts = {}
  for (const p of fmt.formatToParts(now)) parts[p.type] = p.value
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday] || 1
  let hour = Number(parts.hour)
  if (hour === 24) hour = 0
  const minute = Number(parts.minute)
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute,
    minuteOfDay: hour * 60 + minute,
    weekday,
  }
}

/**
 * Epoch milliseconds for a wall-clock minute in an already-resolved local day.
 * Iteration is bounded. For a nonexistent local time (spring-forward gap), the
 * first representable instant after the gap wins, which is the conventional
 * interpretation; for a repeated time, the earlier occurrence is used.
 */
export function zonedDateTimeMs(ymd, minuteOfDay, tz = 'Asia/Shanghai') {
  const [y, m, d] = String(ymd).split('-').map(Number)
  if (!y || !m || !d) return NaN
  const target = Date.UTC(y, m - 1, d, 0, 0) + Number(minuteOfDay) * 60000
  if (!Number.isFinite(target)) return NaN
  let guess = target
  let high = null
  for (let i = 0; i < 6; i++) {
    const p = zonedNow(new Date(guess), tz)
    const represented = Date.parse(`${p.ymd}T${pad2(p.hour)}:${pad2(p.minute)}:00Z`)
    if (represented === target) return guess
    if (represented < target) guess += target - represented
    else { high = guess; guess -= represented - target }
  }
  return high ?? guess
}

export function zonedDayStartMs(_now, zoned, tz = 'Asia/Shanghai') {
  return zonedDateTimeMs(zoned.ymd, 0, tz)
}

export function addZonedDays(now, tz, days) {
  const current = zonedNow(now, tz)
  const targetYmd = new Date(Date.parse(`${current.ymd}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
  return new Date(zonedDateTimeMs(targetYmd, 12 * 60, tz))
}

export function hashSeed(ymd, salt = '') {
  let h = 2166136261
  const s = ymd + '|' + salt
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function rng(seedValue) {
  let a = seedValue >>> 0
  return function () {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function dayDiff(a, b) {
  const x = Date.parse(a + 'T00:00:00Z')
  const y = Date.parse(b + 'T00:00:00Z')
  if (!Number.isFinite(x) || !Number.isFinite(y)) return NaN
  return Math.floor((y - x) / 86400000)
}

export function shiftDay(ymd, days) {
  const base = Date.parse(`${ymd}T00:00:00Z`)
  return Number.isFinite(base) ? new Date(base + days * 86400000).toISOString().slice(0, 10) : ''
}

export function inRange(ymd, start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(end))) return false
  return ymd >= String(start) && ymd <= String(end)
}

/** What kind of day: special / vacation / festival / term */
export function todayCalendar(cfg, t) {
  const cal = cfg.校历 || {}
  const special = (cal.特殊 || []).find((x) => inRange(t.ymd, x.起, x.止))
  const vacation = (cal.假期 || []).find((x) => inRange(t.ymd, x.起, x.止))
  const term = (cal.学期 || []).find((x) => inRange(t.ymd, x.起, x.止))
  let festival = null
  for (const x of cfg.节日 || []) {
    if (x && x.名 && Number(x.月) === t.month && Number(x.日) === t.day) { festival = x; break }
    if (x && x.名 && inRange(t.ymd, x.起, x.止)) { festival = x; break }
  }
  let routine = '日常'
  let label = ''
  const festivalHoliday = !!(festival && festival.起 && festival.止)
  if (special) { routine = special.作息 || '日常'; label = special.名 }
  else if (vacation) { routine = vacation.作息 || '假期'; label = vacation.名 }
  else if (festivalHoliday) { routine = '假期'; label = festival.名 }
  else if ((cfg.晚起日 || []).includes(t.weekday)) routine = '晚起'
  return {
    holiday: !!(vacation || festivalHoliday),
    special: special || null,
    vacation: vacation || null,
    term: term || null,
    festival,
    routine,
    label,
    dayIndex: vacation ? (dayDiff(vacation.起, t.ymd) + 1) : (special ? (dayDiff(special.起, t.ymd) + 1) : 0),
  }
}

export function todayDeviation(cfg, t, routine) {
  const p = cfg.偏离 || {}
  const r = rng(hashSeed(t.ymd, 'derail'))
  const out = {}
  if (routine !== '假期' && r() < Number(p.躺平日 ?? 0.12)) out.flat = true
  else if (routine !== '备考' && r() < Number(p.出门日 ?? 0.1)) out.outing = true
  if (!out.flat && routine === '日常' && (cfg.课表 || {})[t.weekday] && r() < Number(p.翘下午课 ?? 0.08)) out.skipAfternoon = true
  return out
}

export function menstrualDay(cfg, ymd) {
  const p = cfg.经期 || {}
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(p.起始 || '')) ? Date.parse(String(p.起始) + 'T00:00:00Z') : NaN
  if (!Number.isFinite(start)) return 0
  const now = Date.parse(ymd + 'T00:00:00Z')
  if (!Number.isFinite(now)) return 0
  const days = Math.floor((now - start) / 86400000)
  const cycle = Math.max(1, Math.round(Number(p.周期) || 29))
  const length = Math.max(1, Math.round(Number(p.天数) || 5))
  const pos = ((days % cycle) + cycle) % cycle
  return pos < length ? pos + 1 : 0
}

/**
 * A cold is an episode, not an independent daily coin flip: a start day seeded
 * by the date lasts 2–3 days, so "嗓子有点紧" cannot appear and vanish overnight.
 */
export function coldEpisode(cfg, ymd) {
  const month = Number(String(ymd).slice(5, 7))
  if (!Number.isFinite(month)) return null
  const chance = [3, 4, 10, 11].includes(month) ? 0.075 : [12, 1, 2].includes(month) ? 0.05 : 0.02
  // Prefer an older ongoing episode over a fresh start, so a runny nose
  // does not reset to "day 1" just because today's coin also landed cold.
  for (let back = 2; back >= 0; back--) {
    const day = shiftDay(ymd, -back)
    if (!day) continue
    const startRoll = rng(hashSeed(day, 'cold-start'))()
    if (startRoll >= chance) continue
    const duration = rng(hashSeed(day, 'cold-duration'))() < 0.45 ? 2 : 3
    const dayIndex = back + 1
    if (dayIndex <= duration) return { day: dayIndex, duration, start: day }
  }
  return null
}

export function spokenClock(minute) {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = m % 60
  const words = ['十二', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十', '十一']
  const hw = words[h % 12]
  if (mm === 0) return `${hw}点`
  if (mm === 30) return `${hw}点半`
  return `${pad2(h)}:${pad2(mm)}`
}

/**
 * Last night's sleep, combining yesterday evening and today before noon. Falls
 * back to the routine's own sleep row when neither plan exists yet.
 */
export function lastNightSleep(cfg, t, todayItems, nowMinute = null) {
  const yesterday = readPlan(shiftDay(t.ymd, -1))
  const limit = Number.isFinite(nowMinute) ? nowMinute : 12 * 60
  const evening = (yesterday?.items || []).filter((x) => x && sleepText.test(x.what) && x.start >= 16 * 60)
  const morning = (todayItems || []).filter((x) => x && sleepText.test(x.what) && x.end <= Math.min(12 * 60, limit) && x.start < 12 * 60)
  let minutes = 0
  let startMinute = null
  let wakeMinute = null
  let source = 'plans'
  for (const row of evening) {
    minutes += Math.max(0, row.end - row.start)
    if (startMinute === null) startMinute = row.start
  }
  for (const row of morning) {
    minutes += Math.max(0, row.end - row.start)
    if (startMinute === null) startMinute = row.start
    wakeMinute = Math.max(wakeMinute ?? 0, row.end)
  }
  // Still inside today's main sleep: this is not "last night", it is this
  // night. Keep the elapsed part only, so a 00:30 question does not claim 8h.
  const ongoing = (todayItems || []).find((x) => x && /睡/.test(x.what) && x.start <= limit && x.end > limit)
  if (ongoing) {
    minutes = Math.max(0, limit - ongoing.start)
    startMinute = ongoing.start
    wakeMinute = null
    source = 'ongoing'
  } else if (!morning.length && limit < 6 * 60 && (yesterday?.items || []).length) {
    // Before dawn with no ongoing sleep: use the last completed main sleep
    // instead of pretending the future 02:00–08:30 segment already happened.
    const longest = (yesterday.items || []).filter((x) => sleepText.test(x.what)).sort((a, b) => (b.end - b.start) - (a.end - a.start))[0]
    if (longest && longest.end - longest.start >= 120) {
      minutes = longest.end - longest.start
      startMinute = longest.start
      wakeMinute = longest.end
      source = 'previous'
    }
  }
  if (minutes < 120 && !morning.length && source !== 'ongoing') {
    const routine = normalizeRoutine(cfg, t && t.routine)
    const sleep = (routine || []).find((x) => sleepText.test(x.what))
    if (sleep) {
      minutes = Math.max(0, sleep.end - sleep.start)
      startMinute = sleep.start
      wakeMinute = sleep.end
      // Before dawn this is still a projection, not a fact — even if a short
      // evening nap exists in yesterday's plan.
      source = limit < 6 * 60 ? 'future' : 'routine'
    }
  }
  return {
    minutes: Math.round(minutes),
    startMinute: Number.isFinite(startMinute) ? startMinute : null,
    wakeMinute: Number.isFinite(wakeMinute) ? wakeMinute : null,
    source,
  }
}

