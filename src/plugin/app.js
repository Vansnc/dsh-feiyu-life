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
  readConfig, saveConfig, replaceConfig, generate, validateConfig, configPath,
  zonedNow, zonedDateTimeMs, addZonedDays, todayCalendar, todayDeviation, menstrualDay, coldEpisode, lastNightSleep, spokenClock, placeCategory,
} from '../life/life.js'
import {
  dayType, dailyPlan, planPath, readPlan, scheduleRevision, writePlan, deletePlan, archivePlan,
  restoreLatestPlan, listPlanHistory, cleanupPlans,
} from '../life/plan.js'
import { addAdjustment, listAdjustments, removeAdjustment, cleanupFacts } from '../life/state.js'
import { writeDayWithModel } from '../life/gen.js'
import { cleanupMoments, momentSummary } from '../life/moments.js'
import { agencyContext, agencyShareCandidates, handleAgencyInboxReply, markAgencyOutreach, observeAgencyReply, readAgency } from '../cognition/agency/index.js'
import { runInternalAgencyRunner } from '../cognition/agency/runner.js'
import {
  buildCandidates, buildSharePrompt, commitShare, normalizeSharingConfig, readSharing, releaseShare, sharingStatus, takeShare,
} from '../proactive/sharing.js'
import { registerImage, readImageConfig, replaceImageConfig, cleanupPhotos } from '../media/image.js'
import { BEHAVIOR_RULES, inferenceFor, normalizeWorldConfig } from '../life/world.js'
import { createSettingsBackup, restoreSettingsBackup } from '../persistence/backup.js'
import {
  affectContext, affectLabel, appendEvent, applyReflection, cleanupEvents, eventId, eventText,
  readAffect, readEvents, recordLifeSettlement, reflectTurn, reflectionUsage,
  resetAffect, shouldReflect, sourceKind,
} from '../cognition/reflection.js'
import {
  applyCognition, externalPluginStatus, mindContext,
  mutateGoal, mutateMemory, mutatePreference, readMind, writeMind,
} from '../cognition/mind.js'
import {
  activeEntities, activePeople, cleanupContinuity, continuityContext, continuityRevision,
  continuitySummary, continuityView, mutateEntity, mutatePerson, planSyncInfo, readContinuity, readMemories,
  relationshipSummary, settleTimeline,
} from '../life/continuity.js'

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

import { bodyHint, calendarLabel, recentSummary, selfHint } from './context-hints.js'
import { createInitiativeRunner } from './initiative.js'
import { registerLifeTools } from './tools.js'
import { createHttpHelpers } from './http.js'
import { registerMediaRoutes } from './routes/media.js'
import { registerBackupRoutes } from './routes/backup.js'
import { installMaintenance } from './lifecycle.js'

const clockOf = (minute) => {
  const v = ((Math.round(minute) % 1440) + 1440) % 1440
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}

export function apply(ctx) {
  const mounted = new Map()
  let reflectionInFlight = 0
  const lastHumanAt = new Map()
  const lastHumanText = new Map()
  const sharingCheckedAt = new Map()
  const initiativeRunning = new Set()
  let lastInternalAgencyAt = 0

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
    if (!lastHumanAt.has(agent.id)) lastHumanAt.set(agent.id, Date.now())
    if (!lastHumanText.has(agent.id)) lastHumanText.set(agent.id, '')
    const offs = []
    offs.push(agent.ctx.systemPrompt.context({
      name: 'feiyu-life',
      order: 880,
      text: () => {
        try {
          const cfg = readConfig()
          if (!inWorkspace(cfg, cwd)) return ''
          const external = externalPluginStatus()
          const externalFirst = cfg.人格?.外部插件兼容 === '外部优先'
          const state = cfg.连续性?.启用 === false ? null : readContinuity()
          const people = state ? activePeople(state).map((x) => x.name) : []
          const life = generate(cfg, new Date(), {
            energyBaseline: state?.needs?.energy,
            people,
          })
          const inner = cfg.内在?.启用 === false || (externalFirst && external.mood) ? '' : affectContext(readAffect(cfg.内在), cfg.内在)
          const personalityCfg = externalFirst && external.memory ? { ...cfg.人格, 记忆启用: false } : cfg.人格
          const personality = cfg.人格?.启用 === false ? '' : mindContext(readMind(cfg.人格), pendingInbox?.text || '', personalityCfg)
          if (!state) return [life.text, inner, personality].filter(Boolean).join('\n')
          const agency = readAgency()
          return [
            life.text,
            inner,
            personality,
            `（生活连续性）${continuityContext(state, readMemories(2), { timeZone: cfg.时区, vitality: life.vitality })}`,
            continuitySummary(state, { timeZone: cfg.时区 }),
            agencyContext(agency.focus),
            `（认识的人）\n${relationshipSummary(state, { timeZone: cfg.时区 })}\n这些是你心里记着的事，不要逐条播报；只有自然相关时才提。只有最终真实时间线中已经结束、且未被临时调整覆盖的活动与互动才算发生；不要把计划说成成果。`,
          ].filter(Boolean).join('\n')
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
            if (value && !/runtime-context|time-context|system|tool-result|plugin|feiyu-life-share/.test(source)) {
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
        if (/feiyu-life-share/.test(kind)) return
        pendingInbox = { text: value, kind: kind || 'human', token: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }
        if (!/feiyu-life-initiative|feiyu-life-share|bili-duty-scan/.test(kind)) {
          lastHumanAt.set(agent.id, Date.now())
          lastHumanText.set(agent.id, String(value).slice(0, 400))
          try { handleAgencyInboxReply(value, payload, agent.id, { now: Date.now() }) } catch {}
        }
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
          if ((inner.启用 === false && cfg.人格?.启用 === false) || !inWorkspace(cfg, cwd)) return
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
            const external = externalPluginStatus()
            const externalFirst = cfg.人格?.外部插件兼容 === '外部优先'
            if (inner.启用 !== false && !(externalFirst && external.mood)) applyReflection(id, result.reflection, inner)
            const cognition = cfg.人格?.启用 === false
              ? { applied: false, changes: [] }
              : applyCognition(id, result.reflection, externalFirst && external.memory ? { ...cfg.人格, 记忆启用: false } : cfg.人格)
            appendEvent({
              id, at: Date.now(), type: 'turn.reflection', source: inbox.kind, status: 'applied',
              reason: result.reflection.affect.reason, model: result.model,
              affect: result.reflection.affect, memoryCandidates: result.reflection.memoryCandidates,
              relationshipCandidates: result.reflection.relationshipCandidates,
              preferenceCandidates: result.reflection.preferenceCandidates, goalCandidates: result.reflection.goalCandidates,
              identityEvidence: result.reflection.identityEvidence, initiative: result.reflection.initiative, usage: result.usage,
              meta: { inputChars: inbox.text.length, replyChars: replyText.length, cognitiveChanges: cognition.changes },
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
    offs.push(...registerLifeTools(agent, {
      readConfig, mutateMemory, mutatePreference, mutateGoal, mutateEntity, mutatePerson,
      addAdjustment, zonedNow, zonedDateTimeMs, normalizeWorldConfig, inferenceFor,
      BEHAVIOR_RULES, clockOf,
    }))
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
    if (readPlan(t.ymd)) return true
    if (writing.has(t.ymd)) return false
    writing.add(t.ymd)
    try {
      const calendar = todayCalendar(cfg, t)
      const deviation = todayDeviation(cfg, t, calendar.routine)
      const type = dayType(cfg, t, calendar)
      const sleep = lastNightSleep(cfg, { ...t, routine: calendar.routine }, [], t.minuteOfDay)
      const sleepHint = sleep.source === 'future' || sleep.source === 'ongoing'
        ? '这一觉还没睡完'
        : sleep.minutes
          ? `约 ${(sleep.minutes / 60).toFixed(1)} 小时${Number.isFinite(sleep.startMinute) ? `，${spokenClock(sleep.startMinute)} 开始睡` : ''}`
          : ''
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
          sleep: sleepHint,
          mood: affectLabel(readAffect(cfg.内在, when.getTime?.() || Date.now())),
          self: selfHint(cfg, when.getTime?.() || Date.now()),
          recent: recentSummary(cfg, t),
          continuity: `${continuitySummary(continuityState, { timeZone: cfg.时区 })}\n${continuityContext(continuityState, readMemories(2), { timeZone: cfg.时区 })}`,
          continuityEntities: activeEntities(continuityState),
          relationships: relationshipSummary(continuityState, { timeZone: cfg.时区 }),
          continuityPeople: activePeople(continuityState),
        })
      }
      if (result) {
        if (!writePlan(t.ymd, { type, title: result.title, mood: result.mood, items: result.items, source: 'llm', model: result.model, continuityRevision: revision, scheduleRevision: scheduleRevision(cfg) })) return false
        try { console.log('[feiyu-life] plan written by model: ' + t.ymd) } catch {}
      } else {
        const fallback = dailyPlan(cfg, t, calendar, deviation, type)
        if (!writePlan(t.ymd, { type, title: fallback.title || '', mood: '', items: fallback.items, source: 'template', continuityRevision: revision, scheduleRevision: scheduleRevision(cfg) })) return false
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

  /** Bounded, model-free internal cognition. Runs even when outbound sharing is off. */
  const runInternalAgency = (now = Date.now()) => {
    if (now - lastInternalAgencyAt < 60000) return { ok: true, reason: 'interval' }
    lastInternalAgencyAt = now
    return runInternalAgencyRunner({
      now, readConfig, readContinuity, readMind, readAffect, readEvents, readSharing,
    })
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
    try { runInternalAgency() } catch {}
  }

  const runInitiative = createInitiativeRunner({
    readConfig, normalizeSharingConfig, sessions, inWorkspace, generate, readContinuity,
    activePeople, readSharing, readMind, readAffect, readAgency, buildCandidates,
    agencyShareCandidates, takeShare, buildSharePrompt, commitShare, releaseShare,
    appendEvent, eventId, markAgencyOutreach, placeCategory, zonedNow,
    lastHumanAt, lastHumanText, sharingCheckedAt, initiativeRunning, runInternalAgency,
  })

  ctx.effect(() => ctx.interval(tick, 30000))
  try { ctx.effect(() => ctx.interval(() => { runInitiative().catch(() => {}) }, 5 * 60 * 1000)) } catch {}
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
        const life = generate(cfg, at, { rawTimeline: true, moments: false })
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
  const { onlyOwner, reply, readBody } = createHttpHelpers(ctx)

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
    const at = now instanceof Date ? now : new Date(now)
    const tz = String(cfg.时区 || 'Asia/Shanghai')
    const sameDay = zonedNow(at, tz).ymd === zonedNow(new Date(), tz).ymd
    // Previewing another date must not create decorative state for it.
    const r = generate(cfg, at, { moments: sameDay })
    const t = zonedNow(at, tz)
    const agency = readAgency(at.getTime())
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
        vitality: r.vitality || null,
        reply: r.reply || null,
        moment: r.moment || null,
        coverage: r.coverage || null,
        agency: agency.focus ? {
          ...agency.focus,
          lastExecution: (agency.executions || []).at(-1) || null,
        } : null,
      },
      configPath: configPath(),
      time: at.toISOString(),
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
      boundaries: ['候选需经过人格沉淀策略', '敏感候选不自动沉淀', '反思失败不影响正常回复'],
    }
  }

  const mindPayload = (now = new Date()) => {
    const cfg = readConfig()
    const at = now instanceof Date ? now.getTime() : Number(now) || Date.now()
    const mind = readMind(cfg.人格, at)
    return {
      ok: true, mind, integrations: externalPluginStatus(),
      counts: {
        memories: mind.memories.filter((x) => x.status === 'active').length,
        preferences: mind.preferences.filter((x) => x.status === 'active').length,
        goals: mind.goals.filter((x) => x.status === 'active').length,
        relationships: mind.relationships.length,
      },
      boundaries: ['长期记忆可查看、修正和淡忘', '敏感候选不自动沉淀', '自身目标仅限虚拟或插件本地范围', '主动分享不会执行现实动作'],
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
      kind: 'exact', path: ROUTE_PREFIX + '/mind',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        return reply(res, 200, mindPayload())
      }),
    }), 'feiyu-life: personality mind')
  } catch {}

  for (const [path, kind, mutate] of [
    ['/mind/memory', 'memory', mutateMemory], ['/mind/preference', 'preference', mutatePreference], ['/mind/goal', 'goal', mutateGoal],
  ]) {
    try {
      ctx.effect(() => ctx.webServer.register({
        kind: 'exact', path: ROUTE_PREFIX + path,
        handler: onlyOwner(async (req, res) => {
          if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
          let body
          try { body = await readBody(req) } catch (e) { return reply(res, 413, { ok: false, error: String(e.message || e) }) }
          try {
            const cfg = readConfig()
            mutate(String(body?.action || ''), { ...body, source: 'settings', origin: '人格设置页明确操作' }, cfg.人格)
            return reply(res, 200, mindPayload())
          } catch (e) { return reply(res, 400, { ok: false, error: `${kind}: ${String(e?.message || e)}` }) }
        }),
      }), `feiyu-life: ${kind} mutation`)
    } catch {}
  }

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: ROUTE_PREFIX + '/mind/initiative',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        let body = {}
        try { body = await readBody(req) } catch {}
        const list = sessions()
        const target = list.find((x) => String(x.id) === String(body?.sessionId || '')) || list[0]
        if (!target) return reply(res, 409, { ok: false, error: 'no live root session' })
        const results = await runInitiative(target, true)
        return reply(res, 200, { ...mindPayload(), initiativeResult: results[0] || { sessionId: target.id, sent: false, reason: 'not-run' } })
      }),
    }), 'feiyu-life: manual initiative')
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

  registerMediaRoutes({
    ctx, prefix: ROUTE_PREFIX, onlyOwner, reply,
    logoFile: PLUGIN_LOGO_FILE, avatarFile: AVATAR_FILE,
    avatarActionFiles: AVATAR_ACTION_FILES, mapFiles: XUEYUAN_MAP_FILES,
  })

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
          const r = generate(cfg, at, { replay: true, moments: false })
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

  registerBackupRoutes({
    ctx, prefix: ROUTE_PREFIX, onlyOwner, reply, readBody,
    readConfig, readImageConfig, readMind, createSettingsBackup,
    restoreSettingsBackup, replaceConfig, replaceImageConfig, writeMind,
  })

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

  installMaintenance(ctx, {
    readConfig, readImageConfig, cleanupPlans, cleanupFacts, cleanupContinuity,
    cleanupEvents, cleanupPhotos, cleanupMoments,
  })
}
