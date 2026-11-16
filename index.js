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
//   GET  /dsh-feiyu-life/replay   server-owned map/action keyframes for a day
//   GET  /dsh-feiyu-life/continuity   needs, projects, people and memories
//   POST /dsh-feiyu-life/continuity/person   explicit relationship updates
//   GET  /dsh-feiyu-life/settings-backup   portable life + camera settings
//   POST /dsh-feiyu-life/settings-restore  validate and restore a backup

import { existsSync, readFileSync } from 'node:fs'
import {
  readConfig, saveConfig, replaceConfig, generate, validateConfig, CONFIG_PATH,
  zonedNow, zonedDateTimeMs, addZonedDays, todayCalendar, todayDeviation, menstrualDay,
} from './life.js'
import {
  dayType, dailyPlan, planPath, writePlan, deletePlan, archivePlan,
  restoreLatestPlan, listPlanHistory, cleanupPlans,
} from './plan.js'
import { addAdjustment, listAdjustments, removeAdjustment, cleanupFacts } from './state.js'
import { writeDayWithModel } from './gen.js'
import { registerImage, readImageConfig, replaceImageConfig, cleanupPhotos } from './image.js'
import { BEHAVIOR_RULES, inferenceFor, normalizeWorldConfig } from './world.js'
import { createSettingsBackup, restoreSettingsBackup } from './backup.js'
import {
  affectContext, affectLabel, appendEvent, applyReflection, cleanupEvents, eventId, eventText,
  readAffect, readEvents, recordLifeSettlement, reflectTurn, reflectionUsage,
  resetAffect, shouldReflect, sourceKind,
} from './reflection.js'
import {
  activeEntities, activePeople, cleanupContinuity, continuityContext, continuityRevision,
  continuitySummary, continuityView, mutateEntity, mutatePerson, planSyncInfo, readContinuity, readMemories,
  relationshipSummary, settleTimeline,
} from './continuity.js'

export const name = 'feiyu-life'
export const inject = ['systemPrompt', 'agents', 'timer', 'webServer', 'connection', 'llm', 'tools', 'attachments']

const ROUTE_PREFIX = '/dsh-feiyu-life'
const WEEKDAY = ['', '一', '二', '三', '四', '五', '六', '日']
const PLUGIN_LOGO_FILE = new URL('./icon.png', import.meta.url)
const AVATAR_FILE = new URL('./assets/character-actions.png', import.meta.url)
const AVATAR_BEHAVIORS = ['idle', 'walk', 'sleep', 'study', 'eat', 'phone', 'photo', 'bath']
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
  let reflectionInFlight = 0

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
          const life = generate(cfg).text
          const inner = cfg.内在?.启用 === false ? '' : affectContext(readAffect(cfg.内在), cfg.内在)
          if (cfg.连续性?.启用 === false) return [life, inner].filter(Boolean).join('\n')
          const state = readContinuity()
          return `${life}\n${inner ? inner + '\n' : ''}（生活连续性）${continuityContext(state, readMemories(2), { timeZone: cfg.时区 })}\n${continuitySummary(state, { timeZone: cfg.时区 })}\n（认识的人）\n${relationshipSummary(state, { timeZone: cfg.时区 })}\n这些是你心里记着的事，不要逐条播报；只有自然相关时才提。只有最终真实时间线中已经结束、且未被临时调整覆盖的活动与互动才算发生；不要把计划说成成果。`
        } catch { return '' }
      },
    }))
    // One asynchronous reflection at most for each root-session turn. The
    // original transcript is not persisted; only bounded conclusions enter
    // the plugin-owned audit ledger. A failure never delays or changes chat.
    let pendingInbox = null
    let reflectionChain = Promise.resolve()
    const latestTurnTexts = () => {
      try {
        const events = agent?.session?.snapshotEvents?.() || []
        const rows = Array.isArray(events) ? events : []
        let reply = ''; let replyId = ''; let input = ''; let kind = ''
        for (let i = rows.length - 1; i >= 0; i--) {
          const event = rows[i] || {}
          const row = event?.data?.message || event?.data?.item || event?.event || event?.message || event
          const type = String(event?.type || '')
          const role = row?.role || (type === 'assistant/message' ? 'assistant' : (type === 'user/message' || type === 'inbox/inserted') ? 'user' : '')
          if (!reply && role === 'assistant') {
            reply = eventText(row); replyId = String(row?.id || event?.id || i)
            continue
          }
          if (reply && role === 'user') {
            const value = eventText(row)
            const source = sourceKind(row) || sourceKind(event)
            if (value && !/runtime-context|time-context|system|tool-result|plugin/.test(source)) {
              input = value; kind = source || 'human'
              return { input, reply, kind, token: `${String(row?.id || event?.id || i)}:${replyId}` }
            }
          }
        }
      } catch {}
      return { input: '', reply: '', kind: '', token: '' }
    }
    try {
      const off = agent.ctx.on('agent/inbox/inserted', (payload) => {
        const value = eventText(payload)
        const kind = sourceKind(payload)
        if (!value || /runtime-context|time-context|system|tool-result/.test(kind)) return
        pendingInbox = { text: value, kind: kind || 'human', token: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }
      })
      if (typeof off === 'function') offs.push(off)
    } catch {}
    try {
      let lastReflectedTurn = ''
      const off = agent.ctx.on('agent/turn-stopping', (payload) => {
        const captured = pendingInbox
        const snapshot = latestTurnTexts()
        const inbox = captured || (snapshot.input ? { text: snapshot.input, kind: snapshot.kind, token: snapshot.token } : null)
        if (!inbox || inbox.handled || (snapshot.token && snapshot.token === lastReflectedTurn)) return
        inbox.handled = true
        if (snapshot.token) lastReflectedTurn = snapshot.token
        const payloadReply = eventText(payload?.message || payload?.response || '')
        reflectionChain = reflectionChain.then(async () => {
          const cfg = readConfig()
          const inner = cfg.内在 || {}
          if (inner.启用 === false || !inWorkspace(cfg, cwd)) return
          const replyText = payloadReply || snapshot.reply
          if (!shouldReflect(inner.反思模式, inbox.text, replyText, inbox.kind)) return
          const usage = reflectionUsage(inner, Date.now(), cfg.时区)
          if (usage.remaining <= reflectionInFlight) return
          reflectionInFlight++
          const id = eventId([agent?.session?.id, inbox.token, inbox.kind])
          try {
            const result = await reflectTurn(ctx, agent, {
              userText: inbox.text, replyText, source: inbox.kind,
              config: inner, timeoutSeconds: inner.反思超时秒,
            })
            applyReflection(id, result.reflection, inner)
            appendEvent({
              id, at: Date.now(), type: 'turn.reflection', source: inbox.kind, status: 'applied',
              reason: result.reflection.affect.reason, model: result.model,
              affect: result.reflection.affect, memoryCandidates: result.reflection.memoryCandidates,
              relationshipCandidates: result.reflection.relationshipCandidates, usage: result.usage,
              meta: { inputChars: inbox.text.length, replyChars: replyText.length },
            }, { timeZone: cfg.时区 })
          } catch (e) {
            appendEvent({
              id, at: Date.now(), type: 'turn.reflection', source: inbox.kind, status: 'failed',
              reason: String(e?.message || e).slice(0, 180), meta: { inputChars: inbox.text.length, replyChars: replyText.length },
            }, { timeZone: cfg.时区 })
            try { console.log('[feiyu-life] turn reflection skipped after failure: ' + String(e?.message || e)) } catch {}
          } finally { reflectionInFlight = Math.max(0, reflectionInFlight - 1) }
        }).catch(() => {})
      })
      if (typeof off === 'function') offs.push(off)
    } catch {}
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
    // Explicit, bounded continuity tools. They only update plugin-owned local
    // state; they cannot act in the external world or touch arbitrary files.
    for (const spec of [
      ['life_task', 'tasks', '管理短期待办（例如取快递）。不会执行现实动作。'],
      ['life_commitment', 'commitments', '管理与人或时间有关的约定。不会发送消息或代替赴约。'],
      ['life_thread', 'threads', '管理有可追溯来源的长期主线。不会自主创建主线。'],
    ]) {
      try {
        const [toolName, kind, description] = spec
        const off = agent.ctx.tools.register({
          name: toolName,
          description,
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['create', 'update', 'complete', 'cancel', 'pause', 'resume'] },
              id: { type: 'string' }, title: { type: 'string' }, detail: { type: 'string' },
              origin: { type: 'string', description: '来源说明；创建长期主线时必须明确' },
              dueAt: { type: 'number', description: '可选的 Unix 毫秒时间' }, placeId: { type: 'string' }, with: { type: 'string' }, personId: { type: 'string' },
              nextStep: { type: 'string' }, progress: { type: 'number' },
              artifactType: { type: 'string', enum: ['none', 'document', 'album'] }, artifactName: { type: 'string' },
            },
            required: ['action'], additionalProperties: false,
          },
          output: { schema: { type: 'object', additionalProperties: true }, render: (_a, v) => [{ type: 'text', text: String(v?.say || '') }] },
          async execute(args = {}) {
            try {
              if (args.action === 'create' && kind === 'threads' && !String(args.origin || '').trim()) return { ok: false, say: '长期主线需要写明来源' }
              const input = {
                ...args, source: 'tool', origin: String(args.origin || '对话中由用户明确提出'),
                reality: ['document', 'album'].includes(args.artifactType) ? 'local-artifact' : 'virtual',
              }
              if (args.artifactType) input.artifact = { type: args.artifactType, name: args.artifactName || '' }
              const value = mutateEntity(kind, args.action, input)
              return { ok: true, value, say: `${args.action === 'create' ? '已记下' : '已更新'}：${value?.title || args.id}` }
            } catch (e) { return { ok: false, say: String(e?.message || e) } }
          },
        })
        if (typeof off === 'function') offs.push(off)
      } catch {}
    }
    try {
      const off = agent.ctx.tools.register({
        name: 'life_person',
        description: '管理角色明确认识的人。只能记录用户明确提供的人物，不会联系对方或读取外部通讯录。',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['create', 'update', 'archive', 'restore'] },
            id: { type: 'string' }, name: { type: 'string' }, relation: { type: 'string' }, notes: { type: 'string' },
            origin: { type: 'string', description: '人物信息来源；创建时必须明确' }, closeness: { type: 'number' },
          },
          required: ['action'], additionalProperties: false,
        },
        output: { schema: { type: 'object', additionalProperties: true }, render: (_a, v) => [{ type: 'text', text: String(v?.say || '') }] },
        async execute(args = {}) {
          try {
            if (args.action === 'create' && (!String(args.name || '').trim() || !String(args.origin || '').trim())) return { ok: false, say: '创建人物需要姓名和明确来源' }
            const value = mutatePerson(args.action, { ...args, source: 'tool', origin: args.origin || '对话中由用户明确提出' })
            return { ok: true, value, say: `${args.action === 'create' ? '已经记住' : '人物已更新'}：${value?.name || args.id}` }
          } catch (e) { return { ok: false, say: String(e?.message || e) } }
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
      const continuityState = readContinuity()
      const revision = continuityRevision(continuityState)
      let result = null
      if (agent) {
        result = await writeDayWithModel(ctx, agent, {
          cfg,
          date: t.ymd,
          weekdayLabel: WEEKDAY[t.weekday],
          typeName: type.name,
          routine: (cfg[calendar.routine] || []).map((x) => [x[0], x[1], x[2]]),
          classes: ((cfg.课表 || {})[t.weekday] || []).map((x) => [x[0], x[1], x[2]]),
          calendarLabel: calendarLabel(calendar),
          body: bodyHint(cfg, t, deviation),
          recent: recentSummary(cfg, t),
          continuity: `${continuitySummary(continuityState, { timeZone: cfg.时区 })}\n${continuityContext(continuityState, readMemories(2), { timeZone: cfg.时区 })}`,
          continuityEntities: activeEntities(continuityState),
          relationships: relationshipSummary(continuityState, { timeZone: cfg.时区 }),
          continuityPeople: activePeople(continuityState),
        })
      }
      if (result) {
        if (!writePlan(t.ymd, { type, title: result.title, mood: result.mood, items: result.items, source: 'llm', model: result.model, continuityRevision: revision })) return false
        try { console.log('[feiyu-life] plan written by model: ' + t.ymd) } catch {}
      } else {
        const fallback = dailyPlan(cfg, t, calendar, deviation, type)
        if (!writePlan(t.ymd, { type, title: fallback.title || '', mood: '', items: fallback.items, source: 'template', continuityRevision: revision })) return false
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
  try {
    ctx.effect(() => {
      const timer = setTimeout(() => { ensurePlan(new Date()).catch(() => {}) }, 8000)
      return () => clearTimeout(timer)
    })
  } catch {}
  try { ctx.effect(() => ctx.interval(() => { ensurePlan(new Date()).catch(() => {}) }, 20 * 60 * 1000)) } catch {}

  let settling = false
  const reconcileContinuity = (force = false) => {
    if (settling) return { ok: false, reason: 'locked' }
    settling = true
    try {
      const cfg = readConfig()
      if (cfg.连续性?.启用 === false) return { ok: false, reason: 'disabled' }
      const now = new Date()
      const last = readContinuity().lastSettledAt
      const intervalMs = Math.max(5, Number(cfg.连续性?.结算间隔分钟) || 10) * 60000
      if (!force && last && now.getTime() - last < intervalMs) return { ok: true, applied: 0, reason: 'interval' }
      const tz = String(cfg.时区 || 'Asia/Shanghai')
      const days = [addZonedDays(now, tz, -1), now]
      let applied = 0
      for (const at of days) {
        const date = zonedNow(at, tz).ymd
        const life = generate(cfg, at, { rawTimeline: true })
        const result = settleTimeline({ date, timeline: life.rawTimeline || [], nowMs: now.getTime(), maxArtifacts: cfg.连续性?.每日成果上限 })
        applied += Number(result.applied) || 0
        if (result.applied) recordLifeSettlement(date, result, { timeZone: tz, now: now.getTime() })
      }
      return { ok: true, applied }
    } finally { settling = false }
  }
  try {
    ctx.effect(() => {
      const timer = setTimeout(() => { try { reconcileContinuity() } catch {} }, 12000)
      return () => clearTimeout(timer)
    })
  } catch {}
  try { ctx.effect(() => ctx.interval(() => { try { reconcileContinuity() } catch {} }, 5 * 60 * 1000)) } catch {}

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

  const continuityPayload = (now = new Date()) => {
    const cfg = readConfig()
    const state = readContinuity()
    const tz = String(cfg.时区 || 'Asia/Shanghai')
    const tomorrow = addZonedDays(now, tz, 1)
    const date = zonedNow(tomorrow, tz).ymd
    let plan = null
    try { plan = JSON.parse(readFileSync(planPath(date), 'utf8')) } catch {}
    return {
      ok: true, state, view: continuityView(state, { timeZone: tz }),
      summary: continuitySummary(state, { timeZone: tz }), memories: readMemories(7),
      relationships: relationshipSummary(state, { timeZone: tz }),
      planSync: { ...planSyncInfo(state, plan, date), historyCount: listPlanHistory(date).length },
      limits: { threads: 5, tasks: 30, commitments: 20, people: 20 },
      boundaries: ['不执行外部现实动作', '不自主生图', '只写插件专属目录', '计划不等于完成'],
    }
  }

  const affectPayload = (now = new Date()) => {
    const cfg = readConfig()
    const at = now instanceof Date ? now.getTime() : Number(now) || Date.now()
    const state = readAffect(cfg.内在, at)
    return {
      ok: true, state: { ...state, label: affectLabel(state) },
      events: readEvents({ timeZone: cfg.时区, now: at, limit: 60 }).slice().reverse(),
      usage: reflectionUsage(cfg.内在, at, cfg.时区),
      privacy: '本地只保存反思结论、原因、候选摘要与用量，不保存对话原文。',
      boundaries: ['候选记忆不会自动写入长期记忆', '候选关系不会自动创建人物', '反思失败不影响正常回复'],
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
      kind: 'exact', path: ROUTE_PREFIX + '/affect',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        return reply(res, 200, affectPayload())
      }),
    }), 'feiyu-life: affect')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: ROUTE_PREFIX + '/affect/reset',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        const cfg = readConfig()
        resetAffect(cfg.内在)
        appendEvent({ id: eventId(['affect.reset', Date.now()]), at: Date.now(), type: 'affect.reset', source: 'settings', status: 'applied', reason: '用户在设置页重置内在状态' }, { timeZone: cfg.时区 })
        return reply(res, 200, affectPayload())
      }),
    }), 'feiyu-life: affect reset')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: ROUTE_PREFIX + '/continuity/undo-tomorrow',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        const cfg = readConfig()
        const now = new Date()
        const tz = String(cfg.时区 || 'Asia/Shanghai')
        const date = zonedNow(addZonedDays(now, tz, 1), tz).ymd
        if (!restoreLatestPlan(date)) return reply(res, 404, { ok: false, error: 'no_tomorrow_plan_history' })
        return reply(res, 200, { ...continuityPayload(now), changed: true })
      }),
    }), 'feiyu-life: undo tomorrow continuity sync')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: ROUTE_PREFIX + '/continuity',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        return reply(res, 200, continuityPayload())
      }),
    }), 'feiyu-life: continuity')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: ROUTE_PREFIX + '/continuity/entity',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        let body
        try { body = await readBody(req) } catch (e) { return reply(res, 413, { ok: false, error: String(e.message || e) }) }
        try {
          const kind = String(body?.kind || '')
          if (!['threads', 'tasks', 'commitments'].includes(kind)) return reply(res, 400, { ok: false, error: 'bad kind' })
          if (body?.action === 'create' && kind === 'threads' && !String(body?.origin || '').trim()) return reply(res, 400, { ok: false, error: 'thread origin required' })
          mutateEntity(kind, String(body?.action || ''), { ...body, source: 'settings', origin: body.origin || '连续性设置页手动创建' })
          return reply(res, 200, continuityPayload())
        } catch (e) { return reply(res, 400, { ok: false, error: String(e?.message || e) }) }
      }),
    }), 'feiyu-life: continuity entity')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: ROUTE_PREFIX + '/continuity/person',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        let body
        try { body = await readBody(req) } catch (e) { return reply(res, 413, { ok: false, error: String(e.message || e) }) }
        try {
          if (body?.action === 'create' && (!String(body?.name || '').trim() || !String(body?.origin || '').trim())) return reply(res, 400, { ok: false, error: 'person name and origin required' })
          mutatePerson(String(body?.action || ''), { ...body, source: 'settings', origin: body.origin || '连续性设置页手动创建' })
          return reply(res, 200, continuityPayload())
        } catch (e) { return reply(res, 400, { ok: false, error: String(e?.message || e) }) }
      }),
    }), 'feiyu-life: continuity person')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: ROUTE_PREFIX + '/continuity/settle',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const result = reconcileContinuity(true)
          return reply(res, 200, { ...continuityPayload(), ...result })
        }
        catch (e) { return reply(res, 500, { ok: false, error: String(e?.message || e) }) }
      }),
    }), 'feiyu-life: continuity settle')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: ROUTE_PREFIX + '/continuity/sync-tomorrow',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        const cfg = readConfig()
        const now = new Date()
        const tz = String(cfg.时区 || 'Asia/Shanghai')
        const tomorrow = addZonedDays(now, tz, 1)
        const date = zonedNow(tomorrow, tz).ymd
        const before = continuityPayload(now)
        if (before.planSync.synced) return reply(res, 200, { ...before, changed: false })
        const hadPlan = existsSync(planPath(date))
        const archived = hadPlan ? archivePlan(date) : null
        if (hadPlan && !archived) return reply(res, 500, { ok: false, error: 'could_not_archive_tomorrow_plan' })
        deletePlan(date)
        const ok = await ensurePlanFor(tomorrow)
        if (!ok || !existsSync(planPath(date))) {
          if (archived) restoreLatestPlan(date)
          return reply(res, 500, { ok: false, error: 'tomorrow_sync_failed_previous_plan_restored' })
        }
        return reply(res, 200, { ...continuityPayload(now), changed: true })
      }),
    }), 'feiyu-life: sync tomorrow continuity')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PREFIX + '/logo',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const data = readFileSync(PLUGIN_LOGO_FILE)
          res.writeHead(200, {
            'content-type': 'image/png',
            'content-length': data.length,
            'cache-control': 'public, max-age=86400, immutable',
          })
          res.end(data)
        } catch { return reply(res, 404, { ok: false, error: 'logo_not_found' }) }
      }),
    }), 'feiyu-life: logo')
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
      path: ROUTE_PREFIX + '/replay',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const url = new URL(req.url || '/', 'http://x')
          const ts = Number(url.searchParams.get('ts'))
          const at = Number.isFinite(ts) && ts > 0 ? new Date(ts) : new Date()
          const cfg = readConfig()
          const r = generate(cfg, at, { replay: true })
          const zoned = zonedNow(at, String(cfg.时区 || 'Asia/Shanghai'))
          const today = zonedNow(new Date(), String(cfg.时区 || 'Asia/Shanghai')).ymd
          return reply(res, 200, {
            ok: true,
            date: zoned.ymd,
            today,
            currentMinute: r.currentMinute || 0,
            timeline: r.timeline || [],
            frames: r.replay || [],
            map: cfg.地图 || null,
          })
        } catch (e) { return reply(res, 500, { ok: false, error: String(e && e.message) }) }
      }),
    }), 'feiyu-life: replay')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PREFIX + '/settings-backup',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const backup = createSettingsBackup(readConfig(), readImageConfig())
          const data = Buffer.from(JSON.stringify(backup, null, 2), 'utf8')
          const day = backup.exportedAt.slice(0, 10)
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'content-length': data.length,
            'content-disposition': `attachment; filename="dsh-feiyu-life-settings-${day}.json"`,
            'cache-control': 'no-store',
          })
          res.end(data)
        } catch (e) { return reply(res, 500, { ok: false, error: String(e && e.message) }) }
      }),
    }), 'feiyu-life: settings backup')
  } catch {}

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PREFIX + '/settings-restore',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        let body
        try { body = await readBody(req) } catch (e) { return reply(res, 413, { ok: false, error: String(e.message || e) }) }
        let restored
        try {
          restored = restoreSettingsBackup(body && body.backup)
        } catch (e) { return reply(res, 400, { ok: false, error: String((e && e.message) || e) }) }
        const previousLife = readConfig()
        const previousCamera = readImageConfig()
        try {
          replaceConfig(restored.life)
          replaceImageConfig(restored.camera)
          return reply(res, 200, { ok: true, summary: restored.summary, issues: restored.issues })
        } catch (e) {
          try { replaceConfig(previousLife); replaceImageConfig(previousCamera) } catch {}
          return reply(res, 500, { ok: false, error: '恢复写入失败，已回滚原设置：' + String((e && e.message) || e) })
        }
      }),
    }), 'feiyu-life: settings restore')
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
      cleanupContinuity(Math.max(365, cfg.历史保留天数))
      cleanupEvents(cfg.历史保留天数)
      cleanupPhotos(readImageConfig())
    } catch (e) {
      try { ctx.logger?.warn?.('feiyu-life: 自动清理失败 ' + String((e && e.message) || e)) } catch {}
    }
  }
  try {
    ctx.effect(() => {
      const timer = setTimeout(maintain, 15000)
      return () => clearTimeout(timer)
    })
  } catch {}
  try { ctx.effect(() => ctx.interval(maintain, 24 * 60 * 60 * 1000)) } catch {}
}
