// 大肥鱼的生活线 · 每日剧本
//
// 从 dsh-daily-schedule 借来的思路（MIT），但**不用模型**：
//   · 每天先定一个「日子类型」（上课日 / 没课日 / 周末 / 外出日 / 宅家日 / 考试周 / 假期）；
//   · 按类型 + 课表 + 作息拼出全天时间线，每段配一件穿着；
//   · 剧本落盘到 ~/.dsh/feiyu-life-days/<date>.json，同一天不变，跨天重算；
//   · 注入时给「今天是什么日子 / 此刻 / 早些时候 / 接下来 / 傍晚附明天」。
//
// 全是日期做种子的伪随机：不用联网、不花 token，重启也不丢。

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const 家 = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'feiyu-life-days')

function 到分(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1
}

function 种子(s, salt = '') {
  let h = 2166136261
  for (const c of String(s) + '|' + salt) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function 摇(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const 默认衣柜 = {
  睡: ['睡衣'],
  洗澡: ['睡衣', '浴巾裹着'],
  上课: ['藏青卫衣', '白T加开衫', '灰毛衣', '牛仔外套'],
  在家: ['宽松T恤', '珊瑚绒睡衣', '旧卫衣'],
  出门: ['黑大衣', '军绿夹克', '牛仔外套'],
  吃饭: ['宽松T恤', '卫衣'],
}

function 场合(在) {
  const s = String(在 || '')
  if (/睡/.test(s)) return '睡'
  if (/洗澡/.test(s)) return '洗澡'
  if (/上课|专业课|教室|图书馆|自习|背书/.test(s)) return '上课'
  if (/食堂|吃饭|外卖|晚饭|午饭/.test(s)) return '吃饭'
  if (/出门|外面|街上|拍照|逛|超市|便利店|地铁|公交/.test(s)) return '出门'
  return '在家'
}

function 挑穿(衣柜, 场, seed) {
  const 池 = (衣柜 && 衣柜[场]) || 默认衣柜[场] || ['卫衣']
  return 池[Math.floor(摇(seed)() * 池.length) % 池.length]
}

/** 今天是什么日子（类型） */
export function 日程类型(cfg, t, 日历) {
  const r = 摇(种子(t.ymd, 'daytype'))
  if (日历.特殊) return { id: '特殊', 名: 日历.特殊.名 }
  if (日历.假期) return { id: '假期', 名: 日历.假期.名 }
  if (日历.节日 && 日历.节日.起) return { id: '节日', 名: 日历.节日.名 }
  const 课 = (cfg.课表 || {})[t.周] || []
  if (课.length) return { id: '上课日', 名: '上课日' }
  if (t.周 >= 6) return r() < 0.55 ? { id: '宅家日', 名: '周末·宅家' } : { id: '外出日', 名: '周末·出门' }
  return r() < 0.6 ? { id: '没课日', 名: '没课日' } : { id: '外出日', 名: '出门转转' }
}

/** 把「课表 + 作息表」摊平成今天的整段时间线（含穿着） */
export function 时间线(cfg, t, 日历, 偏离 = {}, 类型 = null) {
  if (偏离.躺平) {
    return [
      { 起: 0, 止: 11 * 60, 在: '睡着，今天没打算起', 手机: '在床头' },
      { 起: 11 * 60, 止: 14 * 60, 在: '窝在床上刷手机', 手机: '在手' },
      { 起: 14 * 60, 止: 19 * 60, 在: '在宿舍躺着，一天没出门', 手机: '在手' },
      { 起: 19 * 60, 止: 24 * 60, 在: '点了个外卖，还是躺着', 手机: '在手' },
    ].map((x, i) => ({ ...x, 穿: 挑穿(cfg.衣柜, '在家', 种子(t.ymd, 'w' + i)) }))
  }
  const 课 = 日历.放假 ? [] : ((cfg.课表 || {})[t.周] || [])
  const 底 = cfg[日历.作息表] || 日常兜底()
  const 段们 = []
  for (const b of [...底, ...课]) {
    if (!Array.isArray(b) || b.length < 2) continue
    let 起 = 到分(b[0]); let 止 = 到分(b[1])
    if (起 < 0 || 止 < 0) continue
    if (止 <= 起) 止 += 1440
    段们.push({ 起, 止, 在: String(b[2] || '闲着'), 手机: String(b[3] || '在手'), 课: 课.includes(b) })
  }
  if (偏离.翘下午) for (const x of 段们) if (x.课 && x.起 >= 12 * 60) x.在 = '翘了，在宿舍躺着'
  if (类型 && 类型.id === '外出日' && !偏离.躺平) {
    段们.push({ 起: 15 * 60, 止: 18 * 60, 在: '出门了，带着相机', 手机: '在手', 插: true })
  }
  段们.sort((a, b) => a.起 - b.起)
  // 插进来的段盖掉重叠部分
  const 净 = []
  for (const x of 段们) {
    if (!x.插) continue
    for (const y of 段们) {
      if (y.插) continue
      if (y.止 <= x.起 || y.起 >= x.止) { 净.push(y); continue }
      if (y.起 < x.起) 净.push({ ...y, 止: x.起 })
      if (y.止 > x.止) 净.push({ ...y, 起: x.止 })
    }
    净.push(x)
  }
  const 用 = (净.length ? 净 : 段们).sort((a, b) => a.起 - b.起)
  return 用.map((x, i) => ({ ...x, 穿: x.穿 || 挑穿(cfg.衣柜, 场合(x.在), 种子(t.ymd, 'o' + i)) }))
}

function 日常兜底() {
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

export function 找此刻(items, 分) {
  for (const x of items) if (分 >= x.起 && 分 < x.止) return x
  return null
}

/** 剧本文件路径 */
export function 剧本路径(ymd) {
  return join(家(), ymd + '.json')
}

/** 写一份剧本（模型生成的结果也走这里） */
export function 写剧本(ymd, 数据) {
  try {
    mkdirSync(家(), { recursive: true })
    writeFileSync(剧本路径(ymd), JSON.stringify({ v: 1, date: ymd, ...数据 }, null, 2), 'utf8')
    return true
  } catch { return false }
}

/** 读/建当天的剧本（落盘） */
export function 每日剧本(cfg, t, 日历, 偏离, 类型) {
  const 文件 = join(家(), t.ymd + '.json')
  if (existsSync(文件)) {
    try {
      const d = JSON.parse(readFileSync(文件, 'utf8'))
      if (d && d.v === 1 && Array.isArray(d.items) && d.items.length) return d
    } catch {}
  }
  // ⚠ 这里**不落盘**：注入是同步的，先写模板会把「模型还没生成」的位置占掉，
  //   之后模型写好的版本就再也进不来了。落盘交给 index.js 的确保剧本（模型 or 模板兜底）。
  return {
    v: 1,
    date: t.ymd,
    type: 类型,
    items: 时间线(cfg, t, 日历, 偏离, 类型),
    衣: (cfg.衣柜 ? 'cfg' : 'default'),
  }
}

/** 临时改计划：把某个时间之后的这一段换掉（她自己的决定） */
export function 改剧本(date, 从分, 新段) {
  const 文件 = join(家(), date + '.json')
  try {
    const d = JSON.parse(readFileSync(文件, 'utf8'))
    const 止 = 新段.止
    const 留 = []
    for (const x of d.items) {
      if (x.止 <= 从分 || x.起 >= 止) { 留.push(x); continue }     // 完全在外面，留着
      if (x.起 < 从分) 留.push({ ...x, 止: 从分 })                 // 前面被截掉
      if (x.止 > 止) 留.push({ ...x, 起: 止 })                     // 后面被截掉
    }
    留.push(新段)
    留.sort((a, b) => a.起 - b.起)
    d.items = 留
    writeFileSync(文件, JSON.stringify(d, null, 2), 'utf8')
    return d
  } catch { return null }
}

export { 到分 }
