import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeConfig, validateConfig, todayDeviation,
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
  assert.equal(cfg.配置版本, 3)
  assert.equal(cfg.模型超时秒, 60)
  assert.equal(cfg.历史保留天数, 180)
  assert.deepEqual(cfg.偏离, { 躺平日: 1, 出门日: 0, 翘下午课: 0.25 })
  assert.deepEqual(cfg.日常, [])
  assert.ok(issues.length >= 2)
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
