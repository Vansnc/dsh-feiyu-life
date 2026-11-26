export const phoneOptions = ['在手', '静音', '在床头', '不在手边']
export const routineTables = [['日常', '日常（有课的日子）'], ['晚起', '晚起（周四那种）'], ['假期', '假期'], ['备考', '备考（考试周）']]
export const wardrobeLabels = [['sleep', '睡觉'], ['bath', '洗澡'], ['class', '上课'], ['home', '在家'], ['out', '出门'], ['eat', '吃饭']]
export const weekdayNames = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
export const UI_ASSET_VERSION = '2.7.5'
export const SETTINGS_BACKUP_VERSIONS = [1, 2]

export const tabs = [['now', '此刻'], ['life', '生活'], ['inner', '内在'], ['proactive', '主动'], ['world', '世界'], ['camera', '相机'], ['data', '数据']]
export const groupSections = {
  now: [],
  life: [['day', '作息'], ['week', '课表'], ['year', '年度'], ['body', '身体']],
  inner: [['persona', '人格'], ['inner', '内在'], ['continuity', '连续性']],
  proactive: [['share', '分享']],
  world: [['map', '地图'], ['replay', '回放']],
  camera: [['photo', '照片']],
  data: [['data', '数据']],
}

export const firstTabForGroup = (group) => groupSections[group]?.[0]?.[0] || group
export const isSupportedSettingsBackup = (value) => Boolean(
  value
  && value.format === 'dsh-feiyu-life-settings'
  && SETTINGS_BACKUP_VERSIONS.includes(Number(value.version))
  && value.life
  && value.camera
  && (Number(value.version) === 1 || (value.mind && typeof value.mind === 'object' && !Array.isArray(value.mind))),
)
