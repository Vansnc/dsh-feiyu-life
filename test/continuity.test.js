import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  activeEntities, activePeople, continuityContext, continuityPath, continuityRevision, continuityView,
  effectsDir, mutateEntity, mutatePerson, planSyncInfo, projectsDir, readContinuity, readMemories,
  relationshipSummary, settleTimeline, writeContinuity,
} from '../src/life/continuity.js'
import { normalizePlan } from '../src/life/gen.js'
import { buildTimeline } from '../src/life/state.js'

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
  assert.match(state.recentChanges.find((x) => x.entityId === task.id && x.source === 'timeline:2026-11-14').reason, /最终真实时间线/)
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

test('v1 continuity data migrates to v2 with an empty people list', () => sandbox(() => {
  writeFileSync(continuityPath(), JSON.stringify({ v: 1, needs: { energy: 61 }, threads: [], tasks: [], commitments: [] }))
  const state = readContinuity(10)
  assert.equal(state.v, 2)
  assert.deepEqual(state.people, [])
  assert.equal(state.needs.energy, 61)
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

test('people require provenance and model interaction links are allowlisted', () => sandbox(() => {
  const beforeRevision = continuityRevision()
  assert.throws(() => mutatePerson('create', { name: '小满', origin: '' }), /origin/)
  const person = mutatePerson('create', { name: '小满', relation: '室友', notes: '最近在为恋爱烦恼', origin: '角色设定' }, 1)
  assert.notEqual(continuityRevision(), beforeRevision)
  assert.equal(activePeople()[0].name, '小满')
  assert.match(relationshipSummary(), /最近在为恋爱烦恼/)
  assert.throws(() => mutatePerson('create', { name: '小满', origin: '重复输入' }), /already exists/)
  assert.throws(() => mutateEntity('commitments', 'create', { title: '见陌生人', personId: 'invented' }), /unknown active person/)
  const plan = normalizePlan({ items: [
    { start: '00:00', end: '07:00', what: '睡着了' },
    { start: '07:00', end: '24:00', what: '陪小满聊了会儿', people: [
      { id: person.id, tone: 'warm' }, { id: 'invented', tone: 'tense' },
    ] },
  ] }, undefined, [], activePeople())
  assert.deepEqual(plan.items[1].people, [{ id: person.id, tone: 'warm' }])
}))

test('a fulfilled commitment linked to a person also settles a neutral interaction', () => sandbox(() => {
  const person = mutatePerson('create', { name: '妈妈', relation: '家人', origin: '用户明确提供' }, 1)
  const commitment = mutateEntity('commitments', 'create', { title: '周日晚视频', personId: person.id, origin: '用户明确约定' }, 2)
  const segment = { start: 1000, end: 3601000, what: '和妈妈视频聊近况', source: 'plan', links: [{ type: 'commitment', id: commitment.id }] }
  settleTimeline({ date: '2026-11-16', timeline: [segment], nowMs: 4000000 })
  const state = readContinuity()
  assert.equal(state.commitments[0].status, 'completed')
  assert.equal(state.people[0].interactionCount, 1)
  assert.equal(state.people[0].closeness, 50)
}))

test('an intact interaction updates relationship and shared memory exactly once', () => sandbox(() => {
  const person = mutatePerson('create', { name: '妈妈', relation: '家人', origin: '用户明确提供', closeness: 70 }, 1)
  const segment = { start: 1000, end: 3601000, what: '和妈妈视频聊近况', source: 'plan', behavior: 'phone', people: [{ id: person.id, tone: 'warm' }] }
  const beforeSocial = readContinuity().needs.socialNeed
  settleTimeline({ date: '2026-11-16', timeline: [segment], nowMs: 4000000 })
  const afterFirst = readContinuity()
  settleTimeline({ date: '2026-11-16', timeline: [segment], nowMs: 5000000 })
  const state = readContinuity()
  assert.equal(state.people[0].interactionCount, 1)
  assert.equal(state.people[0].closeness, 71)
  assert.ok(state.needs.socialNeed < beforeSocial)
  assert.equal(state.needs.socialNeed, afterFirst.needs.socialNeed)
  assert.match(readMemories()[0].summary, /妈妈有过互动/)
  assert.equal(state.recentChanges.filter((x) => x.entityId === person.id && x.source === 'timeline:2026-11-16').length, 1)
}))

test('life_adjust overlay prevents a planned person interaction from settling', () => sandbox(() => {
  const person = mutatePerson('create', { name: '阿岚', relation: '室友', origin: '角色设定' }, 1)
  const timeline = buildTimeline(
    [{ start: 0, end: 60, what: '和阿岚聊作业', people: [{ id: person.id, tone: 'neutral' }] }],
    [{ start: 20 * 60000, end: 40 * 60000, what: '临时接电话' }], 0,
  )
  settleTimeline({ date: '2026-11-16', timeline, nowMs: 70 * 60000 })
  assert.equal(readContinuity().people[0].interactionCount, 0)
}))

test('active entity limits are enforced', () => sandbox(() => {
  for (let i = 0; i < 5; i++) mutateEntity('threads', 'create', { title: `主线 ${i}`, origin: '测试' })
  assert.throws(() => mutateEntity('threads', 'create', { title: '超额', origin: '测试' }), /limit/)
}))

test('due items are prioritized and described in human terms', () => sandbox(() => {
  const now = Date.parse('2026-11-16T02:00:00Z')
  mutateEntity('tasks', 'create', { title: '以后再买', origin: '测试', dueAt: now + 10 * 86400000 }, now)
  mutateEntity('commitments', 'create', { title: '给妈妈打电话', origin: '测试', with: '妈妈', dueAt: now - 60000 }, now)
  const state = readContinuity(now)
  state.needs = { ...state.needs, energy: 25, stress: 80, socialNeed: 75, sleepDebtMinutes: 180 }
  writeContinuity(state)
  const view = continuityView(readContinuity(now), { now, timeZone: 'Asia/Shanghai' })
  assert.equal(view.entities[0].title, '给妈妈打电话')
  assert.equal(view.entities[0].due.state, 'overdue')
  assert.ok(view.needs.includes('精力很低'))
  const context = continuityContext(readContinuity(now), [{ summary: '昨天去图书馆改稿了' }], { now, timeZone: 'Asia/Shanghai' })
  assert.match(context, /压力很大/)
  assert.match(context, /昨天去图书馆改稿了/)
}))

test('continuity revision changes when plan inputs change', () => sandbox(() => {
  const first = continuityRevision()
  const task = mutateEntity('tasks', 'create', { title: '取快递', origin: '测试' }, 1)
  const second = continuityRevision()
  assert.notEqual(first, second)
  mutateEntity('tasks', 'update', { id: task.id, dueAt: 123456 }, 2)
  assert.notEqual(second, continuityRevision())
}))

test('pre-generated plans expose stale and synchronized revisions', () => sandbox(() => {
  const state = readContinuity()
  const revision = continuityRevision(state)
  assert.equal(planSyncInfo(state, { date: '2026-11-17', source: 'llm', continuityRevision: revision }).synced, true)
  mutateEntity('tasks', 'create', { title: '新待办', origin: '测试' }, 1)
  const stale = planSyncInfo(readContinuity(), { date: '2026-11-17', source: 'llm', continuityRevision: revision })
  assert.equal(stale.synced, false)
  assert.equal(stale.source, 'llm')
}))

test('daily sleep debt is calculated once from the final day', () => sandbox(() => {
  const hour = 3600000
  const timeline = [
    { start: 0, end: 6 * hour, what: '睡着了', behavior: 'sleep', source: 'plan' },
    { start: 6 * hour, end: 24 * hour, what: '普通的一天', behavior: 'idle', source: 'plan' },
  ]
  settleTimeline({ date: '2026-11-16', timeline, nowMs: 25 * hour })
  assert.equal(readContinuity().needs.sleepDebtMinutes, 120)
  settleTimeline({ date: '2026-11-16', timeline, nowMs: 26 * hour })
  assert.equal(readContinuity().needs.sleepDebtMinutes, 120)
}))
