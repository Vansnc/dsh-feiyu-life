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
