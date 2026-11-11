// dsh-feiyu-life · 相机（原 dsh-feiyu-image，0.6.0 起并进生活线）
//
// 为什么自己做：dsh-image-studio 停在 0.1.7（8 月），跟 dsh 0.2.x 的依赖对不上，
// 要装就得给它盖版本豁免，风险不值当。而真正有用的只有一件事：
//   让模型能「拍一张」——自动带上她此刻的穿着和所在场景，存成本地文件，能直接发到 QQ。
//
// 生图只走火山方舟（Seedream），/images/generations 回图片 URL。
// 外观和风格写在配置里，跟生活线（dsh-feiyu-life）的今日剧本联动。

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, statSync, readdirSync, renameSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const CONFIG = join(DSH_HOME, 'feiyu-image-config.json')
const OUT_DIR = join(DSH_HOME, 'feiyu-image')
const ARK_CFG = join(DSH_HOME, 'ark', 'config.json')
const DAYS = join(DSH_HOME, 'feiyu-life-days')
const 日志文件 = join(DSH_HOME, 'feiyu-image.log')
function 日志(m) { try { appendFileSync(日志文件, new Date().toISOString() + '  ' + m + '\n') } catch {} }

import { 生成提示词, 检查图 } from './image-prompt.js'

const 默认 = {
  总开关: true,
  模型: 'doubao-seedream-5-0-pro-260628',
  备用模型: 'doubao-seedream-5-0-flash-260915',
  用参考图: true,
  参考图: '',                         // 留空 = ~/.dsh/feiyu-image/角色设定/正面.jpg
  外观: '鲸鱼娘：深蓝色及腰长卷发，发尾渐变成浅蓝；头顶一撮鲸鱼尾形状的呆毛；白色蕾丝女仆头饰，头饰右侧一个小蓝蝴蝶结；两侧各有一只鲸鱼鳍形状的耳，耳内侧白色；蓝色大眼，皮肤白皙，圆脸，21 岁成年女性的比例',
  服装: '深蓝色长袖女仆连衣裙，胸前白色荷叶边衬衣，白色大围裙，裙摆金色藤蔓刺绣，袖口白色荷叶边；身后一条深蓝色鲸鱼尾巴，尾鳍浅蓝；白色连裤袜，深蓝色玛丽珍鞋',
  风格: '日系精细插画，赛璐璐分色加柔和厚涂阴影，清晰线稿，非 Q 版',
  镜头: '手机前置自拍近景，脸占画面大半，平视或微微仰起下巴看镜头，画面里不出现手',
  表情: '嘴角带一点得意的笑，眼睛看进镜头',
  细节: '发丝高光、耳鳍的半透明质感、脖颈阴影、衣服褶皱、背景里的生活杂物（画册、马克笔、奶茶、台灯）',
  画幅: '竖幅',
  提示词加工: '模型',            // 模型 / 关（关 = 只用模板扩写）
  出图自检: true,                 // 出图后让视觉模型看一眼，不合格自动重拍
  自检重拍: 1,                    // 自检不合格最多重拍几次
  每日上限: 8,
  最短间隔秒: 30,
  存图目录: '',
}

function 读配置() {
  try {
    const raw = JSON.parse(readFileSync(CONFIG, 'utf8'))
    return { ...默认, ...raw }
  } catch { return { ...默认 } }
}

function 存配置(patch) {
  const next = { ...读配置(), ...patch }
  try { mkdirSync(DSH_HOME, { recursive: true }); writeFileSync(CONFIG, JSON.stringify(next, null, 2), 'utf8') } catch {}
  return next
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
  return '宿舍'
}

function 生活此刻() {
  try {
    const now = new Date()
    const 北京 = new Date(now.getTime() + 8 * 3600e3)
    const ymd = 北京.toISOString().slice(0, 10)
    const 分 = 北京.getUTCHours() * 60 + 北京.getUTCMinutes()
    const day = JSON.parse(readFileSync(join(DAYS, ymd + '.json'), 'utf8'))
    const items = day.items || []
    let cur = null
    for (const x of items) if (分 >= x.起 && 分 < x.止) cur = x
    const 时 = 北京.getUTCHours()
    const 分钟 = 北京.getUTCMinutes()
    const 时钟 = `${String(时).padStart(2, '0')}:${String(分钟).padStart(2, '0')}`
    const 光线 = 时 < 6 ? '天还没亮，只有台灯和窗外路灯'
      : 时 < 9 ? '清晨的柔光，窗子那边是浅金色'
      : 时 < 11 ? '上午的日光，影子偏长'
      : 时 < 14 ? '正午偏亮的光，反差硬'
      : 时 < 17 ? '午后的斜光，暖而低'
      : 时 < 19 ? '傍晚的金色光，天边泛橙'
      : 时 < 22 ? '天已经黑了，室内开着顶灯和台灯'
      : '深夜，只开着台灯，窗外是零星的窗'
    return { 在: cur?.在 || '', 穿: cur?.穿 || '', 光线, 时钟, 时, 场景: cur?.在 || '' }
  } catch { return { 在: '', 穿: '', 光线: '自然光', 时钟: '', 场景: '' } }
}

function 拼提示词(cfg, 参数) {
  const 生活 = 生活此刻()
  const 类型 = String(参数.类型 || 'selfie')
  const 主体 = String(参数.提示 || 参数.prompt || '').trim()
  const 地点 = String(参数.地点 || '').trim() || 推地点(主体 || 生活.在)
  const 时间句 = `时间：${生活.时钟}（${生活.光线}），画面里的光线和天色要跟这个时间对得上`

  // ── 非自拍：拍任何东西（食堂的菜、楼下的猫、桌上一堆书、窗外下雨）──
  if (类型 === 'scene') {
    const 句 = [时间句, `地点：${地点}`]
    句.push(`画面：${主体 || '她此刻看到的东西'}`)
    if (/人|他|她|室友|阿岚|小满|同学|老板|阿姨|猫|狗|鸟/.test(主体)) 句.push('人物或动物按描述画，不要求跟角色参考图一致')
    句.push(`画风：${cfg.风格}`)
    return 句.join('；')
  }

  // ── 自拍：方舟 + 参考图，锁死这张脸 ──
  if (cfg.用参考图) {
    const 句 = ['保持参考图里这个角色的一切特征不变：发色渐变、鲸鱼鳍耳、头顶呆毛、蓝瞳、鲸鱼尾']
    const 穿 = String(参数.穿着 || 生活.穿 || '').trim()
    if (穿) 句.push(`服装：这一张穿「${穿}」，以此为准；参考图里的女仆装和女仆头饰这次都不用`)
    句.push(时间句)
    句.push(`地点：${地点}，背景布置要符合这个地方`)
    const 动作 = 主体.replace(/^[在正]/, '')
    if (动作) 句.push(`行为：${动作}`)
    else 句.push(`行为：${生活.在 || '在宿舍里待着'}`)
    句.push(`镜头：${cfg.镜头}`)
    句.push(`表情：${String(参数.表情 || '').trim() || cfg.表情}`)
    句.push(`画面细节：${cfg.细节}`)
    句.push(`画风：${cfg.风格}`)
    return 句.join('；')
  }

  // ── 自拍：没有参考图（关了参考图），靠文字设定 ──
  const 片段 = [`【角色固定特征，长相必须一致】${cfg.外观}。`]
  片段.push(`默认服装：${cfg.服装}；画面描述里指定了别的穿着就以描述为准。`)
  const 穿2 = String(参数.穿着 || 生活.穿 || '').trim()
  if (穿2) 片段.push(`此刻穿着：${穿2}`)
  片段.push(时间句)
  片段.push(`地点：${地点}`)
  if (主体) 片段.push(`画面：${主体}`)
  片段.push(`镜头：${cfg.镜头}`)
  片段.push(`表情：${String(参数.表情 || '').trim() || cfg.表情}`)
  片段.push(`画面细节：${cfg.细节}`)
  片段.push(`画风：${cfg.风格}`)
  return 片段.filter(Boolean).join('；')
}


// QQ 机器人那边大图容易渲染成空泡：顺手压一张小图（长边 1440，JPEG q88）
function 压小图(pngPath) {
  try {
    const jpg = pngPath.replace(/\.png$/i, '.jpg')
    execFileSync('convert', [pngPath, '-resize', '1440x1440>', '-quality', '88', jpg], { stdio: 'ignore' })
    const st = statSync(jpg)
    return st.size > 0 ? jpg : pngPath
  } catch { return pngPath }
}

async function 生图(cfg, prompt, opts = {}) {
  try {
    return await 生图Ark(cfg, prompt, opts)
  } catch (e) {
    // 主模型挂了就换备用模型再试一次（配额/内容审核这类失败也照换，反正结果一样是失败）
    const 备用 = String(cfg.备用模型 || '').trim()
    if (!备用 || 备用 === cfg.模型) throw e
    日志(`主模型 ${cfg.模型} 失败，换备用 ${备用}：` + String((e && e.message) || e).slice(0, 160))
    return await 生图Ark({ ...cfg, 模型: 备用 }, prompt, opts)
  }
}

// 重拍的废片改名成 feiyu-retry-<时间戳>，留着能回看，但不占每日额度
function 标废片(结果) {
  const 改名 = (p) => String(p).replace(/(\/feiyu-)(\d+)\.(png|jpg)$/, '$1retry-$2.$3')
  if (!结果) return
  const 新原图 = 改名(结果.原图)
  const 新小图 = 改名(结果.path)
  try { if (新原图 !== 结果.原图) renameSync(结果.原图, 新原图) } catch {}
  try { if (新小图 !== 结果.path && 新小图 !== 新原图) renameSync(结果.path, 新小图) } catch {}
  结果.原图 = 新原图
  结果.path = 新小图
}

// 出完就看一眼：角色跑偏、画风错了、多手多指、带文字水印，都算不合格。
// 不合格就把问题塞回提示词重拍（默认最多 1 次），别再出一张歪图直接发出去。
async function 拍并自检(ctx, cfg, { prompt, 参考, 要素 }) {
  const 重拍上限 = Math.max(0, Math.min(2, Number(cfg.自检重拍 ?? 1)))
  const 总次数 = 1 + 重拍上限
  const 记录 = []
  let 最后 = null
  let 检查 = null
  let 补 = ''
  let 本次 = ''
  for (let i = 0; i < 总次数; i++) {
    本次 = (prompt + 补).trim()
    const r = await 生图(cfg, 本次, { 参考 })
    最后 = r
    if (cfg.出图自检 === false) { 记录.push('自检关着，没看'); break }
    检查 = await 检查图(ctx, 找会话(ctx), cfg, r.path, 要素, 参考)
    if (!检查) { 记录.push('自检没跑成，这张没验'); break }
    if (检查.合格) { 记录.push(i === 0 ? '自检过了' : `第 ${i + 1} 张过了`); break }
    记录.push(`第 ${i + 1} 张不合格：${检查.问题.join('；') || '（没说出具体问题）'}`)
    if (i < 总次数 - 1) {
      标废片(最后)   // 这张要重拍了，不算今天正式拍到的一张
      补 = `。不要出现这些问题：${检查.问题.join('；') || '画面缺陷'}` +
        (检查.改法 ? `。按要求改：${检查.改法}` : '')
    }
  }
  return { ...最后, 检查, 记录, prompt: 本次 }
}

function 读参考图(cfg) {
  const p = cfg.参考图 || join(OUT_DIR, '角色设定', '正面.jpg')
  try { return 'data:image/jpeg;base64,' + readFileSync(p).toString('base64') } catch { return '' }
}

const 画幅尺寸 = {
  竖幅: '1440x1920',
  方形: '2048x2048',
  横幅: '1920x1440',
}

// ── 可用模型：直接问方舟要，别再靠人肉记版本号 ─────────────────────
// GET /models，挑 domain 是 ImageGeneration / 输出模态含 image 的；拉不到就退回内置名单。
const 兜底模型 = [
  'doubao-seedream-5-0-pro-260628',
  'doubao-seedream-5-0-flash-260915',
  'doubao-seedream-5-0-260128',
  'doubao-seedream-4-5-251128',
  'doubao-seedream-4-0-250828',
]
let 模型缓存 = null          // { at, 列表 }
const 模型缓存毫秒 = 10 * 60e3

async function 拉模型列表() {
  if (模型缓存 && Date.now() - 模型缓存.at < 模型缓存毫秒) return { 列表: 模型缓存.列表, 缓存: true }
  let 列表 = []
  let 错 = ''
  try {
    const ark = JSON.parse(readFileSync(ARK_CFG, 'utf8'))
    const r = await fetch(ark.baseUrl.replace(/\/+$/, '') + '/models', {
      headers: { Authorization: 'Bearer ' + ark.apiKey },
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error('方舟 ' + r.status + '：' + JSON.stringify(d).slice(0, 160))
    列表 = (d.data || [])
      .filter((m) => m && (/image/i.test(String(m.domain || ''))
        || (((m.modalities || {}).output_modalities) || []).includes('image')))
      .map((m) => m.id)
      .filter(Boolean)
  } catch (e) { 错 = String((e && e.message) || e).slice(0, 200) }
  列表 = [...new Set(列表)].filter(Boolean)
  if (!列表.length) 列表 = 兜底模型.slice()
  模型缓存 = { at: Date.now(), 列表 }
  return { 列表, 缓存: false, 错 }
}

async function 生图Ark(cfg, prompt, opts = {}) {
  const ark = JSON.parse(readFileSync(ARK_CFG, 'utf8'))
  const body = {
    model: cfg.模型,
    prompt,
    size: 画幅尺寸[cfg.画幅] || '1440x1920',
    response_format: 'url',
    watermark: false,
  }
  const 参考 = (cfg.用参考图 && opts.参考 !== false) ? 读参考图(cfg) : ''
  if (参考) body.image = [参考]
  const r = await fetch(ark.baseUrl.replace(/\/+$/, '') + '/images/generations', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + ark.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error('方舟 ' + r.status + '：' + JSON.stringify(data).slice(0, 220))
  const url = data?.data?.[0]?.url
  if (!url) throw new Error('方舟返回里没有图片：' + JSON.stringify(data).slice(0, 200))
  const img = await fetch(url)
  if (!img.ok) throw new Error('下载失败 ' + img.status)
  const buf = Buffer.from(await img.arrayBuffer())
  const dir = cfg.存图目录 || OUT_DIR
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `feiyu-${Date.now()}.png`)
  writeFileSync(path, buf)
  const 小 = 压小图(path)
  return { path: 小, 原图: path, bytes: statSync(小).size, prompt }
}

/** 今日已出图数 / 上次出图时间（简单节流，够用） */
function 今日用量(cfg) {
  const dir = cfg.存图目录 || OUT_DIR
  try {
    const 今天 = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)
    let n = 0
    let 最后 = 0
    for (const f of 列目录(dir)) {
      if (!/^feiyu-\d+\.png$/.test(f)) continue  // 重拍废片 (feiyu-retry-*) 和角色设定图都不算额度
      const st = statSync(join(dir, f))
      if (new Date(st.mtimeMs + 8 * 3600e3).toISOString().slice(0, 10) === 今天) n++
      最后 = Math.max(最后, st.mtimeMs)
    }
    return { n, 最后 }
  } catch { return { n: 0, 最后: 0 } }
}

function 列目录(dir) {
  try { return readdirSync(dir) } catch { return [] }
}


// ── 设置页接口 ────────────────────────────────────────────────────────
const 路由前缀 = '/dsh-feiyu-image'

function 列照片(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => /^feiyu-\d+\.png$/.test(f))
      .map((f) => ({ 名: f, 时间: statSync(join(dir, f)).mtimeMs, 大小: statSync(join(dir, f)).size }))
      .sort((a, b) => b.时间 - a.时间)
      .slice(0, 24)
  } catch { return [] }
}

function 注册设置路由(ctx, 读配置, 存配置, 生图, 拼提示词, 今日用量, 读参考图) {
  const 只认本人 = (handler) => async (req, res) => {
    try {
      const 连接 = ctx.get('connection')
      const 拒 = 连接 && typeof 连接.requestRejection === 'function' ? 连接.requestRejection(req) : undefined
      if (拒 === 401 || 拒 === 403) {
        res.writeHead(拒, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: String(拒) }))
        return
      }
    } catch {}
    return handler(req, res)
  }
  const 回 = (res, code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(obj))
  }
  const 读体 = async (req) => {
    let b = ''
    for await (const c of req) b += c
    try { return JSON.parse(b || '{}') } catch { return undefined }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: 路由前缀 + '/state',
    handler: 只认本人(async (req, res) => {
      if (req.method !== 'GET') return 回(res, 405, { ok: false })
      const cfg = 读配置()
      const 用 = 今日用量(cfg)
      let ark = { ok: false }
      try {
        const a = JSON.parse(readFileSync(ARK_CFG, 'utf8'))
        ark = { ok: Boolean(a.apiKey), baseUrl: a.baseUrl }
      } catch {}
      return 回(res, 200, {
        ok: true, 配置: cfg, 今日: 用.n, 上限: cfg.每日上限,
        照片: 列照片(cfg.存图目录 || OUT_DIR), ark,
        有参考图: Boolean(读参考图(cfg)),
      })
    }),
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: 路由前缀 + '/save',
    handler: 只认本人(async (req, res) => {
      if (req.method !== 'POST') return 回(res, 405, { ok: false })
      const body = await 读体(req)
      if (!body || typeof body !== 'object') return 回(res, 400, { ok: false, error: 'bad json' })
      const patch = body.配置 && typeof body.配置 === 'object' ? body.配置 : body
      const cfg = 存配置(patch)
      return 回(res, 200, { ok: true, 配置: cfg })
    }),
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: 路由前缀 + '/test',
    handler: 只认本人(async (req, res) => {
      if (req.method !== 'POST') return 回(res, 405, { ok: false })
      const body = await 读体(req) || {}
      const cfg = 读配置()
      try {
        const 加工 = await 生成提示词(ctx, 找会话(ctx), cfg, { 类型: body.类型 || 'selfie', 提示: body.提示 || '', 穿着: body.穿着 || '', 表情: body.表情 || '' })
        const 用参考 = String(body.类型 || 'selfie') !== 'scene' && cfg.用参考图
        const prompt = (用参考 ? '保持参考图里这个角色的长相、发色渐变、鲸鱼鳍耳、呆毛、瞳色、鲸鱼尾不变；' : '') + 加工.prompt
        const r = await 拍并自检(ctx, cfg, { prompt, 参考: 用参考, 要素: 加工.要素 })
        return 回(res, 200, { ok: true, 图: r.path, 提示词: r.prompt, 大小: r.bytes, 自检: r.检查, 记录: r.记录 })
      } catch (e) { return 回(res, 500, { ok: false, error: String((e && e.message) || e).slice(0, 300) }) }
    }),
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: 路由前缀 + '/models',
    handler: 只认本人(async (req, res) => {
      if (req.method !== 'GET') return 回(res, 405, { ok: false })
      const url = new URL(req.url || '/', 'http://x')
      if (url.searchParams.get('f')) 模型缓存 = null   // 点「刷新」就别吃缓存
      try {
        const r = await 拉模型列表()
        return 回(res, 200, { ok: true, 列表: r.列表, 缓存: Boolean(r.缓存), 拉取失败: r.错 || undefined })
      } catch (e) {
        return 回(res, 200, { ok: true, 列表: 兜底模型, 拉取失败: String((e && e.message) || e).slice(0, 200) })
      }
    }),
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: 路由前缀 + '/file',
    handler: 只认本人(async (req, res) => {
      const url = new URL(req.url || '/', 'http://x')
      const 名 = url.searchParams.get('n') || ''
      if (!/^feiyu-[\w-]+\.png$/.test(名) && !/^[\u4e00-\u9fa5\w-]+\.(jpg|png)$/.test(名)) return 回(res, 400, { ok: false })
      const dir = 读配置().存图目录 || OUT_DIR
      const 候选 = [join(dir, 名), join(OUT_DIR, '角色设定', 名)]
      for (const p of 候选) {
        try {
          const buf = readFileSync(p)
          res.writeHead(200, { 'content-type': p.endsWith('.jpg') ? 'image/jpeg' : 'image/png', 'cache-control': 'max-age=60' })
          res.end(buf)
          return
        } catch {}
      }
      return 回(res, 404, { ok: false })
    }),
  }))
}

function 找会话(ctx) {
  try {
    const roots = (typeof ctx.agents.roots === 'function' ? ctx.agents.roots() : ctx.agents.list()) || []
    // 优先挑工作目录是 agentchat 的那个会话，它的模型路由才是我们想要的
    const 对 = roots.find((a) => /dsh-agentchat/.test(String((a && a.session && a.session.cwd) || '')))
    return 对 || roots[0]
  } catch { return undefined }
}

export function registerImage(ctx) {
  注册设置路由(ctx, 读配置, 存配置, 生图, 拼提示词, 今日用量, 读参考图)

  ctx.effect(() => ctx.tools.register({
    name: 'shoot',
    description: '拍一张图并保存成文件。selfie=她自己的自拍（自动带上此刻穿着、地点、时间）；scene=拍任何别的东西：食堂的菜、楼下的猫、桌上的画册、窗外下雨、她刚买的杯子……出图后会自动看一眼（角色长相、画风、画崩、文字水印），不合格会自动重拍一次。回复里拿到路径后用 ![描述](路径) 发出去。',
    parameters: {
      type: 'object',
      properties: {
        提示: { type: 'string', description: '画面里还想要什么（姿势、表情、手里的东西、场景细节）。不填就按此刻的状态拍' },
        类型: { type: 'string', enum: ['selfie', 'scene'], description: 'selfie=她本人自拍；scene=拍任何别的东西（风景、物品、吃的、猫、街景、人也可以）' },
        地点: { type: 'string', description: '可选：这一张在哪（不填从日程推断）' },
        穿着: { type: 'string', description: '可选：这一张想让她穿什么（睡衣、卫衣、浴巾…）。不填就沿用参考图里的女仆装' },
        表情: { type: 'string', description: '可选：表情（偷笑、害羞、困、委屈、得意）。不填用默认的笑' },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, 图: { type: 'string' }, 说: { type: 'string' }, 提示词: { type: 'string' }, 自检: { type: 'object' }, 记录: { type: 'array' } }, additionalProperties: true },
      render: (_a, v) => [{ type: 'text', text: String(v?.说 || '') + (v?.图 ? '\n图片：' + v.图 : '') }],
    },
    async execute(参数 = {}) {
      const cfg = 读配置()
      if (!cfg.总开关) return { ok: false, 说: '相机没开' }
      const 用 = 今日用量(cfg)
      if (用.n >= cfg.每日上限) return { ok: false, 说: `今天已经拍了 ${用.n} 张，够了` }
      if (Date.now() - 用.最后 < cfg.最短间隔秒 * 1000) return { ok: false, 说: '刚拍过，等会儿再拍' }
      const 加工 = await 生成提示词(ctx, 找会话(ctx), cfg, 参数)
      const 用参考 = String(参数.类型 || 'selfie') !== 'scene' && cfg.用参考图
      const prompt = (用参考 ? '保持参考图里这个角色的长相、发色渐变、鲸鱼鳍耳、呆毛、瞳色、鲸鱼尾不变；' : '') + 加工.prompt
      try {
        const r = await 拍并自检(ctx, cfg, { prompt, 参考: 用参考, 要素: 加工.要素 })
        const 歪 = r.检查 && r.检查.合格 === false
          ? `（这张还不太对：${(r.检查.问题[0] || '画面有问题')}）`
          : ''
        const 出 = {
          ok: true, 图: r.path,
          说: `拍好了（${Math.round(r.bytes / 1024)}KB）${加工.用模型 ? '' : '（模板扩写）'}${歪}`,
          提示词: r.prompt,
          记录: r.记录,
        }
        if (r.检查) 出.自检 = r.检查
        return 出
      } catch (e) {
        return { ok: false, 说: '没拍成：' + String((e && e.message) || e).slice(0, 160) }
      }
    },
  }))
}

