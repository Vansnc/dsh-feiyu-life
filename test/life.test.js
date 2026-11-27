import test from 'node:test'
import assert from 'node:assert/strict'

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  migrateConfig, normalizeConfig, validateConfig, todayDeviation,
  zonedNow, zonedDayStartMs, zonedDateTimeMs, addZonedDays,
  generate, replyReadiness, lastNightSleep, coldEpisode, vitalityFor,
} from '../src/life/life.js'
import { timeline, timelineCoverage, toMinute, writePlan } from '../src/life/plan.js'
import { buildPrompt, normalizePlan } from '../src/life/gen.js'
import { buildTimeline, segmentAt } from '../src/life/state.js'

test('configuration is normalized at the save boundary', () => {
  const issues = []
  const cfg = normalizeConfig({
    时区: 'Mars/Olympus',
    偏离: { 躺平日: 3, 出门日: -1, 翘下午课: '0.25' },
    日常: [['09:99', '10:00', '坏时间', '未知']],
  }, issues)
  assert.equal(cfg.时区, 'Asia/Shanghai')
  assert.equal(cfg.配置版本, 12)
  assert.equal(cfg.主动分享.每日上限, 2)
  assert.equal(cfg.主动分享.全局冷却分钟, 1440)
  assert.equal(cfg.模型超时秒, 60)
  assert.equal(cfg.历史保留天数, 180)
  assert.deepEqual(cfg.内在, {
    启用: true, 反思模式: '重要回合', 每日反思上限: 30, 基线心情: 55,
    回稳半衰期小时: 8, 注入阈值: 6, 反思超时秒: 45, 反思Provider: '', 反思模型: '',
  })
  assert.deepEqual(cfg.偏离, { 躺平日: 1, 出门日: 0, 翘下午课: 0.25 })
  assert.deepEqual(cfg.日常, [])
  assert.equal(Object.hasOwn(cfg, '事件池'), false)
  assert.ok(issues.length >= 2)
})

test('v7 migrates stock maps, location icons and the legacy event pool', () => {
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
  const migrated = migrateConfig({ 配置版本: 3, 地图: legacyMap, 事件池: [['下午', '重复的小事']] }).value
  assert.equal(migrated.配置版本, 12)
  assert.equal(Object.hasOwn(migrated, '事件池'), false)
  assert.equal(migrated.地图.底图, 'xueyuan-road')
  assert.deepEqual(migrated.地图.地点.map(({ id, x, y }) => ({ id, x, y })), [
    { id: 'dorm', x: 44.3, y: 51.3 }, { id: 'classroom', x: 69.6, y: 30 },
    { id: 'library', x: 57, y: 38.2 }, { id: 'canteen', x: 54.3, y: 55.3 },
    { id: 'shop', x: 77.1, y: 41.3 }, { id: 'outdoor', x: 79.8, y: 57.3 },
    { id: 'cafe', x: 77.7, y: 25.6 }, { id: 'mall', x: 88.7, y: 8.8 },
    { id: 'mcdonalds', x: 81.1, y: 89.3 },
  ])
  assert.ok(migrated.地图.路径.some((edge) => edge.via && edge.via.length))

  const custom = structuredClone(legacyMap)
  custom.地点[0].x = 24
  const kept = migrateConfig({ 配置版本: 3, 地图: custom }).value
  assert.equal(kept.地图.地点[0].x, 24)
  assert.deepEqual(kept.地图.路径, custom.路径)

  const v4 = structuredClone(legacyMap)
  const v4Coordinates = [[43, 61], [73, 31], [58, 37], [55, 68], [84, 55], [93, 55]]
  v4.地点.forEach((node, index) => { [node.x, node.y] = v4Coordinates[index] })
  assert.equal(migrateConfig({ 配置版本: 4, 地图: v4 }).value.地图.地点.length, 9)
})

test('classes apply only inside an ordinary teaching term day', () => {
  const cfg = normalizeConfig({
    日常: [['00:00', '24:00', '在宿舍休息', '在手']],
    课表: { 4: [['09:00', '10:30', '项目管理', '教学楼']] },
  })
  const t = { ymd: '2026-11-12', weekday: 4 }
  assert.ok(timeline(cfg, t, { term: { name: '秋季学期' }, holiday: false, special: '' })
    .some((item) => item.what.includes('项目管理')))
  assert.equal(timeline(cfg, t, { term: null, holiday: false, special: '' })
    .some((item) => item.what.includes('项目管理')), false)
  assert.equal(timeline(cfg, t, { term: { name: '秋季学期' }, holiday: false, special: '校庆停课' })
    .some((item) => item.what.includes('项目管理')), false)
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

test('model prompt uses the selected routine as its upstream skeleton', () => {
  const prompt = buildPrompt({
    cfg: {}, date: '2026-11-12', weekdayLabel: '四', typeName: '没课日',
    routine: [['02:00', '08:30', '睡着了'], ['11:40', '12:40', '食堂吃饭']],
    classes: [], calendarLabel: '学期：2026 秋季学期', body: '平常', recent: '',
    relationships: 'person:p1「小满」（室友）',
  })
  assert.match(prompt, /平时的作息习惯（只是参考，今天完全可以打破）：02:00-08:30 睡着了；11:40-12:40 食堂吃饭/)
  assert.match(prompt, /这一天怎么过完全由你决定/)
  assert.doesNotMatch(prompt, /事件池/)
  assert.match(prompt, /person:p1「小满」/)
  assert.match(prompt, /不得凭空创建人物/)
  assert.doesNotMatch(prompt, /阿岚|小满（恋爱脑）|爱损人/)
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


function withHome(fn) {
  const old = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'feiyu-life-'))
  try { return fn() } finally {
    if (old === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = old
  }
}

const cal = { routine: '日常', term: null, holiday: false, special: null }

test('flat day never puts outdoor clothes on someone lying in bed', () => withHome(() => {
  const cfg = normalizeConfig({
    偏离: { 躺平日: 1, 出门日: 0, 翘下午课: 0 },
    衣柜: { home: ['旧卫衣'], out: ['黑大衣'] },
  })
  const r = generate(cfg, new Date('2026-11-16T06:30:00Z'), { moments: false })
  assert.match(r.current.what, /躺|床|窝/)
  assert.equal(r.current.outfit, '旧卫衣')
  assert.equal(r.current.phone, '在手')
  assert.doesNotMatch(r.text, /黑大衣/)
  assert.match(r.text, /手机在手/)
}))

test('routine gaps and overlaps become one continuous day', () => withHome(() => {
  const cfg = normalizeConfig({
    日常: [['10:00', '12:00', '上午的事', '在手'], ['11:00', '14:00', '重叠的事', '静音'], ['20:00', '21:00', '晚上的事', '在手']],
  })
  const items = timeline(cfg, { ymd: '2026-11-16', weekday: 1 }, cal, {}, { id: 'offDay', name: '没课日' })
  assert.deepEqual(timelineCoverage(items), { complete: true, gaps: [], overlaps: [] })
  assert.equal(items[0].start, 0)
  assert.equal(items.at(-1).end, 1440)
  assert.ok(items.some((x) => x.start === 0 && /睡/.test(x.what)))
}))

test('overlapping classes and an outing never produce two activities at once', () => withHome(() => {
  const cfg = normalizeConfig({
    日常: [['00:00', '24:00', '在宿舍', '在手']],
    课表: { 1: [['08:00', '12:00', '课A', '静音'], ['09:00', '10:30', '课B', '静音'], ['14:00', '17:30', '专业课', '静音']] },
    偏离: { 躺平日: 0, 出门日: 1, 翘下午课: 0 },
  })
  const t = { ymd: '2026-11-16', weekday: 1, month: 11, day: 16, hour: 15, minute: 0, minuteOfDay: 900 }
  const items = timeline(cfg, t, { routine: '日常', term: { name: '秋季学期' }, holiday: false, special: null }, { outing: true }, { id: 'schoolDay', name: '上课日' })
  assert.deepEqual(timelineCoverage(items), { complete: true, gaps: [], overlaps: [] })
  const outing = items.find((x) => /出门/.test(x.what))
  assert.ok(outing)
  const clash = items.filter((x) => x.start < outing.end && x.end > outing.start)
  assert.equal(clash.length, 1, 'outing must not overlap a class')
  assert.equal(timeline(cfg, t, { routine: '日常', term: { name: '秋季学期' }, holiday: false, special: null }, { flat: true }, { id: 'schoolDay', name: '上课日' }).some((x) => /专业课/.test(x.what)), false)
}))

test('energy follows the real night, not only the slow mood baseline', () => withHome(() => {
  writePlan('2026-11-15', { items: [
    { start: 0, end: 180, what: '躺床上刷手机', phone: '在手' },
    { start: 180, end: 420, what: '睡着了', phone: '在床头' },
    { start: 420, end: 1380, what: '过了一天', phone: '在手' },
    { start: 1380, end: 1440, what: '睡着了', phone: '在床头' },
  ] })
  writePlan('2026-11-16', { items: [
    { start: 0, end: 360, what: '睡着了', phone: '在床头' },
    { start: 360, end: 1440, what: '过了一天', phone: '在手' },
  ] })
  const cfg = normalizeConfig({})
  const r = generate(cfg, new Date('2026-11-16T04:00:00Z'), { moments: false, energyBaseline: 95 })
  assert.equal(r.lastNight.source, 'plans')
  assert.ok(r.lastNight.minutes <= 420)
  assert.ok(r.vitality.energy < 70)
  assert.ok(r.vitality.energy < 95)
}))

test('a cold is a multi-day episode, not an isolated daily coin flip', () => {
  const cfg = normalizeConfig({})
  let start = null
  for (let day = 1; day <= 28 && !start; day++) {
    const ymd = `2026-11-${String(day).padStart(2, '0')}`
    if (coldEpisode(cfg, ymd)?.day === 1) start = ymd
  }
  assert.ok(start, 'expected at least one deterministic cold start in November')
  const next = new Date(Date.parse(start + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
  assert.equal(coldEpisode(cfg, next)?.day, 2)
  const end = new Date(Date.parse(start + 'T00:00:00Z') + 4 * 86400000).toISOString().slice(0, 10)
  assert.equal(coldEpisode(cfg, end), null)
})

test('phone, activity and reply speed agree', () => {
  assert.equal(replyReadiness({ phone: '在手', what: '躺床上刷手机', behavior: 'phone' }).id, 'now')
  assert.equal(replyReadiness({ phone: '静音', what: '上课', behavior: 'study' }).id, 'slow')
  assert.equal(replyReadiness({ phone: '不在手边', what: '洗澡', behavior: 'bath' }).id, 'later')
  assert.equal(replyReadiness({ phone: '在床头', what: '睡着了', behavior: 'sleep' }).id, 'asleep')
  assert.equal(replyReadiness({ phone: '在手', what: '睡不着，躺床上刷手机', behavior: 'phone' }).id, 'now')
  assert.equal(replyReadiness({ phone: '在手', what: '从宿舍去食堂', behavior: 'walk', source: 'travel' }).id, 'slow')
})

test('before dawn the day does not pretend its future sleep already happened', () => withHome(() => {
  writePlan('2026-11-15', { items: [
    { start: 0, end: 120, what: '躺床上刷手机', phone: '在手' },
    { start: 120, end: 300, what: '睡着了', phone: '在床头' },
    { start: 300, end: 1440, what: '过了一天', phone: '在手' },
  ] })
  writePlan('2026-11-16', { items: [
    { start: 0, end: 420, what: '睡着了', phone: '在床头' },
    { start: 420, end: 1440, what: '过了一天', phone: '在手' },
  ] })
  const r = generate(normalizeConfig({}), new Date('2026-11-15T16:05:00Z'), { moments: false })
  assert.ok(['previous', 'ongoing'].includes(r.lastNight.source))
  assert.ok(['这觉还没睡完', '还没睡这一觉'].includes(r.vitality.sleepDebtLabel))
  assert.doesNotMatch(r.text, /昨晚.*才睡/)
}))

test('context stays short, natural and separates facts from free detail', () => withHome(() => {
  const r = generate(normalizeConfig({}), new Date('2026-11-16T09:43:00Z'), { moments: true, people: ['小满'] })
  assert.ok(r.text.length < 1200)
  assert.match(r.text, /（此刻）/)
  assert.doesNotMatch(r.text, /。。/)
  assert.match(r.text, /确定发生的事/)
  assert.doesNotMatch(r.text, /按日程|空一行|\[表情/)
  assert.ok(!r.text.includes('（此刻）在宿舍躺着，一天没出门，身上是黑大衣'))
  assert.equal(r.moment !== null, Boolean(r.moments.items.length))
}))

test('legacy and invalid configuration is normalized, not trusted', () => {
  const migrated = migrateConfig({ 配置版本: 10, 衣柜: { home: ['旧卫衣'] }, 日常: '坏数据' })
  assert.equal(migrated.value.配置版本, 12)
  const cfg = normalizeConfig(migrated.value)
  assert.deepEqual(cfg.衣柜.home, ['旧卫衣'])
  assert.deepEqual(cfg.衣柜.out, ['黑大衣', '军绿夹克', '牛仔外套'])
  assert.ok(cfg.日常.length > 0)
  const bad = validateConfig({ 课表: { 1: [['08:00', '12:00', 'A', '静音'], ['09:00', '10:30', 'B', '静音']] }, 节日: [{ 名: '坏日子', 月: 2, 日: 31 }] })
  assert.ok(bad.issues.some((x) => x.includes('课表.1') && x.includes('重叠')))
  assert.equal(bad.config.节日.some((x) => x.名 === '坏日子'), false)
})

test('a nonexistent DST wall time is forward-adjusted and never zero-length', () => {
  const tz = 'America/New_York'
  const ms = zonedDateTimeMs('2026-03-08', 150, tz)
  const local = zonedNow(new Date(ms), tz)
  assert.equal(local.ymd, '2026-03-08')
  assert.ok(local.hour >= 3)
  const later = zonedDateTimeMs('2026-03-08', 210, tz)
  assert.ok(later >= ms)
})

test('vitality clamps and penalizes a short night even with a high baseline', () => {
  const value = vitalityFor({
    sleep: { minutes: 240, startMinute: 150, wakeMinute: 390, source: 'plans' },
    t: { minuteOfDay: 600 },
    period: 0,
    cold: null,
    current: { what: '上专业课', behavior: 'study' },
    baseline: 95,
  })
  assert.ok(value.energy < 60)
  assert.ok(['有点累', '快没电了', '撑不太住'].includes(value.label))
  assert.ok(value.reasons.some((x) => /睡/.test(x)))
})


test('the same instant cannot produce two different lives', () => withHome(() => {
  const cfg = normalizeConfig({})
  const now = new Date('2026-11-16T09:43:00Z')
  const first = generate(cfg, now, { people: ['小满'], energyBaseline: 70 })
  const second = generate(cfg, now, { people: ['小满'], energyBaseline: 70 })
  assert.equal(second.text, first.text)
  assert.deepEqual(second.moments, first.moments)
}))

test('every stock routine covers the whole day without overlap', () => {
  for (const routine of ['日常', '晚起', '假期', '备考']) {
    const cfg = normalizeConfig({})
    const items = timeline(cfg, { ymd: '2026-11-16', weekday: routine === '晚起' ? 4 : 1 }, { routine, term: null, holiday: false, special: null }, {}, { id: 'offDay', name: '没课日' })
    assert.deepEqual(timelineCoverage(items), { complete: true, gaps: [], overlaps: [] }, routine)
  }
})


test('role and wardrobe settings are bounded and validated', () => {
  const cfg = normalizeConfig({
    角色设定: 'x'.repeat(600),
    衣柜: { sleep: [], home: ['这一件衣服的名字特别特别长'], weird: ['ignored'] },
  })
  assert.equal(cfg.角色设定.length, 500)
  assert.deepEqual(cfg.衣柜.sleep, ['睡衣'])
  assert.equal(cfg.衣柜.home[0].length, 12)
  assert.equal(Object.hasOwn(cfg.衣柜, 'weird'), false)
  const checked = validateConfig({
    角色设定: 'x'.repeat(501),
    衣柜: { sleep: [], home: 'bad', out: Array.from({ length: 13 }, (_, i) => `衣服${i}`) },
  })
  assert.ok(checked.issues.some((x) => x.includes('角色设定') && x.includes('500')))
  assert.ok(checked.issues.some((x) => x.includes('衣柜.sleep') && x.includes('空')))
  assert.ok(checked.issues.some((x) => x.includes('衣柜.home') && x.includes('数组')))
  assert.ok(checked.issues.some((x) => x.includes('衣柜.out') && x.includes('12')))
})

test('the settings UI exposes role and wardrobe fields without a hardcoded persona', () => {
  const source = readFileSync(new URL('../src/ui/app.js', import.meta.url), 'utf8')
  assert.match(source, /角色设定与衣柜/)
  assert.match(source, /maxLength: 500/)
  assert.match(source, /patch\(\['衣柜', key\]/)
  assert.match(source, /主动分享/)
  assert.match(source, /sharePage/)
  assert.doesNotMatch(source, /小满（恋爱脑）|爱损人/)
})


test('sharing configuration migrates, clamps and stays optional-backward-compatible', () => {
  const old = migrateConfig({ 配置版本: 11 }).value
  assert.equal(old.配置版本, 12)
  assert.equal(old.主动分享.每日上限, 2)
  const kept = normalizeConfig({ 主动分享: { 每日上限: 1, 全局冷却分钟: 720, 启用: false } })
  assert.equal(kept.主动分享.每日上限, 1)
  assert.equal(kept.主动分享.全局冷却分钟, 720)
  assert.equal(kept.主动分享.启用, false)
  const checked = validateConfig({ 主动分享: { 每日上限: 99, 最低分: 999, 安静开始: -1, 安静结束: 30 } })
  assert.ok(checked.issues.some((x) => x.includes('主动分享')))
  assert.equal(checked.config.主动分享.每日上限, 6)
  assert.equal(checked.config.主动分享.最低分, 100)
  assert.equal(checked.config.主动分享.安静开始, 0)
  assert.equal(checked.config.主动分享.安静结束, 23)
})


test('the plugin has one proactive scheduler and does not call the legacy gate', () => {
  const source = readFileSync(new URL('../src/plugin/app.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /initiativeDecision|markInitiative/)
  assert.doesNotMatch(source, /dsh-speak-up|speak-up-config/)
  assert.match(source, /sharingCheckedAt/)
  assert.equal((source.match(/runInitiative\(\)/g) || []).length, 1)
})


test('model plans obey the configured wardrobe and see mood/goals/agency', () => {
  const cfg = normalizeConfig({
    衣柜: { class: ['藏青卫衣'], sleep: ['睡衣'], home: ['旧卫衣'], out: ['黑大衣'], eat: ['卫衣'], bath: ['浴巾'] },
  })
  const prompt = buildPrompt({
    cfg, date: '2026-11-17', weekdayLabel: '二', typeName: '上课日',
    routine: [['00:00', '24:00', '在宿舍']], classes: [['08:00', '10:00', '上课']],
    calendarLabel: '学期', body: '平常', sleep: '7 小时', mood: '有点累',
    self: '- 自己的目标：整理作品集，下一步：挑三张片子', recent: '', continuity: '', relationships: '',
  })
  assert.match(prompt, /## 衣柜/)
  assert.match(prompt, /藏青卫衣/)
  assert.match(prompt, /## 她心里的事/)
  assert.match(prompt, /挑三张片子/)
  const normalized = normalizePlan({
    title: '一天',
    items: [
      { start: '00:00', end: '08:00', what: '睡着了', phone: '在床头', outfit: '西装', locationId: 'dorm', behavior: 'sleep' },
      { start: '08:00', end: '10:00', what: '上课', phone: '静音', outfit: '西装', locationId: 'classroom', behavior: 'study' },
      { start: '10:00', end: '24:00', what: '在宿舍待着', phone: '在手', outfit: '', locationId: 'dorm', behavior: 'idle' },
    ],
  }, undefined, [], [], cfg.衣柜)
  assert.equal(normalized.items[0].outfit, '睡衣')
  assert.equal(normalized.items[1].outfit, '藏青卫衣')
  assert.equal(normalized.items[2].outfit, '旧卫衣')
})
