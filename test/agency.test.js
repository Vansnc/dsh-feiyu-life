import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defaultContinuity } from '../continuity.js'
import {
  agencyContext, agencyShareCandidates, buildAgencyCandidates, readAgency, tickAgency,
} from '../agency.js'
import { buildSharePrompt } from '../sharing.js'

function withHome(fn) {
  const old = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'feiyu-agency-'))
  try { return fn() } finally {
    if (old === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = old
  }
}

const now = Date.parse('2026-11-17T10:00:00+08:00')
function continuity(overrides = {}) {
  return {
    ...defaultContinuity(now),
    tasks: [{ id: 't1', title: '取快递', detail: '驿站', status: 'open', dueAt: now - 3600000, createdAt: now - 86400000, updatedAt: now - 86400000 }],
    ...overrides,
  }
}
function mind(overrides = {}) {
  return { goals: [{ id: 'g1', title: '整理作品集', nextStep: '挑三张片子', progress: 30, scope: 'local', status: 'active', updatedAt: now - 60000 }], ...overrides }
}

test('agency candidates prefer real overdue sources over vague goals', () => {
  const candidates = buildAgencyCandidates({
    now, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 },
  })
  const task = candidates.find((x) => x.sourceKey === 'continuity:task:t1')
  const goal = candidates.find((x) => x.sourceKey === 'mind:goal:g1')
  assert.ok(task && goal)
  assert.ok(task.score > goal.score)
  assert.equal(task.steps[0].status, 'active')
})

test('tick keeps one focus, persists it, and never marks a pending source done', () => withHome(() => {
  const first = tickAgency({ now, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(first.changed, true)
  assert.ok(first.focus)
  assert.equal(first.state.focus.sourceKey, first.focus.sourceKey)
  const stored = readAgency(now)
  assert.equal(stored.focus.sourceKey, first.focus.sourceKey)
  assert.equal(stored.recent.length, 0)
  assert.ok(agencyContext(stored.focus).includes('只有实际发生才算完成'))
  const second = tickAgency({ now: now + 60000, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(second.focus.sourceKey, first.focus.sourceKey)
}))

test('a completed source closes the focus; a low-energy rest focus is stable', () => withHome(() => {
  const emptyContinuity = defaultContinuity(now)
  const first = tickAgency({ now, continuity: emptyContinuity, mind: { goals: [] }, vitality: { energy: 35 }, affect: { valence: 60 } })
  assert.equal(first.focus.sourceType, 'rest')
  const second = tickAgency({ now: now + 60000, continuity: emptyContinuity, mind: { goals: [] }, vitality: { energy: 35 }, affect: { valence: 60 } })
  assert.equal(second.focus.sourceType, 'rest')
  assert.equal(second.changed, false)

  const done = continuity({ tasks: [{ ...continuity().tasks[0], status: 'completed' }] })
  const cleared = tickAgency({ now: now + 2 * 60000, continuity: done, mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(cleared.focus.sourceKey, 'mind:goal:g1')
  assert.ok(readAgency(now + 2 * 60000).recent.some((x) => x.sourceKey === 'life:rest'))
}))

test('follow-up candidates are pending facts, not completed-life claims', () => {
  const focus = buildAgencyCandidates({ now, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })[0]
  const [candidate] = agencyShareCandidates(focus, { now, date: '2026-11-17', nowMinute: 600 })
  assert.equal(candidate.kind, 'followup')
  assert.match(candidate.facts[0], /记着|挂着/)
  assert.doesNotMatch(candidate.facts[0], /做完了|已经完成/)
  assert.ok(candidate.score >= 84)
  assert.equal(agencyShareCandidates({ ...focus, sourceType: 'rest' }, { now, date: '2026-11-17' }).length, 0)
  const prompt = buildSharePrompt(candidate)
  assert.match(prompt, /还没完成/)
  assert.doesNotMatch(prompt, /- .*已经做完/)
})

test('repeated ticks are idempotent when nothing changed', () => withHome(() => {
  const first = tickAgency({ now, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })
  const before = readAgency(now)
  const second = tickAgency({ now: now + 60000, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(second.changed, false)
  assert.equal(second.focus.sourceKey, first.focus.sourceKey)
  assert.equal(readAgency(now + 60000).recent.length, before.recent.length)
}))
