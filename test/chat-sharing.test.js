import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitiativeRunner } from '../src/plugin/initiative.js'
import { normalizeSharingConfig } from '../src/proactive/sharing.js'
import { lastHumanMessageAt } from '../src/cognition/reflection.js'
import { chatHint } from '../src/plugin/context-hints.js'

test('scheduled and manual checks can enqueue only in the configured live session', async () => {
  const sent = []
  const sessions = ['first', 'chosen'].map(id => ({ id, followup: () => { sent.push(id) } }))
  let target = ''
  const run = createInitiativeRunner({
    readConfig: () => ({ 主动分享: { 指定会话: target } }), normalizeSharingConfig, sessions: () => sessions,
    runInternalAgency() {}, inWorkspace: () => true, initiativeRunning: new Set(), sharingCheckedAt: new Map(),
    readContinuity: () => ({ needs: {} }), generate: () => ({ plan: { date: '2026-11-26' } }),
    activePeople: () => [], readSharing() {}, readMind() {}, readAffect() {}, readAgency: () => ({}),
    buildCandidates: () => [], agencyShareCandidates: () => [], lastHumanText: new Map(), lastHumanAt: new Map(),
    placeCategory() {}, takeShare: () => ({ ok: true, claim: {} }), buildSharePrompt: () => 'test',
    eventId: () => 'id', commitShare: () => ({ ok: true }), appendEvent() {},
  })
  assert.equal((await run())[0].reason, 'no-target')
  target = 'offline'
  assert.equal((await run(null, true))[0].reason, 'target-unavailable')
  target = 'chosen'
  assert.equal((await run(sessions[0], true))[0].sent, false)
  await run()
  await run(null, true)
  assert.deepEqual(sent, ['chosen', 'chosen'])
})

test('long-gap context uses human input timestamps and skips synthetic messages', () => {
  const now = Date.now()
  const at = now - 42 * 3600000
  const events = [
    { type: 'user/message', timestamp: new Date(at).toISOString() },
    { role: 'user', timestamp: now, source: { kind: 'feiyu-life-share' } },
    { role: 'assistant', timestamp: now },
  ]
  assert.equal(lastHumanMessageAt(events, now), at)
  assert.match(chatHint('slow', 42), /42小时/)
  assert.doesNotMatch(chatHint('now', 1), /相隔|此刻不方便/)
})
