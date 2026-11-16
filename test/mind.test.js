import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  applyCognition, defaultMind, initiativeDecision, markInitiative, mindContext,
  mutateGoal, mutateMemory, mutatePreference, normalizeCognition, readMind,
  retrieveMemories,
} from '../mind.js'

const cfg = {
  启用: true, 记忆启用: true, 自动沉淀: true, 记忆重要度阈值: 0.68, 记忆置信度阈值: 0.72,
  记忆上限: 500, 召回条数: 6, 召回字数: 800,
}

function isolated(fn) {
  const old = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'feiyu-mind-'))
  try { return fn() } finally { if (old === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = old }
}

test('one cognition pass promotes only high-quality non-sensitive memory', () => isolated(() => {
  const result = applyCognition('e1', {
    memoryCandidates: [
      { summary: '用户下周要参加答辩', kind: 'fact', subject: 'user', importance: 0.9, confidence: 0.9, sensitivity: 'normal', explicit: true },
      { summary: '用户的敏感隐私', kind: 'fact', subject: 'user', importance: 1, confidence: 1, sensitivity: 'sensitive', explicit: true },
      { summary: '随口说的一句话', importance: 0.2, confidence: 0.9 },
      { summary: '用户的 API key 是 abc123', importance: 1, confidence: 1, sensitivity: 'normal', explicit: true },
    ],
  }, cfg, 1000)
  assert.equal(result.mind.memories.length, 1)
  assert.equal(result.mind.memories[0].summary, '用户下周要参加答辩')
  assert.equal(applyCognition('e1', {}, cfg, 2000).applied, false)
}))

test('preferences and goals require explicit evidence where policy says so', () => isolated(() => {
  const result = applyCognition('e2', {
    preferenceCandidates: [
      { owner: 'user', key: '饮料', value: '喜欢少糖', confidence: 0.95, explicit: false },
      { owner: 'self', key: '散步', value: '喜欢傍晚慢慢走', confidence: 0.9, explicit: false },
      { owner: 'user', key: '称呼', value: '喜欢被叫月见', confidence: 0.95, explicit: true },
    ],
    goalCandidates: [
      { title: '替用户下单', scope: 'local', confidence: 0.99, explicit: false },
      { title: '整理自己的本地日记', scope: 'local', confidence: 0.9, explicit: true, nextStep: '汇总本周片段' },
    ],
  }, cfg, 2000)
  assert.deepEqual(result.mind.preferences.map((x) => x.key).sort(), ['散步', '称呼'])
  assert.deepEqual(result.mind.goals.map((x) => x.title), ['整理自己的本地日记'])
}))

test('identity changes only after three independent aligned observations', () => isolated(() => {
  for (let i = 1; i <= 3; i++) applyCognition(`identity-${i}`, {
    identityEvidence: [{ trait: '会照顾别人的感受', polarity: 'for', reason: `第${i}次主动收住刻薄话`, confidence: 0.9 }],
  }, cfg, i * 1000)
  const mind = readMind(cfg, 4000)
  assert.equal(mind.identity.traits.includes('会照顾别人的感受'), true)
  assert.equal(mind.identityEvidence.length, 3)
}))

test('relationship model evolves slowly and keeps subjective evidence', () => isolated(() => {
  applyCognition('rel-1', { relationshipCandidates: [{ person: '月见', tone: 'warm', reason: '认真听她讲完', confidence: 0.9 }] }, cfg, 1000)
  applyCognition('rel-2', { relationshipCandidates: [{ person: '月见', tone: 'tense', reason: '这轮有一点争执', confidence: 0.9 }] }, cfg, 2000)
  const relation = readMind(cfg, 3000).relationships[0]
  assert.equal(relation.interactionCount, 2)
  assert.equal(relation.warmth, 50)
  assert.equal(relation.tension, 2)
  assert.equal(relation.summary, '这轮有一点争执')
}))

test('topic retrieval is bounded, relevant and respects forgetting', () => isolated(() => {
  const coffee = mutateMemory('create', { summary: '用户喜欢在咖啡店安静写东西', kind: 'preference', subject: 'user', importance: 0.8 }, cfg, 1000)
  mutateMemory('create', { summary: '昨天一起聊过篮球比赛', kind: 'episode', subject: 'relationship', importance: 0.5 }, cfg, 2000)
  let mind = readMind(cfg, 3000)
  assert.match(retrieveMemories(mind, '今天想去咖啡店写稿', cfg, 3000)[0].summary, /咖啡店/)
  mutateMemory('forget', { id: coffee.id }, cfg, 4000)
  mind = readMind(cfg, 5000)
  assert.equal(retrieveMemories(mind, '咖啡店', cfg, 5000).some((x) => x.id === coffee.id), false)
}))

test('manual preference and local goal remain editable', () => isolated(() => {
  const pref = mutatePreference('create', { owner: 'self', key: '音乐', value: '画稿时听轻音乐' }, cfg, 1000)
  const goal = mutateGoal('create', { title: '整理本周生活片段', scope: 'local', nextStep: '挑三段真实时间线' }, cfg, 1000)
  mutatePreference('forget', { id: pref.id }, cfg, 2000)
  mutateGoal('complete', { id: goal.id }, cfg, 2000)
  const mind = readMind(cfg, 3000)
  assert.equal(mind.preferences[0].status, 'forgotten')
  assert.equal(mind.goals[0].status, 'completed')
  assert.equal(mind.goals[0].progress, 100)
}))

test('permanent deletion removes content from current and recovery files', () => isolated(() => {
  const secret = '只用于删除测试的独特记忆-73921'
  const item = mutateMemory('create', { summary: secret, kind: 'fact' }, cfg, 1000)
  mutateMemory('delete', { id: item.id }, cfg, 2000)
  assert.equal(readMind(cfg, 3000).memories.some((x) => x.id === item.id), false)
  assert.doesNotMatch(readFileSync(join(process.env.DSH_HOME, 'feiyu-life-mind.json'), 'utf8'), /73921/)
  assert.doesNotMatch(readFileSync(join(process.env.DSH_HOME, 'feiyu-life-mind.json.bak'), 'utf8'), /73921/)
}))

test('personality context stays bounded and marks subjective boundaries', () => {
  const mind = defaultMind(cfg, 1000)
  mind.memories = Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, summary: `关于咖啡店写稿的第${i}条记忆`, kind: 'episode', subject: 'self', importance: 0.9, confidence: 0.9, sensitivity: 'normal', status: 'active', createdAt: 1000, updatedAt: 1000, expiresAt: 0 }))
  const context = mindContext(mind, '咖啡店写稿', { ...cfg, 召回字数: 500, 召回条数: 3 }, 2000)
  assert.ok(context.length <= 500)
  assert.match(context, /不要逐条复述/)
  assert.ok((context.match(/关于咖啡店/g) || []).length <= 3)
})

test('initiative decision enforces quiet hours, sleep, cooldown, limits and topics', () => isolated(() => {
  const mind = defaultMind(cfg, 1000)
  mind.initiative.lastTopic = '问问作品集做到哪了'; mind.initiative.lastReason = '有点惦记'; mind.initiative.cueAt = 1000
  const base = { mind, config: { 启用: true, 安静开始: 0, 安静结束: 8, 冷却分钟: 240, 每日上限: 2, 未互动分钟: 180, 基础概率: 0.2 }, timeZone: 'Asia/Shanghai', lastHumanAt: 1000, agentIdle: true }
  const noon = Date.parse('2026-11-16T04:00:00Z')
  assert.equal(initiativeDecision({ ...base, now: noon, behavior: 'sleep' }).reason, 'sleeping')
  assert.equal(initiativeDecision({ ...base, now: noon, behavior: 'idle', phone: '不在手边' }).reason, 'phone-away')
  const ok = initiativeDecision({ ...base, now: noon, behavior: 'idle', phone: '在手' })
  assert.equal(ok.ok, true)
  assert.match(ok.topic, /作品集/)
  const marked = markInitiative(mind, ok, cfg, noon)
  assert.equal(initiativeDecision({ ...base, mind: marked, now: noon + 60000, behavior: 'idle', phone: '在手' }).reason, 'cooldown')
}))

test('cognition normalization bounds every autonomous surface', () => {
  const value = normalizeCognition({
    memoryCandidates: Array.from({ length: 10 }, (_, i) => ({ summary: `m${i}`, importance: 99, confidence: -2 })),
    goalCandidates: [{ title: '外部动作', scope: 'external', confidence: 1, explicit: true }, ...Array.from({ length: 4 }, (_, i) => ({ title: `g${i}`, scope: i % 2 ? 'local' : 'virtual', confidence: 4, explicit: true }))],
    identityEvidence: Array.from({ length: 8 }, (_, i) => ({ trait: `t${i}`, reason: 'e', confidence: 9 })),
    initiative: { desire: 4, topic: 'x'.repeat(500), reason: 'y'.repeat(500) },
  })
  assert.equal(value.memoryCandidates.length, 4)
  assert.equal(value.memoryCandidates[0].importance, 1)
  assert.equal(value.goalCandidates.length, 2)
  assert.equal(value.goalCandidates.some((x) => x.title === '外部动作'), false)
  assert.equal(value.identityEvidence.length, 3)
  assert.equal(value.initiative.desire, 1)
  assert.equal(value.initiative.topic.length, 160)
})

test('sensitive text cannot enter any autonomous personality surface', () => {
  const value = normalizeCognition({
    preferenceCandidates: [{ owner: 'self', key: 'API key', value: 'sk-secret', confidence: 1 }],
    goalCandidates: [{ title: '保存 access token', reason: 'secret', scope: 'local', confidence: 1, explicit: true }],
    identityEvidence: [{ trait: '记住密码', reason: '密码是 123456', confidence: 1 }],
    relationshipCandidates: [{ person: '银行卡 6222', reason: '用户告诉了她信用卡', confidence: 1 }],
    initiative: { desire: 1, topic: '提醒 API key', reason: 'secret' },
  })
  assert.equal(value.preferenceCandidates.length, 0)
  assert.equal(value.goalCandidates.length, 0)
  assert.equal(value.identityEvidence.length, 0)
  assert.equal(value.relationshipCandidates.length, 0)
  assert.equal(value.initiative, null)
})
