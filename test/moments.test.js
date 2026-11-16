import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  MOMENT_LIMITS, cleanupMoments, ensureMoments, generateMoments, momentContext,
  momentStage, momentTemplates, momentsPath, normalizeMoments, readMoments, writeMoments,
} from '../moments.js'
import { normalizeConfig } from '../life.js'

function withHome(fn) {
  const old = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'feiyu-moments-'))
  try { return fn() } finally {
    if (old === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = old
  }
}

const cfg = normalizeConfig({})
const t = { ymd: '2026-11-16', month: 11, day: 16, weekday: 1, minuteOfDay: 600 }
const calendar = { term: { name: '秋季学期' }, holiday: false, special: null }

test('today small things are decided once and persist across calls', () => withHome(() => {
  const first = ensureMoments(cfg, t, calendar, { now: Date.parse('2026-11-16T02:00:00Z') })
  assert.ok(existsSync(momentsPath(t.ymd)))
  const before = statSync(momentsPath(t.ymd)).mtimeMs
  const second = ensureMoments(cfg, t, calendar, { now: Date.parse('2026-11-16T09:00:00Z') })
  assert.deepEqual(second, first)
  assert.equal(statSync(momentsPath(t.ymd)).mtimeMs, before, 'a second read must not rewrite the file')
  assert.ok(first.items.length <= MOMENT_LIMITS.perDay)
}))

test('a small thing advances by stages, then ends', () => withHome(() => {
  const data = generateMoments(cfg, t, calendar, { cold: true, now: Date.parse('2026-11-16T02:00:00Z') })
  assert.ok(data.items.length > 0)
  const item = data.items[0]
  const first = momentStage(item, item.stages[0].at - 1)
  assert.equal(first, null)
  const start = momentStage(item, item.stages[0].at, { maxAgeMinutes: 999 })
  assert.equal(start.text, item.stages[0].text)
  if (item.stages.length > 1) {
    const later = momentStage(item, item.stages[1].at, { maxAgeMinutes: 999 })
    assert.equal(later.index, 1)
  }
  const lastAt = item.stages.at(-1).at
  const endMinute = Math.min(1440, lastAt + 361)
  const end = momentStage(item, endMinute, { maxAgeMinutes: 360 })
  assert.equal(end === null, endMinute - lastAt > 360)
}))

test('recent days suppress the same small thing', () => {
  const base = generateMoments(cfg, t, calendar, { cold: true, now: 1 })
  assert.ok(base.items.length > 0)
  const id = base.items[0].id
  const avoided = generateMoments(cfg, { ...t, ymd: '2026-11-17' }, calendar, {
    now: 1,
    recent: [{ id, age: 1 }],
  })
  assert.equal(avoided.items.some((x) => x.id === id), false)
})

test('unknown ids, extra items and unknown people are dropped or bounded', () => {
  const value = normalizeMoments({
    v: 1,
    date: '2026-11-16',
    items: [
      { id: 'package', start: 600, person: '' },
      { id: 'unknown', start: 700 },
      { id: 'laundry', start: 800 },
      { id: 'edit', start: 900 },
    ],
  }, '2026-11-16')
  assert.equal(value.items.length, 2)
  assert.deepEqual(value.items.map((x) => x.id), ['package', 'laundry'])
  const person = normalizeMoments({ v: 1, date: '2026-11-16', items: [{ id: 'person', start: 900, person: '小满' }] }, '2026-11-16')
  assert.equal(momentStage(person.items[0], 910, { maxAgeMinutes: 999 }).text.includes('小满'), true)
})

test('corrupt or oversized files are ignored and replaced safely', () => withHome(() => {
  const path = momentsPath(t.ymd)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, '{not json')
  const fixed = ensureMoments(cfg, t, calendar, { now: 1 })
  assert.ok(Array.isArray(fixed.items))
  assert.ok(statSync(path).size <= MOMENT_LIMITS.fileBytes)

  writeFileSync(path, 'x'.repeat(MOMENT_LIMITS.fileBytes + 100))
  assert.equal(readMoments(t.ymd), null)
  const repaired = ensureMoments(cfg, t, calendar, { now: 2 })
  assert.ok(Array.isArray(repaired.items))
  assert.ok(statSync(path).size <= MOMENT_LIMITS.fileBytes)
}))

test('an empty day is still recorded once', () => withHome(() => {
  assert.equal(writeMoments('2026-11-18', { v: 1, date: '2026-11-18', createdAt: 1, items: [] }), true)
  const data = readMoments('2026-11-18')
  assert.deepEqual(data.items, [])
  assert.equal(momentContext(data, 600), null)
}))

test('expired small-thing files are cleaned up', () => withHome(() => {
  writeMoments('2026-09-01', { v: 1, date: '2026-09-01', createdAt: 1, items: [] })
  const old = new Date('2026-09-01T00:00:00Z')
  utimesSync(momentsPath('2026-09-01'), old, old)
  assert.ok(cleanupMoments(30, Date.parse('2026-11-16T00:00:00Z')) >= 1)
  assert.equal(readMoments('2026-09-01'), null)
}))


test('a flat day never chooses a small thing that requires going out', () => {
  for (let day = 1; day <= 20; day++) {
    const ymd = `2026-11-${String(day).padStart(2, '0')}`
    const data = generateMoments(cfg, { ymd, month: 11, day, weekday: 1 }, calendar, { flat: true, cold: true, now: 1 })
    assert.equal(data.items.some((x) => ['package', 'libraryBook', 'snack', 'cat'].includes(x.id)), false, ymd)
  }
})


test('small things respect place, outing, meals and the full timeline', () => {
  const date = '2026-11-16'
  const parcel = normalizeMoments({ v: 1, date, items: [{ id: 'package', start: 9 * 60 }] }, date)
  const first = momentContext(parcel, 9 * 60 + 10, { currentCategory: 'class' })
  assert.match(first.text, /驿站发短信/)
  assert.equal(momentContext(parcel, 9 * 60 + 190, { currentCategory: 'dorm', outings: [] }), null, 'no outing means no pickup stage')
  const picked = momentContext(parcel, 9 * 60 + 190, { currentCategory: 'dorm', outings: [{ start: 700, end: 740 }] })
  assert.match(picked.text, /拿回来了/)
  assert.equal(momentContext(parcel, 9 * 60 + 430, { currentCategory: 'dorm', outings: [{ start: 700, end: 740 }] }), null, 'a pickup too long ago cannot become an unboxing stage')

  const laundry = normalizeMoments({ v: 1, date, items: [{ id: 'laundry', start: 8 * 60 }] }, date)
  assert.equal(momentContext(laundry, 8 * 60 + 10, { currentCategory: 'class' }), null)
  assert.match(momentContext(laundry, 8 * 60 + 10, { currentCategory: 'dorm' }).text, /泡着/)

  const person = normalizeMoments({ v: 1, date, items: [{ id: 'person', start: 17 * 60, person: '小满' }] }, date)
  assert.equal(momentContext(person, 17 * 60 + 10, { currentCategory: 'any', meals: [] }), null)
  assert.match(momentContext(person, 17 * 60 + 10, { currentCategory: 'any', meals: [{ start: 18 * 60, end: 19 * 60 }] }).text, /小满/)
})

test('there is no weather template without a weather source', () => {
  assert.equal(momentTemplates.some((x) => x.id === 'weather'), false)
})
