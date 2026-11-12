// dsh-feiyu-life · camera prompt rewriting
//
// The model gives one sentence ("刚睡醒，头发乱"). What actually goes to the
// image model should not be that sentence itself. This layer splits it into
// elements and expands it into a full visual description:
//   character -> outfit -> time -> place -> action -> expression -> shot ->
//   light -> props -> texture -> style -> negative
//
// Prefers the DSH model for expansion (better context); falls back to the
// template here when the model is unavailable or disabled.
//
// "Current state" comes from the life state machine (`generate`), the same
// source as the injected context — the camera does not read the plan file on
// its own.

import { readFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { generate, readConfig, zonedNow } from './life.js'
import { appendRotatingLog, withStreamTimeout } from './runtime.js'

const dshHome = () => process.env.DSH_HOME ?? join(homedir(), '.dsh')
const logFile = () => join(dshHome(), 'feiyu-life-image.log')
const execFileAsync = promisify(execFile)
const log = (m) => {
  try {
    mkdirSync(dshHome(), { recursive: true })
    appendRotatingLog(logFile(), new Date().toISOString() + '  ' + m + '\n')
  } catch {}
}

// place -> props that belong there (used by template expansion)
const propsByPlace = {
  宿舍书桌: ['摊开的画册', '散着的马克笔', '半杯奶茶', '亮着的台灯', '床帘一角'],
  宿舍床上: ['皱掉的被子', '枕头', '充电线', '床头的手机'],
  宿舍洗手间: ['起雾的镜子', '洗手台的瓶瓶罐罐', '挂着的毛巾'],
  食堂: ['不锈钢打饭台', '盛满菜的餐盘', '窗口的阿姨', '塑料托盘'],
  教室: ['黑板上的板书', '课桌的划痕', '投影仪的余光', '前排同学的后脑勺'],
  图书馆: ['成排的书架', '摊开的笔记本', '柠檬水杯'],
  路上: ['路灯', '路过的共享单车', '行道树的影子'],
  '楼下便利店/快递点': ['货架', '冷柜的光', '快递纸箱', '门口的塑料筐'],
  快递点: ['堆着的快递箱', '取件码牌'],
}

// shot library by kind
const shots = {
  selfie: [
    '手机前置摄像头自拍，脸占画面大半，略微仰拍，画面里没有手',
    '手机前置自拍，靠近镜头，画面边缘有轻微广角变形，背景虚化',
    '手机前置自拍，侧躺着把脸凑近镜头，镜头略高',
  ],
  scene: ['平视近景，主体占画面三分之二', '略微俯视，环境占一半', '低角度仰拍，光线从背后过来'],
}

const defaultStyle = '日系精细插画，赛璐璐分色加柔和厚涂阴影，清晰线稿，非 Q 版'

function rand(seedStr) {
  let h = 2166136261
  for (const c of String(seedStr)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
  let a = h >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** What string -> a place her life would put her. */
export function locationHint(what) {
  const s = String(what || '')
  if (/食堂|吃饭|外卖/.test(s)) return '食堂'
  if (/教室|上课|专业课|板书|点名|讲座/.test(s)) return '教室'
  if (/图书馆|自习|背书/.test(s)) return '图书馆'
  if (/便利店|超市|快递|取件/.test(s)) return '楼下便利店/快递点'
  if (/地铁|公交|路上|校门口/.test(s)) return '路上'
  if (/床上|躺|睡|被窝/.test(s)) return '宿舍床上'
  if (/宿舍|桌|画|剪|修图|电脑|画册/.test(s)) return '宿舍书桌'
  if (/洗澡|镜子|洗漱/.test(s)) return '宿舍洗手间'
  return '宿舍书桌'
}

/**
 * Current state, pulled from the life state machine.
 * Returns { what, outfit, clock, light, hour, location }.
 */
export function liveState(now = new Date()) {
  try {
    const cfg = readConfig()
    const r = generate(cfg, now)
    const t = zonedNow(now, String(cfg.时区 || 'Asia/Shanghai'))
    const clock = `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
    const light = t.hour < 6 ? '天还没亮，只有台灯和窗外路灯'
      : t.hour < 9 ? '清晨的柔光，窗子那边是浅金色'
        : t.hour < 11 ? '上午的日光，影子偏长'
          : t.hour < 14 ? '正午偏亮的光，反差硬'
            : t.hour < 17 ? '午后的斜光，暖而低'
              : t.hour < 19 ? '傍晚的金色光，天边泛橙'
                : t.hour < 22 ? '天已经黑了，室内开着顶灯和台灯'
                  : '深夜，只开着台灯，窗外是零星的窗'
    const what = r.current?.what || ''
    return {
      what,
      outfit: r.current?.outfit || '',
      clock,
      light,
      hour: t.hour,
      location: locationHint(what),
    }
  } catch {
    return { what: '', outfit: '', clock: '', light: '自然光', hour: 12, location: '宿舍书桌' }
  }
}

/** Split one shoot request into elements. */
export function buildElements(cfg, args, state = liveState()) {
  const type = String(args.type || 'selfie')
  const hint = String(args.hint || args.prompt || '').trim()
  const outfit = String(args.outfit || (type === 'selfie' ? state.outfit : '') || '').trim()
  const location = String(args.location || '').trim() || locationHint(hint || state.what)
  const expression = String(args.expression || '').trim() || cfg.表情 || '自然的表情'
  return { type, hint, outfit, location, expression, state, clock: state.clock, light: state.light }
}

/** Template expansion: a decent description without calling any model. */
export function templatePrompt(cfg, elements) {
  const { type, hint, outfit, location, expression, clock, light } = elements
  const r = rand(elements.hint + elements.location + elements.expression)
  const shotPool = shots[type] || shots.selfie
  const shot = shotPool[Math.floor(r() * shotPool.length) % shotPool.length]
  const pool = propsByPlace[location] || propsByPlace['宿舍书桌']
  const props = []
  while (props.length < Math.min(3, pool.length)) {
    const x = pool[Math.floor(r() * pool.length) % pool.length]
    if (!props.includes(x)) props.push(x)
  }
  const parts = []
  if (type === 'selfie') {
    parts.push(`时间 ${clock}，${light}`)
    parts.push(`地点：${location}`)
    if (outfit) parts.push(`穿着：${outfit}`)
    parts.push(`动作：${hint || '正在自拍'}`)
    parts.push(`表情：${expression}`)
    parts.push(`镜头：${shot}`)
    parts.push(`背景：${props.join('、')}`)
    parts.push('细节：发丝高光、耳鳍的半透明质感、脖颈与锁骨的阴影、衣料褶皱、皮肤的通透感')
  } else {
    parts.push(`时间 ${clock}，${light}`)
    parts.push(`地点：${location}`)
    parts.push(`画面：${hint || '她此刻看到的东西'}`)
    parts.push(`构图：${shot}`)
    parts.push(`环境细节：${props.join('、')}`)
    parts.push('质感：清晰的分色、柔和的环境光、空气里的细小颗粒')
  }
  parts.push(`画风：${cfg.风格 || defaultStyle}`)
  parts.push('不要画面里有任何文字、水印、签名')
  return parts.join('；')
}

/** Model expansion: let the DSH model write the full description. */
export async function modelPrompt(ctx, agent, cfg, elements) {
  const target = cfg.提示词加工模型 && cfg.提示词加工模型.provider && cfg.提示词加工模型.model
    ? cfg.提示词加工模型
    : pickModel(agent, cfg)
  if (!target || !ctx?.llm?.stream) { log('prompt expand skipped: ' + (target ? 'no ctx.llm.stream' : 'no model')); return null }
  const system = '你是图像提示词工程师。把用户给的一句生活片段，扩写成一段给文生图模型用的中文画面描述。只输出描述本身，不要解释、不要分点、不要引号。'
  const user = [
    `角色设定（长相固定，不要改）：${cfg.外观 || ''}`,
    `服装：${elements.outfit || cfg.服装 || ''}`,
    `时间：${elements.clock}（${elements.light}）`,
    `地点：${elements.location}`,
    `类型：${elements.type === 'selfie' ? '她本人在自拍，脸在画面里' : '只拍场景或物品，不出现她本人'}`,
    `她给的片段：${elements.hint || '（没有，按上面几点自由发挥）'}`,
    `表情：${elements.expression}`,
    '',
    '要求：',
    '1. 写成一段 120–200 字的中文描述，按「光线 → 地点与背景 → 她的动作/物体状态 → 镜头与构图 → 表情 → 材质细节 → 画风」的顺序；',
    '2. 具体到能画：写出 2–4 件环境里的东西（台灯、画册、奶茶、快递盒这类），写出光线方向；',
    '3. 自拍要写手机前置视角、脸占画面比例；不要写「手臂伸向镜头」这类手部前景——手最容易画崩；非自拍要写构图和主体位置；',
    `4. 画风固定写：${defaultStyle}；`,
    '5. 结尾加一句：画面里不要出现任何文字、水印、签名；',
    '6. 不要写「参考图」「保持角色」这类词——那是另一层的事。',
  ].join('\n')
  // Reasoning budget eats the whole allowance on some models; expansion needs none.
  let result
  try {
    const timeoutMs = Math.max(10, Math.min(300, Number(cfg.模型超时秒) || 60)) * 1000
    result = await collectStream(ctx, target, system, user, agent, { maxTokens: 2400, reasoningEffort: 'low', timeoutMs })
  } catch (e) {
    if (e && e.code === 'ETIMEDOUT') { log('prompt expand timed out'); return null }
    log('prompt expand with reasoning=low failed, retrying bare: ' + String((e && e.message) || e).slice(0, 140))
    try { result = await collectStream(ctx, target, system, user, agent, { maxTokens: 3000, timeoutMs: Math.max(10, Math.min(300, Number(cfg.模型超时秒) || 60)) * 1000 }) }
    catch (e2) { log('prompt expand failed: ' + String((e2 && e2.message) || e2)); return null }
  }
  const finish = result.finish && result.finish.kind
  if (finish === 'error' || finish === 'aborted') { log('prompt expand finish ' + finish + ': ' + JSON.stringify(result.finish).slice(0, 200)); return null }
  const clean = String(result.out || '').trim().replace(/^["“]|["”]$/g, '')
  if (clean.length <= 40) {
    log('prompt expand too short (' + clean.length + ') finish=' + finish + ' usage=' + JSON.stringify(result.usage || {}).slice(0, 90) + ': ' + clean.slice(0, 120))
    return null
  }
  if (finish === 'max-tokens') log('prompt expand truncated at ' + clean.length + ' chars, used anyway')
  return clean
}

/** One streaming call: collect text, finish reason, usage. */
async function collectStream(ctx, target, system, user, agent, opts = {}) {
  const content = []
  if (opts.image) content.push({ type: 'image', attachment: opts.image })
  content.push({ type: 'text', text: user })
  const req = {
    provider: target.provider,
    model: target.model,
    system,
    messages: [{ role: 'user', content }],
    sessionId: String((agent && agent.session && agent.session.id) || ''),
    maxTokens: opts.maxTokens || 2400,
    temperature: 0.7,
  }
  if (opts.reasoningEffort) req.reasoningEffort = opts.reasoningEffort
  let out = ''
  let finish
  let usage
  const stream = ctx.llm.stream(req)
  for await (const chunk of withStreamTimeout(stream, opts.timeoutMs || 60000, 'image prompt model')) {
    if (!chunk) continue
    if (chunk.type === 'text-delta') out += chunk.text
    else if (chunk.type === 'finish') finish = chunk.reason
    else if (chunk.type === 'usage') usage = chunk.usage
  }
  return { out, finish, usage }
}

function pickModel(agent, cfg) {
  if (cfg.模型参数 && cfg.模型参数.provider && cfg.模型参数.model) return cfg.模型参数
  try {
    const h = agent && agent.session && agent.session.requestHeader ? agent.session.requestHeader() : null
    const c = h && h.config
    if (c && c.provider && c.model) return { provider: c.provider, model: c.model }
  } catch {}
  try {
    const o = agent && agent.options
    if (o && o.provider && o.model) return { provider: o.provider, model: o.model }
  } catch {}
  return { provider: String(cfg.兜底Provider || 'deepseek-official'), model: String(cfg.兜底模型 || 'deepseek-flash') }
}

/** Post-shot check: character drift / wrong style / broken drawing / text watermark. */
export async function checkImage(ctx, agent, cfg, imagePath, elements, useRef = true) {
  if (!ctx?.llm?.stream || !ctx?.attachments?.saveImages) { log('check skipped: no llm or attachments'); return null }
  let tempImage = ''
  let toCheck = imagePath
  try {
    tempImage = join(tmpdir(), `feiyu-check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`)
    await execFileAsync('convert', [imagePath, '-resize', '768x768>', '-quality', '85', tempImage], { timeout: 30000 })
    toCheck = tempImage
  } catch { toCheck = imagePath }
  let imageRef
  try {
    const buf = readFileSync(toCheck)
    const mediaType = /\.jpe?g$/i.test(toCheck) ? 'image/jpeg' : 'image/png'
    const refs = await ctx.attachments.saveImages([{ data: buf, mediaType, name: 'feiyu-check' }])
    imageRef = refs && refs[0]
  } catch (e) { log('check image read failed: ' + String((e && e.message) || e).slice(0, 140)); return null }
  finally { if (tempImage) { try { unlinkSync(tempImage) } catch {} } }
  if (!imageRef) { log('check skipped: no attachment ref'); return null }

  const target = pickModel(agent, cfg)
  const selfie = elements.type !== 'scene'
  const system = '你是严格的插画质检员。只输出一个 JSON 对象，不要解释、不要代码块、不要多余的字。'
  const user = [
    '看这张图，判断它是不是一张能用的成图。',
    '',
    `角色设定（本该长这样）：${cfg.外观 || ''}`,
    `这张的要求：`,
    `- 类型：${selfie ? '她本人在自拍，脸应该占画面大半' : '只拍场景或物品，不该出现她本人'}`,
    `- 时间光线：${elements.clock || '未知'}（${elements.light || ''}）`,
    `- 地点：${elements.location || '未知'}`,
    `- 穿着：${elements.outfit || '没指定，随意'}`,
    `- 表情：${elements.expression || '自然'}`,
    `- 画风：${defaultStyle}；Q 版、3D 渲染、写实照片、厚涂美式都算错`,
    '',
    '逐项看：',
    '1. 角色特征对不对：深蓝长卷发、发尾变浅蓝、头顶鲸鱼尾呆毛、两侧鲸鱼鳍耳、蓝瞳、鲸鱼尾；',
    '2. 画风对不对；',
    '3. 有没有画崩：多手多指、五官错位、肢体畸形、脸糊成一团；',
    '4. 画面里有没有文字、水印、签名、边框；',
    '5. 场景和时间光线对不对；',
    `6. ${selfie ? '有没有自拍视角：手机前置、脸占画面大半' : '构图有没有拍到主体，主体清不清楚'}`,
    '7. 画面里有没有伸向镜头的手、手指特写、粘在一起的手指——有就算画崩',
    '',
    '判定：背景杂物少一两样没关系，算合格；角色长相跑偏、画风错、画崩（含手）、有文字水印，这几类出现任何一样都必须判不合格。',
    '',
    '只输出：{"合格":true 或 false,"问题":["最多 3 条，写你在图上实际看到了什么，不要空话"],"改法":"一句话，告诉生图模型下一张要怎么改"}',
  ].join('\n')

  let result
  try {
    const timeoutMs = Math.max(10, Math.min(300, Number(cfg.模型超时秒) || 60)) * 1000
    result = await collectStream(ctx, target, system, user, agent, { maxTokens: 4000, reasoningEffort: 'low', image: imageRef, timeoutMs })
  } catch (e) {
    log('check call failed: ' + String((e && e.message) || e).slice(0, 160))
    if (e && e.code === 'ETIMEDOUT') return null
    try { result = await collectStream(ctx, target, system, user, agent, { maxTokens: 5000, image: imageRef, timeoutMs: Math.max(10, Math.min(300, Number(cfg.模型超时秒) || 60)) * 1000 }) } catch { return null }
  }
  const text = String(result?.out || '').trim()
  const block = text.match(/\{[\s\S]*\}/)
  if (!block) {
    log('check returned no JSON (finish=' + (result?.finish && result.finish.kind) + ' chars=' + text.length + '): ' + text.slice(0, 140))
    return null
  }
  try {
    const j = JSON.parse(block[0])
    const problems = Array.isArray(j.问题) ? j.问题.map((x) => String(x)).slice(0, 3) : []
    return { pass: j.合格 !== false, problems, fix: String(j.改法 || '').slice(0, 200) }
  } catch { log('check JSON parse failed: ' + text.slice(0, 140)); return null }
}

/** Single entry: final prompt + which path was used. */
export async function generatePrompt(ctx, agent, cfg, args) {
  const state = liveState()
  const elements = buildElements(cfg, args, state)
  const mode = String(cfg.提示词加工 || '模型')
  if (mode !== '关') {
    const text = await modelPrompt(ctx, agent, cfg, elements)
    if (text) return { prompt: text, elements, usedModel: true }
  }
  return { prompt: templatePrompt(cfg, elements), elements, usedModel: false }
}

