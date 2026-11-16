// dsh-feiyu-life · life continuity
//
// The final, adjusted timeline is the only source of completed activity. This
// module never treats a plan as proof, performs external actions, generates
// images, or writes outside the plugin-owned directory.

import { createHash, randomUUID } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { homedir } from 'node:os'

export const CONTINUITY_VERSION = 1
export const ENTITY_LIMITS = { threads: 5, tasks: 30, commitments: 20 }
const kinds = ['threads', 'tasks', 'commitments']
const root = () => process.env.DSH_HOME || join(homedir(), '.dsh')
export const continuityPath = () => join(root(), 'feiyu-life-continuity.json')
export const memoriesDir = () => join(root(), 'feiyu-life-memories')
export const effectsDir = () => join(root(), 'feiyu-life-effects')
export const projectsDir = () => join(root(), 'feiyu-life-projects')
const locks = new Set()

const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, Math.round(Number(n) || 0)))
const text = (v, n = 120) => String(v || '').trim().slice(0, n)
const copy = (x) => JSON.parse(JSON.stringify(x))

function atomicJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  renameSync(tmp, path)
}

function atomicText(path, value) {
  mkdirSync(join(path, '..'), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, value, 'utf8')
  renameSync(tmp, path)
}

function acquireFileLock(date, now) {
  mkdirSync(effectsDir(), { recursive: true })
  const path = join(effectsDir(), `${date}.lock`)
  try {
    if (existsSync(path) && now - statSync(path).mtimeMs > 120000) unlinkSync(path)
    const fd = openSync(path, 'wx')
    writeFileSync(fd, `${process.pid} ${now}\n`)
    return { fd, path }
  } catch { return null }
}

function releaseFileLock(lock) {
  if (!lock) return
  try { closeSync(lock.fd) } catch {}
  try { unlinkSync(lock.path) } catch {}
}

export function defaultContinuity(now = Date.now()) {
  return {
    v: CONTINUITY_VERSION,
    needs: { energy: 70, stress: 30, sleepDebtMinutes: 0, socialNeed: 30, lastMealAt: 0, updatedAt: now },
    threads: [], tasks: [], commitments: [], recentChanges: [], appliedEffects: [], lastSettledAt: 0,
  }
}

function normalizeArtifact(value) {
  const type = ['document', 'album'].includes(value?.type) ? value.type : 'none'
  return { type, name: text(value?.name, 60) }
}

function normalizeEntity(kind, x, now = Date.now()) {
  const statusSet = kind === 'threads' ? ['active', 'paused', 'completed', 'cancelled'] : ['open', 'completed', 'cancelled']
  const status = statusSet.includes(x?.status) ? x.status : (kind === 'threads' ? 'active' : 'open')
  return {
    id: text(x?.id, 80) || randomUUID(),
    title: text(x?.title, 80),
    detail: text(x?.detail, 300),
    status,
    source: text(x?.source, 80) || 'manual',
    origin: text(x?.origin, 160) || '设置页手动创建',
    reality: ['virtual', 'local-artifact'].includes(x?.reality) ? x.reality : 'virtual',
    createdAt: Number(x?.createdAt) || now,
    updatedAt: Number(x?.updatedAt) || now,
    dueAt: Math.max(0, Number(x?.dueAt) || 0),
    completedAt: Math.max(0, Number(x?.completedAt) || 0),
    placeId: text(x?.placeId, 60),
    with: text(x?.with, 80),
    progress: kind === 'threads' ? clamp(x?.progress) : undefined,
    nextStep: kind === 'threads' ? text(x?.nextStep, 160) : undefined,
    artifact: kind === 'threads' ? normalizeArtifact(x?.artifact) : undefined,
  }
}

export function normalizeContinuity(raw, now = Date.now()) {
  const base = defaultContinuity(now)
  if (!raw || typeof raw !== 'object') return base
  const out = { ...base, ...raw, v: CONTINUITY_VERSION }
  out.needs = {
    energy: clamp(raw.needs?.energy ?? base.needs.energy),
    stress: clamp(raw.needs?.stress ?? base.needs.stress),
    sleepDebtMinutes: clamp(raw.needs?.sleepDebtMinutes, 0, 1440),
    socialNeed: clamp(raw.needs?.socialNeed ?? base.needs.socialNeed),
    lastMealAt: Math.max(0, Number(raw.needs?.lastMealAt) || 0),
    updatedAt: Math.max(0, Number(raw.needs?.updatedAt) || now),
  }
  for (const kind of kinds) out[kind] = (Array.isArray(raw[kind]) ? raw[kind] : []).map((x) => normalizeEntity(kind, x, now)).filter((x) => x.title).slice(0, ENTITY_LIMITS[kind] * 3)
  out.recentChanges = (Array.isArray(raw.recentChanges) ? raw.recentChanges : []).slice(-80)
  out.appliedEffects = (Array.isArray(raw.appliedEffects) ? raw.appliedEffects : []).map(String).slice(-2000)
  out.lastSettledAt = Math.max(0, Number(raw.lastSettledAt) || 0)
  return out
}

export function readContinuity(now = Date.now()) {
  try { return normalizeContinuity(JSON.parse(readFileSync(continuityPath(), 'utf8')), now) } catch {
    try { return normalizeContinuity(JSON.parse(readFileSync(continuityPath() + '.bak', 'utf8')), now) } catch { return defaultContinuity(now) }
  }
}

export function writeContinuity(value) {
  try {
    if (existsSync(continuityPath())) atomicText(continuityPath() + '.bak', readFileSync(continuityPath(), 'utf8'))
  } catch {}
  atomicJson(continuityPath(), normalizeContinuity(value))
  return true
}

export function activeEntities(state = readContinuity()) {
  return [...state.threads.filter((x) => x.status === 'active').map((x) => ({ ...x, kind: 'thread' })),
    ...state.tasks.filter((x) => x.status === 'open').map((x) => ({ ...x, kind: 'task' })),
    ...state.commitments.filter((x) => x.status === 'open').map((x) => ({ ...x, kind: 'commitment' }))]
}

/** Stable fingerprint of the inputs that can change a generated plan. */
export function continuityRevision(state = readContinuity()) {
  const rows = activeEntities(state).map((x) => ({
    kind: x.kind, id: x.id, title: x.title, detail: x.detail, dueAt: x.dueAt,
    placeId: x.placeId, with: x.with, nextStep: x.nextStep,
  })).sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`))
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16)
}

export function planSyncInfo(state, plan, date = '') {
  const revision = continuityRevision(state)
  const planRevision = String(plan?.continuityRevision || '')
  return {
    date: String(date || plan?.date || ''), revision, planRevision,
    synced: Boolean(plan && planRevision === revision), source: String(plan?.source || ''),
  }
}

function localDay(ms, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms))
    const get = (type) => parts.find((x) => x.type === type)?.value || ''
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch { return new Date(ms).toISOString().slice(0, 10) }
}

function dueInfo(entity, now, timeZone) {
  if (!entity.dueAt) return { rank: 5, label: '', state: 'none' }
  const delta = entity.dueAt - now
  const today = localDay(now, timeZone)
  const dueDay = localDay(entity.dueAt, timeZone)
  let clock = ''
  try { clock = new Intl.DateTimeFormat('zh-CN', { timeZone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(entity.dueAt)) } catch {}
  if (delta < 0) return { rank: 0, label: `已逾期（${clock}）`, state: 'overdue' }
  if (dueDay === today) return { rank: 1, label: `今天 ${clock.split(' ').at(-1) || clock}`, state: 'today' }
  if (delta <= 3 * 86400000) return { rank: 2, label: `${clock} 前`, state: 'soon' }
  return { rank: 3, label: `${clock} 前`, state: 'later' }
}

export function describeNeeds(needs = {}) {
  const energy = Number(needs.energy) < 30 ? '精力很低' : Number(needs.energy) < 55 ? '有点累' : Number(needs.energy) > 82 ? '精力不错' : '精力平常'
  const stress = Number(needs.stress) > 75 ? '压力很大' : Number(needs.stress) > 50 ? '有些紧绷' : Number(needs.stress) < 20 ? '挺放松' : '压力尚可'
  const social = Number(needs.socialNeed) > 70 ? '很想找人说说话' : Number(needs.socialNeed) > 45 ? '有点想见人' : Number(needs.socialNeed) < 20 ? '想自己待会儿' : '社交需求平常'
  const debt = Number(needs.sleepDebtMinutes) >= 180 ? `欠了约 ${Math.round(needs.sleepDebtMinutes / 60)} 小时睡眠` : Number(needs.sleepDebtMinutes) >= 60 ? '有一点睡眠欠账' : '睡眠欠账不明显'
  return [energy, stress, social, debt]
}

export function continuityView(state = readContinuity(), options = {}) {
  const now = Number(options.now) || Date.now()
  const timeZone = String(options.timeZone || 'Asia/Shanghai')
  const entities = activeEntities(state).map((x) => ({ ...x, due: dueInfo(x, now, timeZone) }))
    .sort((a, b) => (a.due.rank - b.due.rank) || (a.createdAt - b.createdAt))
  return { needs: describeNeeds(state.needs), entities }
}

export function mutateEntity(kind, action, input = {}, now = Date.now()) {
  if (!kinds.includes(kind)) throw new Error('unknown continuity entity kind')
  const allowedActions = kind === 'threads'
    ? ['create', 'update', 'complete', 'cancel', 'pause', 'resume', 'delete']
    : ['create', 'update', 'complete', 'cancel', 'delete']
  if (!allowedActions.includes(action)) throw new Error('unknown continuity action')
  const state = readContinuity(now)
  const list = state[kind]
  const index = list.findIndex((x) => x.id === String(input.id || ''))
  if (action === 'create') {
    if (kind === 'threads' && !text(input.origin, 160)) throw new Error('thread origin is required')
    const active = list.filter((x) => ['active', 'open', 'paused'].includes(x.status)).length
    if (active >= ENTITY_LIMITS[kind]) throw new Error(`${kind} active limit reached`)
    const entity = normalizeEntity(kind, input, now)
    if (!entity.title) throw new Error('title is required')
    list.push(entity)
    state.recentChanges.push({ at: now, entityId: entity.id, kind, reason: `创建：${entity.origin}` })
    writeContinuity(state)
    return entity
  }
  if (index < 0) throw new Error('entity not found')
  if (action === 'delete') list.splice(index, 1)
  else {
    const patch = { ...list[index], ...input, id: list[index].id, createdAt: list[index].createdAt, updatedAt: now }
    if (action === 'complete') { patch.status = 'completed'; patch.completedAt = now }
    if (action === 'cancel') patch.status = 'cancelled'
    if (action === 'pause' && kind === 'threads') patch.status = 'paused'
    if (action === 'resume' && kind === 'threads') patch.status = 'active'
    list[index] = normalizeEntity(kind, patch, now)
  }
  state.recentChanges.push({ at: now, entityId: input.id, kind, reason: `${action}：${text(input.reason, 100) || '用户明确操作'}` })
  writeContinuity(state)
  return action === 'delete' ? null : state[kind].find((x) => x.id === input.id)
}

export function continuitySummary(state = readContinuity(), options = {}) {
  const rows = continuityView(state, options).entities.slice(0, 12).map((x) => {
    const details = [x.due.label, x.with ? `和${x.with}` : '', x.placeId ? `地点 ${x.placeId}` : '', x.kind === 'thread' && x.nextStep ? `下一步：${x.nextStep}` : ''].filter(Boolean)
    return `${x.kind}:${x.id}「${x.title}」${details.length ? `（${details.join('；')}）` : ''}`
  })
  return rows.length ? rows.join('\n') : '没有待关联的长期主线、短期待办或约定。'
}

export function continuityContext(state = readContinuity(), memories = readMemories(2), options = {}) {
  const view = continuityView(state, options)
  const concerns = view.entities.slice(0, 5).map((x) => `${x.title}${x.due.label ? `：${x.due.label}` : ''}`).join('；') || '没有挂着的事情'
  const latest = memories[0]
  const remembered = Array.isArray(latest?.segments) && latest.segments.length
    ? `那天${latest.segments.slice(-3).map((x) => x.what).join('，后来')}`
    : latest?.summary
  const yesterday = remembered || '还没有可回想的昨日生活'
  return `身体感觉：${view.needs.join('，')}。\n挂在心上的事：${concerns}。\n最近记得：${yesterday}。`
}

function effectId(date, seg, suffix) {
  return createHash('sha256').update([date, seg.start, seg.end, seg.source, seg.what, suffix].join('|')).digest('hex').slice(0, 32)
}

function needsDelta(seg) {
  const what = String(seg.what || '')
  const minutes = Math.max(1, Math.round((seg.end - seg.start) / 60000))
  if (/睡/.test(what) || seg.behavior === 'sleep') return { energy: Math.min(20, minutes / 30), stress: -Math.min(12, minutes / 60) }
  if (/吃|饭|面|早餐|午餐|晚餐/.test(what) || seg.behavior === 'eat') return { energy: 8, stress: -2, lastMealAt: seg.end }
  if (/散步|逛|运动|跑步/.test(what) || seg.behavior === 'walk') return { energy: -4, stress: -7 }
  if (/课|学习|作业|改稿|复习|写/.test(what) || seg.behavior === 'study') return { energy: -Math.min(12, minutes / 30), stress: Math.min(8, minutes / 60) }
  if (/聊天|视频|室友|朋友/.test(what)) return { socialNeed: -8, stress: -3 }
  return { energy: -Math.min(4, minutes / 120), socialNeed: Math.min(2, minutes / 180) }
}

function applyNeeds(needs, delta, at) {
  for (const key of ['energy', 'stress', 'socialNeed']) if (delta[key] !== undefined) needs[key] = clamp(needs[key] + delta[key])
  if (delta.sleepDebtMinutes !== undefined) needs.sleepDebtMinutes = clamp(needs.sleepDebtMinutes + delta.sleepDebtMinutes, 0, 1440)
  if (delta.lastMealAt) needs.lastMealAt = delta.lastMealAt
  needs.updatedAt = at
}

function dailyEffectId(date, suffix) {
  return createHash('sha256').update(`${date}|daily|${suffix}`).digest('hex').slice(0, 32)
}

function safeProjectDir(id) { return join(projectsDir(), createHash('sha256').update(String(id)).digest('hex').slice(0, 24)) }

function updateArtifact(thread, seg, change, now, id) {
  if (!['document', 'album'].includes(thread.artifact?.type)) return null
  const dir = safeProjectDir(thread.id)
  mkdirSync(join(dir, 'history'), { recursive: true })
  if (thread.artifact.type === 'document') {
    const file = join(dir, 'project.md')
    const old = existsSync(file) ? readFileSync(file, 'utf8') : `# ${thread.artifact.name || thread.title}\n\n> 本地执行记录；只记录最终时间线中已实际结束的活动。\n`
    if (old.includes(`<!-- effect:${id} -->`)) return file
    if (existsSync(file)) atomicText(join(dir, 'history', `${now}.md`), old)
    const row = `\n<!-- effect:${id} -->\n## ${new Date(seg.end).toISOString()}\n\n- 活动：${text(seg.what, 120)}\n- 用时：${Math.round((seg.end - seg.start) / 60000)} 分钟\n- 进展：${change}\n`
    atomicText(file, old + row)
    return file
  }
  const file = join(dir, 'album.json')
  let album = { v: 1, title: thread.artifact.name || thread.title, note: '仅整理已有照片的摄影集清单；不会生成、复制或修改照片。', entries: [] }
  try { album = { ...album, ...JSON.parse(readFileSync(file, 'utf8')) } } catch {}
  if ((album.entries || []).some((x) => x.id === id)) return file
  album.entries = [...(Array.isArray(album.entries) ? album.entries : []), { id, at: seg.end, activity: text(seg.what, 120), status: '待从已有照片中人工选择' }].slice(-200)
  atomicJson(file, album)
  return file
}

function writeMemory(date, settled, state, now) {
  mkdirSync(memoriesDir(), { recursive: true })
  const file = join(memoriesDir(), `${date}.json`)
  let old = { v: 1, date, segments: [] }
  try { old = JSON.parse(readFileSync(file, 'utf8')) } catch {}
  const byId = new Map((old.segments || []).map((x) => [x.id, x]))
  for (const x of settled) byId.set(x.id, x)
  const segments = [...byId.values()].sort((a, b) => a.start - b.start)
  const memory = {
    v: 1, date, updatedAt: now, segments,
    summary: segments.length ? `记得${segments.slice(-3).map((x) => x.what).join('，后来')}。` : '这天还没有留下清楚的生活记忆。',
    unresolved: [...state.tasks, ...state.commitments].filter((x) => x.status === 'open').slice(0, 8).map((x) => ({ id: x.id, title: x.title })),
  }
  atomicJson(file, memory)
  return memory
}

export function readMemories(limit = 7) {
  try {
    return readdirSync(memoriesDir()).filter((x) => /^\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort().reverse().slice(0, limit).flatMap((name) => {
      try { return [JSON.parse(readFileSync(join(memoriesDir(), name), 'utf8'))] } catch { return [] }
    })
  } catch { return [] }
}

/** Settle completed segments from the final timeline. Safe to retry. */
export function settleTimeline({ date, timeline, nowMs = Date.now(), maxArtifacts = 2 }) {
  if (locks.has(date)) return { ok: false, reason: 'locked', applied: 0 }
  locks.add(date)
  const fileLock = acquireFileLock(date, nowMs)
  if (!fileLock) { locks.delete(date); return { ok: false, reason: 'locked', applied: 0 } }
  try {
    const state = readContinuity(nowMs)
    const applied = new Set(state.appliedEffects)
    const settled = []
    let artifactCount = state.recentChanges.filter((x) => x.source === `timeline:${date}` && /更新 (project\.md|album\.json)/.test(x.reason || '')).length
    let count = 0
    let previousLedger = { effects: [] }
    try { previousLedger = JSON.parse(readFileSync(join(effectsDir(), `${date}.json`), 'utf8')) } catch {}
    const dayEffects = new Set(Array.isArray(previousLedger.effects) ? previousLedger.effects.map(String) : [])
    for (const seg of (timeline || []).filter((x) => x && x.end <= nowMs && x.end > x.start && x.source !== 'travel')) {
      const segmentEffect = effectId(date, seg, 'needs')
      if (!applied.has(segmentEffect)) {
        applyNeeds(state.needs, needsDelta(seg), seg.end)
        applied.add(segmentEffect); count++
        dayEffects.add(segmentEffect)
        settled.push({ id: segmentEffect, start: seg.start, end: seg.end, what: text(seg.what), locationId: text(seg.locationId), source: seg.source })
      }
      // A linked plan segment only counts when it survived life_adjust intact.
      const intactPlan = seg.source === 'plan' && !seg.overridden
      if (!intactPlan) continue
      for (const link of Array.isArray(seg.links) ? seg.links : []) {
        const kind = `${link.type}s`
        if (!kinds.includes(kind)) continue
        const linkEffect = effectId(date, seg, `${link.type}:${link.id}`)
        if (applied.has(linkEffect)) continue
        const entity = state[kind].find((x) => x.id === link.id)
        if (!entity || !['active', 'open'].includes(entity.status)) continue
        let reason = `最终真实时间线完成「${text(seg.what)}」`
        if (kind === 'threads') {
          const delta = clamp(link.progressDelta || 5, 1, 20)
          entity.progress = clamp(entity.progress + delta)
          if (entity.progress >= 100) { entity.status = 'completed'; entity.completedAt = seg.end }
          reason += `，进展 +${delta}%`
          if (artifactCount < Math.max(0, Number(maxArtifacts) || 0)) {
            const path = updateArtifact(entity, seg, `+${delta}%`, nowMs, linkEffect)
            if (path) { reason += `，更新 ${basename(path)}`; artifactCount++ }
          }
        } else { entity.status = 'completed'; entity.completedAt = seg.end }
        entity.updatedAt = seg.end
        state.recentChanges.push({ at: seg.end, entityId: entity.id, kind, reason, source: `timeline:${date}` })
        applied.add(linkEffect); count++
        dayEffects.add(linkEffect)
      }
    }
    const realSegments = (timeline || []).filter((x) => x && x.end > x.start && x.source !== 'travel')
    const dayStart = realSegments.reduce((min, x) => Math.min(min, x.start), Infinity)
    const dayEnd = realSegments.reduce((max, x) => Math.max(max, x.end), 0)
    const sleepBalanceId = dailyEffectId(date, 'sleep-balance')
    // A partial/custom timeline must not be mistaken for a completed day.
    // Twenty hours still admits DST transitions and small malformed gaps.
    const completeDay = Number.isFinite(dayStart) && dayEnd - dayStart >= 20 * 3600000
    if (completeDay && dayEnd <= nowMs && !applied.has(sleepBalanceId)) {
      const slept = realSegments.filter((x) => x.behavior === 'sleep' || /睡/.test(String(x.what || '')))
        .reduce((sum, x) => sum + Math.round((x.end - x.start) / 60000), 0)
      const delta = clamp(480 - slept, -120, 360)
      state.needs.sleepDebtMinutes = clamp(state.needs.sleepDebtMinutes + delta, 0, 1440)
      state.needs.updatedAt = nowMs
      const reason = delta > 0 ? `当天睡了 ${slept} 分钟，新增 ${delta} 分钟睡眠欠账` : delta < 0 ? `当天睡了 ${slept} 分钟，偿还 ${Math.abs(delta)} 分钟睡眠欠账` : `当天睡眠达到 8 小时目标`
      state.recentChanges.push({ at: dayEnd, kind: 'needs', reason, source: `timeline:${date}` })
      applied.add(sleepBalanceId); dayEffects.add(sleepBalanceId); count++
    }
    state.appliedEffects = [...applied].slice(-2000)
    state.lastSettledAt = Math.max(state.lastSettledAt, nowMs)
    state.recentChanges = state.recentChanges.slice(-80)
    writeContinuity(state)
    const ledger = { v: 1, date, updatedAt: nowMs, effects: [...dayEffects] }
    atomicJson(join(effectsDir(), `${date}.json`), ledger)
    const memory = writeMemory(date, settled, state, nowMs)
    return { ok: true, applied: count, state, memory }
  } finally { releaseFileLock(fileLock); locks.delete(date) }
}

export function cleanupContinuity(retentionDays = 365, now = Date.now()) {
  const cutoff = now - Math.max(30, Number(retentionDays) || 365) * 86400000
  let removed = 0
  for (const dir of [memoriesDir(), effectsDir()]) {
    try { for (const name of readdirSync(dir)) { const file = join(dir, name); if (statSync(file).mtimeMs < cutoff) { unlinkSync(file); removed++ } } } catch {}
  }
  return removed
}
