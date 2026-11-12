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
import { appendRotatingLog, withStreamTimeout } from './runtime.js'

const dshHome = () => process.env.DSH_HOME || join(homedir(), '.dsh')

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

function buildPrompt(o) {
  const { cfg, date, weekdayLabel, typeName, classes, calendarLabel, body, recent } = o
  const persona = String(cfg.角色设定 || '大肥鱼：21 岁，在北京读大三，学视觉传达；懒、嘴硬心软、爱损人；室友阿岚（考研）和小满（恋爱脑）；周日晚上跟妈妈视频。')
  const schedule = classes.length ? classes.map((x) => `${x[0]}-${x[1]} ${x[2]}`).join('；') : '这天没课'
  return [
    `给这个角色写 ${date}（周${weekdayLabel}）一天的日程。`,
    '',
    '## 她是谁',
    persona,
    '',
    '## 这一天',
    `- 日子类型：${typeName}`,
    `- 课表：${schedule}`,
    `- ${calendarLabel}`,
    `- 身体/状态：${body || '平常'}`,
    '',
    '## 最近三天（这些桥段**不要再写**，换别的）',
    recent || '（还没有记录）',
    '',
    '## 要求',
    '1. 从 00:00 排到 24:00，**不留空隙、不重叠**，8–14 段；',
    '2. 必须有一段「睡着了」，至少 6 小时；',
    '3. 「what」是口语短句，10–18 字，带细节（「刚起，脸还有点肿」「啃面包看课件」），不要写「上课」两个字就完事；',
    '4. 「outfit」写一件具体的衣服（睡衣 / 藏青卫衣 / 黑大衣 / 牛仔外套…），睡觉那几段写睡衣；',
    '5. 「phone」只能是：在手 / 静音 / 在床头 / 不在手边；',
    '6. 全天要有起伏：赖床、走神、临时出门、被老师点名、快递、猫，都可以有，但别夸张、别写成小说；',
    '7. 最近三天里出现过的事件不要这周再出现第二次；',
    '8. 不要出现"日程""计划""安排表"这类词；',
    '',
    '## 只输出 JSON，不要解释、不要代码块外的文字',
    '{"title":"一句话概括这一天","mood":"两句以内的心情底色","items":[{"start":"07:40","end":"08:10","what":"刚起，脸还有点肿","phone":"在手","outfit":"睡衣"}]}',
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
  return /睡/.test(x.what) ? '还睡着' : '闲一会儿'
}

/** Turn model output into a usable timeline; null if unusable. */
export function normalizePlan(raw) {
  if (!raw || !Array.isArray(raw.items)) return null
  const segs = []
  for (const x of raw.items) {
    const a = toMinute(x.start)
    const b = toMinute(x.end)
    if (a === null || b === null || b <= a) continue
    const what = String(x.what || '').trim().slice(0, 24)
    if (!what) continue
    const phone = ['在手', '静音', '在床头', '不在手边'].includes(String(x.phone)) ? String(x.phone) : '在手'
    segs.push({ start: a, end: Math.min(b, 1440), what, phone, outfit: String(x.outfit || '').trim().slice(0, 12) })
  }
  if (!segs.length) return null
  segs.sort((p, q) => p.start - q.start)
  const clean = []
  if (segs[0].start > 0) clean.push({ start: 0, end: segs[0].start, what: '还睡着', phone: '在床头', outfit: '睡衣' })
  for (const x of segs) {
    const prev = clean[clean.length - 1]
    if (prev && x.start > prev.end) clean.push({ start: prev.end, end: x.start, what: fillLabel(x), phone: '在手', outfit: prev.outfit || '' })
    if (prev && x.start < prev.end) x.start = prev.end
    if (x.end > x.start) clean.push(x)
  }
  const last = clean[clean.length - 1]
  if (last && last.end < 1440) clean.push({ start: last.end, end: 1440, what: /睡/.test(last.what) ? '还睡着' : '躺床上刷手机', phone: '在床头', outfit: last.outfit || '睡衣' })
  const sleep = clean.filter((x) => /睡/.test(x.what)).reduce((n, x) => n + (x.end - x.start), 0)
  if (sleep < 360) return null
  return { title: String(raw.title || '').slice(0, 40), mood: String(raw.mood || '').slice(0, 80), items: clean }
}

/** Call the model once for a day; null on failure (caller falls back to template). */
export async function writeDayWithModel(ctx, agent, params) {
  const target = pickModel(agent, params.cfg)
  if (!target) { log('no model available (agent=' + Boolean(agent) + ')'); return null }
  const system = '你在给一个角色编她真实的一天。只输出 JSON。'
  const user = buildPrompt(params)
  let out = ''
  const kinds = {}
  try {
    const timeoutMs = Math.max(10, Math.min(300, Number(params.cfg.模型超时秒) || 60)) * 1000
    const stream = ctx.llm.stream({
      provider: target.provider,
      model: target.model,
      system,
      messages: [say('user', user)],
      sessionId: String((agent && agent.session && agent.session.id) || ''),
      maxTokens: 3000,
      temperature: 0.9,
    })
    for await (const chunk of withStreamTimeout(stream, timeoutMs, 'daily plan model')) {
      if (!chunk) continue
      kinds[chunk.type] = (kinds[chunk.type] || 0) + 1
      if (chunk.type === 'text-delta') out += chunk.text
      if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind === 'error') {
        log('model returned error: ' + JSON.stringify(chunk.reason).slice(0, 200))
        return null
      }
    }
  } catch (e) { log('call failed: ' + String((e && e.message) || e)); return null }
  const raw = parseJson(out)
  if (!raw) { log('JSON parse failed: len=' + String(out).length + ' kinds=' + JSON.stringify(kinds) + ' body=' + String(out).slice(0, 200)); return null }
  const ok = normalizePlan(raw)
  if (!ok) { log('normalize failed: ' + String(out).slice(0, 300)); return null }
  return { ...ok, source: 'llm', model: target.model }
}

