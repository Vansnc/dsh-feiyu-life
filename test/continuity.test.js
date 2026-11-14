import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  activeEntities, continuityPath, effectsDir, mutateEntity, projectsDir, readContinuity,
  readMemories, settleTimeline, writeContinuity,
} from '../continuity.js'
import { normalizePlan } from '../gen.js'
import { buildTimeline } from '../state.js'

function sandbox(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'feiyu-continuity-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try { return fn(dir) } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    rmSync(dir, { recursive: true, force: true })
  }
}

test('long-term threads require traceable provenance and pickup remains a task', () => sandbox(() => {
  assert.throws(() => mutateEntity('threads', 'create', { title: '作品集', origin: '' }), /origin/)
  const thread = mutateEntity('threads', 'create', { title: '视觉作品集', origin: '用户在对话中明确提出', nextStep: '整理封面' })
  const task = mutateEntity('tasks', 'create', { title: '取快递', origin: '用户明确待办' })
  assert.equal(activeEntities().find((x) => x.id === thread.id).kind, 'thread')
  assert.equal(activeEntities().find((x) => x.id === task.id).kind, 'task')
  assert.ok(readFileSync(continuityPath(), 'utf8').includes('用户在对话中明确提出'))
}))

test('an intact completed segment settles once and records reasons', () => sandbox(() => {
  const task = mutateEntity('tasks', 'create', { title: '取快递', origin: '设置页' }, 1)
  const segment = { start: 1000, end: 61000, plannedStart: 1000, plannedEnd: 61000, what: '下楼取快递', source: 'plan', behavior: 'walk', links: [{ type: 'task', id: task.id }] }
  const first = settleTimeline({ date: '2026-11-14', timeline: [segment], nowMs: 70000 })
  const second = settleTimeline({ date: '2026-11-14', timeline: [segment], nowMs: 80000 })
  assert.ok(first.applied >= 2)
  assert.equal(second.applied, 0)
  const state = readContinuity()
  assert.equal(state.tasks[0].status, 'completed')
  assert.match(state.recentChanges.at(-1).reason, /最终真实时间线/)
  assert.equal(readMemories()[0].date, '2026-11-14')
  assert.equal(JSON.parse(readFileSync(join(effectsDir(), '2026-11-14.json'), 'utf8')).effects.length, 2)
}))

test('continuity state can recover from the previous atomic version', () => sandbox(() => {
  const state = readContinuity(1)
  state.needs.energy = 51
  writeContinuity(state)
  state.needs.energy = 52
  writeContinuity(state)
  writeFileSync(continuityPath(), '{broken')
  assert.equal(readContinuity().needs.energy, 51)
}))

test('life_adjust overlay prevents a linked plan activity from settling', () => sandbox(() => {
  const task = mutateEntity('tasks', 'create', { title: '取快递', origin: '设置页' }, 1)
  const timeline = buildTimeline(
    [{ start: 0, end: 60, what: '取快递', links: [{ type: 'task', id: task.id }] }],
    [{ start: 20 * 60000, end: 40 * 60000, what: '临时接电话' }], 0,
  )
  settleTimeline({ date: '2026-11-14', timeline, nowMs: 70 * 60000 })
  assert.equal(readContinuity().tasks[0].status, 'open')
}))

test('automatic travel trimming does not masquerade as a life_adjust override', () => sandbox(() => {
  const task = mutateEntity('tasks', 'create', { title: '交作业', origin: '设置页' }, 1)
  const segment = { start: 0, end: 50 * 60000, plannedStart: 0, plannedEnd: 60 * 60000, what: '交完作业', source: 'plan', overridden: false, links: [{ type: 'task', id: task.id }] }
  settleTimeline({ date: '2026-11-14', timeline: [segment], nowMs: 60 * 60000 })
  assert.equal(readContinuity().tasks[0].status, 'completed')
}))

test('local artifacts are confined to a hashed plugin project directory', () => sandbox(() => {
  const thread = mutateEntity('threads', 'create', {
    title: '摄影作品集', origin: '用户明确提出', reality: 'local-artifact',
    artifact: { type: 'album', name: '../../不能越界' },
  }, 1)
  const segment = { start: 1, end: 60001, plannedStart: 1, plannedEnd: 60001, what: '整理已有照片', source: 'plan', links: [{ type: 'thread', id: thread.id, progressDelta: 10 }] }
  settleTimeline({ date: '2026-11-14', timeline: [segment], nowMs: 70000, maxArtifacts: 2 })
  const dirs = existsSync(projectsDir()) ? readdirSync(projectsDir()) : []
  assert.equal(dirs.length, 1)
  assert.match(dirs[0], /^[a-f0-9]{24}$/)
  assert.ok(existsSync(join(projectsDir(), dirs[0], 'album.json')))
}))

test('model links are allowlisted and cannot invent continuity ids', () => {
  const plan = normalizePlan({ items: [
    { start: '00:00', end: '07:00', what: '睡着了', links: [] },
    { start: '07:00', end: '24:00', what: '整理作品', links: [{ type: 'thread', id: 'known', progressDelta: 99 }, { type: 'task', id: 'fake' }] },
  ] }, undefined, [{ kind: 'thread', id: 'known' }])
  assert.deepEqual(plan.items[1].links, [{ type: 'thread', id: 'known', progressDelta: 20 }])
})

test('active entity limits are enforced', () => sandbox(() => {
  for (let i = 0; i < 5; i++) mutateEntity('threads', 'create', { title: `主线 ${i}`, origin: '测试' })
  assert.throws(() => mutateEntity('threads', 'create', { title: '超额', origin: '测试' }), /limit/)
}))
