// 把「她的生活线」挂到每个顶层会话上：每轮组装提示词时现算两行状态。
//
// 为什么挂 per-agent 而不是全局：
//   · 子代理（刷 B 站、跑任务的那些）不该看见本体在不在上课 —— 它们不是她。
//   · 会话关掉时随 agent.ctx 一起回收，不留悬挂注册。
//
// 为什么走 systemPrompt.context 而不是 section：
//   · context 是每轮动态的「当下事实」，不进系统提示词正文，不破坏前缀缓存。
//
// 顺带开三条本机接口给设置页用（都过 connection 那道门，只认本机已登录的页面）：
//   GET  /dsh-feiyu-life/state    配置 + 此刻预览
//   POST /dsh-feiyu-life/save     存配置（整份替换）
//   GET  /dsh-feiyu-life/preview  指定时间预览（?ts=毫秒时间戳）

import { existsSync, readFileSync } from 'node:fs'
import { 读配置, 存配置, 生成, CONFIG_PATH, 时区现在, 今日日历, 识别离场, 写状态 } from './life.js'
import { 日程类型, 每日剧本, 剧本路径, 写剧本, 改剧本 } from './plan.js'
import { 用模型写一天 } from './gen.js'

export const name = 'feiyu-life'
export const inject = ['systemPrompt', 'agents', 'timer', 'webServer', 'llm', 'tools']

const 路由前缀 = '/dsh-feiyu-life'

/** 从一条消息里抽出纯文本 */
function textOfMessage(msg) {
  if (!msg) return ''
  const c = msg.content
  if (!Array.isArray(c)) return ''
  return c.map((x) => (x && x.type === 'text' ? x.text : '')).join('\n')
}

/** 经期第几天（0 = 不在） */
function 经期天(cfg, ymd) {
  const q = cfg.经期 || {}
  const 起 = /^\d{4}-\d{2}-\d{2}$/.test(String(q.起始 || '')) ? Date.parse(String(q.起始) + 'T00:00:00Z') : NaN
  if (!Number.isFinite(起)) return 0
  const 今 = Date.parse(ymd + 'T00:00:00Z')
  if (!Number.isFinite(今)) return 0
  const 天 = Math.floor((今 - 起) / 86400000)
  const 周 = Math.max(1, Math.round(Number(q.周期) || 29))
  const 长 = Math.max(1, Math.round(Number(q.天数) || 5))
  return ((天 % 周) + 周) % 周 < 长 ? ((天 % 周) + 周) % 周 + 1 : 0
}

/** 写剧本时告诉模型的「身体/状态」 */
function 身体提示(cfg, t) {
  const 经 = 经期天(cfg, t.ymd)
  if (经 && 经 <= 3) return '经期头几天，腰酸、想吃甜的、没力气'
  if (经) return '经期后段，肚子还坠着'
  return ''
}

/** 最近三天剧本摘要，避免天天一样 */
function 最近摘要(cfg, t) {
  const 行 = []
  for (let i = 1; i <= 3; i++) {
    const d = new Date(Date.parse(t.ymd + 'T00:00:00Z') - i * 86400000).toISOString().slice(0, 10)
    try {
      const j = JSON.parse(readFileSync(剧本路径(d), 'utf8'))
      const 标题 = j.title || (j.type && j.type.名) || ''
      const 段 = (j.items || []).slice(0, 3).map((x) => x.在).join('、')
      行.push(`- ${d}：${标题}${段 ? '（' + 段 + '…）' : ''}`)
    } catch { /* 没有就算了 */ }
  }
  return 行.join('\n')
}

export function apply(ctx) {
  const mounted = new Map()

  const 会话们 = () => {
    try {
      if (typeof ctx.agents.roots === 'function') return ctx.agents.roots() || []
    } catch (e) { /* 拿不到就退回全部 */ }
    try { return ctx.agents.list() || [] } catch (e) { return [] }
  }

  /** 这个会话在不在「要注入」的工作区名单里；名单空 = 全都注 */
  const 属于工作区 = (cfg, cwd) => {
    const list = Array.isArray(cfg.工作区) ? cfg.工作区.filter((x) => typeof x === 'string' && x.trim()) : []
    if (!list.length) return true
    if (!cwd) return false
    return list.some((x) => {
      const 头 = String(x).replace(/[\\/]+$/, '')
      return cwd === 头 || cwd.startsWith(头 + '/') || cwd.startsWith(头 + '\\')
    })
  }

  const 钟点 = (分) => {
    const v = ((Math.round(分) % 1440) + 1440) % 1440
    return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
  }

  const 挂 = (agent) => {
    const cwd = String((agent && agent.session && agent.session.cwd) || '')
    const 卸 = []
    卸.push(agent.ctx.systemPrompt.context({
      name: 'feiyu-life',
      order: 880,
      text: () => {
        try {
          const cfg = 读配置()
          if (!属于工作区(cfg, cwd)) return ''
          return 生成(cfg).text
        } catch (e) { return '' }
      },
    }))
    // 这轮她回完话，看有没有「要去洗澡/睡了/出门」这类离场话；
    // 有就写进状态文件，下一轮注入时盖过时钟，别前后矛盾。
    try {
      const off = agent.ctx.on('agent/turn-stopping', () => {
        try {
          const ev = (agent.session && agent.session.snapshotEvents ? agent.session.snapshotEvents() : []) || []
          let 回复 = ''
          for (let i = ev.length - 1; i >= 0; i--) {
            const e = ev[i]
            if (e && e.type === 'assistant/message') { 回复 = textOfMessage(e.data && e.data.message); break }
          }
          if (!回复) return
          const 离 = 识别离场(回复, new Date())
          if (离) 写状态(离)
        } catch (e) { /* 识别失败不影响对话 */ }
      })
      if (typeof off === 'function') 卸.push(off)
    } catch (e) { /* 挂不上监听就算了 */ }
    // 她可以临时改主意：改今天的安排（改完下一轮注入就变）
    try {
      const off = agent.ctx.tools.register({
        name: 'life_adjust',
        description: '临时改今天的安排（赖床、出门、被叫走、加班）。只在你真的改主意时用；回复里别提到这个工具。',
        parameters: {
          type: 'object',
          properties: {
            在: { type: 'string', description: '改成在做什么（短句，例如：在便利店买布丁）' },
            从: { type: 'string', description: '从几点开始（HH:MM，不填=现在）' },
            时长分钟: { type: 'number', description: '持续多少分钟，默认 90' },
          },
          required: ['在'],
          additionalProperties: false,
        },
        output: {
          schema: { type: 'object', properties: { ok: { type: 'boolean' }, 说: { type: 'string' } }, additionalProperties: true },
          render: (_a, v) => [{ type: 'text', text: String((v && v.说) || '') }],
        },
        async execute(参数 = {}) {
          try {
            const cfg = 读配置()
            const t = 时区现在(new Date(), String(cfg.时区 || 'Asia/Shanghai'))
            const 在 = String(参数.在 || '').trim().slice(0, 24)
            if (!在) return { ok: false, 说: '没说要改成什么' }
            let 起 = t.分
            const m = /^(\d{1,2}):(\d{2})$/.exec(String(参数.从 || '').trim())
            if (m) 起 = Number(m[1]) * 60 + Number(m[2])
            const 时长 = Math.max(15, Math.min(360, Number(参数.时长分钟) || 90))
            const d = 改剧本(t.ymd, 起, { 起, 止: Math.min(1440, 起 + 时长), 在, 手机: '在手', 穿: '' })
            return d ? { ok: true, 说: `记下了：${钟点(起)} 起，${在}` } : { ok: false, 说: '今天还没有剧本，改不了' }
          } catch (e) { return { ok: false, 说: '改失败：' + String((e && e.message) || e) } }
        },
      })
      if (typeof off === 'function') 卸.push(off)
    } catch (e) { /* 工具注册失败不影响注入 */ }
    return () => { for (const f of 卸) { try { f() } catch {} } }
  }

  // ── 每日剧本：一天写一次（模型写，失败退模板）──
  const 在写 = new Set()
  const 查模型用的会话 = () => {
    try {
      const roots = (typeof ctx.agents.roots === 'function' ? ctx.agents.roots() : ctx.agents.list()) || []
      return roots[0]
    } catch { return undefined }
  }
  const 确保剧本 = async (now) => {
    const cfg = 读配置()
    const tz = String(cfg.时区 || 'Asia/Shanghai')
    for (const 偏移 of [0, 1]) {
      const when = 偏移 === 0 ? now : new Date(now.getTime() + 86400000)
      const t = 时区现在(when, tz)
      if (existsSync(剧本路径(t.ymd))) continue
      if (在写.has(t.ymd)) continue
      在写.add(t.ymd)
      ;(async () => {
        try {
          const 日历 = 今日日历(cfg, t)
          const 类型 = 日程类型(cfg, t, 日历)
          const agent = 查模型用的会话()
          let r = null
          if (agent) {
            r = await 用模型写一天(ctx, agent, {
              cfg, date: t.ymd, 周: t.周, 类型, 日历,
              课表: ((cfg.课表 || {})[t.周] || []).map((x) => [x[0], x[1], x[2]]),
              身体: 身体提示(cfg, t),
              最近: 最近摘要(cfg, t),
            })
          }
          if (r) {
            写剧本(t.ymd, { type: 类型, title: r.title, mood: r.mood, items: r.items, source: 'llm', model: r.model })
            try { console.log('[feiyu-life] 剧本已生成（模型）：' + t.ymd) } catch {}
          } else {
            const 兜底 = 每日剧本(cfg, t, 日历, {}, 类型)
            写剧本(t.ymd, { type: 类型, title: 兜底.title || '', mood: '', items: 兜底.items, source: 'template' })
            try { console.log('[feiyu-life] 剧本用模板兜底：' + t.ymd) } catch {}
          }
        } catch (e) {
          try { console.log('[feiyu-life] 写剧本失败：' + String((e && e.message) || e)) } catch {}
        } finally { 在写.delete(t.ymd) }
      })()
    }
  }

  const tick = () => {
    const list = 会话们()
    for (const agent of list) {
      if (mounted.has(agent.id)) continue
      try { mounted.set(agent.id, 挂(agent)) } catch (e) { /* 这个会话挂不上就算了 */ }
    }
    for (const [id, off] of mounted) {
      if (list.some((agent) => agent.id === id)) continue
      try { off() } catch (e) { /* ignore */ }
      mounted.delete(id)
    }
  }

  ctx.effect(() => ctx.interval(tick, 30000))
  ctx.effect(() => () => {
    for (const off of mounted.values()) {
      try { off() } catch (e) { /* ignore */ }
    }
    mounted.clear()
  })

  tick()
  try { setTimeout(() => { 确保剧本(new Date()).catch(() => {}) }, 8000) } catch {}
  try { ctx.effect(() => ctx.interval(() => { 确保剧本(new Date()).catch(() => {}) }, 20 * 60 * 1000)) } catch {}

  // ── 设置页的三条接口 ────────────────────────────────────────────────
  const 只认本人 = (handler) => async (req, res) => {
    try {
      const 连接 = ctx.get('connection')
      const 拒 = 连接 && typeof 连接.requestRejection === 'function' ? 连接.requestRejection(req) : undefined
      if (拒 === 401 || 拒 === 403) {
        res.writeHead(拒, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: false, error: 拒 === 401 ? 'authentication_required' : 'forbidden' }))
        return
      }
    } catch (e) { /* 老宿主没有这道门就放行，跟其它插件一致 */ }
    return handler(req, res)
  }

  const 回 = (res, code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(obj))
  }

  const 读体 = async (req) => {
    let body = ''
    for await (const chunk of req) body += chunk
    try { return JSON.parse(body || '{}') } catch (e) { return undefined }
  }

  const 状态 = (now) => {
    const cfg = 读配置()
    const r = 生成(cfg, now)
    return {
      ok: true,
      配置: cfg,
      预览: { text: r.text, 依据: r.依据 },
      路径: CONFIG_PATH,
      时间: (now instanceof Date ? now : new Date()).toISOString(),
    }
  }

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: 路由前缀 + '/state',
      handler: 只认本人(async (req, res) => {
        if (req.method !== 'GET') return 回(res, 405, { ok: false, error: 'method not allowed' })
        try { return 回(res, 200, 状态(new Date())) } catch (e) { return 回(res, 500, { ok: false, error: String(e && e.message) }) }
      }),
    }), 'feiyu-life: state')
  } catch (e) { /* 注册失败不影响注入 */ }

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: 路由前缀 + '/save',
      handler: 只认本人(async (req, res) => {
        if (req.method !== 'POST') return 回(res, 405, { ok: false, error: 'method not allowed' })
        const body = await 读体(req)
        if (!body || typeof body !== 'object') return 回(res, 400, { ok: false, error: 'bad json' })
        try {
          const patch = body.配置 && typeof body.配置 === 'object' ? body.配置 : body
          存配置(patch)
          return 回(res, 200, 状态(new Date()))
        } catch (e) { return 回(res, 500, { ok: false, error: String(e && e.message) }) }
      }),
    }), 'feiyu-life: save')
  } catch (e) { /* ignore */ }

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: 路由前缀 + '/preview',
      handler: 只认本人(async (req, res) => {
        if (req.method !== 'GET') return 回(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const url = new URL(req.url || '/', 'http://x')
          const ts = Number(url.searchParams.get('ts'))
          const at = Number.isFinite(ts) && ts > 0 ? new Date(ts) : new Date()
          const cfg = 读配置()
          const r = 生成(cfg, at)
          return 回(res, 200, { ok: true, 预览: { text: r.text, 依据: r.依据 }, 时间: at.toISOString() })
        } catch (e) { return 回(res, 500, { ok: false, error: String(e && e.message) }) }
      }),
    }), 'feiyu-life: preview')
  } catch (e) { /* ignore */ }
}
