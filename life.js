// dsh-feiyu-life · life line (pure local computation, no model)
//
// Answers four questions:
//   1. What kind of day is it? (term / vacation / festival / exam week)
//   2. Which routine table applies? (日常 / 晚起 / 假期 / 备考)
//   3. What is she doing right now, is her phone at hand?
//   4. What is weighing on her today? (late night, period, cold, small events)
//
// Output is compressed into a few short lines, injected via systemPrompt.context.
//
// Determinism: three layers of variation (day / hour / ten-minute) keep the
// answer stable within a window but different across hours — like asking a real
// person "what are you doing": same answer twice in five minutes, different two
// hours later.
//
// State is NOT inferred from chat text. State flows from the plan (advanced by
// the clock) plus explicit life_adjust adjustments only — see state.js.

import { readFileSync, writeFileSync, mkdirSync, statSync, renameSync } from 'node:fs'
import { dayType, dailyPlan } from './plan.js'
import { readFacts, buildTimeline, segmentAt, recentSegments, nextSegment } from './state.js'
import { addWorldToTimeline, defaultWorldConfig, normalizeWorldConfig, worldStateAt } from './world.js'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

const dshHome = () => process.env.DSH_HOME || join(homedir(), '.dsh')
export const CONFIG_PATH = join(dshHome(), 'feiyu-life-config.json')

const sectionGate = { 上午: 9, 中午: 12, 下午: 15, 晚上: 19 }
const phoneSuffix = { 静音: '，手机静音', 在手: '', 在床头: '，手机在床头', 不在手边: '，手机不在手边' }
const phoneChoices = ['在手', '静音', '在床头', '不在手边']
const routineNames = ['日常', '晚起', '假期', '备考']
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/
export const LIFE_CONFIG_VERSION = 3

export const defaultConfig = {
  配置版本: LIFE_CONFIG_VERSION,
  总开关: true,
  时区: 'Asia/Shanghai',
  工作区: [],
  地图: defaultWorldConfig,
  模型超时秒: 60,
  历史保留天数: 180,
  经期: { 起始: '2026-11-05', 周期: 29, 天数: 5 },
  校历: {
    学期: [
      { 名: '2026 秋季学期', 起: '2026-09-07', 止: '2027-01-17' },
      { 名: '2027 春季学期', 起: '2027-02-22', 止: '2027-07-04' },
    ],
    假期: [
      { 名: '寒假', 起: '2027-01-18', 止: '2027-02-21', 作息: '假期' },
      { 名: '暑假', 起: '2027-07-05', 止: '2027-08-29', 作息: '假期' },
    ],
    特殊: [{ 名: '期末周', 起: '2027-01-04', 止: '2027-01-17', 作息: '备考' }],
  },
  节日: [
    { 名: '元旦', 月: 1, 日: 1 },
    { 名: '清明', 月: 4, 日: 5 },
    { 名: '劳动节', 月: 5, 日: 1 },
    { 名: '中秋', 月: 9, 日: 25 },
    { 名: '国庆', 起: '2026-10-01', 止: '2026-10-07' },
    { 名: '圣诞', 月: 12, 日: 25 },
    { 名: '春节', 起: '2026-02-17', 止: '2026-02-23' },
    { 名: '春节', 起: '2027-02-06', 止: '2027-02-12' },
  ],
  日常: [
    ['00:00', '01:30', '躺床上刷手机', '在手'],
    ['01:30', '02:00', '刚关灯，还在刷手机', '在手'],
    ['02:00', '08:30', '睡着了', '在床头'],
    ['08:30', '09:10', '刚起，脸还有点肿', '在手'],
    ['09:10', '11:40', '在宿舍磨蹭，或者去自习', '在手'],
    ['11:40', '12:40', '食堂吃饭', '在手'],
    ['12:40', '13:50', '午睡', '不在手边'],
    ['13:50', '18:00', '剪片子、修图', '在手'],
    ['18:00', '19:00', '吃晚饭', '在手'],
    ['19:00', '23:30', '修图、刷 B 站', '在手'],
    ['23:30', '00:00', '洗澡', '不在手边'],
  ],
  晚起: [
    ['00:00', '01:30', '躺床上刷手机', '在手'],
    ['01:30', '10:40', '睡着了', '在床头'],
    ['10:40', '11:20', '刚起，头发乱的', '在手'],
    ['11:20', '11:40', '在宿舍磨蹭', '在手'],
    ['11:40', '12:40', '食堂吃饭', '在手'],
    ['12:40', '13:50', '午睡', '不在手边'],
    ['13:50', '18:00', '剪片子、修图', '在手'],
    ['18:00', '19:00', '吃晚饭', '在手'],
    ['19:00', '23:30', '修图、刷 B 站', '在手'],
    ['23:30', '00:00', '洗澡', '不在手边'],
  ],
  假期: [
    ['00:00', '02:30', '躺床上刷手机', '在手'],
    ['02:30', '11:00', '睡着', '在床头'],
    ['11:00', '12:00', '刚起，脑子是糊的', '在手'],
    ['12:00', '13:00', '随便弄了点吃的', '在手'],
    ['13:00', '15:00', '瘫着看剧', '在手'],
    ['15:00', '18:00', '出门走走，或者拍照', '在手'],
    ['18:00', '19:30', '在外面吃饭', '在手'],
    ['19:30', '01:00', '打游戏、刷手机', '在手'],
  ],
  备考: [
    ['00:00', '02:00', '还在看书', '在手'],
    ['02:00', '09:00', '睡着了', '在床头'],
    ['09:00', '11:30', '图书馆，背书', '静音'],
    ['11:30', '12:30', '食堂吃饭', '在手'],
    ['12:30', '13:30', '趴着眯了一会儿', '不在手边'],
    ['13:30', '17:30', '图书馆，接着背', '静音'],
    ['17:30', '18:30', '吃晚饭', '在手'],
    ['18:30', '01:00', '在宿舍复习', '在手'],
  ],
  晚起日: [4],
  课表: {
    1: [['08:00', '11:30', '上课', '静音'], ['14:00', '17:30', '上专业课', '静音']],
    2: [['14:00', '17:30', '上专业课', '静音']],
    3: [['08:00', '11:30', '上课', '静音']],
    4: [],
    5: [['08:00', '11:30', '上课', '静音'], ['14:00', '17:30', '上专业课', '静音']],
    6: [],
    7: [],
  },
  事件池: [
    ['上午', '快递说放柜子里了，去了没有'],
    ['上午', '早八差点睡过去，进门被老师看了一眼', '早课'],
    ['中午', '食堂新出的窗口，难吃得有点好笑'],
    ['中午', '排队排到门口，最后没吃上'],
    ['下午', '剪的片子被老师夸了一句'],
    ['下午', '图书馆抢到靠窗的座'],
    ['下午', '手机膜又裂了一条'],
    ['晚上', '楼下那只猫又蹲在台阶上'],
    ['晚上', '耳机左耳没声了'],
    ['晚上', '我妈寄的吃的到了，一箱'],
  ],
  偏离: { 躺平日: 0.12, 出门日: 0.1, 翘下午课: 0.08 },
}

const copy = (value) => JSON.parse(JSON.stringify(value))
const clamp = (value, min, max, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function validTimeZone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: String(value) }).format(new Date())
    return true
  } catch { return false }
}

function normalizeRows(rows, path, issues) {
  if (!Array.isArray(rows)) {
    issues.push(`${path} 不是数组，已恢复为空`)
    return []
  }
  return rows.flatMap((row, i) => {
    if (!Array.isArray(row) || !timePattern.test(String(row[0] || '')) || !timePattern.test(String(row[1] || ''))) {
      issues.push(`${path}[${i}] 的时间无效，已忽略`)
      return []
    }
    const phone = phoneChoices.includes(String(row[3])) ? String(row[3]) : '在手'
    if (phone !== row[3]) issues.push(`${path}[${i}] 的手机状态已改为「在手」`)
    return [[String(row[0]), String(row[1]), String(row[2] || '闲着').trim().slice(0, 80) || '闲着', phone]]
  })
}

function normalizeRanges(rows, path, withRoutine, issues) {
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row, i) => {
    const start = String(row && row.起 || '')
    const end = String(row && row.止 || '')
    if (!row || !datePattern.test(start) || !datePattern.test(end) || start > end) {
      issues.push(`${path}[${i}] 的日期范围无效，已忽略`)
      return []
    }
    const out = { 名: String(row.名 || '未命名').trim().slice(0, 40) || '未命名', 起: start, 止: end }
    if (withRoutine) out.作息 = routineNames.includes(row.作息) ? row.作息 : (path.endsWith('假期') ? '假期' : '日常')
    return [out]
  })
}

/** Normalize all user-editable configuration at the persistence boundary. */
export function normalizeConfig(input, issues = []) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const cfg = { ...copy(defaultConfig), ...raw }

  cfg.配置版本 = LIFE_CONFIG_VERSION
  cfg.总开关 = raw.总开关 !== false
  cfg.时区 = validTimeZone(raw.时区 || defaultConfig.时区) ? String(raw.时区 || defaultConfig.时区) : defaultConfig.时区
  if (raw.时区 && cfg.时区 !== raw.时区) issues.push(`时区「${raw.时区}」无效，已恢复为 ${defaultConfig.时区}`)
  cfg.工作区 = Array.isArray(raw.工作区)
    ? [...new Set(raw.工作区.map((x) => String(x || '').trim()).filter(Boolean))]
    : copy(defaultConfig.工作区)
  cfg.模型超时秒 = Math.round(clamp(raw.模型超时秒, 10, 300, defaultConfig.模型超时秒))
  cfg.历史保留天数 = Math.round(clamp(raw.历史保留天数, 7, 3650, defaultConfig.历史保留天数))
  cfg.地图 = normalizeWorldConfig(raw.地图 || defaultConfig.地图)

  const period = raw.经期 && typeof raw.经期 === 'object' ? raw.经期 : {}
  const cycle = Math.round(clamp(period.周期, 1, 120, defaultConfig.经期.周期))
  cfg.经期 = {
    起始: datePattern.test(String(period.起始 || '')) ? String(period.起始) : defaultConfig.经期.起始,
    周期: cycle,
    天数: Math.round(clamp(period.天数, 1, cycle, defaultConfig.经期.天数)),
  }

  const calendar = raw.校历 && typeof raw.校历 === 'object' ? raw.校历 : defaultConfig.校历
  cfg.校历 = {
    学期: normalizeRanges(calendar.学期, '校历.学期', false, issues),
    假期: normalizeRanges(calendar.假期, '校历.假期', true, issues),
    特殊: normalizeRanges(calendar.特殊, '校历.特殊', true, issues),
  }

  cfg.节日 = (Array.isArray(raw.节日) ? raw.节日 : defaultConfig.节日).flatMap((row, i) => {
    if (!row || typeof row !== 'object') return []
    const name = String(row.名 || '未命名').trim().slice(0, 40) || '未命名'
    if (row.起 || row.止) {
      const start = String(row.起 || '')
      const end = String(row.止 || '')
      if (datePattern.test(start) && datePattern.test(end) && start <= end) return [{ 名: name, 起: start, 止: end }]
    } else {
      const month = Math.round(Number(row.月))
      const day = Math.round(Number(row.日))
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return [{ 名: name, 月: month, 日: day }]
    }
    issues.push(`节日[${i}] 无效，已忽略`)
    return []
  })

  for (const name of routineNames) cfg[name] = normalizeRows(raw[name] ?? defaultConfig[name], name, issues)
  const timetable = raw.课表 && typeof raw.课表 === 'object' ? raw.课表 : defaultConfig.课表
  cfg.课表 = {}
  for (let day = 1; day <= 7; day++) cfg.课表[day] = normalizeRows(timetable[day] || [], `课表.${day}`, issues)
  cfg.晚起日 = [...new Set((Array.isArray(raw.晚起日) ? raw.晚起日 : defaultConfig.晚起日)
    .map(Number).filter((x) => Number.isInteger(x) && x >= 1 && x <= 7))].sort((a, b) => a - b)

  cfg.事件池 = (Array.isArray(raw.事件池) ? raw.事件池 : defaultConfig.事件池).flatMap((row) => {
    if (!Array.isArray(row) || !sectionGate[row[0]] || !String(row[1] || '').trim()) return []
    const out = [row[0], String(row[1]).trim().slice(0, 100)]
    if (row[2] === '早课') out.push('早课')
    return [out]
  })
  const deviation = raw.偏离 && typeof raw.偏离 === 'object' ? raw.偏离 : {}
  cfg.偏离 = {
    躺平日: clamp(deviation.躺平日, 0, 1, defaultConfig.偏离.躺平日),
    出门日: clamp(deviation.出门日, 0, 1, defaultConfig.偏离.出门日),
    翘下午课: clamp(deviation.翘下午课, 0, 1, defaultConfig.偏离.翘下午课),
  }
  return cfg
}

export function validateConfig(input) {
  const issues = []
  const config = normalizeConfig(input, issues)
  for (const name of routineNames) {
    if (!config[name].some((row) => /睡/.test(row[2]))) issues.push(`${name}作息里没有包含「睡」的时段`)
    const rows = config[name].map((row) => {
      const start = toMinute(row[0])
      let end = toMinute(row[1])
      if (end <= start) end += 1440
      return { start, end }
    }).sort((a, b) => a.start - b.start)
    if (rows.length && rows[0].start > 0) issues.push(`${name}作息从 00:00 到 ${rows[0].start < 60 ? '00:' + pad2(rows[0].start) : minuteLabel(rows[0].start)} 没有覆盖`)
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].start < rows[i - 1].end) { issues.push(`${name}作息存在重叠时段`); break }
      if (rows[i].start > rows[i - 1].end) { issues.push(`${name}作息存在未覆盖的空档`); break }
    }
    if (rows.length && rows.at(-1).end < 1440) issues.push(`${name}作息没有覆盖到 24:00`)
  }
  return { config, issues }
}

function toMinute(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim())
  if (!m) return -1
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (minute > 59 || hour > 24 || (hour === 24 && minute !== 0)) return -1
  return hour * 60 + minute
}

function pad2(n) { return String(n).padStart(2, '0') }

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

/** Epoch milliseconds for 00:00 in the already-resolved local day. */
export function zonedDateTimeMs(ymd, minuteOfDay, tz = 'Asia/Shanghai') {
  const target = Date.parse(`${ymd}T00:00:00Z`) + minuteOfDay * 60000
  if (!Number.isFinite(target)) return NaN
  let guess = target
  for (let i = 0; i < 4; i++) {
    const p = zonedNow(new Date(guess), tz)
    const represented = Date.parse(`${p.ymd}T${pad2(p.hour)}:${pad2(p.minute)}:00Z`)
    const delta = target - represented
    guess += delta
    if (!delta) break
  }
  return guess
}

export function zonedDayStartMs(_now, zoned, tz = 'Asia/Shanghai') {
  return zonedDateTimeMs(zoned.ymd, 0, tz)
}

export function addZonedDays(now, tz, days) {
  const current = zonedNow(now, tz)
  const targetYmd = new Date(Date.parse(`${current.ymd}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
  return new Date(zonedDateTimeMs(targetYmd, 12 * 60, tz))
}

function hashSeed(ymd, salt = '') {
  let h = 2166136261
  const s = ymd + '|' + salt
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function rng(seedValue) {
  let a = seedValue >>> 0
  return function () {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dayDiff(a, b) {
  const x = Date.parse(a + 'T00:00:00Z')
  const y = Date.parse(b + 'T00:00:00Z')
  if (!Number.isFinite(x) || !Number.isFinite(y)) return NaN
  return Math.floor((y - x) / 86400000)
}

function inRange(ymd, start, end) {
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
  if (routine === '日常' && (cfg.课表 || {})[t.weekday] && r() < Number(p.翘下午课 ?? 0.08)) out.skipAfternoon = true
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

function todayEvents(cfg, t, allowMorning = true) {
  const classes = Array.isArray((cfg.课表 || {})[t.weekday]) ? cfg.课表[t.weekday] : []
  const hasMorning = allowMorning && classes.some((b) => Array.isArray(b) && toMinute(b[0]) >= 0 && toMinute(b[0]) < 10 * 60)
  const pool = (Array.isArray(cfg.事件池) ? cfg.事件池 : [])
    .filter((x) => Array.isArray(x) && x.length >= 2 && x[1])
    .filter((x) => x[2] !== '早课' || hasMorning)
  if (!pool.length) return []
  const r = rng(hashSeed(t.ymd, 'events'))
  const count = r() < 0.55 ? 2 : 1
  const indices = pool.map((_, i) => i)
  const picked = []
  for (let k = 0; k < count && indices.length; k++) {
    const i = Math.floor(r() * indices.length) % indices.length
    picked.push(pool[indices.splice(i, 1)[0]])
  }
  return picked.filter(([section]) => t.hour >= (sectionGate[section] || 0)).map(([, text]) => String(text))
}

function hourVariant(t, what) {
  const r = rng(hashSeed(t.ymd, 'hour' + t.hour))
  if (r() > 0.4) return ''
  const pool = /睡/.test(what) ? ['', '', '']
    : /课/.test(what) ? ['，有点坐不住', '，眼睛发干', '，在想下课吃什么']
      : ['，有点坐不住', '，眼睛发干', '，脖子有点僵', '，想喝冰的']
  return pool[Math.floor(r() * pool.length) % pool.length]
}

function tempAction(t) {
  const r = rng(hashSeed(t.ymd, 'min' + Math.floor(t.minuteOfDay / 10)))
  if (r() > 0.07) return ''
  const pool = ['，刚去接了杯水', '，去楼下拿了个快递', '，在等外卖', '，顺手把衣服晾了']
  return pool[Math.floor(r() * pool.length) % pool.length]
}

/** Today's base mood: doesn't touch the mood value, just one line about how she feels. */
function moodTint(period, cold, tired, good) {
  if (period === 1 || period === 2) return '整个人有点蔫'
  if (tired) return '眼皮沉'
  if (good) return '心情还不错'
  return ''
}

function wakeMinute(cfg, t, calendar) {
  const table = cfg[calendar.routine] || cfg.日常 || []
  for (const b of table) {
    if (Array.isArray(b) && /睡/.test(String(b[2] || ''))) return toMinute(b[1])
  }
  const starts = table.map((b) => toMinute(Array.isArray(b) ? b[0] : '')).filter((x) => x >= 0)
  return starts.length ? Math.min(...starts) : 8 * 60
}

function weekdayName(n) {
  return ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'][n] || ''
}

function minuteLabel(minute) {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}

/** Compress into a few lines, plus "why it computed this way". */
export function generate(cfg, now = new Date()) {
  const empty = { text: '', evidence: [] }
  if (!cfg || cfg.总开关 === false) return empty
  const tz = String(cfg.时区 || 'Asia/Shanghai')
  const t = zonedNow(now, tz)
  const calendar = todayCalendar(cfg, t)
  const deviation = todayDeviation(cfg, t, calendar.routine)
  const type = dayType(cfg, t, calendar)
  const plan = dailyPlan(cfg, t, calendar, deviation, type)
  const dayStartMs = zonedDayStartMs(now, t, tz)
  const baseTimeline = buildTimeline(plan.items, readFacts(t.ymd), dayStartMs, (minute) => zonedDateTimeMs(t.ymd, minute, tz))
  const timeline = addWorldToTimeline(baseTimeline, cfg.地图)
  const current = segmentAt(timeline, now.getTime()) || { what: '闲着', phone: '在手', outfit: '' }
  const world = worldStateAt(timeline, now.getTime(), cfg.地图)
  const localMinute = (ms) => {
    const at = zonedNow(new Date(ms), tz)
    const delta = dayDiff(t.ymd, at.ymd)
    return (Number.isFinite(delta) ? delta : 0) * 1440 + at.minuteOfDay
  }

  const evidence = []
  evidence.push(calendar.special ? `${calendar.special.名}第 ${calendar.dayIndex} 天`
    : calendar.vacation ? `${calendar.vacation.名}第 ${calendar.dayIndex} 天`
      : (calendar.festival && calendar.festival.起) ? `${calendar.festival.名}放假`
        : calendar.term ? `学期中（${calendar.term.名}）`
          : '不在校历里，按平常走')
  evidence.push(`日子类型：${type.name}｜作息表：${calendar.routine}`)
  if (world.location) evidence.push(world.moving && world.destination
    ? `位置：${world.location.name} → ${world.destination.name}`
    : `位置：${world.location.name}`)
  evidence.push(`此刻命中：${current.what}（手机${current.phone || '在手'}${current.outfit ? '，穿' + current.outfit : ''}）`)
  if (deviation.flat) evidence.push('今天没按表走：躺平')
  if (deviation.outing) evidence.push('今天没按表走：临时出门')
  if (deviation.skipAfternoon) evidence.push('今天没按表走：翘了下午的课')

  const r = rng(hashSeed(t.ymd, 'sleep'))
  const sleepAt = [60, 120, 150][Math.floor(r() * 3) % 3]
  const wake = wakeMinute(cfg, t, calendar)
  const tired = wake - sleepAt < 360
  const period = menstrualDay(cfg, t.ymd)
  const cold = r() < 0.08 && [3, 4, 10, 11].includes(t.month)
  const events = todayEvents(cfg, t, !calendar.holiday)

  const conditions = []
  if (tired && t.minuteOfDay < 15 * 60) conditions.push(`昨晚${sleepAt === 60 ? '一点' : sleepAt === 120 ? '两点' : '两点半'}才睡`)
  if (period) conditions.push(period <= 3 ? '腰有点酸' : '肚子还坠着')
  if (cold) conditions.push('嗓子有点紧')
  for (const e of events) conditions.push(e)
  const good = events.some((x) => /夸|猫|寄的/.test(x))
  const tint = moodTint(period, cold, tired, good)
  if (tint) conditions.push(tint)

  const lines = []
  lines.push(`（今天）${t.month}月${t.day}日 ${weekdayName(t.weekday)}·${type.name}${conditions.length ? '。' + conditions.slice(0, 2).join('；') : '。'}。`)

  let nowLine = `（此刻）${current.what}`
  if (current.phone && current.phone !== '在手') nowLine += phoneSuffix[current.phone] || ''
  if (current.outfit && !/睡/.test(current.what)) nowLine += `，身上是${current.outfit}`
  if (!/睡/.test(current.what) && !deviation.flat) nowLine += hourVariant(t, current.what) + tempAction(t)
  lines.push(nowLine + '。')

  const recent = recentSegments(timeline, now.getTime()).slice(0, 2).reverse()
  if (recent.length) lines.push(`（早些时候）${recent.map((x) => x.what).join('，然后')}。`)
  const next = nextSegment(timeline, now.getTime())
  if (next) lines.push(`（接下来）${minuteLabel(localMinute(next.start))} ${next.what}。`)

  if (t.hour >= 18) {
    const tomorrow = zonedNow(addZonedDays(now, tz, 1), tz)
    const tomorrowCal = todayCalendar(cfg, tomorrow)
    const tomorrowType = dayType(cfg, tomorrow, tomorrowCal)
    const tomorrowPlan = dailyPlan(cfg, tomorrow, tomorrowCal, {}, tomorrowType)
    const firstWake = tomorrowPlan.items.find((x) => x.start >= 6 * 60 && !/睡/.test(x.what))
    lines.push(`（明天）${weekdayName(tomorrow.weekday)}·${tomorrowType.name}${firstWake ? `，${minuteLabel(firstWake.start)} ${firstWake.what}` : ''}。`)
  }

  lines.push('（说话）这些是你自己的日子，别当时间表念：不说"按日程/计划/安排"，不报时间段、不列清单；他问起就像闲聊挑一两件说，带点感受。你的场景以「（此刻）」这行为准；他说他在地铁/公司/家，那是他的场景，别安到自己身上。')

  return {
    text: lines.join('\n'),
    evidence,
    current,
    calendar,
    deviation,
    dayType: type,
    today: conditions,
    plan,
    world,
    currentMinute: t.minuteOfDay,
    timeline: timeline.map((x) => ({
      start: localMinute(x.start),
      end: localMinute(x.end),
      what: x.what || '',
      phone: x.phone || '在手',
      outfit: x.outfit || '',
      source: x.source || 'plan',
      behavior: x.behavior || 'idle',
      locationId: x.locationId || '',
      from: x.from || '',
      to: x.to || '',
    })),
  }
}

let cache = { at: 0, cfg: null }

function migrateConfig(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const version = Math.max(0, Math.round(Number(source.配置版本) || 0))
  const next = { ...source }
  // v1: calendar/routine defaults became explicit; normalizeConfig fills them.
  // v2: workspace, timeout and retention became first-class persisted fields.
  if (version < 2) {
    if (!Array.isArray(next.工作区)) next.工作区 = []
    if (next.模型超时秒 === undefined) next.模型超时秒 = defaultConfig.模型超时秒
    if (next.历史保留天数 === undefined) next.历史保留天数 = defaultConfig.历史保留天数
  }
  // v3: logical map and automatic travel became part of the shared world state.
  if (version < 3 && (!next.地图 || typeof next.地图 !== 'object')) next.地图 = copy(defaultConfig.地图)
  next.配置版本 = LIFE_CONFIG_VERSION
  return { value: next, changed: version !== LIFE_CONFIG_VERSION }
}

function writeConfigFile(value) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true })
  const tmp = CONFIG_PATH + '.tmp'
  writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
  renameSync(tmp, CONFIG_PATH)
}

export function readConfig() {
  try {
    const st = statSync(CONFIG_PATH)
    if (cache.cfg && cache.at === st.mtimeMs) return cache.cfg
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
    const migrated = migrateConfig(raw)
    const cfg = normalizeConfig(migrated.value)
    if (migrated.changed) writeConfigFile(cfg)
    cache = { at: statSync(CONFIG_PATH).mtimeMs || st.mtimeMs, cfg }
    return cfg
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      try { writeConfigFile(defaultConfig) } catch {}
    }
    cache = { at: 0, cfg: defaultConfig }
    return defaultConfig
  }
}

export function saveConfig(patch) {
  const prev = readConfig()
  const next = normalizeConfig({ ...prev, ...(patch && typeof patch === 'object' ? patch : {}) })
  writeConfigFile(next)
  cache = { at: 0, cfg: null }
  return next
}

export { pad2, phoneChoices }

