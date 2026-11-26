import test from 'node:test'
import assert from 'node:assert/strict'
import { turnContext } from '../src/plugin/turn-context.js'
import { defaultMind } from '../src/cognition/mind.js'
import { defaultContinuity } from '../src/life/continuity.js'

const life = {
  chatFacts: { date: '2026-11-26', clock: '16:08', next: '17:00 买菜', recent: ['吃午饭'], tomorrow: '早课' },
  current: { what: '改稿', outfit: '蓝衬衣' }, world: { location: { name: '咖啡屋' } },
}
const state = defaultContinuity()
state.tasks.push({ id: 'a', title: '取快递', status: 'open' })
state.people.push({ name: '小满', relation: '室友', status: 'active' })
const focus = { title: '取快递' }
const mind = defaultMind()
mind.memories = [{ summary: '喜欢海盐面包', status: 'active', confidence: 1, importance: 1, updatedAt: Date.now() }]
const diary = ['26', '25', '24'].map(day => ({ date: '2026-11-' + day, segments: [{ what: '记录' + day }] }))
const render = (query, extra) => turnContext({ query, life, mind, state, focus, diary, ...extra })

test('casual turns contain clock, current place and activity but no unrelated records', () => {
  for (const q of ['', '嗯', '今天好冷']) {
    const out = render(q)
    assert.match(out, /16:08 · 咖啡屋 · 改稿/)
    assert.doesNotMatch(out, /取快递|小满|记录|面包|蓝衬衣|买菜|早课/)
    assert.ok(out.length < 350)
  }
  assert.equal(turnContext({ life: { text: '' } }), '')
})

test('follow-up questions select the relevant timeframe, person, memory and unfinished work', () => {
  assert.match(render('明天呢'), /明天预计：早课/)
  assert.match(render('你接下来做什么'), /接下来预计：17:00 买菜/)
  assert.match(render('刚才呢'), /刚才：吃午饭/)
  assert.match(render('昨天做了什么'), /记录25/)
  assert.doesNotMatch(render('昨天做了什么'), /记录24|记录26/)
  assert.match(render('小满是谁'), /小满，室友/)
  assert.equal((render('有啥待办').match(/取快递/g) || []).length, 1)
  assert.match(render('取消取快递'), /task:a/)
  assert.match(render('想买海盐面包'), /喜欢海盐面包/)
  assert.doesNotMatch(render('想买海盐面包', { config: { 记忆启用: false } }), /喜欢海盐面包/)
})

test('overlong optional details cannot displace current facts or exceed the total budget', () => {
  const preferences = Array.from({ length: 6 }, () => ({ status: 'active', confidence: 1, key: '聊天媒介', value: '长'.repeat(400) }))
  const out = render('昨天刚才穿什么 接下来 明天的安排 小满 取快递 海盐面包', { mind: { ...mind, preferences }, inner: '长'.repeat(300) })
  assert.match(out, /^此刻：2026-11-26/)
  assert.ok(out.length <= 1200)
})


test('required facts keep their slot even when the budget cannot hold everything', () => {
  const out = turnContext({ query: '', life, mind, budget: 80 })
  assert.match(out, /^此刻：2026-11-26/)
})

test('required facts have their own cap and shed the lowest priority first', () => {
  const out = turnContext({ query: '', life, mind, budget: 120 })
  assert.match(out, /^此刻：2026-11-26/)
  assert.doesNotMatch(out, /说话：/)
})
