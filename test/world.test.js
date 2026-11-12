import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addWorldToTimeline, behaviorFor, defaultWorldConfig, locationFor, normalizeWorldConfig, worldStateAt,
} from '../world.js'

test('a location change creates a deterministic travel segment', () => {
  const timeline = addWorldToTimeline([
    { start: 0, end: 10 * 60000, what: '在宿舍刷手机', phone: '在手', source: 'plan' },
    { start: 10 * 60000, end: 30 * 60000, what: '食堂吃饭', phone: '在手', source: 'plan' },
  ], defaultWorldConfig)
  const travel = timeline.find((x) => x.source === 'travel')
  assert.ok(travel)
  assert.equal(travel.from, 'dorm')
  assert.equal(travel.to, 'canteen')
  assert.equal(travel.end - travel.start, 8 * 60000)
  const state = worldStateAt(timeline, travel.start + 4 * 60000, defaultWorldConfig)
  assert.equal(state.moving, true)
  assert.equal(state.destination.id, 'canteen')
  assert.equal(Math.round(state.progress * 100), 50)
})

test('behaviour state drives avatar animations', () => {
  assert.equal(behaviorFor('躺床上睡着了'), 'sleep')
  assert.equal(behaviorFor('图书馆背书'), 'study')
  assert.equal(behaviorFor('拿相机出门拍照'), 'photo')
  assert.equal(behaviorFor('食堂吃晚饭'), 'eat')
  assert.equal(locationFor('在图书馆画画', defaultWorldConfig), 'library')
})

test('map configuration clamps coordinates and can disable commuting', () => {
  const cfg = normalizeWorldConfig({
    启用: true,
    自动通勤: false,
    地点: [
      { id: 'a', name: 'A', x: -9, y: 200, 关键词: ['甲'] },
      { id: 'b', name: 'B', x: 70, y: 30, 关键词: ['乙'] },
    ],
    路径: [{ from: 'a', to: 'b', minutes: 0 }],
  })
  assert.equal(cfg.地点[0].x, 4)
  assert.equal(cfg.地点[0].y, 92)
  assert.equal(cfg.路径[0].minutes, 1)
  assert.equal(addWorldToTimeline([
    { start: 0, end: 10, what: '甲' },
    { start: 10, end: 20, what: '乙' },
  ], cfg).some((x) => x.source === 'travel'), false)
})


test('cafe writing stays off campus and uses the study animation', () => {
  const text = '去咖啡店接着改稿'
  assert.equal(locationFor(text, defaultWorldConfig), 'outdoor')
  assert.equal(behaviorFor(text), 'study')

  const existingV3Config = {
    ...defaultWorldConfig,
    地点: defaultWorldConfig.地点.map((node) => ({
      ...node,
      关键词: node.关键词.filter((word) => !/咖啡/.test(word)),
    })),
  }
  assert.equal(locationFor(text, existingV3Config), 'outdoor')

  const timeline = addWorldToTimeline([
    { start: 0, end: 15 * 60000, what: '在便利店拆快递', phone: '在手', source: 'plan' },
    { start: 15 * 60000, end: 105 * 60000, what: text, phone: '在手', source: 'plan' },
  ], defaultWorldConfig)
  const travel = timeline.find((x) => x.source === 'travel')
  assert.ok(travel)
  assert.equal(travel.from, 'shop')
  assert.equal(travel.to, 'outdoor')
  assert.equal(timeline.at(-1).locationId, 'outdoor')
  assert.equal(timeline.at(-1).behavior, 'study')
})

test('behaviour recognition uses subject-aware, explicit phrases', () => {
  const cases = new Map([
    ['蹲着看猫吃完半根火腿肠', 'idle'],
    ['陪室友吃晚饭，自己只喝水', 'idle'],
    ['看猫吃完了，自己去食堂吃晚饭', 'eat'],
    ['她看猫吃完了，自己也吃了晚饭', 'eat'],
    ['点了个外卖，等骑手送到', 'idle'],
    ['外卖到了，坐下吃晚饭', 'eat'],
    ['睡不着，躺床上刷手机', 'phone'],
    ['睡前刷手机看到两点', 'phone'],
    ['看室友睡着之后接着改稿', 'study'],
    ['坐地铁去咖啡店', 'walk'],
    ['刷牙洗脸顺便敷面膜', 'bath'],
    ['带着相机去公园拍照', 'photo'],
    ['把海报标题改到第三遍', 'study'],
    ['在图书馆做海报设计', 'study'],
  ])
  for (const [text, expected] of cases) assert.equal(behaviorFor(text), expected, text)
})

test('an unlocated follow-up stays at the previous place', () => {
  const timeline = addWorldToTimeline([
    { start: 0, end: 60 * 60000, what: '在图书馆看书', source: 'plan' },
    { start: 60 * 60000, end: 120 * 60000, what: '接着整理笔记', source: 'plan' },
    { start: 120 * 60000, end: 180 * 60000, what: '回宿舍洗澡', source: 'plan' },
  ], defaultWorldConfig)
  const followUp = timeline.find((x) => x.what === '接着整理笔记')
  assert.equal(followUp.locationId, 'library')
})

test('explicit model semantics override text heuristics', () => {
  const timeline = addWorldToTimeline([
    { start: 0, end: 60 * 60000, what: '陪室友吃晚饭', locationId: 'outdoor', behavior: 'idle', source: 'plan' },
  ], defaultWorldConfig)
  assert.equal(timeline[0].locationId, 'outdoor')
  assert.equal(timeline[0].behavior, 'idle')
})
