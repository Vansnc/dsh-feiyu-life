import test from 'node:test'
import assert from 'node:assert/strict'

import {
  migrateConfig, normalizeConfig, validateConfig, todayDeviation,
  zonedNow, zonedDayStartMs, zonedDateTimeMs, addZonedDays,
} from '../life.js'
import { timeline, toMinute } from '../plan.js'
import { normalizePlan } from '../gen.js'
import { buildTimeline, segmentAt } from '../state.js'

test('configuration is normalized at the save boundary', () => {
  const issues = []
  const cfg = normalizeConfig({
    时区: 'Mars/Olympus',
    偏离: { 躺平日: 3, 出门日: -1, 翘下午课: '0.25' },
    日常: [['09:99', '10:00', '坏时间', '未知']],
  }, issues)
  assert.equal(cfg.时区, 'Asia/Shanghai')
  assert.equal(cfg.配置版本, 4)
  assert.equal(cfg.模型超时秒, 60)
  assert.equal(cfg.历史保留天数, 180)
  assert.deepEqual(cfg.偏离, { 躺平日: 1, 出门日: 0, 翘下午课: 0.25 })
  assert.deepEqual(cfg.日常, [])
  assert.ok(issues.length >= 2)
})

test('v4 migrates only the untouched stock map onto Xueyuan Road', () => {
  const legacyMap = {
    启用: true,
    自动通勤: true,
    地点: [
      { id: 'dorm', x: 16, y: 72 }, { id: 'classroom', x: 48, y: 22 },
      { id: 'library', x: 78, y: 26 }, { id: 'canteen', x: 48, y: 70 },
      { id: 'shop', x: 80, y: 70 }, { id: 'outdoor', x: 17, y: 24 },
    ],
    路径: [{ from: 'dorm', to: 'canteen', minutes: 8 }],
  }
  const migrated = migrateConfig({ 配置版本: 3, 地图: legacyMap }).value
  assert.equal(migrated.配置版本, 4)
  assert.equal(migrated.地图.底图, 'xueyuan-road')
  assert.deepEqual(migrated.地图.地点.map(({ id, x, y }) => ({ id, x, y })), [
    { id: 'dorm', x: 43, y: 61 }, { id: 'classroom', x: 73, y: 31 },
    { id: 'library', x: 58, y: 37 }, { id: 'canteen', x: 55, y: 68 },
    { id: 'shop', x: 84, y: 55 }, { id: 'outdoor', x: 93, y: 55 },
  ])
  assert.ok(migrated.地图.路径.some((edge) => edge.via && edge.via.length))

  const custom = structuredClone(legacyMap)
  custom.地点[0].x = 24
  const kept = migrateConfig({ 配置版本: 3, 地图: custom }).value
  assert.equal(kept.地图.地点[0].x, 24)
  assert.deepEqual(kept.地图.路径, custom.路径)
})

test('validation explains a routine without sleep', () => {
  const checked = validateConfig({ 日常: [['08:00', '09:00', '吃早餐', '在手']] })
  assert.ok(checked.issues.some((x) => x.includes('日常作息') && x.includes('睡')))
})

test('time parser accepts only real clock values', () => {
  assert.equal(toMinute('23:59'), 1439)
  assert.equal(toMinute('24:00'), 1440)
  assert.equal(toMinute('24:01'), -1)
  assert.equal(toMinute('09:61'), -1)
})

test('outing deviation actually changes the generated timeline', () => {
  const cfg = normalizeConfig({
    日常: [['00:00', '24:00', '在宿舍', '在手']],
    课表: {},
    偏离: { 躺平日: 0, 出门日: 1, 翘下午课: 0 },
  })
  const t = { ymd: '2026-11-12', weekday: 4 }
  const deviation = todayDeviation(cfg, t, '日常')
  assert.equal(deviation.outing, true)
  const items = timeline(cfg, t, { routine: '日常', holiday: false }, deviation, { id: 'offDay', name: '没课日' })
  assert.ok(items.some((x) => x.start === 900 && x.what.includes('出门')))
})

test('model plans can end at 24:00 and still require six hours of sleep', () => {
  const plan = normalizePlan({
    title: '普通一天',
    items: [
      { start: '00:00', end: '07:00', what: '睡着了', phone: '在床头', outfit: '睡衣' },
      { start: '07:00', end: '23:00', what: '过一天', phone: '在手', outfit: '卫衣' },
      { start: '23:00', end: '24:00', what: '洗漱', phone: '不在手边', outfit: '睡衣' },
    ],
  })
  assert.equal(plan.items.at(-1).end, 1440)
})

test('model plan keeps only valid explicit location and behaviour fields', () => {
  const plan = normalizePlan({
    items: [
      { start: '00:00', end: '07:00', what: '睡着了', phone: '在床头', outfit: '睡衣', locationId: 'dorm', behavior: 'sleep' },
      { start: '07:00', end: '24:00', what: '过一天', phone: '在手', outfit: '卫衣', locationId: 'nowhere', behavior: 'teleport' },
    ],
  })
  assert.equal(plan.items[0].locationId, 'dorm')
  assert.equal(plan.items[0].behavior, 'sleep')
  assert.equal(plan.items[1].locationId, '')
  assert.equal(plan.items[1].behavior, '')
})

test('an adjustment cleanly overlays the base plan', () => {
  const base = [{ start: 0, end: 120, what: '睡觉', phone: '在床头' }]
  const adjusted = buildTimeline(base, [{ start: 30 * 60000, end: 60 * 60000, what: '醒了', phone: '在手', source: 'adjust' }], 0)
  assert.equal(segmentAt(adjusted, 45 * 60000).what, '醒了')
  assert.equal(segmentAt(adjusted, 90 * 60000).what, '睡觉')
})

test('a newer overlapping adjustment wins without double-matching', () => {
  const timeline = buildTimeline(
    [{ start: 0, end: 180, what: '原计划', phone: '在手' }],
    [
      { start: 30 * 60000, end: 120 * 60000, what: '先出门', source: 'adjust' },
      { start: 60 * 60000, end: 90 * 60000, what: '临时吃饭', source: 'adjust' },
    ],
    0,
  )
  const at75 = timeline.filter((x) => 75 * 60000 >= x.start && 75 * 60000 < x.end)
  assert.equal(at75.length, 1)
  assert.equal(at75[0].what, '临时吃饭')
  assert.equal(segmentAt(timeline, 100 * 60000).what, '先出门')
})

test('timeline preserves explicit semantic fields from plans and adjustments', () => {
  const timeline = buildTimeline(
    [{ start: 0, end: 120, what: '原计划', locationId: 'library', behavior: 'study' }],
    [{ start: 30 * 60000, end: 60 * 60000, what: '临时改主意', locationId: 'shop', behavior: 'idle' }],
    0,
  )
  assert.equal(segmentAt(timeline, 10 * 60000).locationId, 'library')
  assert.equal(segmentAt(timeline, 10 * 60000).behavior, 'study')
  assert.equal(segmentAt(timeline, 45 * 60000).locationId, 'shop')
  assert.equal(segmentAt(timeline, 45 * 60000).behavior, 'idle')
})

test('zoned day boundaries and tomorrow survive DST transitions', () => {
  const tz = 'America/New_York'
  const spring = new Date('2026-03-08T16:00:00Z')
  const springLocal = zonedNow(spring, tz)
  assert.equal(new Date(zonedDayStartMs(spring, springLocal, tz)).toISOString(), '2026-03-08T05:00:00.000Z')
  const springTimeline = buildTimeline(
    [{ start: 90, end: 210, what: '跨过跳时', phone: '在手' }],
    [],
    zonedDayStartMs(spring, springLocal, tz),
    (minute) => zonedDateTimeMs('2026-03-08', minute, tz),
  )
  assert.equal(springTimeline[0].end - springTimeline[0].start, 60 * 60000)

  const fall = new Date('2026-11-01T04:30:00Z')
  assert.equal(zonedNow(addZonedDays(fall, tz, 1), tz).ymd, '2026-11-02')
})
