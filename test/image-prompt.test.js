import test from 'node:test'
import assert from 'node:assert/strict'

import { buildElements, modelPrompt, templatePrompt } from '../src/media/image-prompt.js'

test('camera template injects life state and defers appearance to the reference image', () => {
  const cfg = {}
  const state = {
    what: '休息', outfit: '蓝色女仆裙', clock: '16:20', light: '午后侧光', location: '宿舍书桌',
  }
  const elements = buildElements(cfg, { type: 'selfie', hint: '这段人工提示应被忽略', outfit: '礼服', __seed: 'shot-a' }, state)
  const prompt = templatePrompt(cfg, elements, true)
  assert.match(prompt, /16:20/)
  assert.match(prompt, /宿舍书桌/)
  assert.match(prompt, /蓝色女仆裙/)
  assert.match(prompt, /以参考图保持同一个人/)
  assert.equal(elements.type, 'character')
  assert.doesNotMatch(prompt, /自拍|手机前置|刷手机|举着手机/)
  assert.match(prompt, /发型是可变化状态/)
  assert.match(prompt, /延续参考图细腻清透的日系二次元画风/)
  assert.match(prompt, /细节必须来自当前人物动作与场景/)
  assert.doesNotMatch(prompt, /人工提示|礼服/)
  assert.ok(!prompt.includes('虹膜纹理'))

  const other = templatePrompt(cfg, buildElements(cfg, { type: 'selfie', __seed: 'shot-b' }, state), true)
  assert.notEqual(other, prompt, 'two shots should receive different mutable appearance/composition details')
})

test('the character can choose a full-length rear view in both expansion paths', async () => {
  const cfg = { 模型参数: { provider: 'test', model: 'test' } }
  const framing = '从远处拍沿着树影走过的全身背影'
  const elements = buildElements(cfg, { framing }, { what: '沿校园小路散步', location: '校园' })
  assert.ok(templatePrompt(cfg, elements, true).includes(framing))
  let instructions
  await modelPrompt({ llm: { async *stream(req) {
    instructions = req.messages[0].content.at(-1).text
    yield { type: 'text-delta', text: framing.repeat(5) }
  } } }, null, cfg, elements, true)
  assert.ok(instructions.includes(framing))
  assert.doesNotMatch(instructions, /手机前置|脸在画面里|刷手机/)
  const usingPhone = buildElements(cfg, {}, { what: '坐在长椅上用手机查路线', location: '校园' })
  assert.match(templatePrompt(cfg, usingPhone), /用手机查路线/)
})

test('scene template inherits the illustration language without adding the character', () => {
  const state = {
    what: '拍窗边的咖啡杯', outfit: '针织衫', clock: '15:10', light: '午后柔光', location: '咖啡屋',
  }
  const prompt = templatePrompt({}, buildElements({}, { type: 'scene', __seed: 'scene-a' }, state), false)
  assert.match(prompt, /细腻清透的日系二次元画风/)
  assert.doesNotMatch(prompt, /人物要求：以参考图保持同一个人/)
})
