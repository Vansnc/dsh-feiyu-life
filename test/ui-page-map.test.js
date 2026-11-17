import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defaultConfig } from '../src/life/life.js'
import { groupSections, tabs } from '../src/ui/constants.js'

const MAP = {
  此刻: ['总开关'],
  生活: ['角色设定','衣柜','校历','节日','经期','偏离','日常','晚起','假期','备考','晚起日','课表'],
  内在: ['人格','内在','连续性'],
  主动: ['主动分享'],
  世界: ['地图'],
  相机: [],
  数据: ['工作区','模型超时秒','历史保留天数','时区'],
}

test('every life config key has exactly one settings page owner', () => {
  const assigned = []
  for (const keys of Object.values(MAP)) assigned.push(...keys)
  for (const key of Object.keys(defaultConfig).filter((x) => x !== '配置版本')) {
    assert.equal(assigned.filter((x) => x === key).length, 1, key)
  }
  assert.equal(assigned.length, Object.keys(defaultConfig).length - 1)
})

test('grouped navigation keeps all legacy sections addressable', () => {
  assert.deepEqual(tabs.map(([k]) => k), ['now','life','inner','proactive','world','camera','data'])
  const sections = Object.values(groupSections).flat().map(([k]) => k)
  for (const key of ['share','persona','inner','continuity','replay','map','year','week','day','body','photo','data']) {
    assert.ok(sections.includes(key), key)
  }
})

test('UI source modules and generated entry keep the DSH contract', () => {
  const entry = readFileSync(new URL('../src/ui/client.js', import.meta.url), 'utf8')
  const app = readFileSync(new URL('../src/ui/app.js', import.meta.url), 'utf8')
  const root = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  assert.match(entry, /window\.__ModuleLoader__\.load/)
  assert.match(entry, /createUI\(require\)/)
  assert.match(app, /export function createUI/)
  assert.match(root, /GENERATED from src\/ui\/client\.js/)
  assert.doesNotMatch(entry, /dsh-feiyu-image|dsh-bili-subagent/)
})
