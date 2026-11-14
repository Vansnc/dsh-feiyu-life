import { migrateImageConfig, normalizeImageConfig } from './image.js'
import { migrateConfig, validateConfig } from './life.js'

export const SETTINGS_BACKUP_FORMAT = 'dsh-feiyu-life-settings'
export const SETTINGS_BACKUP_VERSION = 1

const record = (value) => value && typeof value === 'object' && !Array.isArray(value)

/** Create a portable settings-only backup. Plans, photos and logs stay local. */
export function createSettingsBackup(life, camera, now = new Date()) {
  return {
    format: SETTINGS_BACKUP_FORMAT,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: now.toISOString(),
    life,
    camera,
  }
}

/** Validate and normalize an untrusted backup before anything is written. */
export function restoreSettingsBackup(input) {
  if (!record(input)) throw new Error('备份内容不是对象')
  if (input.format !== SETTINGS_BACKUP_FORMAT) throw new Error('不是鱼的生活设置备份')
  if (Number(input.version) !== SETTINGS_BACKUP_VERSION) throw new Error(`暂不支持备份版本 ${String(input.version ?? '')}`)
  if (!record(input.life) || !record(input.camera)) throw new Error('备份缺少生活配置或相机配置')

  const checked = validateConfig(migrateConfig(input.life).value)
  const camera = normalizeImageConfig(migrateImageConfig(input.camera).value)
  return {
    life: checked.config,
    camera,
    issues: checked.issues,
    summary: {
      exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : '',
      lifeVersion: checked.config.配置版本,
      cameraVersion: camera.配置版本,
      places: Array.isArray(checked.config.地图?.地点) ? checked.config.地图.地点.length : 0,
    },
  }
}
