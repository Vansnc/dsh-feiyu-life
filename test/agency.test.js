import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

import { defaultContinuity } from '../continuity.js'
import {
  AGENCY_VERSION, agencyContext, agencyPath, agencyShareCandidates, buildAgencyCandidates,
  defaultAgency, handleAgencyInboxReply, inboxReplyReference, markAgencyOutreach, normalizeAgency, observeAgencyReply, readAgency, tickAgency, writeAgency,
} from '../agency.js'
import { buildSharePrompt } from '../sharing.js'
import { runInternalAgencyRunner } from '../agency-runner.js'
import { readContinuity } from '../continuity.js'
import { readAffect, readEvents } from '../reflection.js'
import { readMind } from '../mind.js'
import { defaultSharingLedger, readSharing } from '../sharing.js'

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

  markAgencyOutreach(candidate, { now, sessionId: 's1' })
  const waiting = readAgency(now)
  assert.equal(waiting.outreach[focus.sourceKey].status, 'awaiting')
  assert.equal(agencyShareCandidates(focus, { now: now + 24 * 3600000, date: '2026-11-18', state: waiting }).length, 0)
  const ignored = tickAgency({ now: now + 49 * 3600000, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(ignored.state.outreach[focus.sourceKey].status, 'ignored')
  const retry = agencyShareCandidates(focus, { now: now + 122 * 3600000, date: '2026-11-20', state: ignored.state })
  assert.equal(retry.length, 1)
  markAgencyOutreach(retry[0], { now: now + 122 * 3600000, sessionId: 's1' })
  assert.equal(observeAgencyReply('不用催了', { now: now + 122 * 3600000 + 60000, sessionId: 's1' }).changed, true)
  const declined = readAgency(now + 122 * 3600000 + 60000)
  assert.equal(declined.outreach[focus.sourceKey].status, 'declined')
  assert.equal(agencyShareCandidates(focus, { now: now + 124 * 3600000, date: '2026-11-21', state: declined }).length, 0)
}))

test('a human reply clears a pending follow-up without claiming delivery receipt', () => withHome(() => {
  const focus = buildAgencyCandidates({ now, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })[0]
  const [candidate] = agencyShareCandidates(focus, { now, date: '2026-11-17' })
  markAgencyOutreach(candidate, { now, sessionId: 's1' })
  observeAgencyReply('取快递还没弄，晚点去', { now: now + 60000, sessionId: 's1' })
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
  const source = readFileSync(new URL('../src/plugin/initiative.js', import.meta.url), 'utf8')
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
  markAgencyOutreach(candidate, { now, sessionId: 's1' })
  observeAgencyReply('别催了', { now: now + 1, sessionId: 's1' })
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

test('reply association only affects the same session and a recent pending item', () => withHome(() => {
  const c = continuity({
    tasks: [
      { id: 't1', title: '取快递', status: 'open', dueAt: now + 3600000, updatedAt: now - 1000 },
      { id: 't2', title: '回邮件', status: 'open', dueAt: now + 7200000, updatedAt: now - 1000 },
    ],
  })
  const candidates = buildAgencyCandidates({ now, continuity: c, mind: { goals: [] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  const t1 = candidates.find((x) => x.sourceKey === 'continuity:task:t1')
  const t2 = candidates.find((x) => x.sourceKey === 'continuity:task:t2')
  markAgencyOutreach(agencyShareCandidates(t1, { now, date: '2026-11-17' })[0], { now, sessionId: 's1' })
  markAgencyOutreach(agencyShareCandidates(t2, { now, date: '2026-11-17' })[0], { now, sessionId: 's2' })
  assert.equal(observeAgencyReply('普通消息，另一个问题', { now: now + 1000 }).changed, false)
  assert.equal(readAgency(now + 1000).outreach[t1.sourceKey].status, 'awaiting')
  assert.equal(readAgency(now + 1000).outreach[t2.sourceKey].status, 'awaiting')
  observeAgencyReply('算了我问另一个问题', { now: now + 2000, sessionId: 's1' })
  const after = readAgency(now + 2000)
  assert.equal(after.outreach[t1.sourceKey].status, 'awaiting')
  assert.equal(after.outreach[t2.sourceKey].status, 'awaiting')
  observeAgencyReply('别催了', { now: now + 3000, sessionId: 's2' })
  assert.equal(readAgency(now + 3000).outreach[t2.sourceKey].status, 'declined')
}))

test('old v2 rows without sessionId cannot be answered by a generic message', () => withHome(() => {
  const focus = buildAgencyCandidates({ now, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })[0]
  markAgencyOutreach(agencyShareCandidates(focus, { now, date: '2026-11-17' })[0], { now })
  assert.equal(observeAgencyReply('好', { now: now + 1000, sessionId: 's1' }).changed, false)
  assert.equal(readAgency(now + 1000).outreach[focus.sourceKey].status, 'awaiting')
}))

test('low-priority interests become reachable after a quiet period but never go outbound', () => withHome(() => {
  const pref = { id: 'p1', owner: 'self', key: '散步', value: '傍晚慢慢走', status: 'active', updatedAt: now - 1000 }
  const result = tickAgency({ now, continuity: defaultContinuity(now), mind: { goals: [], preferences: [pref] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(result.focus.sourceKey, 'mind:preference:p1')
  assert.equal(result.focus.sourceType, 'interest')
  assert.ok(result.state.explored['mind:preference:p1'] > 0)
  assert.equal(agencyShareCandidates(result.focus, { now, date: '2026-11-17' }).length, 0)
  const reviewed = tickAgency({ now: now + 60000, continuity: defaultContinuity(now), mind: { goals: [], preferences: [pref] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(reviewed.changed, true)
  assert.equal(reviewed.focus, null)
  assert.ok(readAgency(now + 60000).executions.some((x) => x.action === 'review' && x.sourceKey === 'mind:preference:p1'))
  assert.equal(readAgency(now + 60000).recent.some((x) => x.sourceKey === 'mind:preference:p1' && x.status === 'reviewed'), true)
}))

test('source timestamps are stable and persistent needs follow state, not elapsed time', () => {
  const c = defaultContinuity(now)
  c.needs.energy = 30
  c.needs.updatedAt = now - 2 * 3600000
  const pref = { id: 'p1', owner: 'self', key: '散步', value: '傍晚慢慢走', status: 'active', updatedAt: now - 2 * 86400000 }
  const rel = { id: 'r1', name: '阿岚', notes: '最近总在背书', status: 'active', updatedAt: now - 4 * 86400000 }
  c.people = [rel]
  const a = buildAgencyCandidates({ now, continuity: c, mind: { goals: [], preferences: [pref] }, vitality: { energy: 30 }, affect: { valence: 60 } })
  const b = buildAgencyCandidates({ now: now + 3600000, continuity: c, mind: { goals: [], preferences: [pref] }, vitality: { energy: 30 }, affect: { valence: 60 } })
  const ea = a.find((x) => x.sourceKey === 'needs:energy')
  const eb = b.find((x) => x.sourceKey === 'needs:energy')
  assert.equal(ea.sourceUpdatedAt, c.needs.updatedAt)
  assert.equal(ea.expiresAt, 0)
  assert.equal(eb.sourceUpdatedAt, ea.sourceUpdatedAt)
  assert.equal(eb.expiresAt, ea.expiresAt)
  const pa = a.find((x) => x.sourceKey === 'mind:preference:p1')
  const pb = b.find((x) => x.sourceKey === 'mind:preference:p1')
  assert.equal(pa.sourceUpdatedAt, pref.updatedAt)
  assert.equal(pa.expiresAt, pref.updatedAt + 7 * 86400000)
  assert.equal(pb.expiresAt, pa.expiresAt)
  assert.equal(a.some((x) => x.sourceKey === 'relationship:r1'), false)
  const persistent = buildAgencyCandidates({ now: c.needs.updatedAt + 24 * 3600000, continuity: c, mind: { goals: [], preferences: [pref] }, vitality: { energy: 30 }, affect: { valence: 60 } })
  assert.ok(persistent.some((x) => x.sourceKey === 'needs:energy'))
  const recovered = buildAgencyCandidates({ now: c.needs.updatedAt + 25 * 3600000, continuity: { ...c, needs: { ...c.needs, energy: 75, updatedAt: c.needs.updatedAt + 25 * 3600000 } }, mind: { goals: [], preferences: [pref] }, vitality: { energy: 75 }, affect: { valence: 60 } })
  assert.equal(recovered.some((x) => x.sourceKey === 'needs:energy'), false)
  const droppedAgain = buildAgencyCandidates({ now: c.needs.updatedAt + 26 * 3600000, continuity: { ...c, needs: { ...c.needs, energy: 30, updatedAt: c.needs.updatedAt + 26 * 3600000 } }, mind: { goals: [], preferences: [pref] }, vitality: { energy: 30 }, affect: { valence: 60 } })
  assert.equal(droppedAgain.find((x) => x.sourceKey === 'needs:energy').sourceUpdatedAt, c.needs.updatedAt + 26 * 3600000)
})

test('a deferred source cannot preempt before its window or due to time alone', () => withHome(() => {
  const goal = { id: 'g1', title: '整理作品集', nextStep: '挑三张', progress: 30, scope: 'local', status: 'active', updatedAt: now - 1000 }
  const task = { id: 't1', title: '取快递', status: 'open', dueAt: now + 3600000, createdAt: now - 1000, updatedAt: now - 1000 }
  const c = continuity({ tasks: [task] })
  const goalFocus = buildAgencyCandidates({ now, continuity: defaultContinuity(now), mind: { goals: [goal] }, vitality: { energy: 80 }, affect: { valence: 60 } })[0]
  const state = defaultAgency(now)
  state.focus = { ...goalFocus, status: 'active', createdAt: now - 3600000, updatedAt: now - 20 * 60000 }
  state.deferred = [{ sourceKey: 'continuity:task:t1', until: now + 30 * 60000, attempts: 1, lastSourceUpdatedAt: task.updatedAt }]
  writeAgency(state, now)
  const before = tickAgency({ now, continuity: c, mind: { goals: [goal] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(before.focus.sourceKey, 'mind:goal:g1')
  const still = tickAgency({ now: now + 16 * 60000, continuity: c, mind: { goals: [goal] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(still.focus.sourceKey, 'mind:goal:g1')
  const updatedTask = { ...task, updatedAt: now + 16 * 60000 }
  const fresh = tickAgency({ now: now + 16 * 60000, continuity: continuity({ tasks: [updatedTask] }), mind: { goals: [goal] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(fresh.focus.sourceKey, 'continuity:task:t1')
  const stable = tickAgency({ now: now + 17 * 60000, continuity: continuity({ tasks: [updatedTask] }), mind: { goals: [goal] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.equal(stable.focus.sourceKey, 'continuity:task:t1')
}))

test('sharing ledger rows reconcile a missing outreach exactly once', () => withHome(() => {
  const recent = [{ kind: 'followup', sourceKey: 'continuity:task:t1', stageKey: 'agency:continuity:task:t1:0', sessionId: 's1', title: '取快递', at: now }]
  const first = tickAgency({ now, continuity: defaultContinuity(now), mind: { goals: [] }, vitality: { energy: 80 }, affect: { valence: 60 }, sharingRecent: recent })
  assert.equal(readAgency(now).outreach['continuity:task:t1'].status, 'awaiting')
  assert.equal(first.changed, true)
  const second = tickAgency({ now: now + 1000, continuity: defaultContinuity(now), mind: { goals: [] }, vitality: { energy: 80 }, affect: { valence: 60 }, sharingRecent: recent })
  assert.equal(second.changed, false)
  assert.equal(readAgency(now + 1000).outreach['continuity:task:t1'].lastAt, now)
}))

test('the injectable internal runner advances state while sharing is disabled', () => withHome(() => {
  const result = runInternalAgencyRunner({
    now,
    readConfig: () => ({ 主动分享: { 启用: false }, 时区: 'Asia/Shanghai' }),
    readContinuity: () => continuity(),
    readMind: () => mind(),
    readAffect: () => ({ valence: 60 }),
    readEvents: () => [],
    readSharing,
  })
  assert.equal(result.ok, true)
  assert.ok(result.focus)
  assert.ok(readAgency(now).focus)
  assert.equal(readAgency(now).focus.sourceKey, 'continuity:task:t1')
  const runnerSource = readFileSync(new URL('../agency-runner.js', import.meta.url), 'utf8')
  assert.doesNotMatch(runnerSource, /\.followup\s*\(/)
}))


test('persistent low energy does not reopen an abandoned need through time alone', () => withHome(() => {
  const c = defaultContinuity(now)
  c.needs.energy = 30
  c.needs.updatedAt = now - 3600000
  const state = defaultAgency(now)
  state.abandoned = [{ sourceKey: 'needs:energy', at: now - 1000, reason: '旧', lastSourceUpdatedAt: c.needs.updatedAt }]
  writeAgency(state, now)
  const result = tickAgency({ now: now + 7200000, continuity: c, mind: { goals: [], preferences: [] }, vitality: { energy: 30 }, affect: { valence: 60 } })
  assert.equal(result.focus, null)
  assert.equal(readAgency(now + 7200000).abandoned.some((x) => x.sourceKey === 'needs:energy'), true)
}))

test('a reassuring phrase is not treated as an association, and candidate work stays bounded', () => {
  const prefs = Array.from({ length: 80 }, (_, i) => ({ id: `p${i}`, owner: 'self', key: `兴趣${i}`, value: '随便看看', status: 'active', updatedAt: now - 1000 }))
  const candidates = buildAgencyCandidates({ now, continuity: defaultContinuity(now), mind: { goals: [], preferences: prefs }, vitality: { energy: 80 }, affect: { valence: 60 } })
  assert.ok(candidates.length <= 40)
  withHome(() => {
    const focus = buildAgencyCandidates({ now, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })[0]
    markAgencyOutreach(agencyShareCandidates(focus, { now, date: '2026-11-17' })[0], { now, sessionId: 's1' })
    observeAgencyReply('不用担心，我自己来', { now: now + 1, sessionId: 's1' })
    assert.equal(readAgency(now + 1).outreach[focus.sourceKey].status, 'awaiting')
  })
})


test('production inbox payload has no implicit reply reference, only explicit fields are used', () => {
  assert.equal(inboxReplyReference({ agent: {}, message: { id: 'm1', content: [] } }), '')
  assert.equal(inboxReplyReference({ message: { replyTo: 'share-1' } }), 'share-1')
  assert.equal(inboxReplyReference({ message: { source: { parentId: 'share-2' } } }), 'share-2')
})

test('a short refusal with sibling pending items does not guess which one', () => withHome(() => {
  const c = continuity({
    tasks: [
      { id: 't1', title: '取快递', status: 'open', dueAt: now + 3600000, updatedAt: now - 1000 },
      { id: 't2', title: '回邮件', status: 'open', dueAt: now + 7200000, updatedAt: now - 1000 },
    ],
  })
  const candidates = buildAgencyCandidates({ now, continuity: c, mind: { goals: [] }, vitality: { energy: 80 }, affect: { valence: 60 } })
  for (const x of candidates) markAgencyOutreach(agencyShareCandidates(x, { now, date: '2026-11-17' })[0], { now, sessionId: 's1' })
  assert.equal(observeAgencyReply('别催了', { now: now + 60000, sessionId: 's1' }).changed, false)
  const state = readAgency(now + 60000)
  assert.equal(state.outreach[candidates[0].sourceKey].status, 'awaiting')
  assert.equal(state.outreach[candidates[1].sourceKey].status, 'awaiting')
}))

test('two ledger interruptions do not invent a newer source fact', () => withHome(() => {
  const rows = [
    { kind: 'followup', sourceKey: 'continuity:task:t1', stageKey: 'stage-0', sessionId: 's1', title: '取快递', at: now, sourceUpdatedAt: 0 },
    { kind: 'followup', sourceKey: 'continuity:task:t1', stageKey: 'stage-1', sessionId: 's1', title: '取快递', at: now + 1000, sourceUpdatedAt: 0 },
  ]
  const result = tickAgency({ now: now + 1000, continuity: defaultContinuity(now), mind: { goals: [] }, vitality: { energy: 80 }, affect: { valence: 60 }, sharingRecent: rows })
  const row = readAgency(now + 1000).outreach['continuity:task:t1']
  assert.equal(row.count, 2)
  assert.equal(row.lastSourceUpdatedAt, 0)
  const focus = { ...buildAgencyCandidates({ now: now + 1000, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })[0], sourceUpdatedAt: 0 }
  assert.equal(agencyShareCandidates(focus, { now: now + 49 * 3600000, date: '2026-11-19', state: result.state }).length, 0)
  const fresh = { ...focus, sourceUpdatedAt: 1 }
  assert.equal(agencyShareCandidates(fresh, { now: now + 49 * 3600000, date: '2026-11-19', state: result.state }).length, 1)
}))


test('production inbox adapter does not infer an association from the payload', () => withHome(() => {
  const focus = buildAgencyCandidates({ now, continuity: continuity(), mind: mind(), vitality: { energy: 80 }, affect: { valence: 60 } })[0]
  markAgencyOutreach(agencyShareCandidates(focus, { now, date: '2026-11-17' })[0], { now, sessionId: 's1' })
  const ordinary = handleAgencyInboxReply('算了我问另一个问题', { agent: {}, message: { id: 'm1', content: [] } }, 's1', { now: now + 1 })
  assert.equal(ordinary.changed, false)
  assert.equal(readAgency(now + 1).outreach[focus.sourceKey].status, 'awaiting')
  const referenced = handleAgencyInboxReply('好', { agent: {}, message: { id: 'm2', replyTo: 'agency:continuity:task:t1:0' } }, 's1', { now: now + 2 })
  assert.equal(referenced.changed, true)
  assert.equal(readAgency(now + 2).outreach[focus.sourceKey].status, 'responded')
}))
