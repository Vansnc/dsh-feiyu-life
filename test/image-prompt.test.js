import test from 'node:test'
import assert from 'node:assert/strict'

import { buildElements, templatePrompt } from '../image-prompt.js'

test('camera template honors configured lens, details and style', () => {
  const cfg = {
    镜头: '85mm 近景，眼睛精确合焦',
    细节: '虹膜纹理、分束发丝、蕾丝纤维和衣料褶皱',
    风格: '细腻日系手绘插画',
    表情: '浅笑',
  }
  const elements = buildElements(cfg, { type: 'selfie', hint: '在窗边自拍' }, {
    what: '休息', outfit: '蓝色女仆裙', clock: '16:20', light: '午后侧光', location: '宿舍书桌',
  })
  const prompt = templatePrompt(cfg, elements)
  assert.match(prompt, /85mm 近景，眼睛精确合焦/)
  assert.match(prompt, /虹膜纹理、分束发丝、蕾丝纤维和衣料褶皱/)
  assert.match(prompt, /细腻日系手绘插画/)
  assert.match(prompt, /脸、眼睛、发丝和衣料清楚/)
})
