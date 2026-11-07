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

import { 读配置, 存配置, 生成, CONFIG_PATH } from './life.js'

export const name = 'feiyu-life'
export const inject = ['systemPrompt', 'agents', 'timer', 'webServer']

const 路由前缀 = '/dsh-feiyu-life'

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

  const 挂 = (agent) => {
    const cwd = String((agent && agent.session && agent.session.cwd) || '')
    return agent.ctx.systemPrompt.context({
      name: 'feiyu-life',
      order: 880,
      text: () => {
        try {
          const cfg = 读配置()
          if (!属于工作区(cfg, cwd)) return ''
          return 生成(cfg).text
        } catch (e) { return '' }
      },
    })
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
