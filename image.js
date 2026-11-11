// dsh-feiyu-life · camera (merged from dsh-feiyu-image)
//
// Registers the `shoot` tool and the settings routes under the life plugin:
//   /dsh-feiyu-life/image/{state,save,test,models,file}
//
// "Current state" comes from the life state machine via image-prompt.js, so
// the camera and the injected context always agree.
//
// Storage moved to the feiyu-life-image namespace; legacy paths are still
// read so existing photos/config keep working.

import {
  readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, renameSync,
  appendFileSync, existsSync, copyFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { generatePrompt, checkImage } from './image-prompt.js'

const dshHome = () => process.env.DSH_HOME ?? join(homedir(), '.dsh')

const CONFIG_PATH = join(dshHome(), 'feiyu-life-image-config.json')
const LEGACY_CONFIG_PATH = join(dshHome(), 'feiyu-image-config.json')
const OUT_DIR = join(dshHome(), 'feiyu-life-image')
const LEGACY_OUT_DIR = join(dshHome(), 'feiyu-image')
const ARK_CFG = join(dshHome(), 'ark', 'config.json')
const LOG_FILE = join(dshHome(), 'feiyu-life-image.log')
const log = (m) => { try { appendFileSync(LOG_FILE, new Date().toISOString() + '  ' + m + '\n') } catch {} }

const DEFAULT_CONFIG = {
  总开关: true,
  模型: 'doubao-seedream-5-0-pro-260628',
  备用模型: 'doubao-seedream-5-0-flash-260915',
  用参考图: true,
  参考图: '',
  外观: '鲸鱼娘：深蓝色及腰长卷发，发尾渐变成浅蓝；头顶一撮鲸鱼尾形状的呆毛；白色蕾丝女仆头饰，头饰右侧一个小蓝蝴蝶结；两侧各有一只鲸鱼鳍形状的耳，耳内侧白色；蓝色大眼，皮肤白皙，圆脸，21 岁成年女性的比例',
  服装: '深蓝色长袖女仆连衣裙，胸前白色荷叶边衬衣，白色大围裙，裙摆金色藤蔓刺绣，袖口白色荷叶边；身后一条深蓝色鲸鱼尾巴，尾鳍浅蓝；白色连裤袜，深蓝色玛丽珍鞋',
  风格: '日系精细插画，赛璐璐分色加柔和厚涂阴影，清晰线稿，非 Q 版',
  镜头: '手机前置自拍近景，脸占画面大半，平视或微微仰起下巴看镜头，画面里不出现手',
  表情: '嘴角带一点得意的笑，眼睛看进镜头',
  细节: '发丝高光、耳鳍的半透明质感、脖颈阴影、衣服褶皱、背景里的生活杂物（画册、马克笔、奶茶、台灯）',
  画幅: '竖幅',
  提示词加工: '模型',
  出图自检: true,
  自检重拍: 1,
  每日上限: 8,
  最短间隔秒: 30,
  存图目录: '',
  兜底Provider: 'deepseek-official',
  兜底模型: 'deepseek-flash',
  模型参数: null,
}

function migrateLegacyConfig() {
  try {
    if (!existsSync(CONFIG_PATH) && existsSync(LEGACY_CONFIG_PATH)) copyFileSync(LEGACY_CONFIG_PATH, CONFIG_PATH)
  } catch {}
}

export function readImageConfig() {
  migrateLegacyConfig()
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
    return { ...DEFAULT_CONFIG, ...raw }
  } catch {
    try {
      const raw = JSON.parse(readFileSync(LEGACY_CONFIG_PATH, 'utf8'))
      return { ...DEFAULT_CONFIG, ...raw }
    } catch { return { ...DEFAULT_CONFIG } }
  }
}

export function saveImageConfig(patch) {
  const next = { ...readImageConfig(), ...(patch && typeof patch === 'object' ? patch : {}) }
  try {
    mkdirSync(dshHome(), { recursive: true })
    writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8')
  } catch {}
  return next
}

const sizeByAspect = { 竖幅: '1440x1920', 方形: '2048x2048', 横幅: '1920x1440' }

function readRefImage(cfg) {
  const p = cfg.参考图 || join(OUT_DIR, '角色设定', '正面.jpg')
  const candidates = [p, join(LEGACY_OUT_DIR, '角色设定', '正面.jpg')]
  for (const x of candidates) {
    try { return 'data:image/jpeg;base64,' + readFileSync(x).toString('base64') } catch {}
  }
  return ''
}

function photoDirs(cfg) {
  const custom = String(cfg.存图目录 || '').trim()
  return custom ? [custom] : [OUT_DIR, LEGACY_OUT_DIR]
}

function listPhotos(cfg) {
  const out = []
  for (const dir of photoDirs(cfg)) {
    try {
      for (const f of readdirSync(dir)) {
        if (!/^feiyu-\d+\.png$/.test(f)) continue
        const st = statSync(join(dir, f))
        out.push({ name: f, time: st.mtimeMs, size: st.size })
      }
    } catch {}
  }
  return out.sort((a, b) => b.time - a.time).slice(0, 24)
}

/** Saved-today count and last shot time (retakes and character refs don't count). */
function todayUsage(cfg) {
  try {
    const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)
    let n = 0
    let last = 0
    for (const dir of photoDirs(cfg)) {
      let files = []
      try { files = readdirSync(dir) } catch {}
      for (const f of files) {
        if (!/^feiyu-\d+\.png$/.test(f)) continue
        const st = statSync(join(dir, f))
        if (new Date(st.mtimeMs + 8 * 3600e3).toISOString().slice(0, 10) === today) n++
        last = Math.max(last, st.mtimeMs)
      }
    }
    return { n, last }
  } catch { return { n: 0, last: 0 } }
}

/** QQ renders large images poorly: save a small copy (long edge 1440, JPEG q88). */
function shrink(pngPath) {
  try {
    const jpg = pngPath.replace(/\.png$/i, '.jpg')
    execFileSync('convert', [pngPath, '-resize', '1440x1440>', '-quality', '88', jpg], { stdio: 'ignore' })
    const st = statSync(jpg)
    return st.size > 0 ? jpg : pngPath
  } catch { return pngPath }
}

async function generateImage(cfg, prompt, opts = {}) {
  try {
    return await arkGenerate(cfg, prompt, opts)
  } catch (e) {
    const backup = String(cfg.备用模型 || '').trim()
    if (!backup || backup === cfg.模型) throw e
    log(`主模型 ${cfg.模型} 失败，换备用 ${backup}：` + String((e && e.message) || e).slice(0, 160))
    return await arkGenerate({ ...cfg, 模型: backup }, prompt, opts)
  }
}

async function arkGenerate(cfg, prompt, opts = {}) {
  const ark = JSON.parse(readFileSync(ARK_CFG, 'utf8'))
  const body = {
    model: cfg.模型,
    prompt,
    size: sizeByAspect[cfg.画幅] || '1440x1920',
    response_format: 'url',
    watermark: false,
  }
  const ref = (cfg.用参考图 && opts.useRef !== false) ? readRefImage(cfg) : ''
  if (ref) body.image = [ref]
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
  const dir = String(cfg.存图目录 || '').trim() || OUT_DIR
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `feiyu-${Date.now()}.png`)
  writeFileSync(path, buf)
  const small = shrink(path)
  return { path: small, original: path, bytes: statSync(small).size, prompt }
}

/** Rename a retaken bad shot so it keeps for review but doesn't count against today's limit. */
function markRetake(result) {
  const rename = (p) => String(p).replace(/(\/feiyu-)(\d+)\.(png|jpg)$/, '$1retry-$2.$3')
  if (!result) return
  const nextOriginal = rename(result.original)
  const nextSmall = rename(result.path)
  try { if (nextOriginal !== result.original) renameSync(result.original, nextOriginal) } catch {}
  try { if (nextSmall !== result.path && nextSmall !== nextOriginal) renameSync(result.path, nextSmall) } catch {}
  result.original = nextOriginal
  result.path = nextSmall
}

/** Shoot, then look at the result; retake with the problems fed back (max 1 by default). */
async function shootAndCheck(ctx, cfg, { prompt, useRef, elements }) {
  const retakeLimit = Math.max(0, Math.min(2, Number(cfg.自检重拍 ?? 1)))
  const attempts = 1 + retakeLimit
  const notes = []
  let last = null
  let check = null
  let extra = ''
  let current = ''
  for (let i = 0; i < attempts; i++) {
    current = (prompt + extra).trim()
    const r = await generateImage(cfg, current, { useRef })
    last = r
    if (cfg.出图自检 === false) { notes.push('自检关着，没看'); break }
    check = await checkImage(ctx, findSession(ctx), cfg, r.path, elements, useRef)
    if (!check) { notes.push('自检没跑成，这张没验'); break }
    if (check.pass) { notes.push(i === 0 ? '自检过了' : `第 ${i + 1} 张过了`); break }
    notes.push(`第 ${i + 1} 张不合格：${check.problems.join('；') || '（没说出具体问题）'}`)
    if (i < attempts - 1) {
      markRetake(last)
      extra = `。不要出现这些问题：${check.problems.join('；') || '画面缺陷'}` +
        (check.fix ? `。按要求改：${check.fix}` : '')
    }
  }
  return { ...last, check, notes, prompt: current }
}

// ── available models: ask Ark directly instead of hard-coding versions ──
const fallbackModels = [
  'doubao-seedream-5-0-pro-260628',
  'doubao-seedream-5-0-flash-260915',
  'doubao-seedream-5-0-260128',
  'doubao-seedream-4-5-251128',
  'doubao-seedream-4-0-250828',
]
let modelCache = null // { at, list }
const MODEL_CACHE_MS = 10 * 60e3

async function fetchModels() {
  if (modelCache && Date.now() - modelCache.at < MODEL_CACHE_MS) return { list: modelCache.list, cached: true }
  let list = []
  let error = ''
  try {
    const ark = JSON.parse(readFileSync(ARK_CFG, 'utf8'))
    const r = await fetch(ark.baseUrl.replace(/\/+$/, '') + '/models', {
      headers: { Authorization: 'Bearer ' + ark.apiKey },
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error('方舟 ' + r.status + '：' + JSON.stringify(d).slice(0, 160))
    list = (d.data || [])
      .filter((m) => m && (/image/i.test(String(m.domain || ''))
        || (((m.modalities || {}).output_modalities) || []).includes('image')))
      .map((m) => m.id)
      .filter(Boolean)
  } catch (e) { error = String((e && e.message) || e).slice(0, 200) }
  list = [...new Set(list)].filter(Boolean)
  if (!list.length) list = fallbackModels.slice()
  modelCache = { at: Date.now(), list }
  return { list, cached: false, error }
}

// ── settings routes ─────────────────────────────────────────────────
const ROUTE_PREFIX = '/dsh-feiyu-life/image'

function registerRoutes(ctx) {
  const onlyOwner = (handler) => async (req, res) => {
    try {
      const connection = ctx.get('connection')
      const rejection = connection && typeof connection.requestRejection === 'function' ? connection.requestRejection(req) : undefined
      if (rejection === 401 || rejection === 403) {
        res.writeHead(rejection, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: String(rejection) }))
        return
      }
    } catch {}
    return handler(req, res)
  }
  const reply = (res, code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(obj))
  }
  const readBody = async (req) => {
    let b = ''
    for await (const c of req) b += c
    try { return JSON.parse(b || '{}') } catch { return undefined }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: ROUTE_PREFIX + '/state',
    handler: onlyOwner(async (req, res) => {
      if (req.method !== 'GET') return reply(res, 405, { ok: false })
      const cfg = readImageConfig()
      const usage = todayUsage(cfg)
      let ark = { ok: false }
      try {
        const a = JSON.parse(readFileSync(ARK_CFG, 'utf8'))
        ark = { ok: Boolean(a.apiKey), baseUrl: a.baseUrl }
      } catch {}
      return reply(res, 200, {
        ok: true,
        config: cfg,
        today: usage.n,
        limit: cfg.每日上限,
        photos: listPhotos(cfg),
        ark,
        hasRef: Boolean(readRefImage(cfg)),
      })
    }),
  }), 'feiyu-life: image state')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: ROUTE_PREFIX + '/save',
    handler: onlyOwner(async (req, res) => {
      if (req.method !== 'POST') return reply(res, 405, { ok: false })
      const body = await readBody(req)
      if (!body || typeof body !== 'object') return reply(res, 400, { ok: false, error: 'bad json' })
      const patch = body.config && typeof body.config === 'object' ? body.config : body
      const cfg = saveImageConfig(patch)
      return reply(res, 200, { ok: true, config: cfg })
    }),
  }), 'feiyu-life: image save')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: ROUTE_PREFIX + '/test',
    handler: onlyOwner(async (req, res) => {
      if (req.method !== 'POST') return reply(res, 405, { ok: false })
      const body = await readBody(req) || {}
      const cfg = readImageConfig()
      try {
        const expanded = await generatePrompt(ctx, findSession(ctx), cfg, {
          type: body.type || 'selfie',
          hint: body.hint || '',
          outfit: body.outfit || '',
          expression: body.expression || '',
        })
        const useRef = String(body.type || 'selfie') !== 'scene' && cfg.用参考图
        const prompt = (useRef ? '保持参考图里这个角色的长相、发色渐变、鲸鱼鳍耳、呆毛、瞳色、鲸鱼尾不变；' : '') + expanded.prompt
        const r = await shootAndCheck(ctx, cfg, { prompt, useRef, elements: expanded.elements })
        return reply(res, 200, { ok: true, image: r.path, prompt: r.prompt, bytes: r.bytes, check: r.check, notes: r.notes })
      } catch (e) { return reply(res, 500, { ok: false, error: String((e && e.message) || e).slice(0, 300) }) }
    }),
  }), 'feiyu-life: image test')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: ROUTE_PREFIX + '/models',
    handler: onlyOwner(async (req, res) => {
      if (req.method !== 'GET') return reply(res, 405, { ok: false })
      const url = new URL(req.url || '/', 'http://x')
      if (url.searchParams.get('f')) modelCache = null
      try {
        const r = await fetchModels()
        return reply(res, 200, { ok: true, models: r.list, cached: Boolean(r.cached), modelError: r.error || undefined })
      } catch (e) {
        return reply(res, 200, { ok: true, models: fallbackModels, modelError: String((e && e.message) || e).slice(0, 200) })
      }
    }),
  }), 'feiyu-life: image models')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: ROUTE_PREFIX + '/file',
    handler: onlyOwner(async (req, res) => {
      const url = new URL(req.url || '/', 'http://x')
      const name = url.searchParams.get('n') || ''
      if (!/^feiyu-[\w-]+\.png$/.test(name) && !/^[\u4e00-\u9fa5\w-]+\.(jpg|png)$/.test(name)) return reply(res, 400, { ok: false })
      const cfg = readImageConfig()
      const candidates = []
      for (const dir of photoDirs(cfg)) candidates.push(join(dir, name))
      candidates.push(join(OUT_DIR, '角色设定', name), join(LEGACY_OUT_DIR, '角色设定', name))
      for (const p of candidates) {
        try {
          const buf = readFileSync(p)
          res.writeHead(200, { 'content-type': p.endsWith('.jpg') ? 'image/jpeg' : 'image/png', 'cache-control': 'max-age=60' })
          res.end(buf)
          return
        } catch {}
      }
      return reply(res, 404, { ok: false })
    }),
  }), 'feiyu-life: image file')
}

function findSession(ctx) {
  try {
    const roots = (typeof ctx.agents.roots === 'function' ? ctx.agents.roots() : ctx.agents.list()) || []
    const preferred = roots.find((a) => /dsh-agentchat/.test(String((a && a.session && a.session.cwd) || '')))
    return preferred || roots[0]
  } catch { return undefined }
}

export function registerImage(ctx) {
  registerRoutes(ctx)

  ctx.effect(() => ctx.tools.register({
    name: 'shoot',
    description: '拍一张图并保存成文件。selfie=她自己的自拍（自动带上此刻穿着、地点、时间）；scene=拍任何别的东西：食堂的菜、楼下的猫、桌上的画册、窗外下雨、她刚买的杯子……出图后会自动看一眼（角色长相、画风、画崩、文字水印），不合格会自动重拍一次。回复里拿到路径后用 ![描述](路径) 发出去。',
    parameters: {
      type: 'object',
      properties: {
        hint: { type: 'string', description: '画面里还想要什么（姿势、表情、手里的东西、场景细节）。不填就按此刻的状态拍' },
        type: { type: 'string', enum: ['selfie', 'scene'], description: 'selfie=她本人自拍；scene=拍任何别的东西（风景、物品、吃的、猫、街景、人也可以）' },
        location: { type: 'string', description: '可选：这一张在哪（不填从生活线推断）' },
        outfit: { type: 'string', description: '可选：这一张想让她穿什么（睡衣、卫衣、浴巾…）。不填就沿用参考图里的女仆装' },
        expression: { type: 'string', description: '可选：表情（偷笑、害羞、困、委屈、得意）。不填用默认的笑' },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, image: { type: 'string' }, say: { type: 'string' }, prompt: { type: 'string' }, check: { type: 'object' }, notes: { type: 'array' } }, additionalProperties: true },
      render: (_a, v) => [{ type: 'text', text: String(v?.say || '') + (v?.image ? '\n图片：' + v.image : '') }],
    },
    async execute(args = {}) {
      const cfg = readImageConfig()
      if (!cfg.总开关) return { ok: false, say: '相机没开' }
      const usage = todayUsage(cfg)
      if (usage.n >= cfg.每日上限) return { ok: false, say: `今天已经拍了 ${usage.n} 张，够了` }
      if (Date.now() - usage.last < cfg.最短间隔秒 * 1000) return { ok: false, say: '刚拍过，等会儿再拍' }
      const expanded = await generatePrompt(ctx, findSession(ctx), cfg, args)
      const useRef = String(args.type || 'selfie') !== 'scene' && cfg.用参考图
      const prompt = (useRef ? '保持参考图里这个角色的长相、发色渐变、鲸鱼鳍耳、呆毛、瞳色、鲸鱼尾不变；' : '') + expanded.prompt
      try {
        const r = await shootAndCheck(ctx, cfg, { prompt, useRef, elements: expanded.elements })
        const flawed = r.check && r.check.pass === false
          ? `（这张还不太对：${(r.check.problems[0] || '画面有问题')}）`
          : ''
        const out = {
          ok: true,
          image: r.path,
          say: `拍好了（${Math.round(r.bytes / 1024)}KB）${expanded.usedModel ? '' : '（模板扩写）'}${flawed}`,
          prompt: r.prompt,
          notes: r.notes,
        }
        if (r.check) out.check = r.check
        return out
      } catch (e) {
        return { ok: false, say: '没拍成：' + String((e && e.message) || e).slice(0, 160) }
      }
    },
  }), 'feiyu-life: shoot')
}
