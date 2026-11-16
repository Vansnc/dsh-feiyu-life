import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  affectContext, appendEvent, applyReflection, buildReflectionPrompt, decayedAffect,
  defaultAffect, eventId, normalizeReflection, readAffect, readEvents,
  recordLifeSettlement, reflectionUsage, shouldReflect,
} from '../reflection.js'

const inner = { 基线心情: 55, 回稳半衰期小时: 8, 注入阈值: 6, 每日反思上限: 2 }

test('reflection output is bounded and candidate-only', () => {
  const value = normalizeReflection({
    affect: { valenceDelta: 99, arousalDelta: -99, dimensions: { joy: 99, calm: 3, worry: -2, sadness: 4 }, reason: '她被认真回应了', confidence: 4 },
    memoryCandidates: Array.from({ length: 5 }, (_, i) => ({ summary: `候选${i}`, importance: 2, confidence: -1 })),
    relationshipCandidates: [{ person: '月见', tone: 'warm', reason: '认真听她说话' }],
  })
  assert.equal(value.affect.valenceDelta, 12)
  assert.equal(value.affect.arousalDelta, -12)
  assert.equal(value.affect.dimensions.joy, 20)
  assert.equal(value.affect.confidence, 1)
  assert.equal(value.memoryCandidates.length, 3)
  assert.equal(value.relationshipCandidates[0].tone, 'warm')
  assert.equal(normalizeReflection({ affect: {} }), null)
})

test('affect decays to baseline and injects only when significant', () => {
  const now = 1_800_000_000_000
  const state = { ...defaultAffect(inner, now - 8 * 3600000), valence: 75, arousal: 55, updatedAt: now - 8 * 3600000, lastReason: '收到了好消息' }
  const view = decayedAffect(state, inner, now)
  assert.equal(Math.round(view.valence), 65)
  assert.equal(Math.round(view.arousal), 45)
  assert.match(affectContext(view, inner, now), /内在状态/)
  assert.equal(affectContext(defaultAffect(inner, now), inner, now), '')
})

test('applying the same reflection is idempotent and recoverable', () => {
  const old = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'feiyu-reflect-'))
  try {
    const reflection = normalizeReflection({ affect: { valenceDelta: 8, arousalDelta: 4, dimensions: { joy: 10 }, reason: '被关心', confidence: 0.9 } })
    assert.equal(applyReflection('turn-1', reflection, inner, 1000).applied, true)
    assert.equal(applyReflection('turn-1', reflection, inner, 1000).applied, false)
    const state = readAffect(inner, 1000)
    assert.equal(state.valence, 63)
    assert.equal(state.appliedEvents.length, 1)
    assert.equal(JSON.parse(readFileSync(join(process.env.DSH_HOME, 'feiyu-life-affect.json'), 'utf8')).lastReason, '被关心')
  } finally { if (old === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = old }
})

test('daily event ledger deduplicates, bounds usage and never stores transcript', () => {
  const old = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'feiyu-events-'))
  try {
    const options = { timeZone: 'Asia/Shanghai' }
    appendEvent({ id: 'a', at: Date.parse('2026-11-16T02:00:00Z'), type: 'turn.reflection', source: 'human', status: 'applied', reason: '觉得被理解', meta: { inputChars: 30 } }, options)
    assert.equal(appendEvent({ id: 'a', at: Date.parse('2026-11-16T02:00:00Z'), type: 'turn.reflection', status: 'applied', reason: '重复' }, options).added, false)
    appendEvent({ id: 'b', at: Date.parse('2026-11-16T03:00:00Z'), type: 'turn.reflection', status: 'failed', reason: 'timeout' }, options)
    const events = readEvents({ date: '2026-11-16' })
    assert.equal(events.length, 2)
    assert.equal(reflectionUsage(inner, Date.parse('2026-11-16T04:00:00Z'), 'Asia/Shanghai').remaining, 0)
    assert.doesNotMatch(JSON.stringify(events), /用户输入|角色回复|transcript/)
  } finally { if (old === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = old }
})

test('life settlements share the ledger without duplicate writes', () => {
  const old = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'feiyu-life-event-'))
  try {
    const first = recordLifeSettlement('2026-11-16', { applied: 3 }, { now: Date.parse('2026-11-16T12:00:00Z') })
    const again = recordLifeSettlement('2026-11-16', { applied: 3 }, { now: Date.parse('2026-11-16T12:00:00Z') })
    assert.equal(first.added, true)
    assert.equal(again.added, false)
    assert.equal(readEvents({ date: '2026-11-16' })[0].type, 'life.settled')
  } finally { if (old === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = old }
})

test('reflection modes and prompt enforce a single bounded candidate pass', () => {
  assert.equal(shouldReflect('关闭', '今天很开心', '我也是', 'human'), false)
  assert.equal(shouldReflect('每轮', '嗯', '知道了', 'human'), true)
  assert.equal(shouldReflect('重要回合', '嗯', '知道了', 'human'), false)
  assert.equal(shouldReflect('重要回合', '以后记得这件事', '好，我记住了', 'human'), true)
  assert.equal(shouldReflect('每轮', '内部时间', '收到', 'runtime-context'), false)
  const prompt = buildReflectionPrompt({ userText: 'x'.repeat(3000), replyText: 'y'.repeat(3000) })
  assert.ok(prompt.length < 3000)
  assert.match(prompt, /不会自动写入长期记忆/)
  assert.equal(eventId(['a', 'b']), eventId(['a', 'b']))
})
