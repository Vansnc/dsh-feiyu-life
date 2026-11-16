import { migrateImageConfig, normalizeImageConfig } from './image.js'
import { migrateConfig, validateConfig } from './life.js'
import { normalizeMind } from './mind.js'

export const SETTINGS_BACKUP_FORMAT = 'dsh-feiyu-life-settings'
export const SETTINGS_BACKUP_VERSION = 2

const record = (value) => value && typeof value === 'object' && !Array.isArray(value)

/** Create a portable settings/personality backup. Plans, photos and event logs stay local. */
export function createSettingsBackup(life, camera, mind, now = new Date()) {
  return {
    format: SETTINGS_BACKUP_FORMAT,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: now.toISOString(),
    life,
    camera,
    mind: normalizeMind(mind, life?.人格, now.getTime()),
  }
}

/** Validate and normalize an untrusted backup before anything is written. */
export function restoreSettingsBackup(input) {
  if (!record(input)) throw new Error('备份内容不是对象')
  if (input.format !== SETTINGS_BACKUP_FORMAT) throw new Error('不是鱼的生活设置备份')
  const version = Number(input.version)
  if (![1, SETTINGS_BACKUP_VERSION].includes(version)) throw new Error(`暂不支持备份版本 ${String(input.version ?? '')}`)
  if (!record(input.life) || !record(input.camera)) throw new Error('备份缺少生活配置或相机配置')

  const checked = validateConfig(migrateConfig(input.life).value)
  const camera = normalizeImageConfig(migrateImageConfig(input.camera).value)
  const mind = version >= 2 ? normalizeMind(input.mind, checked.config.人格) : null
  return {
    life: checked.config,
    camera,
    mind,
    issues: checked.issues,
    summary: {
      exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : '',
      lifeVersion: checked.config.配置版本,
      cameraVersion: camera.配置版本,
      places: Array.isArray(checked.config.地图?.地点) ? checked.config.地图.地点.length : 0,
      memories: mind ? mind.memories.filter((x) => x.status === 'active').length : 0,
    },
  }
}
