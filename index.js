// dsh-feiyu-life · mount the life line onto every top-level session.
//
// Why per-agent instead of global:
//   · subagents (B站 scanning, task runners) must not see "she is in class" — they are not her;
//   · the registration is reclaimed with agent.ctx when the session closes.
//
// Why systemPrompt.context instead of a section:
//   · context is the per-turn "current facts", it does not go into the system
//     prompt body, so the prefix cache is not broken.
//
// The state machine (state.js) is the single source of truth. It is driven only
// by the day plan and explicit life_adjust adjustments — never inferred from
// chat text. The plan is what constrains her speech.
//
// Three local endpoints for the settings page (behind the connection gate):
//   GET  /dsh-feiyu-life/state    config + current preview
//   POST /dsh-feiyu-life/save     persist config (full replace)
//   GET  /dsh-feiyu-life/preview  preview at ?ts=ms

import { existsSync, readFileSync } from 'node:fs'
import { readConfig, saveConfig, generate, CONFIG_PATH, zonedNow, todayCalendar } from './life.js'
import { dayType, dailyPlan, planPath, writePlan } from './plan.js'
import { addAdjustment } from './state.js'
import { writeDayWithModel } from './gen.js'
import { registerImage } from './image.js'

export const name = 'feiyu-life'
export const inject = ['systemPrompt', 'agents', 'timer', 'webServer', 'llm', 'tools', 'attachments']

const ROUTE_PREFIX = '/dsh-feiyu-life'
const WEEKDAY = ['', '一', '二', '三', '四', '五', '六', '日']

/** Menstrual cycle day (0 = not on period). */
function periodDay(cfg, ymd) {
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

/** Body/state hint passed to the model when writing a day. */
function bodyHint(cfg, t) {
  const d = periodDay(cfg, t.ymd)
  if (d && d <= 3) return '经期头几天，腰酸、想吃甜的、没力气'
  if (d) return '经期后段，肚子还坠着'
  return ''
}

/** Last three days' plans, so the model does not repeat the same beats. */
function recentSummary(cfg, t) {
  const lines = []
  for (let i = 1; i <= 3; i++) {
    const d = new Date(Date.parse(t.ymd + 'T00:00:00Z') - i * 86400000).toISOString().slice(0, 10)
    try {
      const plan = JSON.parse(readFileSync(planPath(d), 'utf8'))
      const title = plan.title || (plan.type && plan.type.name) || ''
      const bits = (plan.items || []).slice(0, 3).map((x) => x.what ?? x.在).join('、')
      lines.push(`- ${d}：${title}${bits ? '（' + bits + '…）' : ''}`)
    } catch {}
  }
  return lines.join('\n')
}

function calendarLabel(calendar) {
  if (calendar.special) return `特殊：${calendar.special.名}`
  if (calendar.vacation) return `假期：${calendar.vacation.名}`
  if (calendar.term) return `学期：${calendar.term.名}`
  return '平时'
}

const clockOf = (minute) => {
  const v = ((Math.round(minute) % 1440) + 1440) % 1440
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}

export function apply(ctx) {
  const mounted = new Map()

  const sessions = () => {
    try {
      if (typeof ctx.agents.roots === 'function') return ctx.agents.roots() || []
    } catch {}
    try { return ctx.agents.list() || [] } catch { return [] }
  }

  /** Only inject into sessions inside configured workspaces; empty list = all. */
  const inWorkspace = (cfg, cwd) => {
    const list = Array.isArray(cfg.工作区) ? cfg.工作区.filter((x) => typeof x === 'string' && x.trim()) : []
    if (!list.length) return true
    if (!cwd) return false
    return list.some((x) => {
      const head = String(x).replace(/[\\/]+$/, '')
      return cwd === head || cwd.startsWith(head + '/') || cwd.startsWith(head + '\\')
    })
  }

  const mount = (agent) => {
    const cwd = String((agent && agent.session && agent.session.cwd) || '')
    const offs = []
    offs.push(agent.ctx.systemPrompt.context({
      name: 'feiyu-life',
      order: 880,
      text: () => {
        try {
          const cfg = readConfig()
          if (!inWorkspace(cfg, cwd)) return ''
          return generate(cfg).text
        } catch { return '' }
      },
    }))
    // She can change today's plan on purpose; that writes an adjustment segment.
    try {
      const off = agent.ctx.tools.register({
        name: 'life_adjust',
        description: '临时改今天的安排（赖床、出门、被叫走、加班）。只在你真的改主意时用；回复里别提到这个工具。',
        parameters: {
          type: 'object',
          properties: {
            what: { type: 'string', description: '改成在做什么（短句，例如：在便利店买布丁）' },
            from: { type: 'string', description: '从几点开始（HH:MM，不填=现在）' },
            duration: { type: 'number', description: '持续多少分钟，默认 90' },
          },
          required: ['what'],
          additionalProperties: false,
        },
        output: {
          schema: { type: 'object', properties: { ok: { type: 'boolean' }, say: { type: 'string' } }, additionalProperties: true },
          render: (_a, v) => [{ type: 'text', text: String((v && v.say) || '') }],
        },
        async execute(args = {}) {
          try {
            const cfg = readConfig()
            const now = new Date()
            const t = zonedNow(now, String(cfg.时区 || 'Asia/Shanghai'))
            const what = String(args.what || '').trim().slice(0, 24)
            if (!what) return { ok: false, say: '没说要改成什么' }
            let startMinute = t.minuteOfDay
            const m = /^(\d{1,2}):(\d{2})$/.exec(String(args.from || '').trim())
            if (m) startMinute = Number(m[1]) * 60 + Number(m[2])
            const duration = Math.max(15, Math.min(360, Number(args.duration) || 90))
            const dayStartMs = now.getTime() - t.minuteOfDay * 60000
            addAdjustment(t.ymd, {
              start: dayStartMs + startMinute * 60000,
              end: dayStartMs + Math.min(1440, startMinute + duration) * 60000,
              what,
              phone: '在手',
              outfit: '',
              source: 'adjust',
            })
            return { ok: true, say: `记下了：${clockOf(startMinute)} 起，${what}` }
          } catch (e) { return { ok: false, say: '改失败：' + String((e && e.message) || e) } }
        },
      })
      if (typeof off === 'function') offs.push(off)
    } catch {}
    return () => { for (const f of offs) { try { f() } catch {} } }
  }

  // ── Daily plan: write once per date (model first, template fallback) ──
  const writing = new Set()
  const modelAgent = () => {
    try {
      const roots = (typeof ctx.agents.roots === 'function' ? ctx.agents.roots() : ctx.agents.list()) || []
      return roots[0]
    } catch { return undefined }
  }
  const ensurePlan = async (now) => {
    const cfg = readConfig()
    const tz = String(cfg.时区 || 'Asia/Shanghai')
    for (const offset of [0, 1]) {
      const when = offset === 0 ? now : new Date(now.getTime() + 86400000)
      const t = zonedNow(when, tz)
      if (existsSync(planPath(t.ymd))) continue
      if (writing.has(t.ymd)) continue
      writing.add(t.ymd)
      ;(async () => {
        try {
          const calendar = todayCalendar(cfg, t)
          const type = dayType(cfg, t, calendar)
          const agent = modelAgent()
          let result = null
          if (agent) {
            result = await writeDayWithModel(ctx, agent, {
              cfg,
              date: t.ymd,
              weekdayLabel: WEEKDAY[t.weekday],
              typeName: type.name,
              classes: ((cfg.课表 || {})[t.weekday] || []).map((x) => [x[0], x[1], x[2]]),
              calendarLabel: calendarLabel(calendar),
              body: bodyHint(cfg, t),
              recent: recentSummary(cfg, t),
            })
          }
          if (result) {
            writePlan(t.ymd, { type, title: result.title, mood: result.mood, items: result.items, source: 'llm', model: result.model })
            try { console.log('[feiyu-life] plan written by model: ' + t.ymd) } catch {}
          } else {
            const fallback = dailyPlan(cfg, t, calendar, {}, type)
            writePlan(t.ymd, { type, title: fallback.title || '', mood: '', items: fallback.items, source: 'template' })
            try { console.log('[feiyu-life] plan fell back to template: ' + t.ymd) } catch {}
          }
        } catch (e) {
          try { console.log('[feiyu-life] plan write failed: ' + String((e && e.message) || e)) } catch {}
        } finally { writing.delete(t.ymd) }
      })()
    }
  }

  const tick = () => {
    const list = sessions()
    for (const agent of list) {
      if (mounted.has(agent.id)) continue
      try { mounted.set(agent.id, mount(agent)) } catch {}
    }
    for (const [id, off] of mounted) {
      if (list.some((agent) => agent.id === id)) continue
      try { off() } catch {}
      mounted.delete(id)
    }
  }

  ctx.effect(() => ctx.interval(tick, 30000))
  ctx.effect(() => () => {
    for (const off of mounted.values()) { try { off() } catch {} }
    mounted.clear()
  })

  tick()
  try { setTimeout(() => { ensurePlan(new Date()).catch(() => {}) }, 8000) } catch {}
  try { ctx.effect(() => ctx.interval(() => { ensurePlan(new Date()).catch(() => {}) }, 20 * 60 * 1000)) } catch {}

  // ── Settings page endpoints ──────────────────────────────────────────
  const onlyOwner = (handler) => async (req, res) => {
    try {
      const connection = ctx.get('connection')
      const rejection = connection && typeof connection.requestRejection === 'function' ? connection.requestRejection(req) : undefined
      if (rejection === 401 || rejection === 403) {
        res.writeHead(rejection, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: false, error: rejection === 401 ? 'authentication_required' : 'forbidden' }))
        return
      }
    } catch {}
    return handler(req, res)
  }

  const reply = (res, code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(obj))
  }

  const readBody = async (req) => {
    let body = ''
    for await (const chunk of req) body += chunk
    try { return JSON.parse(body || '{}') } catch { return undefined }
  }

  const statePayload = (now) => {
    const cfg = readConfig()
    const r = generate(cfg, now)
    return {
      ok: true,
      config: cfg,
      preview: { text: r.text, evidence: r.evidence },
      timeline: r.timeline || [],
      currentMinute: r.currentMinute || 0,
      configPath: CONFIG_PATH,
      time: (now instanceof Date ? now : new Date()).toISOString(),
    }
  }

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PREFIX + '/state',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try { return reply(res, 200, statePayload(new Date())) } catch (e) { return reply(res, 500, { ok: false, error: String(e && e.message) }) }
      }),
    }), 'feiyu-life: state')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PREFIX + '/save',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        const body = await readBody(req)
        if (!body || typeof body !== 'object') return reply(res, 400, { ok: false, error: 'bad json' })
        try {
          const patch = body.config && typeof body.config === 'object' ? body.config : body
          saveConfig(patch)
          return reply(res, 200, statePayload(new Date()))
        } catch (e) { return reply(res, 500, { ok: false, error: String(e && e.message) }) }
      }),
    }), 'feiyu-life: save')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PREFIX + '/preview',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const url = new URL(req.url || '/', 'http://x')
          const ts = Number(url.searchParams.get('ts'))
          const at = Number.isFinite(ts) && ts > 0 ? new Date(ts) : new Date()
          const r = generate(readConfig(), at)
          return reply(res, 200, {
            ok: true,
            preview: { text: r.text, evidence: r.evidence },
            timeline: r.timeline || [],
            currentMinute: r.currentMinute || 0,
            time: at.toISOString(),
          })
        } catch (e) { return reply(res, 500, { ok: false, error: String(e && e.message) }) }
      }),
    }), 'feiyu-life: preview')
  } catch {}

  // 相机（原 dsh-feiyu-image）：shoot 工具 + /dsh-feiyu-image/* 设置页接口
  try { registerImage(ctx) } catch (e) {
    try { ctx.logger?.warn?.('feiyu-life: 相机没挂上 ' + String((e && e.message) || e)) } catch {}
  }
}
