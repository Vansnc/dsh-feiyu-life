// dsh-feiyu-life · model-written daily plan
//
// The template guarantees "a human day", but not "a different day every day".
// So once a day we ask the DSH model to write the whole 00:00-24:00 timeline
// from the persona / timetable / last few days:
//   · write today and tomorrow once, persist;
//   · failure / timeout / bad JSON -> fall back to the plan.js template (never blank);
//   · once written for a date, never call the model again for it.

import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { appendRotatingLog, withStreamTimeout } from '../infrastructure/runtime.js'
import { BEHAVIOR_RULES, defaultWorldConfig, normalizeWorldConfig } from './world.js'
import { normalizeWardrobe, occasion } from './plan.js'

const dshHome = () => process.env.DSH_HOME || join(homedir(), '.dsh')
const sleepText = /(?:睡着|午睡|补觉|还睡着|睡熟|睡了|睡到|睡觉)/

const log = (m) => {
  try {
    const d = join(dshHome(), 'feiyu-life.log')
    mkdirSync(dshHome(), { recursive: true })
    appendRotatingLog(d, new Date().toISOString() + '  ' + m + '\n')
  } catch {}
}

function say(role, text) {
  return { role, id: randomUUID(), content: [{ type: 'text', text }], source: { kind: 'plugin', plugin: 'dsh-feiyu-life' } }
}

/** Grab the model from any live session (same trick as the mood plugin). */
export function pickModel(agent, cfg = {}) {
  if (cfg.模型 && cfg.模型.provider && cfg.模型.model) return cfg.模型
  try {
    const h = agent && agent.session && agent.session.requestHeader ? agent.session.requestHeader() : null
    const c = h && h.config
    if (c && c.provider && c.model) return { provider: c.provider, model: c.model }
  } catch {}
  try {
    const o = agent && agent.options
    if (o && o.provider && o.model) return { provider: o.provider, model: o.model }
  } catch {}
  return null
}

export function buildPrompt(o) {
  const { cfg, date, weekdayLabel, typeName, routine, classes, calendarLabel, body, sleep, mood, self, recent, continuity, relationships } = o
  // Persona is user settings, never a constant in the life layer. If nothing
  // is configured, write a day without inventing a personality for her.
  // The life layer writes a day, not a personality. Persona stays in the
  // chat prompt / mind layer; here only an explicit role description is used.
  const configured = [String(cfg.角色设定 || '').trim()].filter(Boolean)
  const persona = configured.length ? configured.join('\n') : '（没有配置角色设定：只写作息与生活事实，不要添加性格评价。）'
  const schedule = classes.length ? classes.map((x) => `${x[0]}-${x[1]} ${x[2]}`).join('；') : '这天没课'
  const routineRows = Array.isArray(routine) ? routine : []
  const routineSkeleton = routineRows.length ? routineRows.map((x) => `${x[0]}-${x[1]} ${x[2]}`).join('；') : '没有额外作息约束'
  const world = normalizeWorldConfig(cfg.地图 || defaultWorldConfig)
  const wardrobe = normalizeWardrobe(cfg.衣柜)
  const wardrobeText = [
    ['sleep', '睡觉'], ['bath', '洗澡'], ['class', '上课'], ['home', '在家'], ['out', '出门'], ['eat', '吃饭'],
  ].map(([key, label]) => `- ${label}：${wardrobe[key].join(' / ')}`).join('\n')
  const locations = world.地点.map((x) => `${x.id}=${x.name}`).join('；')
  const behaviors = BEHAVIOR_RULES.map((x) => `${x.id}=${x.label}`).concat('idle=发呆').join('；')
  return [
    `给这个角色写 ${date}（周${weekdayLabel}）一天的日程。`,
    '',
    '## 她是谁',
    persona,
    '',
    '## 这一天',
    `- 日子类型：${typeName}`,
    `- 作息骨架：${routineSkeleton}`,
    `- 课表：${schedule}`,
    `- ${calendarLabel}`,
    `- 身体/状态：${body || '平常'}`,
    `- 昨晚睡眠：${sleep || '还没有记录，按作息骨架推断'}`,
    `- 心情底色：${mood || '平常'}`,
    '',
    '## 她心里的事（只作为生活取舍，不要声称已经完成）',
    self || '没有需要强行塞进这一天的目标。',
    '',
    '## 衣柜（outfit 必须从对应类别中选）',
    wardrobeText,
    '',
    '## 最近三天（这些桥段**不要再写**，换别的）',
    recent || '（还没有记录）',
    '',
    '## 可以关联的生活连续性项目',
    continuity || '没有待关联项目。',
    '',
    '## 已明确认识的人',
    relationships || '还没有由用户明确记下的人物。',
    '',
    '## 要求',
    '1. 从 00:00 排到 24:00，**不留空隙、不重叠**，8–14 段；',
    '2. 必须有一段「睡着了」，至少 6 小时；',
    '3. 「what」是口语短句，10–18 字，带细节（「刚起，脸还有点肿」「啃面包看课件」），不要写「上课」两个字就完事；',
    '4. 「outfit」必须从上面衣柜对应类别里选一件；睡觉那几段用「睡觉」类，不要自己编衣柜外的衣服；',
    '5. 「phone」只能是：在手 / 静音 / 在床头 / 不在手边；',
    '6. 以作息骨架为主，课表覆盖冲突时段；可以细化生活细节，但不要擅自改变睡醒、上课和用餐的大致区间，身体/状态要求优先；',
    '7. 全天最多一两件小插曲（快递、猫、洗衣服、被叫走），不要堆戏剧化事件；最近三天出现过的具体桥段不要重复；',
    '8. 每段都填写 locationId 和 behavior；locationId 只能从下面地点中选，behavior 只能从下面行为中选；',
    `   地点：${locations}`,
    `   行为：${behaviors}`,
    '9. locationId 表示这一段实际停留的地点；behavior 表示她本人正在做的动作，不要把猫、狗、室友的动作算成她的；',
    '10. 手机状态要和正在做的事一致：睡觉写「在床头」，洗澡/洗漱写「不在手边」，上课写「静音」；不要一边睡着一边「在手」；',
    '11. 两段之间留出真实的过渡（走路、收拾、洗澡），不要上一秒在教室下一秒已经躺下；精力要和睡眠、身体状态对得上；',
    '12. 如果某一段确实推进了上面已有项目，可填写 links；只能使用上面列出的 type 和 id，不得虚构。长期主线可附 progressDelta（1–20）；取快递等一次性事项只能关联 task；',
    '13. 如果这一段确实和上面已有的人互动，可填写 people；只能使用 person id，tone 只能是 warm / neutral / tense，不得凭空创建人物；',
    '14. links 和 people 都只是意图关联，只有该段到时真实结束且没有被 life_adjust 覆盖，系统才会结算；不要出现"日程""计划""安排表"这类词；',
    '',
    '## 只输出 JSON，不要解释、不要代码块外的文字',
    '{"title":"一句话概括这一天","mood":"两句以内的心情底色","items":[{"start":"07:40","end":"08:10","what":"刚起，脸还有点肿","phone":"在手","outfit":"睡衣","locationId":"dorm","behavior":"idle","links":[{"type":"task","id":"已有ID"}],"people":[{"id":"已有person ID","tone":"warm"}]}]}',
  ].join('\n')
}

function parseJson(text) {
  const s = String(text || '')
  const m = s.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}

function toMinute(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim())
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (minute > 59 || hour > 24 || (hour === 24 && minute !== 0)) return null
  const v = hour * 60 + minute
  return Number.isFinite(v) ? v : null
}

function clockOf(minute) {
  const v = Math.max(0, Math.min(1440, Math.round(minute)))
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}

function fillLabel(x) {
  return sleepText.test(x.what) ? '还睡着' : '闲一会儿'
}

/** Turn model output into a usable timeline; null if unusable. */
export function normalizePlan(raw, worldConfig = defaultWorldConfig, allowedEntities = [], allowedPeople = [], wardrobeConfig = null) {
  if (!raw || !Array.isArray(raw.items)) return null
  const wardrobe = wardrobeConfig ? normalizeWardrobe(wardrobeConfig) : null
  const world = normalizeWorldConfig(worldConfig)
  const locationIds = new Set(world.地点.map((x) => x.id))
  const homeLocationId = world.地点.find((x) => x.id === 'dorm')?.id || world.地点[0]?.id || ''
  const behaviorIds = new Set([...BEHAVIOR_RULES.map((x) => x.id), 'idle'])
  const allowed = new Map((allowedEntities || []).map((x) => [`${x.kind}:${x.id}`, x]))
  const people = new Set((allowedPeople || []).map((x) => String(x.id || '')).filter(Boolean))
  const segs = []
  for (const x of raw.items) {
    const a = toMinute(x.start)
    const b = toMinute(x.end)
    if (a === null || b === null || b <= a) continue
    const what = String(x.what || '').trim().slice(0, 24)
    if (!what) continue
    const phone = ['在手', '静音', '在床头', '不在手边'].includes(String(x.phone)) ? String(x.phone) : '在手'
    segs.push({
      start: a,
      end: Math.min(b, 1440),
      what,
      phone,
      outfit: String(x.outfit || '').trim().slice(0, 12),
      locationId: locationIds.has(String(x.locationId || '')) ? String(x.locationId) : '',
      behavior: behaviorIds.has(String(x.behavior || '')) ? String(x.behavior) : '',
      links: (Array.isArray(x.links) ? x.links : []).flatMap((link) => {
        const type = String(link?.type || '')
        const id = String(link?.id || '')
        if (!allowed.has(`${type}:${id}`)) return []
        return [{ type, id, progressDelta: type === 'thread' ? Math.max(1, Math.min(20, Math.round(Number(link.progressDelta) || 5))) : undefined }]
      }).slice(0, 3),
      people: (Array.isArray(x.people) ? x.people : []).flatMap((link) => {
        const id = String(link?.id || '')
        if (!people.has(id)) return []
        const tone = ['warm', 'tense'].includes(String(link?.tone || '')) ? String(link.tone) : 'neutral'
        return [{ id, tone }]
      }).slice(0, 3),
    })
  }
  if (!segs.length) return null
  // A sleep segment with the phone "in hand" is the most common model slip;
  // enforce the same coherence the local template and context rely on.
  for (const row of segs) {
    if (/睡着|午睡|补觉|还睡着|睡熟/.test(row.what) || row.behavior === 'sleep') row.phone = '在床头'
    if (/洗澡|冲澡|洗漱|刷牙|洗脸|面膜|洗头/.test(row.what) || row.behavior === 'bath') row.phone = '不在手边'
  }
  segs.sort((p, q) => p.start - q.start)
  const clean = []
  const inferred = (what, fallback = {}) => ({
    locationId: fallback.locationId || (/睡|床|起床|洗漱|刷手机/.test(what) ? homeLocationId : ''),
    behavior: fallback.behavior || (/睡/.test(what) ? 'sleep' : ''),
  })
  if (segs[0].start > 0) clean.push({ start: 0, end: segs[0].start, what: '还睡着', phone: '在床头', outfit: '睡衣', ...inferred('还睡着') })
  for (const x of segs) {
    const prev = clean[clean.length - 1]
    if (prev && x.start > prev.end) {
      const what = fillLabel(x)
      clean.push({ start: prev.end, end: x.start, what, phone: '在手', outfit: prev.outfit || '', ...inferred(what, prev) })
    }
    if (prev && x.start < prev.end) x.start = prev.end
    if (x.end > x.start) clean.push(x)
  }
  const last = clean[clean.length - 1]
  if (last && last.end < 1440) {
    const what = sleepText.test(last.what) ? '还睡着' : '躺床上刷手机'
    clean.push({ start: last.end, end: 1440, what, phone: '在床头', outfit: last.outfit || '睡衣', ...inferred(what) })
  }
  if (wardrobe) {
    // Apply after prefix/tail synthesis too; those rows are generated locally
    // and would otherwise bypass the selected wardrobe.
    for (const row of clean) {
      const pool = wardrobe[occasion(row.what, row.behavior, row.locationId)] || []
      if (pool.length && !pool.includes(row.outfit)) row.outfit = pool[0]
    }
  }
  const sleep = clean.filter((x) => sleepText.test(x.what)).reduce((n, x) => n + (x.end - x.start), 0)
  if (sleep < 360) return null
  return { title: String(raw.title || '').slice(0, 40), mood: String(raw.mood || '').slice(0, 80), items: clean }
}

/** Call the model for a day; null on failure (caller falls back to template). */
export async function writeDayWithModel(ctx, agent, params) {
  const target = pickModel(agent, params.cfg)
  if (!target) { log('no model available (agent=' + Boolean(agent) + ')'); return null }
  const system = '你在给一个角色编她真实的一天。只输出 JSON。'
  const user = buildPrompt(params)
  const timeoutMs = Math.max(10, Math.min(300, Number(params.cfg.模型超时秒) || 60)) * 1000
  // 每天只跑一两次；不把 maxTokens 掐紧，让深度思考和正文都有地方写。
  // 第一次默认推理，失败再重试一次（低推理）。
  const attempts = [
    { maxTokens: 32000, temperature: 0.9 },
    { maxTokens: 32000, temperature: 0.9, reasoningEffort: 'low' },
  ]
  for (let i = 0; i < attempts.length; i++) {
    let out = ''
    const kinds = {}
    try {
      const stream = ctx.llm.stream({
        provider: target.provider,
        model: target.model,
        system,
        messages: [say('user', user)],
        sessionId: String((agent && agent.session && agent.session.id) || ''),
        ...attempts[i],
      })
      for await (const chunk of withStreamTimeout(stream, timeoutMs, 'daily plan model')) {
        if (!chunk) continue
        kinds[chunk.type] = (kinds[chunk.type] || 0) + 1
        if (chunk.type === 'text-delta') out += chunk.text
        if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind === 'error') {
          log('model returned error: ' + JSON.stringify(chunk.reason).slice(0, 200))
          break
        }
      }
    } catch (e) { log('call failed: ' + String((e && e.message) || e)); return null }
    const raw = parseJson(out)
    if (!raw) { log('JSON parse failed (attempt ' + (i + 1) + '): len=' + String(out).length + ' kinds=' + JSON.stringify(kinds) + ' body=' + String(out).slice(0, 200)); continue }
    const ok = normalizePlan(raw, params.cfg.地图, params.continuityEntities, params.continuityPeople, params.cfg.衣柜)
    if (!ok) { log('normalize failed (attempt ' + (i + 1) + '): ' + String(out).slice(0, 300)); continue }
    return { ...ok, source: 'llm', model: target.model }
  }
  return null
}
