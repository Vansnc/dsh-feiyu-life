import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

import { defaultContinuity } from '../continuity.js'
import {
  AGENCY_VERSION, agencyContext, agencyPath, agencyShareCandidates, buildAgencyCandidates,
  defaultAgency, markAgencyOutreach, normalizeAgency, observeAgencyReply, readAgency, tickAgency, writeAgency,
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
  assert.ok(readAgency(now + 2 * 60000).recent.some((x) => x.sourceKey === 'needs:energy'))
}))

test('internal review steps have evidence and never regress after progress', () => withHome(() => {
  const goalOnly = { goals: [] }
  const goal = { id: 'g1', title: '整理作品集', nextStep: '挑三张片子', progress: 30, scope: 'local', status: 'active', updatedAt: now }
  const first = tickAgency({ now, continuity: defaultContinuity(now), mind: { goals: [goal] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(first.focus.sourceKey, 'mind:goal:g1')
  assert.equal(first.focus.steps[0].kind, 'review')
  const reviewed = tickAgency({ now: now + 60000, continuity: defaultContinuity(now), mind: { goals: [goal] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(reviewed.focus.steps[0].status, 'done')
  assert.match(reviewed.focus.steps[0].evidence, /内部复盘/)
  assert.ok(reviewed.state.executions.some((x) => x.action === 'review' && /不记为完成/.test(x.evidence)))
  assert.equal(reviewed.focus.internalPlan.nextAction, '挑三张片子')
  assert.match(reviewed.focus.reason, /等待真实进展/)
  const progressed = tickAgency({ now: now + 2 * 60000, continuity: defaultContinuity(now), mind: { goals: [{ ...goal, progress: 40 }] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(progressed.focus.steps[0].status, 'done')
  assert.equal(progressed.focus.steps[1].status, 'done')
  const stable = tickAgency({ now: now + 3 * 60000, continuity: defaultContinuity(now), mind: { goals: [{ ...goal, progress: 40 }] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(stable.changed, false)
  assert.equal(stable.focus.steps[0].status, 'done')
  assert.equal(stable.focus.steps[1].status, 'done')
}))

test('real tasks are never auto-completed by the internal executor', () => withHome(() => {
  const first = tickAgency({ now, continuity: continuity(), mind: { goals: [] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(first.focus.sourceKey, 'continuity:task:t1')
  assert.equal(first.focus.steps[0].status, 'active')
  assert.equal(first.focus.steps[1].status, 'pending')
  const second = tickAgency({ now: now + 3600000, continuity: continuity(), mind: { goals: [] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(second.focus.steps[0].status, 'active')
  assert.equal(second.focus.steps[1].status, 'pending')
  assert.equal(second.state.executions.filter((x) => x.action === 'review').length, 0)
  assert.equal(second.state.focus.status, 'active')
}))

test('defer, abandon and reopen require a genuinely newer source revision', () => withHome(() => {
  const task = { id: 't1', title: '取快递', status: 'open', dueAt: now - 3600000, createdAt: now - 86400000, updatedAt: now - 3600000 }
  const goal = { id: 'g1', title: '整理作品集', nextStep: '挑三张', progress: 30, scope: 'local', status: 'active', updatedAt: now - 1000 }
  const state = defaultAgency(now)
  state.focus = { ...buildAgencyCandidates({ now, continuity: defaultContinuity(now), mind: { goals: [goal] }, vitality: { energy: 80 }, affect: { valence: 60 } })[0], status: 'active', attempts: 2, createdAt: now - 3600000, updatedAt: now - 20 * 60000 }
  writeAgency(state, now)
  const switched = tickAgency({ now, continuity: continuity({ tasks: [task] }), mind: { goals: [goal] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(switched.focus.sourceKey, 'continuity:task:t1')
  assert.equal(switched.state.abandoned.some((x) => x.sourceKey === 'mind:goal:g1'), true)

  const reopened = tickAgency({ now: now + 60000, continuity: defaultContinuity(now), mind: { goals: [{ ...goal, updatedAt: now + 30000 }] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(reopened.focus.sourceKey, 'mind:goal:g1')
  assert.equal(reopened.state.abandoned.some((x) => x.sourceKey === 'mind:goal:g1'), false)
  assert.ok(reopened.state.recent.some((x) => x.sourceKey === 'mind:goal:g1' && x.status === 'reopened'))
}))

test('v1 agency files migrate to v2 without losing focus/deferred/recent', () => withHome(() => {
  const raw = {
    v: 1, updatedAt: now,
    focus: { id: 'old', sourceKey: 'continuity:task:t1', sourceId: 't1', sourceType: 'task', title: '取快递', status: 'active', createdAt: now - 1000, updatedAt: now - 1000, steps: [{ label: '先记着：取快递', status: 'active' }] },
    deferred: [{ sourceKey: 'mind:goal:old', until: now + 1000, attempts: 1 }],
    recent: [{ at: now - 1, sourceKey: 'x', title: '旧记录', status: 'done' }],
  }
  writeFileSync(agencyPath(), JSON.stringify(raw))
  const clean = readAgency(now)
  assert.equal(clean.v, AGENCY_VERSION)
  assert.equal(clean.focus.sourceKey, 'continuity:task:t1')
  assert.equal(clean.focus.steps[0].kind, 'wait')
  assert.equal(clean.deferred.length, 1)
  assert.equal(clean.abandoned.length, 0)
  const disk = JSON.parse(readFileSync(agencyPath(), 'utf8'))
  assert.equal(disk.v, AGENCY_VERSION)
  assert.ok(disk.outreach)
  assert.ok(disk.executions)
}))

test('follow-up candidates are pending facts and wait for a response', () => withHome(() => {
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

  markAgencyOutreach(candidate, { now })
  const waiting = readAgency(now)
  assert.equal(waiting.outreach[focus.sourceKey].status, 'awaiting')
  assert.equal(agencyShareCandidates(focus, { now: now + 24 * 3600000, date: '2026-11-18', state: waiting }).length, 0)
  const ignored = tickAgency({ now: now + 49 * 3600000, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(ignored.state.outreach[focus.sourceKey].status, 'ignored')
  const retry = agencyShareCandidates(focus, { now: now + 122 * 3600000, date: '2026-11-20', state: ignored.state })
  assert.equal(retry.length, 1)
  markAgencyOutreach(retry[0], { now: now + 122 * 3600000 })
  assert.equal(observeAgencyReply('不用催了', { now: now + 123 * 3600000 }).changed, true)
  const declined = readAgency(now + 123 * 3600000)
  assert.equal(declined.outreach[focus.sourceKey].status, 'declined')
  assert.equal(agencyShareCandidates(focus, { now: now + 124 * 3600000, date: '2026-11-21', state: declined }).length, 0)
}))

test('a human reply clears a pending follow-up without claiming delivery receipt', () => withHome(() => {
  const focus = buildAgencyCandidates({ now, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })[0]
  const [candidate] = agencyShareCandidates(focus, { now, date: '2026-11-17' })
  markAgencyOutreach(candidate, { now })
  observeAgencyReply('知道了，晚点弄', { now: now + 60000 })
  const state = readAgency(now + 60000)
  assert.equal(state.outreach[focus.sourceKey].status, 'responded')
  assert.equal(agencyShareCandidates(focus, { now: now + 2 * 60000, date: '2026-11-17', state }).length, 0)
}))

test('needs, self preferences, people and persisted events are sourced candidates', () => {
  const c = defaultContinuity(now)
  c.needs.socialNeed = 90
  c.people = [{ id: 'p1', name: '阿岚', notes: '最近总在背书', status: 'active', updatedAt: now - 1000 }]
  const candidates = buildAgencyCandidates({
    now, continuity: c,
    mind: { goals: [], preferences: [{ id: 'p2', owner: 'self', key: '散步', value: '傍晚慢慢走', status: 'active', updatedAt: now }], memories: [{ id: 'm1', kind: 'promise', summary: '周末陪他挑耳机', status: 'active', updatedAt: now }] },
    vitality: { energy: 80 }, affect: { valence: 60 },
    events: [{ id: 'e1', summary: '在食堂听见有人聊实习', at: now - 1000 }],
  })
  for (const key of ['needs:social', 'mind:preference:p2', 'mind:promise:m1', 'relationship:p1', 'event:e1']) {
    assert.ok(candidates.some((x) => x.sourceKey === key), key)
  }
})

test('index runs the internal tick before the outbound sharing gate', () => {
  const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
  const internal = source.indexOf('runInternalAgency(now)')
  const gate = source.indexOf('if (!sharingCfg.启用)')
  assert.ok(internal > 0)
  assert.ok(gate > internal)
  const agencySource = readFileSync(new URL('../agency.js', import.meta.url), 'utf8')
  assert.doesNotMatch(agencySource, /\.followup\s*\(/)
})


test('repeated internal ticks are idempotent when nothing changed', () => withHome(() => {
  const first = tickAgency({ now, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })
  const before = first.focus.steps
  const second = tickAgency({ now: now + 60000, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(second.changed, false)
  assert.deepEqual(second.focus.steps, before)
}))

test('concurrent agency ticks leave one consistent focus', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'feiyu-agency-race-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try {
    const moduleUrl = new URL('../agency.js', import.meta.url).href
    const script = `
      import { tickAgency } from ${JSON.stringify(moduleUrl)};
      import { defaultContinuity } from ${JSON.stringify(new URL('../continuity.js', import.meta.url).href)};
      const now = ${now};
      const c = defaultContinuity(now);
      c.tasks = [{ id: 't1', title: '取快递', status: 'open', dueAt: now - 3600000, updatedAt: now - 3600000 }];
      const r = tickAgency({ now, continuity: c, mind: { goals: [] }, vitality: { energy: 80 }, affect: { valence: 60 } });
      console.log(JSON.stringify({ focus: r.focus?.sourceKey || '', changed: r.changed }));
    `
    const run = () => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, DSH_HOME: dir }, stdio: ['ignore', 'pipe', 'ignore'] })
      let out = ''
      child.stdout.on('data', (chunk) => { out += chunk })
      child.on('error', reject)
      child.on('exit', (code) => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`child ${code}`)))
    })
    const results = await Promise.all([run(), run()])
    assert.ok(results.every((x) => x.focus === 'continuity:task:t1'))
    const state = readAgency(now)
    assert.equal(state.focus.sourceKey, 'continuity:task:t1')
    assert.ok(Array.isArray(state.deferred))
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
})

test('a declined follow-up reopens only after a newer source fact', () => withHome(() => {
  const focus = buildAgencyCandidates({ now, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })[0]
  const [candidate] = agencyShareCandidates(focus, { now, date: '2026-11-17' })
  markAgencyOutreach(candidate, { now })
  observeAgencyReply('别催了', { now: now + 1 })
  const declined = readAgency(now + 1)
  assert.equal(declined.outreach[focus.sourceKey].status, 'declined')
  assert.equal(agencyShareCandidates(focus, { now: now + 2, date: '2026-11-17', state: declined }).length, 0)
  const fresh = { ...focus, sourceUpdatedAt: focus.sourceUpdatedAt + 1 }
  assert.equal(agencyShareCandidates(fresh, { now: now + 3 * 3600000, date: '2026-11-17', state: declined }).length, 1)
}))

test('no candidates stays quiet without inventing a purpose', () => withHome(() => {
  const result = tickAgency({ now, continuity: defaultContinuity(now), mind: { goals: [], preferences: [] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(result.focus, null)
  assert.equal(result.changed, false)
  assert.equal(readAgency(now).focus, null)
}))

test('expired deferred records are persisted as abandoned, not silently lost', () => withHome(() => {
  const state = defaultAgency(now)
  state.deferred = [{ sourceKey: 'continuity:task:gone', until: now - 1, attempts: 3, reason: '旧推迟', lastSourceUpdatedAt: 1 }]
  writeAgency(state, now)
  const result = tickAgency({ now, continuity: defaultContinuity(now), mind: { goals: [], preferences: [] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(result.changed, true)
  const stored = readAgency(now)
  assert.equal(stored.deferred.length, 0)
  assert.equal(stored.abandoned.some((x) => x.sourceKey === 'continuity:task:gone'), true)
}))
