import test from 'node:test'
import assert from 'node:assert/strict'

import { buildElements, templatePrompt } from '../image-prompt.js'

test('camera template injects life state and defers appearance to the reference image', () => {
  const cfg = { 风格: '细腻日系手绘插画' }
  const elements = buildElements(cfg, { type: 'selfie', hint: '在窗边自拍' }, {
    what: '休息', outfit: '蓝色女仆裙', clock: '16:20', light: '午后侧光', location: '宿舍书桌',
  })
  const prompt = templatePrompt(cfg, elements, true)
  assert.match(prompt, /16:20/)
  assert.match(prompt, /宿舍书桌/)
  assert.match(prompt, /蓝色女仆裙/)
  assert.match(prompt, /细腻日系手绘插画/)
  assert.match(prompt, /参考图为准/)
  assert.match(prompt, /不要怼脸/)
  assert.ok(!prompt.includes('虹膜纹理'))
})
