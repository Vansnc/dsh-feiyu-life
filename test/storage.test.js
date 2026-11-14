import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  writePlan, planPath, archivePlan, listPlanHistory, restoreLatestPlan, cleanupPlans,
} from '../plan.js'
import {
  addAdjustment, factsPath, listAdjustments, removeAdjustment, cleanupFacts,
} from '../state.js'
import {
  buildImageRequest, buildPhotoMetadata, cleanupPhotos, composeImagePrompt, detectImageFormat,
  normalizeImageConfig, photoMetadataName, photoThumbnailName, referenceImageFiles,
  IMAGE_CONFIG_VERSION,
} from '../image.js'

test('regeneration history restores the previous plan and adjustments are removable', () => {
  const dir = mkdtempSync(join(tmpdir(), 'feiyu-storage-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try {
    const date = '2026-11-12'
    assert.equal(writePlan(date, { title: '旧剧本', items: [{ start: 0, end: 60, what: '睡觉' }] }), true)
    assert.ok(archivePlan(date))
    assert.equal(listPlanHistory(date).length, 1)
    assert.equal(writePlan(date, { title: '新剧本', items: [{ start: 0, end: 60, what: '起床' }] }), true)
    assert.equal(restoreLatestPlan(date), true)
    assert.equal(JSON.parse(readFileSync(planPath(date), 'utf8')).title, '旧剧本')
    assert.equal(listPlanHistory(date).length, 0)

    assert.equal(addAdjustment(date, { start: 1, end: 2, what: '出门' }), true)
    const item = listAdjustments(date)[0]
    assert.ok(item.id)
    assert.equal(removeAdjustment(date, { id: item.id }), true)
    assert.deepEqual(listAdjustments(date), [])
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    rmSync(dir, { recursive: true, force: true })
  }
})

test('expired plan and adjustment files are cleaned by retention policy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'feiyu-cleanup-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try {
    const date = '2020-01-01'
    writePlan(date, { items: [{ start: 0, end: 60, what: '旧计划' }] })
    addAdjustment(date, { start: 1, end: 2, what: '旧调整' })
    const old = new Date('2020-01-02T00:00:00Z')
    utimesSync(planPath(date), old, old)
    utimesSync(factsPath(date), old, old)
    assert.equal(cleanupPlans(7, Date.parse('2026-11-12T00:00:00Z')), 1)
    assert.equal(cleanupFacts(7, Date.parse('2026-11-12T00:00:00Z')), 1)
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    rmSync(dir, { recursive: true, force: true })
  }
})

test('image configuration has an explicit version and bounded timeouts', () => {
  const cfg = normalizeImageConfig({ 配置版本: 0, 模型超时秒: 2, 生图超时秒: 9999, 照片保留天数: 0 })
  assert.equal(cfg.配置版本, IMAGE_CONFIG_VERSION)
  assert.equal(cfg.模型超时秒, 10)
  assert.equal(cfg.生图超时秒, 600)
  assert.equal(cfg.照片保留天数, 90)
  assert.equal(cfg.清晰度, '2K')
})

test('camera requests use detailed 2K lossless output without oversized prompts', () => {
  const cfg = normalizeImageConfig({ 模型: 'doubao-seedream-5-0-pro-260628', 画幅: '竖幅', 清晰度: '2K' })
  const body = buildImageRequest(cfg, '清晰的角色自拍')
  assert.equal(body.size, '1776x2368')
  assert.equal(body.output_format, 'png')
  assert.deepEqual(body.optimize_prompt_options, { mode: 'standard' })
  const prompt = composeImagePrompt('细节很多；'.repeat(100), true)
  assert.ok(prompt.length <= 300)
  assert.match(prompt, /保持参考图/)
  assert.match(prompt, /不要出现任何文字、水印、签名$/)
})

test('downloaded images are identified by bytes instead of URL suffixes', () => {
  assert.deepEqual(detectImageFormat(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), { ext: 'png', mime: 'image/png' })
  assert.deepEqual(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), { ext: 'jpg', mime: 'image/jpeg' })
  assert.deepEqual(detectImageFormat(Buffer.from('RIFFxxxxWEBP')), { ext: 'webp', mime: 'image/webp' })
  assert.equal(detectImageFormat(Buffer.from('opaque'), 'image/webp; charset=binary'), null)
  assert.equal(detectImageFormat(Buffer.from('<html>bad gateway</html>'), 'text/html'), null)
})

test('gallery thumbnails have a stable cacheable filename', () => {
  assert.equal(photoThumbnailName('feiyu-123.png'), 'feiyu-123-thumb.jpg')
  assert.equal(photoThumbnailName('feiyu-123.webp'), 'feiyu-123-thumb.jpg')
  assert.equal(photoMetadataName('feiyu-123.webp'), 'feiyu-123.json')
})

test('character reference library accepts a directory and prioritizes canonical views', () => {
  const dir = mkdtempSync(join(tmpdir(), 'feiyu-refs-'))
  try {
    for (const name of ['背面.webp', '其他.png', '侧面.jpg', '正面.png', '说明.txt']) writeFileSync(join(dir, name), 'x')
    assert.deepEqual(referenceImageFiles({ 参考图: dir }).map((path) => path.split('/').pop()), [
      '正面.png', '侧面.jpg', '背面.webp', '其他.png',
    ])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('photo metadata keeps the exact life context used by the camera', () => {
  const metadata = buildPhotoMetadata(
    { 模型: 'seedream-pro', 清晰度: '2K', 画幅: '竖幅' },
    {
      type: 'selfie', clock: '16:20', location: '咖啡屋', outfit: '蓝色女仆裙', expression: '浅笑',
      light: '午后侧光', state: { what: '坐在窗边改稿' },
    },
    { pass: true, problems: [] }, ['自检过了'], '一张清晰的自拍', Date.parse('2026-11-14T08:20:00Z'),
  )
  assert.equal(metadata.context.location, '咖啡屋')
  assert.equal(metadata.context.activity, '坐在窗边改稿')
  assert.equal(metadata.context.clock, '16:20')
  assert.equal(metadata.quality, '2K')
  assert.equal(metadata.check.pass, true)
})

test('photo cleanup removes only expired plugin images', () => {
  const dir = mkdtempSync(join(tmpdir(), 'feiyu-photos-'))
  try {
    const generated = join(dir, 'feiyu-100.png')
    const retry = join(dir, 'feiyu-retry-99.jpg')
    const thumbnail = join(dir, 'feiyu-100-thumb.jpg')
    const metadata = join(dir, 'feiyu-100.json')
    const reference = join(dir, '正面.jpg')
    const unrelated = join(dir, 'holiday.png')
    for (const path of [generated, retry, thumbnail, metadata, reference, unrelated]) writeFileSync(path, 'x')
    const old = new Date('2020-01-02T00:00:00Z')
    for (const path of [generated, retry, thumbnail, metadata, reference, unrelated]) utimesSync(path, old, old)
    assert.equal(cleanupPhotos({ 存图目录: dir, 照片保留天数: 90 }, Date.parse('2026-11-12T00:00:00Z')), 4)
    assert.equal(existsSync(generated), false)
    assert.equal(existsSync(retry), false)
    assert.equal(existsSync(thumbnail), false)
    assert.equal(existsSync(metadata), false)
    assert.equal(existsSync(reference), true)
    assert.equal(existsSync(unrelated), true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
