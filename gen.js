// 大肥鱼的生活线 · 用模型写「明天的剧本」
//
// 模板能保证"有人的一天"，但保不了"每天不一样、细节像真的"。所以这里借 daily-schedule
// 的做法：一天写一次，让 DSH 自己的模型按人设/课表/最近几天来编。
//   · 每晚（或当天第一次要用时）写今天/明天，落盘；
//   · 失败、超时、JSON 不合法 → 退回 plan.js 的模板（保证一定有，不会开天窗）；
//   · 生成完就不再调模型，注入只是读文件，几毛钱一天。

import { randomUUID } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const 日志 = (m) => { try { const d = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'feiyu-life.log'); mkdirSync(join(process.env.DSH_HOME || join(homedir(), '.dsh')), { recursive: true }); appendFileSync(d, new Date().toISOString() + '  ' + m + '\n') } catch {} }

function 插话(role, text) {
  return { role, id: randomUUID(), content: [{ type: 'text', text }], source: { kind: 'plugin', plugin: 'dsh-feiyu-life' } }
}

/** 从任何活着的会话身上取模型（跟心情插件同一套写法） */
export function 取模型(agent, cfg = {}) {
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

function 提示词(o) {
  const { cfg, date, 周, 类型, 课表, 日历, 身体, 最近 } = o
  const 角色 = String(cfg.角色设定 || '大肥鱼：21 岁，在北京读大三，学视觉传达；懒、嘴硬心软、爱损人；室友阿岚（考研）和小满（恋爱脑）；周日晚上跟妈妈视频。')
  const 课 = 课表.length ? 课表.map((x) => `${x[0]}-${x[1]} ${x[2]}`).join('；') : '这天没课'
  const 校历 = 日历.特殊 ? `特殊：${日历.特殊.名}` : 日历.假期 ? `假期：${日历.假期.名}` : 日历.学期 ? `学期：${日历.学期.名}` : '平时'
  return [
    `给这个角色写 ${date}（周${'一二三四五六日'[周 - 1]}）一天的日程。`,
    '',
    '## 她是谁',
    角色,
    '',
    '## 这一天',
    `- 日子类型：${类型.名}`,
    `- 课表：${课}`,
    `- ${校历}`,
    `- 身体/状态：${身体 || '平常'}`,
    '',
    '## 最近三天（这些桥段**不要再写**，换别的）',
    最近 || '（还没有记录）',
    '',
    '## 要求',
    '1. 从 00:00 排到 24:00，**不留空隙、不重叠**，8–14 段；',
    '2. 必须有一段「睡着了」，至少 6 小时；',
    '3. 「在」是口语短句，10–18 字，带细节（「刚起，脸还有点肿」「啃面包看课件」），不要写「上课」两个字就完事；',
    '4. 「穿」写一件具体的衣服（睡衣 / 藏青卫衣 / 黑大衣 / 牛仔外套…），睡觉那几段写睡衣；',
    '5. 「手机」只能是：在手 / 静音 / 在床头 / 不在手边；',
    '6. 全天要有起伏：赖床、走神、临时出门、被老师点名、快递、猫，都可以有，但别夸张、别写成小说；',
    '7. 最近三天里出现过的事件（点名、取快递、改稿、跟妈妈视频这类）这周不要再出现第二次；',
    '8. 不要出现"日程""计划""安排表"这类词；',
    '',
    '## 只输出 JSON，不要解释、不要代码块外的文字',
    '{"title":"一句话概括这一天","mood":"两句以内的心情底色","items":[{"起":"07:40","止":"08:10","在":"刚起，脸还有点肿","手机":"在手","穿":"睡衣"}]}',
  ].join('\n')
}

function 解析(text) {
  const s = String(text || '')
  const m = s.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}

function 分钟(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim())
  if (!m) return null
  const v = Number(m[1]) * 60 + Number(m[2])
  return Number.isFinite(v) ? v : null
}

function 钟点(分) {
  const v = Math.max(0, Math.min(1440, Math.round(分)))
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}

/** 把模型吐出来的东西收拾成能用的时间线；不合格返 null */
export function 规整(raw) {
  if (!raw || !Array.isArray(raw.items)) return null
  const 段 = []
  for (const x of raw.items) {
    const a = 分钟(x.起), b = 分钟(x.止)
    if (a === null || b === null || b <= a) continue
    const 在 = String(x.在 || '').trim().slice(0, 24)
    if (!在) continue
    const 手机 = ['在手', '静音', '在床头', '不在手边'].includes(String(x.手机)) ? String(x.手机) : '在手'
    段.push({ 起: a, 止: Math.min(b, 1440), 在, 手机, 穿: String(x.穿 || '').trim().slice(0, 12) })
  }
  if (!段.length) return null
  段.sort((p, q) => p.起 - q.起)
  // 首尾补齐、中间填空
  const 净 = []
  if (段[0].起 > 0) 净.push({ 起: 0, 止: 段[0].起, 在: '还睡着', 手机: '在床头', 穿: '睡衣' })
  for (const x of 段) {
    const 上 = 净[净.length - 1]
    if (上 && x.起 > 上.止) 净.push({ 起: 上.止, 止: x.起, 在: 接着上一段(x), 手机: '在手', 穿: 上.穿 || '' })
    if (上 && x.起 < 上.止) x.起 = 上.止            // 重叠：截掉
    if (x.止 > x.起) 净.push(x)
  }
  const 末 = 净[净.length - 1]
  if (末 && 末.止 < 1440) 净.push({ 起: 末.止, 止: 1440, 在: /睡/.test(末.在) ? '还睡着' : '躺床上刷手机', 手机: '在床头', 穿: 末.穿 || '睡衣' })
  const 睡 = 净.filter((x) => /睡/.test(x.在)).reduce((n, x) => n + (x.止 - x.起), 0)
  if (睡 < 240) return null
  return { title: String(raw.title || '').slice(0, 40), mood: String(raw.mood || '').slice(0, 80), items: 净 }
}

function 接着上一段(x) {
  return /睡/.test(x.在) ? '还睡着' : '闲一会儿'
}

/** 调一次模型写一天；失败 / 不合格返回 null（调用方退模板） */
export async function 用模型写一天(ctx, agent, 参数) {
  const t = 取模型(agent, 参数.cfg)
  if (!t) { 日志('没有可用模型（agent=' + Boolean(agent) + '）'); return null }
  const sys = '你在给一个角色编她真实的一天。只输出 JSON。'
  const user = 提示词(参数)
  let out = ''
  const kinds = {}
  try {
    for await (const chunk of ctx.llm.stream({
      provider: t.provider,
      model: t.model,
      system: sys,
      messages: [插话('user', user)],
      sessionId: String((agent && agent.session && agent.session.id) || ''),
      maxTokens: 3000,
      temperature: 0.9,
    })) {
      if (!chunk) continue
      kinds[chunk.type] = (kinds[chunk.type] || 0) + 1
      if (chunk.type === 'text-delta') out += chunk.text
      if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind === 'error') { 日志('模型返回 error：' + JSON.stringify(chunk.reason).slice(0, 200)); return null }
    }
  } catch (e) { 日志('调用失败：' + String((e && e.message) || e)); return null }
  const raw = 解析(out)
  if (!raw) { 日志('JSON 解析失败：长度=' + String(out).length + ' 类型=' + JSON.stringify(kinds) + ' 内容=' + String(out).slice(0, 200)); return null }
  const ok = 规整(raw)
  if (!ok) { 日志('规整不合格：' + String(out).slice(0, 300)); return null }
  return { ...ok, source: 'llm', model: t.model }
}
