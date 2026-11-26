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
  existsSync, copyFileSync, unlinkSync,
} from 'node:fs'
import { execFile } from 'node:child_process'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { promisify } from 'node:util'
import { generatePrompt, checkImage } from './image-prompt.js'
import { mediaTimeZone, mediaZonedNow } from './life-snapshot.js'
import { appendRotatingLog, timeoutSignal } from '../infrastructure/runtime.js'

const dshHome = () => process.env.DSH_HOME ?? join(homedir(), '.dsh')

const CONFIG_PATH = join(dshHome(), 'feiyu-life-image-config.json')
const LEGACY_CONFIG_PATH = join(dshHome(), 'feiyu-image-config.json')
const OUT_DIR = join(dshHome(), 'feiyu-life-image')
const LEGACY_OUT_DIR = join(dshHome(), 'feiyu-image')
const ARK_CFG = join(dshHome(), 'ark', 'config.json')
const LOG_FILE = join(dshHome(), 'feiyu-life-image.log')
const PACKAGE_REFERENCE_IMAGES = [
  fileURLToPath(new URL('../../assets/references/feiyu-front.jpg', import.meta.url)),
  fileURLToPath(new URL('../../assets/references/feiyu-turnaround.jpg', import.meta.url)),
]
const execFileAsync = promisify(execFile)
const log = (m) => {
  try {
    mkdirSync(dshHome(), { recursive: true })
    appendRotatingLog(LOG_FILE, new Date().toISOString() + '  ' + m + '\n')
  } catch {}
}

export const IMAGE_CONFIG_VERSION = 5
const LEGACY_DEFAULT_DETAILS = '发丝高光、耳鳍的半透明质感、脖颈阴影、衣服褶皱、背景里的生活杂物（画册、马克笔、奶茶、台灯）'

const DEFAULT_CONFIG = {
  配置版本: IMAGE_CONFIG_VERSION,
  总开关: true,
  模型: 'doubao-seedream-5-0-pro-260628',
  备用模型: 'doubao-seedream-5-0-flash-260915',
  用参考图: true,
  参考图: '',
  画幅: '竖幅',
  清晰度: '2K',
  出图自检: true,
  自检重拍: 1,
  每日上限: 8,
  最短间隔秒: 30,
  模型超时秒: 60,
  生图超时秒: 120,
  照片保留天数: 90,
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
    const migrated = migrateImageConfig(raw)
    const next = normalizeImageConfig(migrated.value)
    if (migrated.changed) writeImageConfig(next)
    return next
  } catch {
    try {
      const raw = JSON.parse(readFileSync(LEGACY_CONFIG_PATH, 'utf8'))
      const next = normalizeImageConfig(migrateImageConfig(raw).value)
      try { writeImageConfig(next) } catch {}
      return next
    } catch {
      const next = normalizeImageConfig({})
      try { writeImageConfig(next) } catch {}
      return next
    }
  }
}

export function saveImageConfig(patch) {
  const next = normalizeImageConfig({ ...readImageConfig(), ...(patch && typeof patch === 'object' ? patch : {}) })
  writeImageConfig(next)
  return next
}

/** Replace the whole camera configuration after a complete external validation. */
export function replaceImageConfig(input) {
  const next = normalizeImageConfig(input)
  writeImageConfig(next)
  return next
}

function writeImageConfig(next) {
  mkdirSync(dshHome(), { recursive: true })
  const tmp = CONFIG_PATH + '.tmp'
  writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8')
  renameSync(tmp, CONFIG_PATH)
}

const sizeByQuality = {
  '1.5K': { 竖幅: '1344x1792', 方形: '1536x1536', 横幅: '1792x1344' },
  '2K': { 竖幅: '1776x2368', 方形: '2048x2048', 横幅: '2368x1776' },
}
const originalPhoto = /^feiyu-\d+\.(?:png|jpe?g|webp)$/i
const generatedPhoto = /^feiyu-(?:retry-)?\d+(?:-(?:small|thumb))?\.(?:png|jpe?g|webp)$/i
const generatedPhotoMeta = /^feiyu-(?:retry-)?\d+\.json$/i
const photoTimestamp = (name) => /^feiyu-(\d+)\.(?:png|jpe?g|webp)$/i.exec(name)?.[1] || ''
export const photoThumbnailName = (name) => String(name).replace(/\.(?:png|jpe?g|webp)$/i, '-thumb.jpg')
export const photoMetadataName = (name) => String(name).replace(/\.(?:png|jpe?g|webp)$/i, '.json')

export function detectImageFormat(buf, _contentType = '') {
  if (!Buffer.isBuffer(buf) || !buf.length) return null
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { ext: 'png', mime: 'image/png' }
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' }
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' }
  }
  // Never trust the HTTP header on its own: gateways sometimes return an
  // HTML error page while keeping the requested image content type.
  return null
}

const imageMimeForPath = (path) => /\.webp$/i.test(path) ? 'image/webp'
  : /\.jpe?g$/i.test(path) ? 'image/jpeg' : 'image/png'

export function migrateImageConfig(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const version = Math.max(0, Math.round(Number(source.配置版本) || 0))
  const next = { ...source }
  if (version < 2) {
    delete next.种子
    delete next.后端
    if (next.模型超时秒 === undefined) next.模型超时秒 = DEFAULT_CONFIG.模型超时秒
    if (next.生图超时秒 === undefined) next.生图超时秒 = DEFAULT_CONFIG.生图超时秒
    if (next.照片保留天数 === undefined) next.照片保留天数 = DEFAULT_CONFIG.照片保留天数
  }
  if (version < 3) {
    if (next.清晰度 === undefined) next.清晰度 = DEFAULT_CONFIG.清晰度
    if (next.细节 === LEGACY_DEFAULT_DETAILS) next.细节 = DEFAULT_CONFIG.细节
  }
  if (version < 5) {
    // Reference-only camera: no user-authored appearance or prompt template survives migration.
    for (const key of ['外观', '服装', '风格', '镜头', '表情', '细节', '提示词加工']) delete next[key]
  }
  next.配置版本 = IMAGE_CONFIG_VERSION
  return { value: next, changed: version !== IMAGE_CONFIG_VERSION || ['种子', '后端', '外观', '服装', '风格', '镜头', '表情', '细节', '提示词加工'].some((key) => key in source) }
}

export function normalizeImageConfig(raw) {
  const next = { ...DEFAULT_CONFIG, ...(raw && typeof raw === 'object' ? raw : {}) }
  for (const key of ['外观', '服装', '风格', '镜头', '表情', '细节', '提示词加工']) delete next[key]
  next.配置版本 = IMAGE_CONFIG_VERSION
  next.用参考图 = true
  next.每日上限 = Math.max(1, Math.min(100, Math.round(Number(next.每日上限) || DEFAULT_CONFIG.每日上限)))
  next.最短间隔秒 = Math.max(0, Math.min(86400, Math.round(Number(next.最短间隔秒) || 0)))
  next.自检重拍 = Math.max(0, Math.min(2, Math.round(Number(next.自检重拍) || 0)))
  next.模型超时秒 = Math.max(10, Math.min(300, Math.round(Number(next.模型超时秒) || DEFAULT_CONFIG.模型超时秒)))
  next.生图超时秒 = Math.max(30, Math.min(600, Math.round(Number(next.生图超时秒) || DEFAULT_CONFIG.生图超时秒)))
  next.照片保留天数 = Math.max(1, Math.min(3650, Math.round(Number(next.照片保留天数) || DEFAULT_CONFIG.照片保留天数)))
  if (!Object.hasOwn(sizeByQuality['2K'], next.画幅)) next.画幅 = DEFAULT_CONFIG.画幅
  if (!Object.hasOwn(sizeByQuality, next.清晰度)) next.清晰度 = DEFAULT_CONFIG.清晰度
  return next
}

const referenceImage = /\.(?:png|jpe?g|webp)$/i

const expandHome = (path) => {
  const value = String(path || '').trim()
  return value === '~' ? homedir() : value.startsWith('~/') ? join(homedir(), value.slice(2)) : value
}

const referenceRank = (path) => {
  const name = basename(path).toLowerCase()
  if (/正面|front/.test(name)) return 0
  if (/三视图|设定|sheet/.test(name)) return 1
  if (/侧面|side|profile/.test(name)) return 2
  if (/背面|back|rear/.test(name)) return 3
  return 4
}

function imagesIn(path) {
  try {
    const stat = statSync(path)
    if (stat.isFile()) return referenceImage.test(path) ? [path] : []
    if (!stat.isDirectory()) return []
    return readdirSync(path)
      .filter((name) => referenceImage.test(name))
      .map((name) => join(path, name))
  } catch { return [] }
}

/** Resolve a stable multi-view reference set. Files, directories and lists are accepted. */
export function referenceImageFiles(cfg) {
  const configured = String(cfg.参考图 || '').split(/[\n,，;；]+/u).map(expandHome).filter(Boolean)
  // Empty means the curated package pair exactly. A user's custom library is
  // only mixed in when explicitly configured, avoiding conflicting identities
  // from an old auto-scanned directory.
  const sources = configured.length ? configured : PACKAGE_REFERENCE_IMAGES
  const seen = new Set()
  const files = []
  for (const source of sources) {
    for (const path of imagesIn(source)) {
      if (seen.has(path)) continue
      seen.add(path)
      files.push(path)
    }
  }
  return files.sort((a, b) => referenceRank(a) - referenceRank(b) || a.localeCompare(b, 'zh-CN')).slice(0, 10)
}

function readRefImages(cfg) {
  const result = []
  for (const path of referenceImageFiles(cfg)) {
    try {
      const buf = readFileSync(path)
      const mime = detectImageFormat(buf)?.mime
      if (mime) result.push(`data:${mime};base64,` + buf.toString('base64'))
    } catch {}
  }
  return result
}

function photoDirs(cfg) {
  const custom = String(cfg.存图目录 || '').trim()
  return custom ? [custom] : [OUT_DIR, LEGACY_OUT_DIR]
}

/** Remove only files produced by this plugin; reference images are never touched. */
export function cleanupPhotos(cfg = readImageConfig(), now = Date.now()) {
  const cutoff = now - Math.max(1, Number(cfg.照片保留天数) || 90) * 86400000
  let removed = 0
  for (const dir of new Set(photoDirs(cfg))) {
    let names = []
    try { names = readdirSync(dir) } catch {}
    for (const name of names) {
      if (!generatedPhoto.test(name) && !generatedPhotoMeta.test(name)) continue
      const path = join(dir, name)
      try { if (statSync(path).mtimeMs < cutoff) { unlinkSync(path); removed++ } } catch {}
    }
  }
  return removed
}

function listPhotos(cfg) {
  const byTimestamp = new Map()
  for (const dir of photoDirs(cfg)) {
    try {
      for (const f of readdirSync(dir)) {
        if (!originalPhoto.test(f)) continue
        const st = statSync(join(dir, f))
        const key = photoTimestamp(f)
        const current = byTimestamp.get(key)
        // Before v1.0.8 the reduced JPEG reused the original timestamp. Keep
        // one gallery item and prefer the full PNG/WebP when both still exist.
        const rank = /\.png$/i.test(f) ? 3 : /\.webp$/i.test(f) ? 2 : 1
        let meta = null
        try { meta = JSON.parse(readFileSync(join(dir, photoMetadataName(f)), 'utf8')) } catch {}
        if (!current || rank > current.rank) byTimestamp.set(key, {
          name: f, time: st.mtimeMs, size: st.size, rank,
          context: meta?.context || null,
          prompt: String(meta?.prompt || '').slice(0, 1200),
          model: String(meta?.model || ''),
          quality: String(meta?.quality || ''),
          check: meta?.check && typeof meta.check === 'object' ? meta.check : null,
        })
      }
    } catch {}
  }
  return [...byTimestamp.values()]
    .map(({ rank, ...photo }) => photo)
    .sort((a, b) => b.time - a.time).slice(0, 24)
}

export function buildPhotoMetadata(cfg, elements, check, notes, prompt, timestamp = Date.now()) {
  return {
    version: 1,
    createdAt: new Date(timestamp).toISOString(),
    model: String(cfg.模型 || ''),
    quality: String(cfg.清晰度 || DEFAULT_CONFIG.清晰度),
    aspect: String(cfg.画幅 || DEFAULT_CONFIG.画幅),
    prompt: String(prompt || '').slice(0, 1200),
    context: {
      type: String(elements?.type || 'character'),
      clock: String(elements?.clock || ''),
      location: String(elements?.location || ''),
      activity: String(elements?.state?.what || elements?.hint || ''),
      outfit: String(elements?.outfit || ''),
      expression: String(elements?.expression || ''),
      light: String(elements?.light || ''),
    },
    check: check || null,
    notes: Array.isArray(notes) ? notes.map(String).slice(0, 4) : [],
  }
}

function writePhotoMetadata(result, cfg, elements, check, notes, prompt) {
  if (!result?.original) return null
  const timestamp = Number(photoTimestamp(basename(result.original))) || Date.now()
  const metadata = buildPhotoMetadata(cfg, elements, check, notes, prompt, timestamp)
  const path = result.original.replace(/\.(?:png|jpe?g|webp)$/i, '.json')
  const temp = path + '.tmp'
  try {
    writeFileSync(temp, JSON.stringify(metadata, null, 2), 'utf8')
    renameSync(temp, path)
    return metadata
  } catch {
    try { unlinkSync(temp) } catch {}
    return null
  }
}

/** Saved-today count and last shot time (retakes and character refs don't count). */
function todayUsage(cfg) {
  try {
    let tz = 'Asia/Shanghai'
    try { tz = mediaTimeZone() } catch {}
    const today = mediaZonedNow(new Date(), tz).ymd
    const todayShots = new Set()
    let last = 0
    for (const dir of photoDirs(cfg)) {
      let files = []
      try { files = readdirSync(dir) } catch {}
      for (const f of files) {
        if (!originalPhoto.test(f)) continue
        const st = statSync(join(dir, f))
        if (mediaZonedNow(new Date(st.mtimeMs), tz).ymd === today) todayShots.add(photoTimestamp(f))
        last = Math.max(last, st.mtimeMs)
      }
    }
    return { n: todayShots.size, last }
  } catch { return { n: 0, last: 0 } }
}

/** Keep a high-quality sharing copy while retaining the untouched original. */
async function shrink(imagePath) {
  try {
    const jpg = imagePath.replace(/\.(?:png|jpe?g|webp)$/i, '-small.jpg')
    await execFileAsync('convert', [
      imagePath, '-auto-orient', '-resize', '2048x2048>', '-strip',
      '-sampling-factor', '4:4:4', '-quality', '93', jpg,
    ], { timeout: 30000 })
    const st = statSync(jpg)
    return st.size > 0 ? jpg : imagePath
  } catch { return imagePath }
}

const thumbnailJobs = new Map()

async function ensurePhotoThumbnail(imagePath) {
  const thumbnail = imagePath.replace(/\.(?:png|jpe?g|webp)$/i, '-thumb.jpg')
  const reduced = imagePath.replace(/\.(?:png|jpe?g|webp)$/i, '-small.jpg')
  const legacyReduced = imagePath.replace(/\.(?:png|webp)$/i, '.jpg')
  const source = [reduced, legacyReduced, imagePath].find((candidate) => {
    try { return statSync(candidate).size > 0 } catch { return false }
  }) || imagePath
  try {
    if (statSync(thumbnail).mtimeMs >= statSync(imagePath).mtimeMs) return thumbnail
  } catch {}
  if (thumbnailJobs.has(thumbnail)) return thumbnailJobs.get(thumbnail)
  const job = (async () => {
    const temp = thumbnail.replace(/\.jpg$/i, `.${process.pid}-${Date.now()}.tmp.jpg`)
    try {
      await execFileAsync('convert', [source, '-auto-orient', '-thumbnail', '480x480>', '-strip', '-quality', '78', temp], { timeout: 30000 })
      if (statSync(temp).size <= 0) throw new Error('empty thumbnail')
      renameSync(temp, thumbnail)
      return thumbnail
    } catch {
      try { unlinkSync(temp) } catch {}
      return source
    } finally {
      thumbnailJobs.delete(thumbnail)
    }
  })()
  thumbnailJobs.set(thumbnail, job)
  return job
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

export function buildImageRequest(cfg, prompt) {
  const quality = Object.hasOwn(sizeByQuality, cfg.清晰度) ? cfg.清晰度 : DEFAULT_CONFIG.清晰度
  const sizes = sizeByQuality[quality]
  const body = {
    model: cfg.模型,
    prompt,
    size: sizes[cfg.画幅] || sizes.竖幅,
    response_format: 'url',
    watermark: false,
    optimize_prompt_options: { mode: 'standard' },
  }
  // Seedream 5.x supports explicit lossless output. Older selectable models
  // keep their native format so a compatibility fallback cannot be rejected.
  if (/seedream-5-/i.test(String(cfg.模型 || ''))) body.output_format = 'png'
  return body
}

const NO_TEXT_PROMPT = '画面里不要出现任何文字、水印、签名'

function boundedPrompt(value, max = 900) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const withoutTail = text.replace(/[；。]?画面里不要出现任何文字、水印、签名[；。]?$/u, '')
  const tail = `；${NO_TEXT_PROMPT}`
  return withoutTail.slice(0, Math.max(1, max - tail.length)).replace(/[，、；。\s]+$/u, '') + tail
}

export function composeImagePrompt(expanded, useRef = true, useStyleRef = true) {
  const identity = useRef
    ? '以输入参考图确认人物身份：保持同一张脸、稳定的五官比例、瞳色、基础发色和有辨识度的身体特征；发型扎法、刘海整理、碎发、湿润与凌乱程度可按当前生活自然变化，不锁死发型轮廓；参考图中的姿势、服装、帽子和可拆卸饰品不自动继承；'
    : ''
  const style = useStyleRef
    ? (useRef
        ? '画风严格延续输入参考图：细腻清透的日系二次元插画，轻盈干净线稿，柔和低饱和蓝白色感，平滑赛璐璐与轻厚涂融合，发丝有通透渐变和细微高光，肤色与阴影克制柔和；不要转成写实、3D、Q版或其他画风；'
        : '只借鉴输入参考图的画风，不画参考图中的人物：细腻清透的日系二次元插画，轻盈干净线稿，柔和低饱和色感，平滑赛璐璐与轻厚涂融合，材质和光影克制柔和；不要转成写实、3D、Q版或其他画风；')
    : ''
  const body = identity + style + String(expanded || '')
  const withTail = body.includes(NO_TEXT_PROMPT) ? body : `${body}；${NO_TEXT_PROMPT}`
  return boundedPrompt(withTail, 900)
}

function composeRetakePrompt(base, check) {
  const correction = [
    ...(check?.problems || []).slice(0, 3),
    check?.fix || '',
  ].filter(Boolean).join('；')
  if (!correction) return boundedPrompt(base, 900)
  const suffix = `；修正要求：${boundedPrompt(correction, 240)}`
  return boundedPrompt(base, 900 - suffix.length) + suffix
}

async function arkGenerate(cfg, prompt, opts = {}) {
  const ark = JSON.parse(readFileSync(ARK_CFG, 'utf8'))
  const body = buildImageRequest(cfg, prompt)
  const refs = (cfg.用参考图 && (opts.useRef !== false || opts.useStyleRef === true)) ? readRefImages(cfg) : []
  if (refs.length) body.image = refs
  const timeoutMs = Math.max(30, Math.min(600, Number(cfg.生图超时秒) || 120)) * 1000
  const r = await fetch(ark.baseUrl.replace(/\/+$/, '') + '/images/generations', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + ark.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: timeoutSignal(timeoutMs),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error('方舟 ' + r.status + '：' + JSON.stringify(data).slice(0, 220))
  const url = data?.data?.[0]?.url
  if (!url) throw new Error('方舟返回里没有图片：' + JSON.stringify(data).slice(0, 200))
  const img = await fetch(url, { signal: timeoutSignal(timeoutMs) })
  if (!img.ok) throw new Error('下载失败 ' + img.status)
  const buf = Buffer.from(await img.arrayBuffer())
  const format = detectImageFormat(buf, img.headers.get('content-type'))
  if (!format) throw new Error('下载结果不是支持的 PNG、JPEG 或 WebP 图片')
  const dir = String(cfg.存图目录 || '').trim() || OUT_DIR
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `feiyu-${Date.now()}.${format.ext}`)
  writeFileSync(path, buf)
  const small = await shrink(path)
  const thumbnail = await ensurePhotoThumbnail(path)
  return { path: small, original: path, thumbnail, bytes: statSync(small).size, prompt }
}

/** Rename a retaken bad shot so it keeps for review but doesn't count against today's limit. */
function markRetake(result) {
  const rename = (p) => String(p).replace(/([\\/]feiyu-)(\d+)(-(?:small|thumb))?\.(png|jpe?g|webp)$/i, '$1retry-$2$3.$4')
  if (!result) return
  const nextOriginal = rename(result.original)
  const nextSmall = rename(result.path)
  const nextThumbnail = result.thumbnail ? rename(result.thumbnail) : ''
  const metadata = String(result.original).replace(/\.(?:png|jpe?g|webp)$/i, '.json')
  const nextMetadata = metadata.replace(/([\\/]feiyu-)(\d+)(\.json)$/i, '$1retry-$2$3')
  try { if (nextOriginal !== result.original) renameSync(result.original, nextOriginal) } catch {}
  try { if (nextSmall !== result.path && nextSmall !== nextOriginal) renameSync(result.path, nextSmall) } catch {}
  try { if (nextThumbnail && nextThumbnail !== result.thumbnail) renameSync(result.thumbnail, nextThumbnail) } catch {}
  try { if (nextMetadata !== metadata) renameSync(metadata, nextMetadata) } catch {}
  result.original = nextOriginal
  result.path = nextSmall
  if (nextThumbnail) result.thumbnail = nextThumbnail
}

/** Shoot, then look at the result; retake with the problems fed back (max 1 by default). */
async function shootAndCheck(ctx, cfg, { prompt, useRef, useStyleRef, elements }) {
  const retakeLimit = Math.max(0, Math.min(2, Number(cfg.自检重拍 ?? 1)))
  const attempts = 1 + retakeLimit
  const notes = []
  let last = null
  let check = null
  let current = ''
  const referencePaths = (useRef || useStyleRef) ? referenceImageFiles(cfg).slice(0, 3) : []
  for (let i = 0; i < attempts; i++) {
    current = i === 0 ? boundedPrompt(prompt, 900) : composeRetakePrompt(prompt, check)
    const r = await generateImage(cfg, current, { useRef, useStyleRef })
    last = r
    if (cfg.出图自检 === false) { notes.push('自检关着，没看'); break }
    check = await checkImage(ctx, findSession(ctx), cfg, r.path, elements, useRef, referencePaths, useStyleRef, prompt)
    if (!check) { notes.push('自检没跑成，这张没验'); break }
    if (check.pass) { notes.push(i === 0 ? '自检过了' : `第 ${i + 1} 张过了`); break }
    notes.push(`第 ${i + 1} 张不合格：${check.problems.join('；') || '（没说出具体问题）'}`)
    if (i < attempts - 1) {
      markRetake(last)
    }
  }
  const metadata = writePhotoMetadata(last, cfg, elements, check, notes, current)
  return { ...last, check, notes, prompt: current, metadata }
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
      signal: timeoutSignal(30000),
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

let shooting = false
// Cooldown belongs to deliberate shots, not internal retakes: retakes update image
// mtimes, so deriving the gap from files would push the next shot back every time a
// self-check fails. Track the start of the last deliberate shot instead.
let lastShotAt = 0

function shotBlocked(cfg) {
  const usage = todayUsage(cfg)
  if (usage.n >= cfg.每日上限) return `今天已经拍了 ${usage.n} 张，达到上限`
  const last = lastShotAt || usage.last
  const waitMs = cfg.最短间隔秒 * 1000 - (Date.now() - last)
  if (waitMs > 0) return `刚拍过，再等 ${Math.ceil(waitMs / 1000)} 秒`
  return ''
}

// ── settings routes ─────────────────────────────────────────────────
const ROUTE_PREFIX = '/dsh-feiyu-life/image'

function registerRoutes(ctx) {
  const onlyOwner = (handler) => async (req, res) => {
    try {
      const rejection = ctx.connection.requestRejection(req)
      if (rejection !== undefined) {
        const code = Number.isInteger(rejection) && rejection >= 400 && rejection <= 599 ? rejection : 403
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: false, error: String(code) }))
        return
      }
    } catch {
      res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ ok: false, error: 'connection_guard_unavailable' }))
      return
    }
    return handler(req, res)
  }
  const reply = (res, code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(obj))
  }
  const readBody = async (req) => {
    let b = ''
    for await (const c of req) {
      b += c
      if (b.length > 1024 * 1024) throw new Error('request body too large')
    }
    try { return JSON.parse(b || '{}') } catch { return undefined }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: ROUTE_PREFIX + '/state',
    handler: onlyOwner(async (req, res) => {
      if (req.method !== 'GET') return reply(res, 405, { ok: false })
      const cfg = readImageConfig()
      const usage = todayUsage(cfg)
      const referenceFiles = referenceImageFiles(cfg)
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
        hasRef: referenceFiles.length > 0,
        refCount: referenceFiles.length,
        refNames: referenceFiles.map((path) => basename(path)),
      })
    }),
  }), 'feiyu-life: image state')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: ROUTE_PREFIX + '/save',
    handler: onlyOwner(async (req, res) => {
      if (req.method !== 'POST') return reply(res, 405, { ok: false })
      let body
      try { body = await readBody(req) } catch (e) { return reply(res, 413, { ok: false, error: String(e.message || e) }) }
      if (!body || typeof body !== 'object') return reply(res, 400, { ok: false, error: 'bad json' })
      const patch = body.config && typeof body.config === 'object' ? body.config : body
      try {
        const cfg = saveImageConfig(patch)
        return reply(res, 200, { ok: true, config: cfg })
      } catch (e) { return reply(res, 500, { ok: false, error: String(e.message || e) }) }
    }),
  }), 'feiyu-life: image save')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: ROUTE_PREFIX + '/test',
    handler: onlyOwner(async (req, res) => {
      if (req.method !== 'POST') return reply(res, 405, { ok: false })
      let body
      try { body = await readBody(req) || {} } catch (e) { return reply(res, 413, { ok: false, error: String(e.message || e) }) }
      const cfg = readImageConfig()
      const blocked = shotBlocked(cfg)
      if (blocked) return reply(res, 429, { ok: false, error: blocked })
      if (shooting) return reply(res, 409, { ok: false, error: '已有一张照片正在生成' })
      shooting = true
      lastShotAt = Date.now()
      try {
        const expanded = await generatePrompt(ctx, findSession(ctx), cfg, {
          type: body.type || 'character',
        })
        const useRef = expanded.useRef
        const useStyleRef = expanded.useStyleRef
        const prompt = composeImagePrompt(expanded.prompt, useRef, useStyleRef)
        const r = await shootAndCheck(ctx, cfg, { prompt, useRef, useStyleRef, elements: expanded.elements })
        return reply(res, 200, {
          ok: true, image: r.path, prompt: r.prompt, bytes: r.bytes,
          check: r.check, notes: r.notes, metadata: r.metadata,
        })
      } catch (e) { return reply(res, 500, { ok: false, error: String((e && e.message) || e).slice(0, 300) }) }
      finally { shooting = false }
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
      if (req.method !== 'GET') return reply(res, 405, { ok: false })
      const url = new URL(req.url || '/', 'http://x')
      const name = url.searchParams.get('n') || ''
      if (!/^feiyu-[\w-]+\.(?:png|jpe?g|webp)$/i.test(name) && !/^[\u4e00-\u9fa5\w-]+\.(?:jpe?g|png|webp)$/i.test(name)) return reply(res, 400, { ok: false })
      const cfg = readImageConfig()
      const candidates = []
      for (const dir of photoDirs(cfg)) candidates.push(join(dir, name))
      candidates.push(join(OUT_DIR, '角色设定', name), join(LEGACY_OUT_DIR, '角色设定', name))
      for (const p of candidates) {
        try {
          statSync(p)
          const servedPath = url.searchParams.get('thumb') === '1' ? await ensurePhotoThumbnail(p) : p
          const buf = readFileSync(servedPath)
          // Old releases could save JPEG/WebP bytes under a .png suffix. Sniff
          // the response too so those existing photos remain viewable.
          const mime = detectImageFormat(buf)?.mime || imageMimeForPath(servedPath)
          const isThumbnail = url.searchParams.get('thumb') === '1'
          const cache = isThumbnail && servedPath !== p ? 'public, max-age=86400, immutable' : 'public, max-age=3600'
          res.writeHead(200, { 'content-type': mime, 'content-length': buf.length, 'cache-control': cache })
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
    description: '拍下此刻的角色生活照或场景照。根据自己想记录的瞬间选择视角、距离和姿态，可用 framing 简述选择；地点、活动、穿着与人物参考由相机提供。拿到路径后可单独发 ![照片](路径)，无需配文。只有这张照片有特别想说的事时再写，别习惯性点评自己的外表。',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['character', 'scene', 'selfie'], description: 'character=角色生活照（默认），scene=只拍场景，selfie 兼容旧调用' },
        framing: { type: 'string', maxLength: 120, description: '可选。角色此次想怎样入画，比如沿树影走远时的全身背影。留空由扩写模型选择。' },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, image: { type: 'string' }, say: { type: 'string' }, prompt: { type: 'string' }, check: { type: 'object' }, notes: { type: 'array' }, metadata: { type: 'object' } }, additionalProperties: true },
      render: (_a, v) => [{ type: 'text', text: v?.ok && v.image ? '可直接发送：![照片](' + v.image + ')' : String(v?.say || '') }],
    },
    async execute(rawArgs = {}) {
      const args = {
        type: rawArgs.type ?? rawArgs.类型,
        framing: rawArgs.framing,
      }
      const cfg = readImageConfig()
      if (!cfg.总开关) return { ok: false, say: '相机没开' }
      const blocked = shotBlocked(cfg)
      if (blocked) return { ok: false, say: blocked }
      if (shooting) return { ok: false, say: '已经有一张照片正在生成，等它拍完' }
      shooting = true
      lastShotAt = Date.now()
      try {
        const expanded = await generatePrompt(ctx, findSession(ctx), cfg, args)
        const useRef = expanded.useRef
        const useStyleRef = expanded.useStyleRef
        const prompt = composeImagePrompt(expanded.prompt, useRef, useStyleRef)
        const r = await shootAndCheck(ctx, cfg, { prompt, useRef, useStyleRef, elements: expanded.elements })
        const flawed = r.check && r.check.pass === false
          ? `（这张还不太对：${(r.check.problems[0] || '画面有问题')}）`
          : ''
        const out = {
          ok: true,
          image: r.path,
          say: `拍好了（${Math.round(r.bytes / 1024)}KB）${expanded.usedModel ? '' : '（模板扩写）'}${flawed}`,
          prompt: r.prompt,
          notes: r.notes,
          metadata: r.metadata,
        }
        if (r.check) out.check = r.check
        return out
      } catch (e) {
        return { ok: false, say: '没拍成：' + String((e && e.message) || e).slice(0, 160) }
      } finally { shooting = false }
    },
  }), 'feiyu-life: shoot')
}

