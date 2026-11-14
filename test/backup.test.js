import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createSettingsBackup, restoreSettingsBackup, SETTINGS_BACKUP_FORMAT,
} from '../backup.js'

test('settings backup round-trips life and camera configuration', () => {
  const backup = createSettingsBackup({
    时区: 'Asia/Shanghai',
    日常: [['00:00', '24:00', '睡着了', '在床头']],
    地图: { 地点: [{ id: 'a' }, { id: 'b' }] },
  }, { 配置版本: 1, 每日上限: 12, 清晰度: '2K', 种子: 42, 后端: 'legacy' }, new Date('2026-11-14T12:00:00.000Z'))

  assert.equal(backup.format, SETTINGS_BACKUP_FORMAT)
  assert.equal(backup.exportedAt, '2026-11-14T12:00:00.000Z')
  const restored = restoreSettingsBackup(JSON.parse(JSON.stringify(backup)))
  assert.equal(restored.life.时区, 'Asia/Shanghai')
  assert.equal(restored.camera.每日上限, 12)
  assert.equal(restored.camera.配置版本, 3)
  assert.equal(Object.hasOwn(restored.camera, '种子'), false)
  assert.equal(Object.hasOwn(restored.camera, '后端'), false)
  assert.ok(restored.summary.places >= 2)
})

test('settings restore rejects unrelated or future backup files', () => {
  assert.throws(() => restoreSettingsBackup({}), /不是鱼的生活设置备份/)
  assert.throws(() => restoreSettingsBackup({
    format: SETTINGS_BACKUP_FORMAT, version: 99, life: {}, camera: {},
  }), /暂不支持备份版本/)
  assert.throws(() => restoreSettingsBackup({
    format: SETTINGS_BACKUP_FORMAT, version: 1, life: {},
  }), /缺少生活配置或相机配置/)
})
