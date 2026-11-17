import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  configPath, defaultConfig, LIFE_CONFIG_VERSION, migrateConfig, normalizeConfig,
  readConfig, replaceConfig, saveConfig, validateConfig,
} from '../life.js'

function withHome(fn) {
  const old = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'feiyu-life-config-'))
  try { return fn() } finally {
    if (old === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = old
  }
}

test('life config contract keeps version, paths, defaults and required groups', () => withHome(() => {
  assert.equal(LIFE_CONFIG_VERSION, 12)
  assert.equal(configPath(), join(process.env.DSH_HOME, 'feiyu-life-config.json'))
  const cfg = normalizeConfig({})
  assert.equal(cfg.配置版本, 12)
  for (const key of ['衣柜', '主动分享', '内在', '连续性', '人格', '课表', '日常']) assert.ok(cfg[key], key)
  assert.deepEqual(cfg.衣柜.sleep, defaultConfig.衣柜.sleep)
  assert.equal(cfg.主动分享.启用, true)
  assert.equal(cfg.内在.启用, true)
  assert.equal(cfg.连续性.启用, true)
}))

test('config normalization reports errors and strips unknown legacy event pool', () => {
  const issues = []
  const cfg = normalizeConfig({ 事件池: ['x'], 衣柜: { class: ['藏青卫衣'] }, 主动分享: { 每日上限: 99 } }, issues)
  assert.equal(Object.hasOwn(cfg, '事件池'), false)
  assert.equal(cfg.衣柜.class[0], '藏青卫衣')
  assert.ok(cfg.主动分享.每日上限 <= 6)
  assert.ok(issues.length > 0)
  const checked = validateConfig({ 时区: 'Not/AZone', 日常: 'bad' })
  assert.ok(checked.issues.length > 0)
  assert.equal(checked.config.时区, 'Asia/Shanghai')
})

test('old config versions migrate forward without changing the public root API', async () => {
  const old = migrateConfig({ 配置版本: 1, 日常: [], 衣柜: { class: ['旧卫衣'] } })
  assert.equal(old.value.配置版本, 12)
  assert.ok(Array.isArray(old.value.工作区))
  assert.ok(old.changed)
  const cfg = normalizeConfig(old.value)
  assert.equal(cfg.衣柜.class[0], '旧卫衣')
  const root = await import('../life.js')
  for (const name of ['configPath', 'defaultConfig', 'LIFE_CONFIG_VERSION', 'normalizeConfig', 'validateConfig', 'migrateConfig', 'readConfig', 'saveConfig', 'replaceConfig']) {
    assert.equal(typeof root[name] !== 'undefined', true, name)
  }
})

test('atomic config read/save/replace keeps persistence path and merge semantics', () => withHome(() => {
  const first = readConfig()
  assert.equal(first.配置版本, 12)
  const saved = saveConfig({ 角色设定: '测试角色' })
  assert.equal(saved.角色设定, '测试角色')
  const disk = JSON.parse(readFileSync(configPath(), 'utf8'))
  assert.equal(disk.角色设定, '测试角色')
  const replaced = replaceConfig({ ...saved, 角色设定: '替换角色' })
  assert.equal(replaced.角色设定, '替换角色')
  assert.equal(JSON.parse(readFileSync(configPath(), 'utf8')).角色设定, '替换角色')
  assert.equal(readConfig().角色设定, '替换角色')
}))
