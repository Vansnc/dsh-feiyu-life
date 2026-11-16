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
    '手机前置自拍，正常手持距离，胸像构图，带一点肩部和少量环境，脸约占画面 40%',
    '手机前置自拍，半身近景，人物位于画面中央偏一侧，保留当前环境信息，脸不要贴满画面',
    '手机前置自拍，肩部以上构图，镜头稍高于眼睛，画面自然舒展，不要极端广角变形',
  ],
  scene: [
    '平视近景，主体清楚，环境辅助说明场景',
    '略微俯视，主体明确，背景不过度抢镜',
    '中景构图，画面协调，保留地点信息与生活感',
  ],
}

const defaultStyle = '日系精细插画，赛璐璐分色加柔和厚涂阴影，清晰线稿，非 Q 版'

/** 表情由当前行为推断，避免固定摆拍 */
function autoExpression(elements) {
  const s = `${elements?.hint || ''} ${elements?.state?.what || ''}`
  if (/睡|困|躺|刚醒|深夜/.test(s)) return '表情自然放松，带一点困意，眼神柔和有高光，嘴角带一点浅笑，不要僵硬瞪镜头'
  if (/吃饭|外卖|奶茶|零食/.test(s)) return '表情自然轻松，嘴角带一点随意的笑意，眼神有光，不要刻意摆拍'
  if (/图书馆|自习|学习|写稿|画|剪片|修图/.test(s)) return '表情安静专注，眼神清亮有高光，嘴角微收，不要呆滞'
  return '表情自然灵动，眼睛有高光、嘴角带一点浅笑，不要僵硬摆拍'
}

/** 穿着由生活状态注入；没有就用自然日常兜底 */
function autoOutfit(elements) {
  const explicit = String(elements?.outfit || '').trim()
  if (explicit) return explicit
  return '符合当前时间、地点和活动的自然日常穿着，不要擅自换成礼服、女仆装、制服或 cosplay'
}

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
    const worldPlace = r.world?.moving && r.world?.destination
      ? `${r.world.location?.name || '路上'}去${r.world.destination.name}的路上`
      : r.world?.location?.name
    return {
      what,
      outfit: r.current?.outfit || '',
      clock,
      light,
      hour: t.hour,
      location: worldPlace || locationHint(what),
    }
  } catch {
    return { what: '', outfit: '', clock: '', light: '自然光', hour: 12, location: '宿舍书桌' }
  }
}

/** Split one shoot request into elements. */
export function buildElements(cfg, args, state = liveState()) {
  const type = String(args.type || 'selfie')
  const hint = String(args.hint || args.prompt || '').trim()
  const explicitOutfit = String(args.outfit || '').trim()
  const outfit = explicitOutfit || (type === 'selfie' ? state.outfit : '')
  const location = String(args.location || '').trim() || state.location || locationHint(hint || state.what)
  const expression = String(args.expression || '').trim() || cfg.表情 || '自然的表情'
  return { type, hint, outfit, explicitOutfit, location, expression, state, clock: state.clock, light: state.light }
}

/** Template expansion: a decent description without calling any model. */
export function templatePrompt(cfg, elements, useRef = false) {
  const { type, hint, location, clock, light } = elements
  const expression = autoExpression(elements)
  const outfit = autoOutfit(elements)
  const r = rand(`${hint}|${location}|${clock}`)
  const shotPool = shots[type] || shots.selfie
  const generatedShot = shotPool[Math.floor(r() * shotPool.length) % shotPool.length]
  const visualStyle = String(cfg.风格 || defaultStyle).trim()
  const pool = propsByPlace[location]
    || (/路上|门口|地铁|公交|街上/.test(location) ? propsByPlace['路上'] : propsByPlace['宿舍书桌'])
  const props = []
  while (props.length < Math.min(3, pool.length)) {
    const x = pool[Math.floor(r() * pool.length) % pool.length]
    if (!props.includes(x)) props.push(x)
  }
  const parts = []
  if (type === 'selfie') {
    parts.push(`这是她在 ${clock} 拍的一张自拍，${light}`)
    parts.push(`地点：${location}`)
    parts.push(`当前动作：${hint || elements?.state?.what || '在进行日常活动'}（这个动作要实际画出来，比如刷手机就画出手和手机，不要省略）`)
    parts.push(`穿着：${outfit}`)
    parts.push(`表情：${expression}`)
    parts.push(`构图：${generatedShot}`)
    parts.push(`背景中自然带出：${props.join('、')}`)
    parts.push('画面要求：人物与环境关系自然，整体协调，主体清楚，不要怼脸，不要僵硬摆拍')
    parts.push('人物要求：人物外貌完全以参考图为准，不要改脸；不要照搬参考图里的贝雷帽和蝴蝶结头饰，头发自然露出来')
  } else {
    parts.push(`时间 ${clock}，${light}`)
    parts.push(`地点：${location}`)
    parts.push(`画面主体：${hint || '她此刻看到的场景'}`)
    parts.push(`构图：${generatedShot}`)
    parts.push(`环境细节：${props.join('、')}`)
    parts.push('画面要求：构图清楚、主体明确、整体协调')
  }
  parts.push(`画风：${visualStyle}`)
  parts.push('不要出现任何文字、水印、签名')
  return parts.join('；')
}

/** Model expansion: let the DSH model write the full description. */
export async function modelPrompt(ctx, agent, cfg, elements, useRef = false) {
  const target = cfg.提示词加工模型 && cfg.提示词加工模型.provider && cfg.提示词加工模型.model
    ? cfg.提示词加工模型
    : pickModel(agent, cfg)
  if (!target || !ctx?.llm?.stream) { log('prompt expand skipped: ' + (target ? 'no ctx.llm.stream' : 'no model')); return null }
  const system = '你是图像提示词工程师。请根据“当前生活状态”生成一段给文生图模型使用的中文画面描述。人物长相以参考图为唯一准则，不要自行改脸，不要新增参考图里没有的帽子或头饰。只输出描述本身，不要解释、不要分点、不要引号。'
  const head = useRef && elements.type !== 'scene'
    ? [
      '人物长相以参考图为唯一准则，不要自行改脸，不要新增参考图里没有的帽子或头饰。',
      `服装：${autoOutfit(elements)}`,
      `表情：${autoExpression(elements)}`,
    ]
    : [
      `角色设定（长相固定，不要改）：${cfg.外观 || ''}`,
      `服装：${elements.outfit || cfg.服装 || ''}`,
      `表情：${elements.expression || '自然的表情'}`,
    ]
  const user = [
    ...head,
    '',
    '要求：',
    '1. 自拍要避免过近，默认采用自然的胸像或半身自拍，保留少量环境；',
    '2. 必须保留用户片段里的动作细节（比如「刷手机」就要画出手拿手机在刷，「照镜子」就要画镜子），不能省略或改成别的动作；',
    '3. 表情必须有眼神高光和一点浅笑或好奇，不能呆滞、不能面无表情；',
    '4. 不要照搬参考图里的贝雷帽和蝴蝶结头饰，头发自然露出来；',
    '5. 具体到能画：写出 2–4 件环境里的东西（台灯、画册、奶茶、快递盒这类），写出光线方向；',
    '6. 不要写「手臂伸向镜头」这类手部前景——手最容易画崩；',
    '7. 人物与背景要协调，画风统一；',
    `8. 画风严格使用：${defaultStyle}；`,
    '9. 结尾补一句：画面里不要出现任何文字、水印、签名；',
    '10. 不要写「参考图」「保持角色」这类词。',
    '',
    `时间：${elements.clock}（${elements.light}）`,
    `地点：${elements.location}`,
    `类型：${elements.type === 'selfie' ? '自拍，人物本人出镜，脸在画面里' : '场景照，不出现她本人'}`,
    `当前状态：${elements.hint || elements.state?.what || '日常生活片段'}`,
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
  const images = []
  if (Array.isArray(opts.images)) images.push(...opts.images.filter(Boolean))
  if (opts.image) images.push(opts.image)
  for (const image of images) content.push({ type: 'image', attachment: image })
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
export async function checkImage(ctx, agent, cfg, imagePath, elements, useRef = true, referencePaths = []) {
  if (!ctx?.llm?.stream || !ctx?.attachments?.saveImages) { log('check skipped: no llm or attachments'); return null }
  let tempImage = ''
  let toCheck = imagePath
  try {
    tempImage = join(tmpdir(), `feiyu-check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`)
    await execFileAsync('convert', [
      imagePath, '-resize', '1024x1024>', '-sampling-factor', '4:4:4', '-quality', '90', tempImage,
    ], { timeout: 30000 })
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
  const refRefs = []
  for (const p of referencePaths.slice(0, 3)) {
    try {
      const buf = readFileSync(p)
      const mediaType = /\.jpe?g$/i.test(p) ? 'image/jpeg' : 'image/png'
      const refs = await ctx.attachments.saveImages([{ data: buf, mediaType, name: 'feiyu-ref' }])
      if (refs && refs[0]) refRefs.push(refs[0])
    } catch {}
  }

  const target = pickModel(agent, cfg)
  const selfie = elements.type !== 'scene'
  const system = '你是严格的插画质检员。只输出一个 JSON 对象，不要解释、不要代码块、不要多余的字。'
  const user = [
    '前面若干张是人物参考图，最后一张是本次生成结果。',
    '请直接对照参考图检查生成结果，不要只依据文字设定。',
    '',
    '必须检查：',
    '1. 生成图的脸型、五官比例、发型轮廓、发色、瞳色、发饰是否像参考图；',
    '2. 成图里出现参考图那顶贝雷帽或蝴蝶结头饰的，判不合格（那套造型不保留）；',
    '3. 自拍构图是否自然：至少看到肩部或上半身，不要只剩半张脸，不要过度怼脸；',
    '4. 表情是否自然灵动：眼神有高光、嘴角带浅笑或好奇，不能呆滞木然；',
    '5. 人物与背景是否协调，画面是否统一；',
    '6. 是否存在画崩、多手多指、五官错位、肢体畸形；',
    '7. 是否出现文字、水印、签名、边框；',
    '8. 当前状态里的动作有没有画出来（比如刷手机要看到手机和手）；',
    '',
    `当前时间与光线：${elements.clock || '未知'}（${elements.light || ''}）`,
    `当前地点：${elements.location || '未知'}`,
    `当前状态：${elements.hint || elements.state?.what || '未知'}`,
    `当前穿着：${autoOutfit(elements)}`,
    '',
    '判定标准：只要出现“脸明显不像参考图、照搬参考图的贝雷帽/头饰、表情呆滞、过度怼脸、画崩、有字水印”中的任意一项，就判不合格。',
    '',
    '只输出 JSON：{"合格":true 或 false,"问题":["最多 4 条"],"改法":"一句话说明下一张该怎么修"}',
  ].join('\n')

  let result
  try {
    const timeoutMs = Math.max(10, Math.min(300, Number(cfg.模型超时秒) || 60)) * 1000
    result = await collectStream(ctx, target, system, user, agent, { maxTokens: 4000, reasoningEffort: 'low', images: [...refRefs, imageRef], timeoutMs })
  } catch (e) {
    log('check call failed: ' + String((e && e.message) || e).slice(0, 160))
    if (e && e.code === 'ETIMEDOUT') return null
    try { result = await collectStream(ctx, target, system, user, agent, { maxTokens: 5000, images: [...refRefs, imageRef], timeoutMs: Math.max(10, Math.min(300, Number(cfg.模型超时秒) || 60)) * 1000 }) } catch { return null }
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
  const useRef = elements.type !== 'scene' && cfg.用参考图 !== false
  const mode = String(cfg.提示词加工 || '模型')
  if (mode !== '关') {
    const text = await modelPrompt(ctx, agent, cfg, elements, useRef)
    if (text) return { prompt: text, elements, usedModel: true, useRef }
  }
  return { prompt: templatePrompt(cfg, elements, useRef), elements, usedModel: false, useRef }
}

