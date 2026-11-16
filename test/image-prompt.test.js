import test from 'node:test'
import assert from 'node:assert/strict'

import { buildElements, templatePrompt } from '../image-prompt.js'

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
  assert.match(prompt, /不要怼脸/)
  assert.match(prompt, /发型是可变化状态/)
  assert.match(prompt, /细节必须来自当前人物动作与场景/)
  assert.doesNotMatch(prompt, /人工提示|礼服/)
  assert.ok(!prompt.includes('虹膜纹理'))

  const other = templatePrompt(cfg, buildElements(cfg, { type: 'selfie', __seed: 'shot-b' }, state), true)
  assert.notEqual(other, prompt, 'two shots should receive different mutable appearance/composition details')
})
