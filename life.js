// 大肥鱼的生活线 —— 纯本地计算，一次模型都不调。
//
// 它回答四个问题：
//   1. 今天是什么日子？（学期 / 寒暑假 / 节日 / 考试周）
//   2. 这套日子该走哪张作息表？（日常 / 晚起 / 假期 / 备考）
//   3. 此刻在干什么、手机在不在手上？
//   4. 今天身上还压着什么事？（熬夜、经期、着凉、当天的一两件小事）
//
// 算完压成两行短文本，由 index.js 注入 systemPrompt.context。
//
// 关于"确定性"（v0.2 的改动）：
//   早先只按日期做种子，同一天里的每一分钟都算得一模一样 —— 读起来像背日程表。
//   现在分三层变：
//     · 日层：每天可能"没按表走"（躺平日 / 出门日 / 翘了下午的课），按日期抽；
//     · 小时层：这一小时的身体感觉（坐不住 / 眼睛发干 / 有点饿），按（日期, 小时）抽；
//     · 十分层：临时小动作（去接水 / 拿快递），按（日期, 十位分钟）抽，概率很低。
//   还是不需要状态文件：同一分钟查两次结果一样，过了这一小时自然换一句 —— 这就像
//   你问一个真人"你在干嘛"，五分钟问两次答案一样，两小时后再问就不一样了。
//
// 层级优先级（高 → 低）：特殊（考试周）→ 假期 → 学期；作息表：特殊 > 假期 > 晚起日 > 日常。

import { readFileSync, writeFileSync, mkdirSync, statSync, renameSync } from 'node:fs'
import { 日程类型, 每日剧本, 找此刻 } from './plan.js'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

export const CONFIG_PATH = join(homedir(), '.dsh', 'feiyu-life-config.json')

const 段门 = { 上午: 9, 中午: 12, 下午: 15, 晚上: 19 }
const 手机说 = { 静音: '，手机静音', 在手: '', 在床头: '，手机在床头', 不在手边: '，手机不在手边' }
const 手机们 = ['在手', '静音', '在床头', '不在手边']

export const 默认配置 = {
  总开关: true,
  时区: 'Asia/Shanghai',
  // 只在这些目录的会话里注入（留空 = 所有顶层会话）。别的活儿不该看见「你在上课」。
  工作区: [],

  经期: { 起始: '2026-11-05', 周期: 29, 天数: 5 },

  // ── 年度：这几段日子决定走哪张作息表 ──────────────────────────────
  校历: {
    学期: [
      { 名: '2026 秋季学期', 起: '2026-09-07', 止: '2027-01-17' },
      { 名: '2027 春季学期', 起: '2027-02-22', 止: '2027-07-04' },
    ],
    假期: [
      { 名: '寒假', 起: '2027-01-18', 止: '2027-02-21', 作息: '假期' },
      { 名: '暑假', 起: '2027-07-05', 止: '2027-08-29', 作息: '假期' },
    ],
    特殊: [
      { 名: '期末周', 起: '2027-01-04', 止: '2027-01-17', 作息: '备考' },
    ],
  },

  // 公历节日：{名, 月, 日} 每年都过；{名, 起, 止} 只那几天
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

  // ── 日：四张作息表 ────────────────────────────────────────────────
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

  // ── 事件：段决定什么时候才可能出现；条件目前支持「早课」 ──────────
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

  // ── 偶尔不按表走（概率，0~1，可以调成 0 关掉）─────────────────────
  偏离: { 躺平日: 0.12, 出门日: 0.1, 翘下午课: 0.08 },
}

function 到分(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim())
  if (!m) return -1
  return Number(m[1]) * 60 + Number(m[2])
}

function 补零(n) { return String(n).padStart(2, '0') }

export function 时区现在(now, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  })
  const parts = {}
  for (const p of fmt.formatToParts(now)) parts[p.type] = p.value
  const 周 = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday] || 1
  let 时 = Number(parts.hour)
  if (时 === 24) 时 = 0
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    月: Number(parts.month),
    日: Number(parts.day),
    hh: 时,
    mm: Number(parts.minute),
    分: 时 * 60 + Number(parts.minute),
    周,
  }
}

// 日期做种子的伪随机：同一时段永远同一套，过了这段自然变
function 种子(ymd, salt = '') {
  let h = 2166136261
  const s = ymd + '|' + salt
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function 摇(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function 日数(a, b) {
  const x = Date.parse(a + 'T00:00:00Z')
  const y = Date.parse(b + 'T00:00:00Z')
  if (!Number.isFinite(x) || !Number.isFinite(y)) return NaN
  return Math.floor((y - x) / 86400000)
}

function 在区间(ymd, 起, 止) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(起)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(止))) return false
  return ymd >= String(起) && ymd <= String(止)
}

/** 今天是什么日子：特殊 / 假期 / 学期 / 节日 */
export function 今日日历(cfg, t) {
  const 校 = cfg.校历 || {}
  const 特殊 = (校.特殊 || []).find((x) => 在区间(t.ymd, x.起, x.止))
  const 假 = (校.假期 || []).find((x) => 在区间(t.ymd, x.起, x.止))
  const 学 = (校.学期 || []).find((x) => 在区间(t.ymd, x.起, x.止))
  let 节 = null
  for (const x of cfg.节日 || []) {
    if (x && x.名 && Number(x.月) === t.月 && Number(x.日) === t.日) { 节 = x; break }
    if (x && x.名 && 在区间(t.ymd, x.起, x.止)) { 节 = x; break }
  }
  let 表 = '日常'
  let 名 = ''
  // 放了假的节日（有起止的那种，比如国庆、春节）也当假期走，不上课
  const 节假 = !!(节 && 节.起 && 节.止)
  if (特殊) { 表 = 特殊.作息 || '日常'; 名 = 特殊.名 }
  else if (假) { 表 = 假.作息 || '假期'; 名 = 假.名 }
  else if (节假) { 表 = '假期'; 名 = 节.名 }
  else if ((cfg.晚起日 || []).includes(t.周)) 表 = '晚起'
  return {
    放假: !!(假 || 节假),
    特殊: 特殊 || null,
    假期: 假 || null,
    学期: 学 || null,
    节日: 节,
    作息表: 表,
    名,
    第几天: 假 ? (日数(假.起, t.ymd) + 1) : (特殊 ? (日数(特殊.起, t.ymd) + 1) : 0),
  }
}

/** 今天"没按表走"的偏离（按日期抽，一天内不变） */
function 今日偏离(cfg, t, 表) {
  const p = cfg.偏离 || {}
  const r = 摇(种子(t.ymd, 'derail'))
  const out = {}
  if (表 !== '假期' && r() < Number(p.躺平日 ?? 0.12)) out.躺平 = true
  else if (表 !== '备考' && r() < Number(p.出门日 ?? 0.1)) out.出门 = true
  if (表 === '日常' && (cfg.课表 || {})[t.周] && r() < Number(p.翘下午课 ?? 0.08)) out.翘下午 = true
  return out
}

/** 现在落在哪一段：课表优先，其次作息表 */
export function 此刻(cfg, t, 日历, 偏离 = {}) {
  if (偏离.躺平) {
    return { 在: t.分 < 11 * 60 ? '睡着了，今天没打算起' : '在宿舍躺着，一天没出门', 手机: t.分 < 11 * 60 ? '在床头' : '在手' }
  }
  const 课表 = cfg.课表 || {}
  const 课 = 日历.放假 ? [] : (Array.isArray(课表[t.周]) ? 课表[t.周] : [])
  const 底 = cfg[日历.作息表] || cfg.日常 || []
  const 候选 = [...课, ...底]
  for (const b of 候选) {
    if (!Array.isArray(b) || b.length < 2) continue
    const [起, 止, 在, 手机] = b
    const a = 到分(起)
    let z = 到分(止)
    if (a < 0 || z < 0) continue
    const 是课 = 课.includes(b)
    if (是课 && 偏离.翘下午 && 到分(起) >= 12 * 60) continue
    if (z <= a) z += 1440
    const now = t.分 < a && z > 1440 ? t.分 + 1440 : t.分
    if (now >= a && now < z) return { 在: String(在 || '闲着'), 手机: String(手机 || '在手') }
  }
  return { 在: '闲着', 手机: '在手' }
}

function 起床点(cfg, t, 日历) {
  const 表 = cfg[日历.作息表] || cfg.日常 || []
  const 起 = 表.map((b) => 到分(Array.isArray(b) ? b[0] : '')).filter((x) => x >= 0)
  // 找到"睡着"那一段的结束点
  for (const b of 表) {
    if (Array.isArray(b) && /睡/.test(String(b[2] || ''))) return 到分(b[1])
  }
  return 起.length ? Math.min(...起) : 8 * 60
}

function 经期第几天(cfg, ymd) {
  const 期 = cfg.经期 || {}
  const 起 = /^\d{4}-\d{2}-\d{2}$/.test(String(期.起始 || '')) ? Date.parse(String(期.起始) + 'T00:00:00Z') : NaN
  if (!Number.isFinite(起)) return 0
  const 今 = Date.parse(ymd + 'T00:00:00Z')
  if (!Number.isFinite(今)) return 0
  const 天 = Math.floor((今 - 起) / 86400000)
  const 周 = Math.max(1, Math.round(Number(期.周期) || 29))
  const 长 = Math.max(1, Math.round(Number(期.天数) || 5))
  const 位 = ((天 % 周) + 周) % 周
  return 位 < 长 ? 位 + 1 : 0
}

/** 今天抽到哪几件小事（含段），过了那个点才算数 */
export function 今天的小事(cfg, t, 有早课允许 = true) {
  const 课 = Array.isArray((cfg.课表 || {})[t.周]) ? cfg.课表[t.周] : []
  const 有早课 = 有早课允许 && 课.some((b) => Array.isArray(b) && 到分(b[0]) >= 0 && 到分(b[0]) < 10 * 60)
  const pool = (Array.isArray(cfg.事件池) ? cfg.事件池 : [])
    .filter((x) => Array.isArray(x) && x.length >= 2 && x[1])
    .filter((x) => x[2] !== '早课' || 有早课)
  if (!pool.length) return []
  const r = 摇(种子(t.ymd, 'events'))
  const 要几条 = r() < 0.55 ? 2 : 1
  const 索引 = pool.map((_, i) => i)
  const 选中 = []
  for (let k = 0; k < 要几条 && 索引.length; k++) {
    const i = Math.floor(r() * 索引.length) % 索引.length
    选中.push(pool[索引.splice(i, 1)[0]])
  }
  return 选中.filter(([段]) => t.hh >= (段门[段] || 0)).map(([, 文]) => String(文))
}

/** 这一小时的身体感觉（按小时抽，40% 为空） */
function 小时变体(t, 在) {
  const r = 摇(种子(t.ymd, 'hour' + t.hh))
  if (r() > 0.4) return ''
  const 池 = /睡/.test(在) ? ['', '', '']
    : 在.includes('课') ? ['，有点坐不住', '，眼睛发干', '，在想下课吃什么']
      : ['，有点坐不住', '，眼睛发干', '，脖子有点僵', '，想喝冰的']
  return 池[Math.floor(r() * 池.length) % 池.length]
}

/** 十分钟级的临时小动作（概率很低） */
function 临时动作(t) {
  const r = 摇(种子(t.ymd, 'min' + Math.floor(t.分 / 10)))
  if (r() > 0.07) return ''
  const 池 = ['，刚去接了杯水', '，去楼下拿了个快递', '，在等外卖', '，顺手把衣服晾了']
  return 池[Math.floor(r() * 池.length) % 池.length]
}

/**
 * 今日底色：不改心情数值，只给她一句「今天整个人是什么状态」。
 * 用来补上「心情只听对话」那个洞——身上不舒服的时候，她说话自然会短、会蔫。
 * 优先顺序：经期头两天 > 着凉 > 熬夜 > 今天有好事 > 平常（不出声）
 */
function 今日底色(经, 生病, 困, 好事) {
  // 生病不另说一句：上面「今天」里已经写了嗓子紧/着凉，再说一遍就是复读
  if (经 === 1 || 经 === 2) return '整个人有点蔫'
  if (困) return '眼皮沉'
  if (好事) return '心情还不错'
  return ''
}

/** 压成两行，附「为什么这么算」 */
export function 生成(cfg, now = new Date()) {
  const 空 = { text: '', 依据: [] }
  if (!cfg || cfg.总开关 === false) return 空
  const tz = String(cfg.时区 || 'Asia/Shanghai')
  const t = 时区现在(now, tz)
  const 日历 = 今日日历(cfg, t)
  const 偏离 = 今日偏离(cfg, t, 日历.作息表)
  const 类型 = 日程类型(cfg, t, 日历)
  const 剧本 = 每日剧本(cfg, t, 日历, 偏离, 类型)
  const 在 = 找此刻(剧本.items, t.分) || { 在: '闲着', 手机: '在手', 穿: '' }

  const 依据 = []
  依据.push(日历.特殊 ? `${日历.特殊.名}第 ${日历.第几天} 天`
    : 日历.假期 ? `${日历.假期.名}第 ${日历.第几天} 天`
      : (日历.节日 && 日历.节日.起) ? `${日历.节日.名}放假`
        : 日历.学期 ? `学期中（${日历.学期.名}）`
          : '不在校历里，按平常走')
  依据.push(`日子类型：${类型.名}｜作息表：${日历.作息表}`)
  依据.push(`此刻命中：${在.在}（手机${在.手机 || '在手'}${在.穿 ? '，穿' + 在.穿 : ''}）`)
  if (偏离.躺平) 依据.push('今天没按表走：躺平')
  if (偏离.翘下午) 依据.push('今天没按表走：翘了下午的课')

  // ── 今天这一行：日子类型 + 身上的状况 ──
  const r = 摇(种子(t.ymd, 'sleep'))
  const 睡点 = [60, 120, 150][Math.floor(r() * 3) % 3]
  const 起 = 起床点(cfg, t, 日历)
  const 困 = 起 - 睡点 < 360
  const 经 = 经期第几天(cfg, t.ymd)
  const 着凉 = r() < 0.08 && [3, 4, 10, 11].includes(t.月)
  const 小事们 = 今天的小事(cfg, t, !日历.放假)

  const 状况 = []
  if (困 && t.分 < 15 * 60) 状况.push(`昨晚${睡点 === 60 ? '一点' : 睡点 === 120 ? '两点' : '两点半'}才睡`)
  if (经) 状况.push(经 <= 3 ? '腰有点酸' : '肚子还坠着')
  if (着凉) 状况.push('嗓子有点紧')
  for (const 文 of 小事们) 状况.push(文)
  const 好事 = 小事们.some((x) => /夸|猫|寄的/.test(x))
  const 底色 = 今日底色(经, 着凉, 困, 好事)
  if (底色) 状况.push(底色)

  const 行们 = []
  行们.push(`（今天）${t.月}月${t.日}日 ${周名(t.周)}·${类型.名}${状况.length ? '。' + 状况.slice(0, 2).join('；') : '。'}。`)

  // ── 此刻 ──
  let 此刻行 = `（此刻）${在.在}`
  if (在.手机 && 在.手机 !== '在手') 此刻行 += 手机说[在.手机] || ''
  if (在.穿 && !/睡/.test(在.在)) 此刻行 += `，身上是${在.穿}`
  if (!/睡/.test(在.在) && !偏离.躺平) 此刻行 += 小时变体(t, 在.在) + 临时动作(t)
  行们.push(此刻行 + '。')

  // ── 早些时候 / 接下来 ──
  const 早 = 剧本.items.filter((x) => x.止 <= t.分 && x.止 > t.分 - 360 && !/睡/.test(x.在)).slice(-2)
  if (早.length) 行们.push(`（早些时候）${早.map((x) => x.在).join('，然后')}。`)
  const 后 = 剧本.items.filter((x) => x.起 > t.分 && !/睡/.test(x.在)).slice(0, 1)
  if (后.length) 行们.push(`（接下来）${分钟说(后[0].起)} ${后[0].在}。`)

  // ── 傍晚以后附上明天 ──
  if (t.hh >= 18) {
    const 明 = 时区现在(new Date(now.getTime() + 86400000), tz)
    const 明日历 = 今日日历(cfg, 明)
    const 明类型 = 日程类型(cfg, 明, 明日历)
    const 明剧本 = 每日剧本(cfg, 明, 明日历, {}, 明类型)
    const 第一醒 = 明剧本.items.find((x) => x.起 >= 6 * 60 && !/睡/.test(x.在))
    行们.push(`（明天）${周名(明.周)}·${明类型.名}${第一醒 ? `，${分钟说(第一醒.起)} ${第一醒.在}` : ''}。`)
  }

  // ── 怎么把这段带进聊天（借 daily-schedule 的思路）──
  行们.push('（说话）这些是你自己的日子，别当时间表念：不说"按日程/计划/安排"，不报时间段、不列清单；他问起就像闲聊挑一两件说，带点感受。')
  return {
    text: 行们.join('\n'),
    依据,
    此刻: 在,
    日历,
    偏离,
    类型,
    今天: 状况,
    剧本,
  }
}

function 周名(n) {
  return ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'][n] || ''
}

function 分钟说(分) {
  const m = ((Math.round(分) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

let 缓存 = { at: 0, cfg: null }

/** 读配置：文件不在就写一份默认的；按 mtime 热更 */
export function 读配置() {
  try {
    const st = statSync(CONFIG_PATH)
    if (缓存.cfg && 缓存.at === st.mtimeMs) return 缓存.cfg
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
    const cfg = { ...默认配置, ...raw }
    // 老配置（0.1.x，没有校历）读进来时顺手补一份存盘，免得设置页看到的是"默认值"而文件里没有
    if (!raw.校历) {
      try { writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8') } catch (e2) { /* 写不了不影响读 */ }
    }
    缓存 = { at: statSync(CONFIG_PATH).mtimeMs || st.mtimeMs, cfg }
    return cfg
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      try { mkdirSync(dirname(CONFIG_PATH), { recursive: true }); writeFileSync(CONFIG_PATH, JSON.stringify(默认配置, null, 2), 'utf8') } catch (e2) { /* 写不了就用默认值 */ }
    }
    缓存 = { at: 0, cfg: 默认配置 }
    return 默认配置
  }
}

/** 合并存盘（顶层的键整体替换，跟设置页的编辑方式一致） */
export function 存配置(patch) {
  const 旧 = 读配置()
  const 新 = { ...旧, ...(patch && typeof patch === 'object' ? patch : {}) }
  mkdirSync(dirname(CONFIG_PATH), { recursive: true })
  const tmp = CONFIG_PATH + '.tmp'
  writeFileSync(tmp, JSON.stringify(新, null, 2), 'utf8')
  renameSync(tmp, CONFIG_PATH)
  缓存 = { at: 0, cfg: null }
  return 新
}

export { 补零, 手机们 }
