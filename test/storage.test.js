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
import { cleanupPhotos, normalizeImageConfig, IMAGE_CONFIG_VERSION } from '../image.js'

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
})

test('photo cleanup removes only expired plugin images', () => {
  const dir = mkdtempSync(join(tmpdir(), 'feiyu-photos-'))
  try {
    const generated = join(dir, 'feiyu-100.png')
    const retry = join(dir, 'feiyu-retry-99.jpg')
    const reference = join(dir, '正面.jpg')
    const unrelated = join(dir, 'holiday.png')
    for (const path of [generated, retry, reference, unrelated]) writeFileSync(path, 'x')
    const old = new Date('2020-01-02T00:00:00Z')
    for (const path of [generated, retry, reference, unrelated]) utimesSync(path, old, old)
    assert.equal(cleanupPhotos({ 存图目录: dir, 照片保留天数: 90 }, Date.parse('2026-11-12T00:00:00Z')), 2)
    assert.equal(existsSync(generated), false)
    assert.equal(existsSync(retry), false)
    assert.equal(existsSync(reference), true)
    assert.equal(existsSync(unrelated), true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
