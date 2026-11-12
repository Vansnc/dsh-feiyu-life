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
import {
  readConfig, saveConfig, generate, validateConfig, CONFIG_PATH,
  zonedNow, zonedDateTimeMs, addZonedDays, todayCalendar, todayDeviation, menstrualDay,
} from './life.js'
import {
  dayType, dailyPlan, planPath, writePlan, deletePlan, archivePlan,
  restoreLatestPlan, listPlanHistory, cleanupPlans,
} from './plan.js'
import { addAdjustment, listAdjustments, removeAdjustment, cleanupFacts } from './state.js'
import { writeDayWithModel } from './gen.js'
import { registerImage, readImageConfig, cleanupPhotos } from './image.js'
import { BEHAVIOR_RULES, inferenceFor, normalizeWorldConfig } from './world.js'

export const name = 'feiyu-life'
export const inject = ['systemPrompt', 'agents', 'timer', 'webServer', 'connection', 'llm', 'tools', 'attachments']

const ROUTE_PREFIX = '/dsh-feiyu-life'
const WEEKDAY = ['', '一', '二', '三', '四', '五', '六', '日']
const AVATAR_FILE = new URL('./assets/character-actions.png', import.meta.url)
const AVATAR_BEHAVIORS = ['idle', 'walk', 'sleep', 'study', 'eat', 'phone', 'photo']
const AVATAR_ACTION_FILES = new Map(AVATAR_BEHAVIORS.map((behavior) => [
  behavior,
  new URL(`./assets/actions/${behavior}.png`, import.meta.url),
]))
const XUEYUAN_MAP_FILES = new Map(['base', 'anime', 'buildings'].map((layer) => [
  layer,
  new URL(`./assets/maps/xueyuan-${layer}.svg`, import.meta.url),
]))

/** Body/state hint passed to the model when writing a day. */
function bodyHint(cfg, t, deviation = {}) {
  const detour = deviation.flat ? '今天想躺平，基本不出门'
    : deviation.outing ? '今天临时想出门走走'
      : deviation.skipAfternoon ? '今天不想去下午的课' : ''
  const d = menstrualDay(cfg, t.ymd)
  const body = d && d <= 3 ? '经期头几天，腰酸、想吃甜的、没力气'
    : d ? '经期后段，肚子还坠着' : ''
  return [body, detour].filter(Boolean).join('；')
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
            outfit: { type: 'string', description: '这段时间穿什么（可选）' },
            phone: { type: 'string', enum: ['在手', '静音', '在床头', '不在手边'], description: '这段时间的手机状态（可选）' },
            locationId: { type: 'string', description: '地点 id（可选；不填时从活动短句推断）' },
            behavior: { type: 'string', enum: ['idle', 'walk', 'sleep', 'study', 'eat', 'phone', 'photo', 'bath'], description: '行为（可选；不填时从活动短句推断）' },
          },
          required: ['what'],
          additionalProperties: false,
        },
        output: {
          schema: { type: 'object', properties: { ok: { type: 'boolean' }, say: { type: 'string' } }, additionalProperties: true },
          render: (_a, v) => [{ type: 'text', text: String((v && v.say) || '') }],
        },
        async execute(rawArgs = {}) {
          // 兼容模型按中文描述字段传参（在 / 从 / 时长分钟）
          const args = {
            what: rawArgs.what ?? rawArgs.在,
            from: rawArgs.from ?? rawArgs.从,
            duration: rawArgs.duration ?? rawArgs.时长分钟,
            outfit: rawArgs.outfit ?? rawArgs.穿着,
            phone: rawArgs.phone ?? rawArgs.手机,
            locationId: rawArgs.locationId ?? rawArgs.地点,
            behavior: rawArgs.behavior ?? rawArgs.行为,
          }
          try {
            const cfg = readConfig()
            const now = new Date()
            const t = zonedNow(now, String(cfg.时区 || 'Asia/Shanghai'))
            const what = String(args.what || '').trim().slice(0, 24)
            if (!what) return { ok: false, say: '没说要改成什么' }
            let startMinute = t.minuteOfDay
            const m = /^(\d{1,2}):(\d{2})$/.exec(String(args.from || '').trim())
            if (args.from && (!m || Number(m[1]) > 23 || Number(m[2]) > 59)) return { ok: false, say: '开始时间要写成有效的 HH:MM' }
            if (m) startMinute = Number(m[1]) * 60 + Number(m[2])
            const duration = Math.max(15, Math.min(360, Number(args.duration) || 90))
            const tz = String(cfg.时区 || 'Asia/Shanghai')
            const world = normalizeWorldConfig(cfg.地图)
            const inferred = inferenceFor(what, world)
            const locationId = world.地点.some((node) => node.id === args.locationId) ? String(args.locationId) : inferred.locationId
            const behavior = BEHAVIOR_RULES.some((rule) => rule.id === args.behavior) || args.behavior === 'idle'
              ? String(args.behavior) : inferred.behavior
            const ok = addAdjustment(t.ymd, {
              start: zonedDateTimeMs(t.ymd, startMinute, tz),
              end: zonedDateTimeMs(t.ymd, Math.min(1440, startMinute + duration), tz),
              what,
              phone: ['在手', '静音', '在床头', '不在手边'].includes(args.phone) ? args.phone : '在手',
              outfit: String(args.outfit || '').trim().slice(0, 24),
              locationId,
              behavior,
              source: 'adjust',
            })
            if (!ok) return { ok: false, say: '没能把调整写进状态文件' }
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
  const ensurePlanFor = async (when) => {
    const cfg = readConfig()
    const tz = String(cfg.时区 || 'Asia/Shanghai')
    const t = zonedNow(when, tz)
    if (existsSync(planPath(t.ymd))) return true
    if (writing.has(t.ymd)) return false
    writing.add(t.ymd)
    try {
      const calendar = todayCalendar(cfg, t)
      const deviation = todayDeviation(cfg, t, calendar.routine)
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
          body: bodyHint(cfg, t, deviation),
          recent: recentSummary(cfg, t),
        })
      }
      if (result) {
        if (!writePlan(t.ymd, { type, title: result.title, mood: result.mood, items: result.items, source: 'llm', model: result.model })) return false
        try { console.log('[feiyu-life] plan written by model: ' + t.ymd) } catch {}
      } else {
        const fallback = dailyPlan(cfg, t, calendar, deviation, type)
        if (!writePlan(t.ymd, { type, title: fallback.title || '', mood: '', items: fallback.items, source: 'template' })) return false
        try { console.log('[feiyu-life] plan fell back to template: ' + t.ymd) } catch {}
      }
      return true
    } catch (e) {
      try { console.log('[feiyu-life] plan write failed: ' + String((e && e.message) || e)) } catch {}
      return false
    } finally { writing.delete(t.ymd) }
  }
  const ensurePlan = async (now) => {
    const tz = String(readConfig().时区 || 'Asia/Shanghai')
    await Promise.all([ensurePlanFor(now), ensurePlanFor(addZonedDays(now, tz, 1))])
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
      const rejection = ctx.connection.requestRejection(req)
      if (rejection !== undefined) {
        const code = Number.isInteger(rejection) && rejection >= 400 && rejection <= 599 ? rejection : 403
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: false, error: code === 401 ? 'authentication_required' : 'forbidden' }))
        return
      }
    } catch {
      res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ ok: false, error: 'connection_guard_unavailable' }))
      return
    }
    return handler(req, res)
  }

  const reply = (res, code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(obj))
  }

  const readBody = async (req) => {
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > 1024 * 1024) throw new Error('request body too large')
    }
    try { return JSON.parse(body || '{}') } catch { return undefined }
  }

  const adjustmentPayload = (cfg, at) => {
    const tz = String(cfg.时区 || 'Asia/Shanghai')
    const day = zonedNow(at instanceof Date ? at : new Date(at), tz)
    return listAdjustments(day.ymd).map((fact) => {
      const start = zonedNow(new Date(fact.start), tz)
      const end = zonedNow(new Date(fact.end), tz)
      return {
        id: String(fact.id || ''), index: fact.index, date: day.ymd,
        start: start.minuteOfDay,
        end: end.ymd === day.ymd ? end.minuteOfDay : 1440,
        what: String(fact.what || ''), phone: String(fact.phone || '在手'),
        outfit: String(fact.outfit || ''), locationId: String(fact.locationId || ''),
        behavior: String(fact.behavior || ''), createdAt: Number(fact.createdAt) || 0,
      }
    })
  }

  const statePayload = (now) => {
    const cfg = readConfig()
    const r = generate(cfg, now)
    const t = zonedNow(now instanceof Date ? now : new Date(now), String(cfg.时区 || 'Asia/Shanghai'))
    return {
      ok: true,
      config: cfg,
      preview: { text: r.text, evidence: r.evidence },
      timeline: r.timeline || [],
      currentMinute: r.currentMinute || 0,
      current: r.current || null,
      world: r.world || null,
      adjustments: adjustmentPayload(cfg, now),
      meta: {
        dayType: r.dayType || null,
        calendar: calendarLabel(r.calendar || {}),
        routine: (r.calendar && r.calendar.routine) || '日常',
        deviation: r.deviation || {},
        plan: r.plan ? {
          date: r.plan.date || '',
          source: r.plan.source || 'preview',
          title: r.plan.title || '',
          model: r.plan.model || '',
        } : null,
        planHistoryCount: listPlanHistory(t.ymd).length,
      },
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

  for (const [behavior, file] of AVATAR_ACTION_FILES) {
    try {
      ctx.effect(() => ctx.webServer.register({
        kind: 'exact',
        path: `${ROUTE_PREFIX}/avatar/${behavior}`,
        handler: onlyOwner(async (req, res) => {
          if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
          try {
            const data = readFileSync(file)
            res.writeHead(200, {
              'content-type': 'image/png',
              'content-length': data.length,
              'cache-control': 'no-store',
            })
            res.end(data)
          } catch (e) { return reply(res, 404, { ok: false, error: 'avatar_action_not_found' }) }
        }),
      }), `feiyu-life: avatar ${behavior}`)
    } catch {}
  }

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PREFIX + '/avatar',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const url = new URL(req.url || '/', 'http://x')
          const file = AVATAR_ACTION_FILES.get(String(url.searchParams.get('action') || '')) || AVATAR_FILE
          const data = readFileSync(file)
          res.writeHead(200, {
            'content-type': 'image/png',
            'content-length': data.length,
            'cache-control': 'no-store',
          })
          res.end(data)
        } catch (e) { return reply(res, 404, { ok: false, error: 'avatar_not_found' }) }
      }),
    }), 'feiyu-life: avatar')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PREFIX + '/map/xueyuan',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const url = new URL(req.url || '/', 'http://x')
          const file = XUEYUAN_MAP_FILES.get(String(url.searchParams.get('layer') || 'base'))
          if (!file) return reply(res, 404, { ok: false, error: 'map_layer_not_found' })
          const data = readFileSync(file)
          res.writeHead(200, {
            'content-type': 'image/svg+xml; charset=utf-8',
            'content-length': data.length,
            'cache-control': 'no-store',
          })
          res.end(data)
        } catch (e) { return reply(res, 404, { ok: false, error: 'map_layer_not_found' }) }
      }),
    }), 'feiyu-life: xueyuan map')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PREFIX + '/save',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        let body
        try { body = await readBody(req) } catch (e) { return reply(res, 413, { ok: false, error: String(e.message || e) }) }
        if (!body || typeof body !== 'object') return reply(res, 400, { ok: false, error: 'bad json' })
        try {
          const patch = body.config && typeof body.config === 'object' ? body.config : body
          const checked = validateConfig(patch)
          saveConfig(checked.config)
          return reply(res, 200, { ...statePayload(new Date()), issues: checked.issues })
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
            current: r.current || null,
            world: r.world || null,
            adjustments: adjustmentPayload(readConfig(), at),
            meta: {
              dayType: r.dayType || null,
              calendar: calendarLabel(r.calendar || {}),
              routine: (r.calendar && r.calendar.routine) || '日常',
              deviation: r.deviation || {},
              plan: r.plan ? {
                date: r.plan.date || '', source: r.plan.source || 'preview',
                title: r.plan.title || '', model: r.plan.model || '',
              } : null,
              planHistoryCount: listPlanHistory(zonedNow(at, String(readConfig().时区 || 'Asia/Shanghai')).ymd).length,
            },
            time: at.toISOString(),
          })
        } catch (e) { return reply(res, 500, { ok: false, error: String(e && e.message) }) }
      }),
    }), 'feiyu-life: preview')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PREFIX + '/infer',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const url = new URL(req.url || '/', 'http://x')
          const text = String(url.searchParams.get('text') || '').trim().slice(0, 200)
          if (!text) return reply(res, 400, { ok: false, error: 'text_required' })
          return reply(res, 200, { ok: true, ...inferenceFor(text, readConfig().地图) })
        } catch (e) { return reply(res, 500, { ok: false, error: String(e && e.message) }) }
      }),
    }), 'feiyu-life: infer')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PREFIX + '/regenerate',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const cfg = readConfig()
          const now = new Date()
          const t = zonedNow(now, String(cfg.时区 || 'Asia/Shanghai'))
          const hadPlan = existsSync(planPath(t.ymd))
          const archived = archivePlan(t.ymd)
          if (hadPlan && !archived) return reply(res, 500, { ok: false, error: 'could_not_archive_current_plan' })
          deletePlan(t.ymd)
          const ok = await ensurePlanFor(now)
          if (!ok || !existsSync(planPath(t.ymd))) {
            if (archived) restoreLatestPlan(t.ymd)
            return reply(res, 500, { ok: false, error: 'regeneration_failed_previous_plan_restored' })
          }
          return reply(res, 200, statePayload(now))
        } catch (e) { return reply(res, 500, { ok: false, error: String(e && e.message) }) }
      }),
    }), 'feiyu-life: regenerate')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PREFIX + '/undo-regenerate',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const now = new Date()
          const cfg = readConfig()
          const t = zonedNow(now, String(cfg.时区 || 'Asia/Shanghai'))
          if (!restoreLatestPlan(t.ymd)) return reply(res, 404, { ok: false, error: 'no_plan_history' })
          return reply(res, 200, statePayload(now))
        } catch (e) { return reply(res, 500, { ok: false, error: String(e && e.message) }) }
      }),
    }), 'feiyu-life: undo regenerate')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PREFIX + '/adjustments/delete',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        let body
        try { body = await readBody(req) } catch (e) { return reply(res, 413, { ok: false, error: String(e.message || e) }) }
        if (!body || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.date || ''))) return reply(res, 400, { ok: false, error: 'bad date' })
        const selector = { id: String(body.id || ''), index: Number.isInteger(body.index) ? body.index : -1 }
        if (!selector.id && selector.index < 0) return reply(res, 400, { ok: false, error: 'bad selector' })
        if (!removeAdjustment(String(body.date), selector)) return reply(res, 404, { ok: false, error: 'adjustment_not_found' })
        return reply(res, 200, statePayload(new Date()))
      }),
    }), 'feiyu-life: delete adjustment')
  } catch {}

  // 相机（原 dsh-feiyu-image）：shoot 工具 + /dsh-feiyu-image/* 设置页接口
  try { registerImage(ctx) } catch (e) {
    try { ctx.logger?.warn?.('feiyu-life: 相机没挂上 ' + String((e && e.message) || e)) } catch {}
  }

  const maintain = () => {
    try {
      const cfg = readConfig()
      cleanupPlans(cfg.历史保留天数)
      cleanupFacts(cfg.历史保留天数)
      cleanupPhotos(readImageConfig())
    } catch (e) {
      try { ctx.logger?.warn?.('feiyu-life: 自动清理失败 ' + String((e && e.message) || e)) } catch {}
    }
  }
  try { setTimeout(maintain, 15000) } catch {}
  try { ctx.effect(() => ctx.interval(maintain, 24 * 60 * 60 * 1000)) } catch {}
}
