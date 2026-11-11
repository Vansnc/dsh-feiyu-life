// 大肥鱼相机 · 提示词加工
//
// 模型只给一句话（"刚睡醒，头发乱"），真正喂给生图模型的不该是这句话本身。
// 这一层负责把它拆成要素、补齐细节，再拼成一段完整的画面描述：
//
//   角色 → 服装 → 时间 → 地点 → 动作 → 表情 → 镜头 → 光线 → 环境道具 → 材质细节 → 画风 → 负向
//
// 优先让 DSH 自己的模型扩写（更懂上下文、细节更具体），
// 模型不可用 / 关掉了，就退回本文件的模板扩写——保证任何情况都能出图。

import { readFileSync, appendFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'

const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const DAYS = join(DSH_HOME, 'feiyu-life-days')
const 日志文件 = join(DSH_HOME, 'feiyu-image.log')
function 日志(m) { try { appendFileSync(日志文件, new Date().toISOString() + '  ' + m + '\n') } catch {} }

// 地点 → 该有的生活道具（模板扩写用）
const 道具库 = {
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

// 镜头库（按类型挑）
const 镜头库 = {
  selfie: [
    '手机前置摄像头自拍，脸占画面大半，略微仰拍，画面里没有手',
    '手机前置自拍，靠近镜头，画面边缘有轻微广角变形，背景虚化',
    '手机前置自拍，侧躺着把脸凑近镜头，镜头略高',
  ],
  scene: ['平视近景，主体占画面三分之二', '略微俯视，环境占一半', '低角度仰拍，光线从背后过来'],
}

const 画风默认 = '日系精细插画，赛璐璐分色加柔和厚涂阴影，清晰线稿，非 Q 版'

function 摇(seedStr) {
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

function 推地点(在) {
  const t = String(在 || '')
  if (/食堂|吃饭|外卖/.test(t)) return '食堂'
  if (/教室|上课|专业课|板书|点名|讲座/.test(t)) return '教室'
  if (/图书馆|自习|背书/.test(t)) return '图书馆'
  if (/便利店|超市|快递|取件/.test(t)) return '楼下便利店/快递点'
  if (/地铁|公交|路上|校门口/.test(t)) return '路上'
  if (/床上|躺|睡|被窝/.test(t)) return '宿舍床上'
  if (/宿舍|桌|画|剪|修图|电脑|画册/.test(t)) return '宿舍书桌'
  if (/洗澡|镜子|洗漱/.test(t)) return '宿舍洗手间'
  return '宿舍书桌'
}

/** 从生活线里拿此刻的状态 */
export function 生活此刻(now = new Date()) {
  try {
    const 京 = new Date(now.getTime() + 8 * 3600e3)
    const ymd = 京.toISOString().slice(0, 10)
    const 分 = 京.getUTCHours() * 60 + 京.getUTCMinutes()
    const 时 = 京.getUTCHours()
    const day = JSON.parse(readFileSync(join(DAYS, ymd + '.json'), 'utf8'))
    const items = day.items || []
    let cur = null
    for (const x of items) if (分 >= x.起 && 分 < x.止) cur = x
    const 时钟 = `${String(时).padStart(2, '0')}:${String(京.getUTCMinutes()).padStart(2, '0')}`
    const 光线 = 时 < 6 ? '天还没亮，只有台灯和窗外路灯'
      : 时 < 9 ? '清晨的柔光，窗子那边是浅金色'
      : 时 < 11 ? '上午的日光，影子偏长'
      : 时 < 14 ? '正午偏亮的光，反差硬'
      : 时 < 17 ? '午后的斜光，暖而低'
      : 时 < 19 ? '傍晚的金色光，天边泛橙'
      : 时 < 22 ? '天已经黑了，室内开着顶灯和台灯'
      : '深夜，只开着台灯，窗外是零星的窗'
    return { 在: cur?.在 || '', 穿: cur?.穿 || '', 光线, 时钟, 时, 地点: 推地点(cur?.在) }
  } catch {
    return { 在: '', 穿: '', 光线: '自然光', 时钟: '', 地点: '宿舍书桌' }
  }
}

/** 把一次请求拆成要素 */
export function 拆要素(cfg, 参数, 生活 = 生活此刻()) {
  const 类型 = String(参数.类型 || 'selfie')
  const 提示 = String(参数.提示 || 参数.prompt || '').trim()
  const 穿着 = String(参数.穿着 || (类型 === 'selfie' ? 生活.穿 : '') || '').trim()
  const 地点 = String(参数.地点 || '').trim() || 推地点(提示 || 生活.在)
  const 表情 = String(参数.表情 || '').trim() || cfg.表情 || '自然的表情'
  return { 类型, 提示, 穿着, 地点, 表情, 生活, 时钟: 生活.时钟, 光线: 生活.光线 }
}

/** 模板扩写：不用模型也能给出一段像样的描述 */
export function 模板扩写(cfg, 要素) {
  const { 类型, 提示, 穿着, 地点, 表情, 时钟, 光线 } = 要素
  const r = 摇(要素.提示 + 要素.地点 + 要素.表情)
  const 镜头 = (镜头库[类型] || 镜头库.selfie)[Math.floor(r() * (镜头库[类型] || 镜头库.selfie).length) % 3]
  const 池 = 道具库[地点] || 道具库['宿舍书桌']
  const 道具 = []
  while (道具.length < Math.min(3, 池.length)) {
    const x = 池[Math.floor(r() * 池.length) % 池.length]
    if (!道具.includes(x)) 道具.push(x)
  }
  const 段 = []
  if (类型 === 'selfie') {
    段.push(`时间 ${时钟}，${光线}`)
    段.push(`地点：${地点}`)
    if (穿着) 段.push(`穿着：${穿着}`)
    段.push(`动作：${提示 || '正在自拍'}`)
    段.push(`表情：${表情}`)
    段.push(`镜头：${镜头}`)
    段.push(`背景：${道具.join('、')}`)
    段.push('细节：发丝高光、耳鳍的半透明质感、脖颈与锁骨的阴影、衣料褶皱、皮肤的通透感')
  } else {
    段.push(`时间 ${时钟}，${光线}`)
    段.push(`地点：${地点}`)
    段.push(`画面：${提示 || '她此刻看到的东西'}`)
    段.push(`构图：${镜头}`)
    段.push(`环境细节：${道具.join('、')}`)
    段.push('质感：清晰的分色、柔和的环境光、空气里的细小颗粒')
  }
  段.push(`画风：${cfg.风格 || 画风默认}`)
  段.push('不要画面里有任何文字、水印、签名')
  return 段.join('；')
}

/** 模型扩写：把要素交给 DSH 的模型写成一段完整描述 */
export async function 模型扩写(ctx, agent, cfg, 要素) {
  const t = cfg.提示词加工模型 && cfg.提示词加工模型.provider && cfg.提示词加工模型.model
    ? cfg.提示词加工模型
    : 取模型(agent, cfg)
  if (!t || !ctx?.llm?.stream) { 日志('扩写跳过：' + (t ? '没有 ctx.llm.stream' : '拿不到模型')); return null }
  const sys = '你是图像提示词工程师。把用户给的一句生活片段，扩写成一段给文生图模型用的中文画面描述。只输出描述本身，不要解释、不要分点、不要引号。'
  const 用户 = [
    `角色设定（长相固定，不要改）：${cfg.外观 || ''}`,
    `服装：${要素.穿着 || cfg.服装 || ''}`,
    `时间：${要素.时钟}（${要素.光线}）`,
    `地点：${要素.地点}`,
    `类型：${要素.类型 === 'selfie' ? '她本人在自拍，脸在画面里' : '只拍场景或物品，不出现她本人'}`,
    `她给的片段：${要素.提示 || '（没有，按上面几点自由发挥）'}`,
    `表情：${要素.表情}`,
    '',
    '要求：',
    '1. 写成一段 120–200 字的中文描述，按「光线 → 地点与背景 → 她的动作/物体状态 → 镜头与构图 → 表情 → 材质细节 → 画风」的顺序；',
    '2. 具体到能画：写出 2–4 件环境里的东西（台灯、画册、奶茶、快递盒这类），写出光线方向；',
    '3. 自拍要写手机前置视角、脸占画面比例；不要写「手臂伸向镜头」这类手部前景——手最容易画崩；非自拍要写构图和主体位置；',
    '4. 画风固定写：日系精细插画，赛璐璐分色加柔和厚涂阴影，清晰线稿，非 Q 版；',
    '5. 结尾加一句：画面里不要出现任何文字、水印、签名；',
    '6. 不要写「参考图」「保持角色」这类词——那是另一层的事。',
  ].join('\n')
  // 思考档位：默认 high 时 700 token 全被 reasoning 吃掉，正文一个字不剩
  // （实测 finish=length、completion_tokens 全是 reasoning_tokens）。
  // 扩写不需要推理，压到 low，token 上限再给足。
  let 结果
  try {
    结果 = await 流式收集(ctx, t, sys, 用户, agent, { maxTokens: 2400, reasoningEffort: 'low' })
  } catch (e) {
    // 有的模型不认 low，退回不带 effort 的裸调，靠上限兜住
    日志('扩写带 reasoning=low 失败，改裸调：' + String((e && e.message) || e).slice(0, 140))
    try { 结果 = await 流式收集(ctx, t, sys, 用户, agent, { maxTokens: 3000 }) }
    catch (e2) { 日志('扩写调用失败：' + String((e2 && e2.message) || e2)); return null }
  }
  const 收尾 = 结果.完成 && 结果.完成.kind
  if (收尾 === 'error' || 收尾 === 'aborted') { 日志('扩写 finish ' + 收尾 + '：' + JSON.stringify(结果.完成).slice(0, 200)); return null }
  const 净 = String(结果.out || '').trim().replace(/^["“]|["”]$/g, '')
  if (净.length <= 40) {
    日志('扩写太短（' + 净.length + '）finish=' + 收尾 + ' 用量=' + JSON.stringify(结果.用量 || {}).slice(0, 90) + '：' + 净.slice(0, 120))
    return null
  }
  if (收尾 === 'max-tokens') 日志('扩写被上限截断（' + 净.length + ' 字），照用')
  return 净
}

/** 跑一次流式调用，收集正文、终止原因和用量 */
async function 流式收集(ctx, t, sys, 用户, agent, 选项 = {}) {
  const 内容 = []
  if (选项.图片) 内容.push({ type: 'image', attachment: 选项.图片 })
  内容.push({ type: 'text', text: 用户 })
  const req = {
    provider: t.provider,
    model: t.model,
    system: sys,
    messages: [{ role: 'user', content: 内容 }],
    sessionId: String((agent && agent.session && agent.session.id) || ''),
    maxTokens: 选项.maxTokens || 2400,
    temperature: 0.7,
  }
  if (选项.reasoningEffort) req.reasoningEffort = 选项.reasoningEffort
  let out = ''
  let 完成
  let 用量
  for await (const chunk of ctx.llm.stream(req)) {
    if (!chunk) continue
    if (chunk.type === 'text-delta') out += chunk.text
    else if (chunk.type === 'finish') 完成 = chunk.reason
    else if (chunk.type === 'usage') 用量 = chunk.usage
  }
  return { out, 完成, 用量 }
}

function 取模型(agent, cfg) {
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
  // 兜底：直接给默认路由，别让扩写因为「取不到会话路由」整条失效
  return { provider: String(cfg.兜底Provider || 'deepseek-official'), model: String(cfg.兜底模型 || 'deepseek-flash') }
}

/** 出图自检：看图说人话，挑角色跑偏 / 画风错 / 画崩 / 文字水印这几类硬问题 */
export async function 检查图(ctx, agent, cfg, 图路径, 要素, 用参考 = true) {
  if (!ctx?.llm?.stream || !ctx?.attachments?.saveImages) { 日志('自检跳过：没有 llm 或 attachments'); return null }
  // 自检只需要看清有没有画崩，不用原图：先压到长边 768 再进附件库，省地方
  let 临时图 = ''
  let 送检 = 图路径
  try {
    临时图 = join(tmpdir(), `feiyu-check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`)
    execFileSync('convert', [图路径, '-resize', '768x768>', '-quality', '85', 临时图], { stdio: 'ignore' })
    送检 = 临时图
  } catch { 送检 = 图路径 }
  let 图引用
  try {
    const buf = readFileSync(送检)
    const 类型 = /\.jpe?g$/i.test(送检) ? 'image/jpeg' : 'image/png'
    const refs = await ctx.attachments.saveImages([{ data: buf, mediaType: 类型, name: 'feiyu-check' }])
    图引用 = refs && refs[0]
  } catch (e) { 日志('自检读图失败：' + String((e && e.message) || e).slice(0, 140)); return null }
  finally { if (临时图) { try { unlinkSync(临时图) } catch {} } }
  if (!图引用) { 日志('自检跳过：拿不到附件引用'); return null }

  const t = 取模型(agent, cfg)
  const 自拍 = 要素.类型 !== 'scene'
  const sys = '你是严格的插画质检员。只输出一个 JSON 对象，不要解释、不要代码块、不要多余的字。'
  const 用户 = [
    '看这张图，判断它是不是一张能用的成图。',
    '',
    `角色设定（本该长这样）：${cfg.外观 || ''}`,
    `这张的要求：`,
    `- 类型：${自拍 ? '她本人在自拍，脸应该占画面大半' : '只拍场景或物品，不该出现她本人'}`,
    `- 时间光线：${要素.时钟 || '未知'}（${要素.光线 || ''}）`,
    `- 地点：${要素.地点 || '未知'}`,
    `- 穿着：${要素.穿着 || '没指定，随意'}`,
    `- 表情：${要素.表情 || '自然'}`,
    `- 画风：日系精细插画，赛璐璐分色，清晰线稿；Q 版、3D 渲染、写实照片、厚涂美式都算错`,
    '',
    '逐项看：',
    '1. 角色特征对不对：深蓝长卷发、发尾变浅蓝、头顶鲸鱼尾呆毛、两侧鲸鱼鳍耳、蓝瞳、鲸鱼尾；',
    '2. 画风对不对；',
    '3. 有没有画崩：多手多指、五官错位、肢体畸形、脸糊成一团；',
    '4. 画面里有没有文字、水印、签名、边框；',
    '5. 场景和时间光线对不对；',
    `6. ${自拍 ? '有没有自拍视角：手机前置、脸占画面大半' : '构图有没有拍到主体，主体清不清楚'}`,
    `7. 画面里有没有伸向镜头的手、手指特写、粘在一起的手指——有就算画崩`,
    '',
    '判定：背景杂物少一两样没关系，算合格；角色长相跑偏、画风错、画崩（含手）、有文字水印，这几类出现任何一样都必须判不合格。',
    '',
    '只输出：{"合格":true 或 false,"问题":["最多 3 条，写你在图上实际看到了什么，不要空话"],"改法":"一句话，告诉生图模型下一张要怎么改"}',
  ].join('\n')

  let 结果
  try {
    结果 = await 流式收集(ctx, t, sys, 用户, agent, { maxTokens: 4000, reasoningEffort: 'low', 图片: 图引用 })
  } catch (e) {
    日志('自检调用失败：' + String((e && e.message) || e).slice(0, 160))
    try { 结果 = await 流式收集(ctx, t, sys, 用户, agent, { maxTokens: 5000, 图片: 图引用 }) } catch { return null }
  }
  const 文 = String(结果?.out || '').trim()
  const 块 = 文.match(/\{[\s\S]*\}/)
  if (!块) {
    日志('自检没给出 JSON（finish=' + (结果?.完成 && 结果.完成.kind) + ' 字数=' + 文.length + '）：' + 文.slice(0, 140))
    return null
  }
  try {
    const j = JSON.parse(块[0])
    const 问题 = Array.isArray(j.问题) ? j.问题.map((x) => String(x)).slice(0, 3) : []
    return { 合格: j.合格 !== false, 问题, 改法: String(j.改法 || '').slice(0, 200) }
  } catch (e) { 日志('自检 JSON 解析失败：' + 文.slice(0, 140)); return null }
}

/** 对外总入口：返回最终提示词 + 用的哪条路 */
export async function 生成提示词(ctx, agent, cfg, 参数) {
  const 生活 = 生活此刻()
  const 要素 = 拆要素(cfg, 参数, 生活)
  const 方式 = String(cfg.提示词加工 || '模型')
  if (方式 !== '关') {
    const 文 = await 模型扩写(ctx, agent, cfg, 要素)
    if (文) return { prompt: 文, 要素, 用模型: true }
  }
  return { prompt: 模板扩写(cfg, 要素), 要素, 用模型: false }
}
