// dsh-feiyu-life · life line (pure local computation, no model)
//
// Answers five questions:
//   1. What kind of day is it? (term / vacation / festival / exam week)
//   2. Which routine table applies? (日常 / 晚起 / 假期 / 备考)
//   3. What is she doing right now, can she reply?
//   4. How much energy does she actually have today, and why?
//   5. What small thing of the day is still going on?
//
// Output is compressed into a few short lines, injected via systemPrompt.context.
//
// Determinism: the plan is fixed for a date; within it, only segment boundaries
// and the stages of "today's small thing" can change the wording. There is no
// hourly resampling, so two questions five minutes apart cannot produce two
// different lives.
//
// State is NOT inferred from chat text. State flows from the plan (advanced by
// the clock) plus explicit life_adjust adjustments only — see state.js.

import { mkdirSync, statSync } from 'node:fs'
import { dayType, dailyPlan, readPlan, normalizeRoutine, normalizeWardrobe, timelineCoverage } from './plan.js'
import { readFacts, buildTimeline, segmentAt, recentSegments } from './state.js'
import { addWorldToTimeline, buildReplayFrames, defaultWorldConfig, normalizeWorldConfig, worldStateAt } from './world.js'
import { ensureMoments, momentContext } from './moments.js'
import { atomicWriteJson, quarantine, readJsonBounded, withLock } from './storage.js'
import { defaultSharingConfig, normalizeSharingConfig } from './sharing.js'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

const dshHome = () => process.env.DSH_HOME || join(homedir(), '.dsh')
export const configPath = () => join(dshHome(), 'feiyu-life-config.json')
// Kept for callers that display the path; read/write always resolve it live.
export const CONFIG_PATH = join(dshHome(), 'feiyu-life-config.json')

const phoneChoices = ['在手', '静音', '在床头', '不在手边']
const routineNames = ['日常', '晚起', '假期', '备考']
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/
const CONFIG_MAX_BYTES = 2 * 1024 * 1024
const sleepText = /(?:睡着|午睡|补觉|还睡着|睡熟|睡了|睡到|睡觉)/
export const LIFE_CONFIG_VERSION = 12

export const defaultConfig = {
  配置版本: LIFE_CONFIG_VERSION,
  总开关: true,
  时区: 'Asia/Shanghai',
  工作区: [],
  角色设定: '',
  衣柜: normalizeWardrobe(),
  地图: defaultWorldConfig,
  模型超时秒: 60,
  历史保留天数: 180,
  连续性: { 启用: true, 结算间隔分钟: 10, 每日成果上限: 2, 自主主线: false },
  内在: {
    启用: true,
    反思模式: '重要回合',
    每日反思上限: 30,
    基线心情: 55,
    回稳半衰期小时: 8,
    注入阈值: 6,
    反思超时秒: 45,
    反思Provider: '',
    反思模型: '',
  },
  人格: {
    启用: true,
    自我叙事: '我是大肥鱼，一个有自己生活节奏、会在意关系也会保留边界的人。',
    核心特质: ['嘴硬心软', '有点懒', '重感情'],
    核心价值: ['真诚', '尊重边界', '说到做到'],
    记忆启用: true,
    自动沉淀: true,
    记忆重要度阈值: 0.68,
    记忆置信度阈值: 0.72,
    记忆上限: 500,
    召回条数: 6,
    召回字数: 800,
    外部插件兼容: '内建优先',
    主动: { 启用: false, 检查间隔分钟: 15, 安静开始: 0, 安静结束: 8, 冷却分钟: 240, 每日上限: 2, 未互动分钟: 180, 基础概率: 0.15, 外部主动搭话优先: true },
  },
  主动分享: defaultSharingConfig,
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
    issues.push(`${path} 不是数组，已忽略`)
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

function validMonthDay(month, day) {
  const m = Math.round(Number(month))
  const d = Math.round(Number(day))
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false
  const dt = new Date(Date.UTC(2024, m - 1, d))
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
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
  cfg.角色设定 = String(raw.角色设定 || '').trim().slice(0, 500)
  cfg.衣柜 = normalizeWardrobe(raw.衣柜)
  cfg.模型超时秒 = Math.round(clamp(raw.模型超时秒, 10, 300, defaultConfig.模型超时秒))
  cfg.历史保留天数 = Math.round(clamp(raw.历史保留天数, 7, 3650, defaultConfig.历史保留天数))
  const continuity = raw.连续性 && typeof raw.连续性 === 'object' ? raw.连续性 : defaultConfig.连续性
  cfg.连续性 = {
    启用: continuity.启用 !== false,
    结算间隔分钟: Math.round(clamp(continuity.结算间隔分钟, 5, 60, defaultConfig.连续性.结算间隔分钟)),
    每日成果上限: Math.round(clamp(continuity.每日成果上限, 0, 10, defaultConfig.连续性.每日成果上限)),
    // 1.2.0 deliberately does not autonomously create long-term threads.
    自主主线: false,
  }
  const inner = raw.内在 && typeof raw.内在 === 'object' ? raw.内在 : defaultConfig.内在
  cfg.内在 = {
    启用: inner.启用 !== false,
    反思模式: ['关闭', '重要回合', '每轮'].includes(inner.反思模式) ? inner.反思模式 : defaultConfig.内在.反思模式,
    每日反思上限: Math.round(clamp(inner.每日反思上限, 1, 200, defaultConfig.内在.每日反思上限)),
    基线心情: Math.round(clamp(inner.基线心情, 20, 80, defaultConfig.内在.基线心情)),
    回稳半衰期小时: Math.round(clamp(inner.回稳半衰期小时, 1, 72, defaultConfig.内在.回稳半衰期小时)),
    注入阈值: Math.round(clamp(inner.注入阈值, 1, 20, defaultConfig.内在.注入阈值)),
    反思超时秒: Math.round(clamp(inner.反思超时秒, 10, 120, defaultConfig.内在.反思超时秒)),
    反思Provider: String(inner.反思Provider || '').trim().slice(0, 100),
    反思模型: String(inner.反思模型 || '').trim().slice(0, 160),
  }
  const persona = raw.人格 && typeof raw.人格 === 'object' ? raw.人格 : defaultConfig.人格
  const proactive = persona.主动 && typeof persona.主动 === 'object' ? persona.主动 : defaultConfig.人格.主动
  cfg.人格 = {
    启用: persona.启用 !== false,
    自我叙事: String(persona.自我叙事 || defaultConfig.人格.自我叙事).trim().slice(0, 500),
    核心特质: [...new Set((Array.isArray(persona.核心特质) ? persona.核心特质 : defaultConfig.人格.核心特质).map((x) => String(x || '').trim().slice(0, 40)).filter(Boolean))].slice(0, 12),
    核心价值: [...new Set((Array.isArray(persona.核心价值) ? persona.核心价值 : defaultConfig.人格.核心价值).map((x) => String(x || '').trim().slice(0, 40)).filter(Boolean))].slice(0, 12),
    记忆启用: persona.记忆启用 !== false,
    自动沉淀: persona.自动沉淀 !== false,
    记忆重要度阈值: clamp(persona.记忆重要度阈值, 0.3, 1, defaultConfig.人格.记忆重要度阈值),
    记忆置信度阈值: clamp(persona.记忆置信度阈值, 0.3, 1, defaultConfig.人格.记忆置信度阈值),
    记忆上限: Math.round(clamp(persona.记忆上限, 50, 2000, defaultConfig.人格.记忆上限)),
    召回条数: Math.round(clamp(persona.召回条数, 1, 12, defaultConfig.人格.召回条数)),
    召回字数: Math.round(clamp(persona.召回字数, 200, 1600, defaultConfig.人格.召回字数)),
    外部插件兼容: ['内建优先', '外部优先'].includes(persona.外部插件兼容) ? persona.外部插件兼容 : defaultConfig.人格.外部插件兼容,
    主动: {
      启用: proactive.启用 === true,
      检查间隔分钟: Math.round(clamp(proactive.检查间隔分钟, 5, 120, defaultConfig.人格.主动.检查间隔分钟)),
      安静开始: Math.round(clamp(proactive.安静开始, 0, 23, defaultConfig.人格.主动.安静开始)),
      安静结束: Math.round(clamp(proactive.安静结束, 0, 23, defaultConfig.人格.主动.安静结束)),
      冷却分钟: Math.round(clamp(proactive.冷却分钟, 30, 1440, defaultConfig.人格.主动.冷却分钟)),
      每日上限: Math.round(clamp(proactive.每日上限, 0, 10, defaultConfig.人格.主动.每日上限)),
      未互动分钟: Math.round(clamp(proactive.未互动分钟, 30, 10080, defaultConfig.人格.主动.未互动分钟)),
      基础概率: clamp(proactive.基础概率, 0, 1, defaultConfig.人格.主动.基础概率),
      外部主动搭话优先: proactive.外部主动搭话优先 !== false,
    },
  }
  cfg.地图 = normalizeWorldConfig(raw.地图 || defaultConfig.地图)
  cfg.主动分享 = normalizeSharingConfig(raw.主动分享, issues)

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
      if (validMonthDay(month, day)) return [{ 名: name, 月: month, 日: day }]
    }
    issues.push(`节日[${i}] 无效，已忽略`)
    return []
  })

  for (const name of routineNames) {
    const rows = raw[name]
    cfg[name] = Array.isArray(rows) ? normalizeRows(rows, name, issues) : copy(defaultConfig[name])
  }
  const timetable = raw.课表 && typeof raw.课表 === 'object' && !Array.isArray(raw.课表) ? raw.课表 : defaultConfig.课表
  cfg.课表 = {}
  for (let day = 1; day <= 7; day++) cfg.课表[day] = normalizeRows(timetable[day] || [], `课表.${day}`, issues)
  cfg.晚起日 = [...new Set((Array.isArray(raw.晚起日) ? raw.晚起日 : defaultConfig.晚起日)
    .map(Number).filter((x) => Number.isInteger(x) && x >= 1 && x <= 7))].sort((a, b) => a - b)

  // v6 removed the parallel event pool: the daily model plan is the sole source
  // of story beats, and life_adjust is the sole post-generation mutation path.
  delete cfg.事件池
  const deviation = raw.偏离 && typeof raw.偏离 === 'object' ? raw.偏离 : {}
  cfg.偏离 = {
    躺平日: clamp(deviation.躺平日, 0, 1, defaultConfig.偏离.躺平日),
    出门日: clamp(deviation.出门日, 0, 1, defaultConfig.偏离.出门日),
    翘下午课: clamp(deviation.翘下午课, 0, 1, defaultConfig.偏离.翘下午课),
  }
  return cfg
}

function routineRowBounds(config, name) {
  return (config[name] || []).map((row) => {
    const start = toMinute(row[0])
    let end = toMinute(row[1])
    if (end <= start) end += 1440
    return { start, end }
  }).sort((a, b) => a.start - b.start)
}

export function validateConfig(input) {
  const issues = []
  const config = normalizeConfig(input, issues)
  for (const name of routineNames) {
    if (!config[name].length) { issues.push(`${name}作息为空，运行时会退回内置模板`); continue }
    if (!config[name].some((row) => /睡/.test(row[2]))) issues.push(`${name}作息里没有包含「睡」的时段`)
    const rows = routineRowBounds(config, name)
    if (rows.length && rows[0].start > 0) issues.push(`${name}作息从 00:00 到 ${minuteLabel(rows[0].start)} 没有覆盖`)
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].start < rows[i - 1].end) { issues.push(`${name}作息存在重叠时段`); break }
      if (rows[i].start > rows[i - 1].end) { issues.push(`${name}作息存在未覆盖的空档`); break }
    }
    if (rows.length && rows.at(-1).end < 1440) issues.push(`${name}作息没有覆盖到 24:00`)
  }
  for (let day = 1; day <= 7; day++) {
    const rows = routineRowBounds(config.课表, String(day)).filter((x) => x.start >= 0 && x.end > x.start)
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].start < rows[i - 1].end) { issues.push(`课表.${day} 存在课程时间重叠，运行时后者会被截断`); break }
    }
  }
  for (const [key, label] of [['学期', '校历.学期'], ['假期', '校历.假期'], ['特殊', '校历.特殊']]) {
    const rows = (config.校历[key] || []).slice().sort((a, b) => a.起.localeCompare(b.起))
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].起 <= rows[i - 1].止) { issues.push(`${label} 日期范围重叠：${rows[i].名}`); break }
    }
  }
  const rawInput = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (typeof rawInput.角色设定 !== 'undefined' && typeof rawInput.角色设定 !== 'string') issues.push('角色设定必须是文本')
  if (typeof rawInput.角色设定 === 'string' && rawInput.角色设定.length > 500) issues.push('角色设定超过 500 字，保存时会截断')
  if (rawInput.衣柜 !== undefined) {
    if (!rawInput.衣柜 || typeof rawInput.衣柜 !== 'object' || Array.isArray(rawInput.衣柜)) {
      issues.push('衣柜必须是按分类分组的对象，已恢复默认')
    } else {
      for (const key of Object.keys(defaultConfig.衣柜)) {
        const list = rawInput.衣柜[key]
        if (list === undefined) continue
        if (!Array.isArray(list)) { issues.push(`衣柜.${key} 必须是数组，已恢复默认`); continue }
        if (!list.length) issues.push(`衣柜.${key} 不能为空，已恢复默认`)
        if (list.length > 12) issues.push(`衣柜.${key} 最多 12 件，多余项会截断`)
        if (list.some((x) => String(x || '').trim().length > 12)) issues.push(`衣柜.${key} 有名称超过 12 字，会截断`)
        if (list.some((x) => !String(x || '').trim())) issues.push(`衣柜.${key} 有空名称，已忽略`)
      }
    }
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

function minuteLabel(minute) {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}

const clockOf = (minute) => minuteLabel(minute)

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

function shiftDay(ymd, days) {
  const base = Date.parse(`${ymd}T00:00:00Z`)
  return Number.isFinite(base) ? new Date(base + days * 86400000).toISOString().slice(0, 10) : ''
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

function spokenClock(minute) {
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

/** How coherent are phone, activity and reply speed? */
export function replyReadiness({ phone = '在手', what = '', behavior = '', source = '' } = {}) {
  const text = String(what || '')
  if (behavior === 'sleep' || sleepText.test(text)) return { id: 'asleep', label: '睡着了，回不了' }
  if (behavior === 'bath' || /洗澡|冲澡|洗漱|刷牙|洗脸|面膜|洗头/.test(text)) return { id: 'later', label: '手机不在手边，等会儿回' }
  if (phone === '不在手边') return { id: 'later', label: '手机不在手边，等会儿回' }
  if (source === 'travel' || behavior === 'walk') return { id: 'slow', label: '在路上，回得慢' }
  if (phone === '静音') return { id: 'slow', label: '手机静音，可能过会儿才看到' }
  if (phone === '在床头') return { id: 'slow', label: '手机在床头，回得慢' }
  return { id: 'now', label: '手机在手，能马上回' }
}

/**
 * Energy is derived from real sleep + body state + what she is doing, then
 * blended lightly with the slow continuity baseline. It never announces
 * "精力不错" on a four-hour night.
 */
export function vitalityFor({ sleep, t, period = 0, cold = null, current = {}, baseline } = {}) {
  const minutes = Number(sleep?.minutes) || 420
  let energy = 58 + (minutes - 420) * 0.12
  const reasons = []
  const unfinishedNight = ['previous', 'future', 'ongoing'].includes(sleep?.source)
  if (!unfinishedNight && minutes < 300) { energy -= 8; reasons.push('昨晚没怎么睡够') }
  else if (!unfinishedNight && minutes < 400) reasons.push('睡得不太够')
  if (period === 1 || period === 2) { energy -= 12; reasons.push('腰有点酸') }
  else if (period) { energy -= 5; reasons.push('肚子还坠着') }
  if (cold) { energy -= cold.day >= 2 ? 6 : 10; reasons.push(cold.day === 1 ? '嗓子发紧' : '还有点鼻音') }
  const minute = Number(t?.minuteOfDay) || 0
  const wake = Number.isFinite(sleep?.wakeMinute) ? sleep.wakeMinute : 8 * 60
  const awake = minute >= wake ? minute - wake : minute + 1440 - wake
  const early = minute < 6 * 60 && unfinishedNight
  if (!early && awake > 9 * 60) { energy -= 6; reasons.push('坐得有点久') }
  if (awake < 30) energy -= 6
  if (early && !sleepText.test(String(current.what || ''))) reasons.push('这个点还醒着')
  if (/课|复习|考试|背书/.test(String(current.what || '')) || current.behavior === 'study') energy -= 4
  energy = clamp(energy, 15, 95, 55)
  if (Number.isFinite(Number(baseline))) energy = energy * 0.7 + Number(baseline) * 0.3
  energy = Math.round(clamp(energy, 12, 96, 55))
  const label = energy >= 82 ? '精力挺足' : energy >= 65 ? '还行' : energy >= 48 ? '有点累' : energy >= 32 ? '快没电了' : '撑不太住'
  const lateStart = !unfinishedNight && Number.isFinite(sleep?.startMinute) && (sleep.startMinute >= 60 || sleep.startMinute >= 23 * 60)
  if (lateStart && minutes < 420) {
    reasons.unshift(minute >= 14 * 60 ? '昨晚没睡够' : `昨晚${spokenClock(sleep.startMinute)}才睡`)
    for (let i = reasons.length - 1; i > 0; i--) if (/睡/.test(reasons[i])) reasons.splice(i, 1)
  }
  const sleepDebt = unfinishedNight ? 0 : Math.max(0, 480 - minutes)
  const sleepDebtLabel = sleep?.source === 'ongoing' ? '这觉还没睡完'
    : sleep?.source === 'future' ? '这觉还没睡'
      : sleep?.source === 'previous' ? '还没睡这一觉'
        : minutes >= 480 ? '睡得还行' : minutes >= 420 ? '睡眠欠一点' : minutes >= 300 ? '昨晚没睡够' : '昨晚睡得太少'
  return {
    energy,
    label,
    reasons: [...new Set(reasons)].slice(0, 3),
    sleepDebt,
    sleepDebtLabel,
    spokenStart: Number.isFinite(sleep?.startMinute) ? spokenClock(sleep.startMinute) : '',
    asleep: Boolean(current.behavior === 'sleep' || sleepText.test(String(current.what || ''))),
  }
}

const texturePools = {
  class: ['笔记本摊着，没写几行', '前排有人在打瞌睡', '窗外有人在打球'],
  study: ['耳机里循环同一首', '桌上摊着没剪完的片子', '杯子里的水凉了'],
  eat: ['人有点多，端着盘子找了会儿座', '今天的菜有点咸'],
  phone: ['刷到一个很旧的视频', '一条消息看了两遍'],
  idle: ['窗帘没拉开', '桌上那杯水凉了', '被子踢到一边'],
  photo: ['光刚好落在墙上'],
  walk: ['路边有人在遛狗'],
  bath: [],
  sleep: [],
}

export function placeCategory(current = {}) {
  const location = String(current.locationId || '')
  const text = String(current.what || '')
  if (location === 'dorm') return 'dorm'
  if (location === 'classroom') return 'class'
  if (location === 'library') return 'library'
  if (location === 'canteen') return 'canteen'
  if (['outdoor', 'shop', 'mall', 'cafe', 'mcdonalds'].includes(location)) return 'out'
  if (/宿舍|床上|躺|被窝|窝在/.test(text)) return 'dorm'
  if (/图书馆/.test(text)) return 'library'
  if (/课|教室|教学楼/.test(text)) return 'class'
  if (/食堂|餐厅/.test(text)) return 'canteen'
  if (/出门|外面|街上|逛|拍照|超市|便利店/.test(text) || current.behavior === 'walk' || current.source === 'travel') return 'out'
  return 'any'
}

function segmentTexture(current, t, { asleep, hasMoment }) {
  if (asleep || hasMoment || current.source === 'travel') return ''
  const behavior = String(current.behavior || '')
  const location = String(current.locationId || '')
  const what = String(current.what || '')
  let pool = texturePools[behavior] || []
  if (behavior === 'eat' && location === 'dorm') pool = ['外卖盒摊在桌上', '汤洒了一点在袋子上']
  if (behavior === 'idle' && location === 'dorm') pool = [/躺|床|窝/.test(what) ? '被子踢到一边' : '窗帘没拉开', '桌上那杯水凉了']
  if (behavior === 'idle' && location === 'classroom') pool = ['前排有人在打瞌睡', '投影有点糊']
  if (behavior === 'phone' && location === 'dorm') pool = ['刷到一个很旧的视频', '一条消息看了两遍']
  if (!pool.length) return ''
  const random = rng(hashSeed(t.ymd, 'texture|' + current.start + '|' + current.what))
  if (random() > 0.52) return ''
  return pool[Math.floor(random() * pool.length) % pool.length]
}

function nearestSegment(timeline, nowMs) {
  if (!timeline.length) return null
  let previous = timeline[0]
  for (const row of timeline) {
    if (row.start <= nowMs) previous = row
    if (row.start > nowMs) break
  }
  return previous || timeline[0]
}

function weekdayName(n) {
  return ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'][n] || ''
}

function calendarEvidence(calendar) {
  if (calendar.special) return `${calendar.special.名}第 ${calendar.dayIndex} 天`
  if (calendar.vacation) return `${calendar.vacation.名}第 ${calendar.dayIndex} 天`
  if (calendar.festival && calendar.festival.起) return `${calendar.festival.名}放假`
  if (calendar.term) return `学期中（${calendar.term.名}）`
  return '不在校历里，按平常走'
}

/** Compress into a few lines, plus "why it computed this way". */
export function generate(cfg, now = new Date(), options = {}) {
  const empty = { text: '', evidence: [] }
  if (!cfg || cfg.总开关 === false) return empty
  const tz = String(cfg.时区 || 'Asia/Shanghai')
  const t = zonedNow(now, tz)
  const calendar = todayCalendar(cfg, t)
  const deviation = todayDeviation(cfg, t, calendar.routine)
  const type = dayType(cfg, t, calendar)
  const plan = dailyPlan(cfg, t, calendar, deviation, type, { mergeFuture: true, nowMinute: t.minuteOfDay })
  const dayStartMs = zonedDayStartMs(now, t, tz)
  const baseTimeline = buildTimeline(plan.items, readFacts(t.ymd), dayStartMs, (minute) => zonedDateTimeMs(t.ymd, minute, tz))
  const timeline = addWorldToTimeline(baseTimeline, cfg.地图)
  let current = segmentAt(timeline, now.getTime()) || nearestSegment(timeline, now.getTime()) || {
    what: '闲着', phone: '在手', outfit: '', behavior: 'idle', locationId: 'dorm', source: 'fallback',
  }
  const world = worldStateAt(timeline, now.getTime(), cfg.地图)
  const coverage = timelineCoverage(plan.items)
  const localMinute = (ms) => {
    const at = zonedNow(new Date(ms), tz)
    const delta = dayDiff(t.ymd, at.ymd)
    return (Number.isFinite(delta) ? delta : 0) * 1440 + at.minuteOfDay
  }
  const replay = options.replay ? buildReplayFrames(timeline, cfg.地图, localMinute) : undefined

  // Body, sleep and the resulting energy.
  const period = menstrualDay(cfg, t.ymd)
  const cold = coldEpisode(cfg, t.ymd)
  const sleep = lastNightSleep(cfg, { ...t, routine: calendar.routine }, plan.items, t.minuteOfDay)
  const reply = replyReadiness({ phone: current.phone, what: current.what, behavior: current.behavior, source: current.source })
  const vitality = vitalityFor({ sleep, t, period, cold, current, baseline: options.energyBaseline })
  // Older/model plans can leave "手机在手" on a sleep segment; the displayed
  // state must still be coherent with being asleep.
  const displayPhone = vitality.asleep && current.phone === '在手' ? '在床头' : current.phone
  if (displayPhone !== current.phone) current = { ...current, phone: displayPhone }

  // Whole-timeline facts used to keep today's small things honest.
  const outLocations = new Set(['outdoor', 'shop', 'mall', 'cafe', 'mcdonalds'])
  const outings = timeline
    .filter((x) => x.source !== 'travel' && (outLocations.has(x.locationId) || /出门|外面|街上|逛|拍照/.test(String(x.what || ''))))
    .map((x) => ({ start: localMinute(x.start), end: localMinute(x.end) }))
  const meals = timeline
    .filter((x) => x.behavior === 'eat' || /吃|饭|外卖|夜宵|零食/.test(String(x.what || '')))
    .map((x) => ({ start: localMinute(x.start), end: localMinute(x.end) }))
  const currentCategory = placeCategory(current)

  // Today's small thing is persisted and advances by its own stages.
  let moments = null
  let moment = null
  if (options.moments !== false) {
    const people = (Array.isArray(options.people) ? options.people : []).map((x) => String(x || '').trim()).filter(Boolean)
    moments = ensureMoments(cfg, t, calendar, {
      deviation,
      term: Boolean(calendar.term && !calendar.holiday && !calendar.special),
      outing: outings.length > 0,
      cold: Boolean(cold),
      period: Boolean(period),
      tired: vitality.energy < 55,
      people,
      now: now.getTime(),
    })
    moment = momentContext(moments, t.minuteOfDay, {
      asleep: vitality.asleep,
      maxAgeMinutes: 360,
      currentCategory,
      outings,
      meals,
    })
    // A background errand is not worth mentioning in the middle of a class,
    // or while walking to the next place without a stable location.
    if (currentCategory === 'class' || /课|自习|复习|背书/.test(String(current.what || '')) || current.source === 'travel') moment = null
  }

  const conditions = []
  if (deviation.flat) conditions.push(type.id === 'schoolDay' ? '今天没去上课' : '今天没打算出门')
  else if (deviation.skipAfternoon) conditions.push('下午的课没去')
  if (period === 1 || period === 2) conditions.push('腰有点酸')
  else if (period) conditions.push('肚子还坠着')
  if (cold) conditions.push(cold.day === 1 ? '嗓子有点紧' : '还有点鼻音')
  if (vitality.reasons.length) {
    for (const reason of vitality.reasons) {
      if (conditions.length >= 2) break
      if (!conditions.includes(reason)) conditions.push(reason)
    }
  }

  const evidence = []
  evidence.push(calendarEvidence(calendar))
  evidence.push(`日子类型：${type.name}｜作息表：${calendar.routine}`)
  if (world.location) evidence.push(world.moving && world.destination
    ? `位置：${world.location.name} → ${world.destination.name}`
    : `位置：${world.location.name}`)
  evidence.push(`此刻命中：${current.what}（手机${displayPhone || '在手'}${current.outfit ? '，穿' + current.outfit : ''}）`)
  evidence.push(`昨晚睡眠：${Math.round((sleep.minutes || 0) / 60 * 10) / 10} 小时（${sleep.source}）｜精力：${vitality.label} ${vitality.energy}`)
  evidence.push(`回复：${reply.label}`)
  if (cold) evidence.push(`感冒第 ${cold.day} 天，共约 ${cold.duration} 天`)
  if (moment) evidence.push(`今天的小事：${moment.title}（第 ${moment.stageIndex + 1} 阶段，${moment.ageMinutes} 分钟前）`)
  if (!coverage.complete) evidence.push(`时间线需要修复：空档 ${coverage.gaps.length}，重叠 ${coverage.overlaps.length}`)
  if (deviation.flat) evidence.push('今天没按表走：躺平')
  if (deviation.outing) evidence.push('今天没按表走：临时出门')
  if (deviation.skipAfternoon) evidence.push('今天没按表走：翘了下午的课')

  const texture = segmentTexture(current, t, { asleep: vitality.asleep, hasMoment: Boolean(moment) })
  const lines = []
  const bodyText = conditions.slice(0, 2).join('；')
  lines.push(`（今天）${t.month}月${t.day}日 ${weekdayName(t.weekday)}·${type.name}${bodyText ? '。' + bodyText : ''}。`)

  let nowLine = `（此刻）${current.what}`
  if (current.outfit && !/睡|洗澡|冲澡|洗漱|浴巾/.test(current.what) && !['sleep', 'bath'].includes(current.behavior)) {
    nowLine += `，身上是${current.outfit}`
  }
  if (reply.id !== 'asleep' && reply.label) nowLine += `，${reply.label}`
  else if (vitality.asleep && displayPhone) nowLine += `，手机${displayPhone}`
  if (texture) nowLine += `，${texture}`
  lines.push(nowLine + '。')

  const activityKey = (what, behavior) => {
    const text = String(what || '')
    // Check eating first: "坐在床边吃" is not lying in bed.
    if (/吃|饭|外卖/.test(text) || behavior === 'eat') return 'eat'
    if (/躺|窝|刷手机|在床上|被窝/.test(text) || behavior === 'phone') return 'bed'
    if (/课|自习|复习|背书/.test(text) || behavior === 'study') return 'study'
    return behavior || text
  }
  const startedAt = new Set([activityKey(current.what, current.behavior)])
  const recent = []
  for (const row of recentSegments(timeline, now.getTime(), 240)) {
    if (!row.what || /睡/.test(row.what) || row.source === 'travel' || row.what === current.what) continue
    const key = activityKey(row.what, row.behavior)
    if (startedAt.has(key)) continue
    startedAt.add(key)
    recent.push(row.what)
    if (recent.length >= 2) break
  }
  recent.reverse()
  if (recent.length) lines.push(`（刚才）${recent.join('，然后')}。`)
  if (moment) lines.push(`（零碎）${moment.text}。`)

  const next = vitality.asleep ? null : timeline
    .filter((x) => x.start > now.getTime() && x.source !== 'travel' && !/睡/.test(x.what))
    .sort((a, b) => a.start - b.start)[0]
  const nextAt = next ? localMinute(next.start) : NaN
  if (next && Number.isFinite(nextAt) && nextAt < 1440 && next.start - now.getTime() <= 6 * 3600000) {
    lines.push(`（接下来）${clockOf(nextAt)} 大概${next.what}。`)
  }

  if (t.hour >= 18) {
    const tomorrow = zonedNow(addZonedDays(now, tz, 1), tz)
    const tomorrowCal = todayCalendar(cfg, tomorrow)
    const tomorrowType = dayType(cfg, tomorrow, tomorrowCal)
    const tomorrowPlan = dailyPlan(cfg, tomorrow, tomorrowCal, {}, tomorrowType)
    const sleepEnd = tomorrowPlan.items.find((x) => /睡/.test(x.what) && x.end <= 12 * 60)?.end
    const firstWake = tomorrowPlan.items.find((x) => x.start >= 6 * 60 && !/睡/.test(x.what))
    const wakeMinute = Number.isFinite(sleepEnd) ? sleepEnd : (firstWake ? firstWake.start : null)
    lines.push(`（明天）${weekdayName(tomorrow.weekday)}·${tomorrowType.name}${wakeMinute ? `，${minuteLabel(wakeMinute)} 左右起` : ''}。`)
  }

  lines.push('（说话）这是你自己的日子，别当时间表念：不报时间段、不列清单，他问起挑一两件说就行。括号里写死的是确定发生的事；没写到的细节可以随口补，但别改正在做的事、地点和手机状态。他说自己在地铁/公司/家，那是他的场景，别安到你身上。')

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
      links: Array.isArray(x.links) ? x.links : [],
    })),
    vitality,
    reply,
    lastNight: sleep,
    cold,
    period,
    moment,
    moments,
    coverage,
    ...(options.rawTimeline ? { rawTimeline: timeline } : {}),
    ...(replay ? { replay } : {}),
  }
}

let cache = { path: '', mtimeMs: 0, size: 0, cfg: null }

function writeConfigFile(value) {
  mkdirSync(dirname(configPath()), { recursive: true })
  return atomicWriteJson(configPath(), value)
}

export function migrateConfig(raw) {
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
  // v4 introduced the first real-campus crop. v5 expands the crop to real
  // neighbourhood POIs and replaces hand-written bends with OSM routing.
  // Only untouched stock coordinate profiles migrate; custom maps stay intact.
  if (version < 5 && next.地图 && Array.isArray(next.地图.地点)) {
    const profiles = [
      new Map([['dorm', [16, 72]], ['classroom', [48, 22]], ['library', [78, 26]], ['canteen', [48, 70]], ['shop', [80, 70]], ['outdoor', [17, 24]]]),
      new Map([['dorm', [43, 61]], ['classroom', [73, 31]], ['library', [58, 37]], ['canteen', [55, 68]], ['shop', [84, 55]], ['outdoor', [93, 55]]]),
    ]
    const current = new Map(next.地图.地点.map((node) => [String(node && node.id), node]))
    const stock = profiles.some((profile) => profile.size === current.size
      && [...profile].every(([id, [x, y]]) => Number(current.get(id)?.x) === x && Number(current.get(id)?.y) === y))
    if (stock) {
      const enabled = next.地图.启用 !== false
      const commute = next.地图.自动通勤 !== false
      next.地图 = { ...copy(defaultWorldConfig), 启用: enabled, 自动通勤: commute }
    } else if (!next.地图.底图) next.地图.底图 = 'xueyuan-road'
  }
  // v6 removes the legacy event pool. Daily-plan details now come only from
  // the model plan (or template fallback), and later changes use life_adjust.
  delete next.事件池
  // v7 adds a safe local Iconify glyph id to each map location. Normalization
  // fills defaults for existing locations and custom locations.
  // v8 adds the continuity settlement policy. Runtime history remains in
  // separate plugin-owned files and is intentionally not part of settings.
  if (version < 8 && (!next.连续性 || typeof next.连续性 !== 'object')) next.连续性 = copy(defaultConfig.连续性)
  // v11 moves the optional role description and wardrobe into validated
  // settings, so the life layer no longer ships hardcoded persona copy.
  if (version < 11) {
    if (typeof next.角色设定 !== 'string') next.角色设定 = ''
    if (!next.衣柜 || typeof next.衣柜 !== 'object') next.衣柜 = copy(defaultConfig.衣柜)
  }
  // v12 adds sharing policy; old configs keep working with low-disturbance
  // defaults and no persisted ledger until the first real share.
  if (version < 12) next.主动分享 = { ...defaultSharingConfig, ...(next.主动分享 || {}) }
  next.配置版本 = LIFE_CONFIG_VERSION
  return { value: next, changed: version !== LIFE_CONFIG_VERSION || Object.hasOwn(source, '事件池') }
}

export function readConfig() {
  const path = configPath()
  const read = readJsonBounded(path, { maxBytes: CONFIG_MAX_BYTES })
  if (read.ok) {
    if (cache.cfg && cache.path === path && cache.mtimeMs === read.mtimeMs && cache.size === read.size) return cache.cfg
    const migrated = migrateConfig(read.value)
    const cfg = normalizeConfig(migrated.value)
    if (migrated.changed) {
      writeConfigFile(cfg)
      try {
        const st = statSync(path)
        cache = { path, mtimeMs: st.mtimeMs, size: st.size, cfg }
        return cfg
      } catch {}
    }
    cache = { path, mtimeMs: read.mtimeMs, size: read.size, cfg }
    return cfg
  }
  // Missing or corrupt: never keep serving a broken file forever.
  if (read.reason !== 'missing') quarantine(path)
  try { writeConfigFile(defaultConfig) } catch {}
  cache = { path, mtimeMs: 0, size: 0, cfg: defaultConfig }
  return defaultConfig
}

export function saveConfig(patch) {
  const run = () => {
    const prev = readConfig()
    const next = normalizeConfig({ ...prev, ...(patch && typeof patch === 'object' ? patch : {}) })
    writeConfigFile(next)
    cache = { path: configPath(), mtimeMs: 0, size: 0, cfg: null }
    return next
  }
  const locked = withLock(configPath() + '.lock', run, { staleMs: 10000 })
  return locked === undefined ? run() : locked
}

/** Replace the whole life configuration after a complete external validation. */
export function replaceConfig(input) {
  const next = normalizeConfig(input)
  writeConfigFile(next)
  cache = { path: configPath(), mtimeMs: 0, size: 0, cfg: null }
  return next
}

export { pad2, phoneChoices, minuteLabel, clockOf, spokenClock, segmentTexture }
