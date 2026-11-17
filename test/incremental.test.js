import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { generate, normalizeConfig } from '../src/life/life.js'
import {
  dailyPlan, mergeFutureItems, planPath, readPlan, scheduleRevision, timelineCoverage, writePlan,
} from '../src/life/plan.js'

function withHome(fn) {
  const old = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'feiyu-incremental-'))
  try { return fn() } finally {
    if (old === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = old
  }
}

const ymd = '2026-11-16'
const t = { ymd, weekday: 1, month: 11, day: 16 }
const calendar = { routine: '日常', term: { name: '秋季学期' }, holiday: false, special: null }

function baseConfig(classes = [['08:00', '11:30', '上课', '静音'], ['14:00', '17:30', '上专业课', '静音']]) {
  return normalizeConfig({
    日常: [['00:00', '24:00', '在宿舍', '在手']],
    课表: { 1: classes },
    偏离: { 躺平日: 0, 出门日: 0, 翘下午课: 0 },
  })
}

const oldItems = [
  { start: 0, end: 8 * 60, what: '睡着了', phone: '在床头', outfit: '睡衣', locationId: 'dorm' },
  { start: 8 * 60, end: 12 * 60, what: '上专业课', phone: '静音', outfit: '藏青卫衣', locationId: 'classroom' },
  { start: 12 * 60, end: 14 * 60, what: '食堂吃饭', phone: '在手', outfit: '卫衣', locationId: 'canteen' },
  { start: 14 * 60, end: 18 * 60, what: '在宿舍剪片', phone: '在手', outfit: '旧卫衣', locationId: 'dorm' },
  { start: 18 * 60, end: 24 * 60, what: '躺床上刷手机', phone: '在手', outfit: '旧卫衣', locationId: 'dorm' },
]

test('a timetable change only adjusts the future and keeps the past frozen', () => withHome(() => {
  const before = baseConfig()
  assert.equal(writePlan(ymd, { scheduleRevision: scheduleRevision(before), items: oldItems }), true)
  const mtime = statSync(planPath(ymd)).mtimeMs
  const persistedBefore = readPlan(ymd).items
  const after = baseConfig([['10:00', '12:00', '新课', '静音']])
  const plan = dailyPlan(after, t, calendar, {}, { id: 'schoolDay', name: '上课日' }, { mergeFuture: true, nowMinute: 13 * 60 })
  assert.deepEqual(plan.items.slice(0, 3), persistedBefore.slice(0, 3), 'past segments are byte-for-byte frozen')
  assert.ok(plan.items.some((x) => x.start === 14 * 60 && x.end === 18 * 60 && x.what === '在宿舍剪片'), 'future content is reused when the category is compatible')
  assert.deepEqual(timelineCoverage(plan.items), { complete: true, gaps: [], overlaps: [] })
  assert.match(String(plan.mergedSchedule), /./)
  assert.equal(readPlan(ymd).scheduleRevision, scheduleRevision(before), 'the persisted base plan is not rewritten by a read')
  assert.equal(statSync(planPath(ymd)).mtimeMs, mtime)
}))

test('the segment that already started is frozen until its original end', () => withHome(() => {
  const before = baseConfig()
  writePlan(ymd, { scheduleRevision: scheduleRevision(before), items: oldItems })
  const after = baseConfig([])
  const plan = dailyPlan(after, t, calendar, {}, { id: 'schoolDay', name: '上课日' }, { mergeFuture: true, nowMinute: 9 * 60 })
  const frozenClass = plan.items.find((x) => x.start === 8 * 60)
  assert.equal(frozenClass.what, '上专业课')
  assert.equal(frozenClass.end, 12 * 60)
  assert.deepEqual(timelineCoverage(plan.items), { complete: true, gaps: [], overlaps: [] })
}))

test('the same schedule returns the persisted plan without a merge', () => withHome(() => {
  const cfg = baseConfig()
  writePlan(ymd, { scheduleRevision: scheduleRevision(cfg), items: oldItems })
  const persisted = readPlan(ymd)
  const plan = dailyPlan(cfg, t, calendar, {}, { id: 'schoolDay', name: '上课日' }, { mergeFuture: true, nowMinute: 13 * 60 })
  assert.equal(plan, persisted)
}))

test('schedule revision changes for both timetable and routine edits', () => {
  const base = scheduleRevision(baseConfig())
  assert.notEqual(base, scheduleRevision(baseConfig([['10:00', '12:00', '新课', '静音']])))
  const routineChanged = baseConfig()
  routineChanged.日常 = [['00:00', '24:00', '换了个作息', '在手']]
  assert.notEqual(base, scheduleRevision(routineChanged))
})

test('a legacy plan without a revision is still merged conservatively', () => withHome(() => {
  writePlan(ymd, { items: oldItems })
  const persistedBefore = readPlan(ymd).items
  const plan = dailyPlan(baseConfig([['10:00', '12:00', '新课', '静音']]), t, calendar, {}, { id: 'schoolDay', name: '上课日' }, { mergeFuture: true, nowMinute: 13 * 60 })
  assert.deepEqual(timelineCoverage(plan.items), { complete: true, gaps: [], overlaps: [] })
  assert.deepEqual(plan.items.slice(0, 3), persistedBefore.slice(0, 3))
}))


test('the live context uses the merged future without a model call', () => withHome(() => {
  const before = baseConfig()
  writePlan(ymd, { scheduleRevision: scheduleRevision(before), items: oldItems })
  const after = baseConfig([['10:00', '12:00', '新课', '静音']])
  const current = generate(after, new Date('2026-11-16T05:00:00Z'), { moments: false })
  assert.equal(current.current.what, '食堂吃饭', 'the current segment is still frozen')
  assert.ok(current.plan.items.some((x) => x.start === 14 * 60 && x.what === '在宿舍剪片'), 'future content is preserved')
  assert.ok(!current.plan.items.some((x) => x.start === 10 * 60), 'a new past class is not invented after it happened')
}))


test('future links survive an intact merge and are dropped when the segment is split', () => {
  const old = [{ start: 14 * 60, end: 18 * 60, what: '剪片', locationId: 'dorm', links: [{ type: 'thread', id: 't1', progressDelta: 5 }], people: [] }]
  const intact = mergeFutureItems(old, [{ start: 14 * 60, end: 18 * 60, what: '在宿舍' }], 13 * 60)
  assert.equal(intact.length, 1)
  assert.deepEqual(intact[0].links, [{ type: 'thread', id: 't1', progressDelta: 5 }])
  const split = mergeFutureItems(old, [
    { start: 14 * 60, end: 16 * 60, what: '在宿舍' },
    { start: 16 * 60, end: 18 * 60, what: '上专业课' },
  ], 13 * 60)
  assert.equal(split.length, 2)
  assert.deepEqual(split.flatMap((x) => x.links || []), [])
  const collapsed = mergeFutureItems(old, [
    { start: 14 * 60, end: 16 * 60, what: '在宿舍' },
    { start: 16 * 60, end: 18 * 60, what: '在宿舍' },
  ], 13 * 60)
  assert.equal(collapsed.length, 1)
  assert.deepEqual(collapsed[0].links, [], 'a split must not silently restore links via collapse')
})
