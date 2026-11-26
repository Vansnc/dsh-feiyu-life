// 外层：从事实层收集 Fact，按话题挑、按预算裁剪，再统一渲染成注入文本。
// 句式只在这里定义；改措辞不需要动生活线或认知层的生成逻辑。
import { lifeFacts, mindFacts, affectFacts, continuityFacts, chatFacts, selectFacts, renderFacts } from './facts.js'
import { chatHint } from './context-hints.js'

export { wantsTomorrow, needsDiary } from './facts.js'

export function turnContext({ life, query = '', gapHours = 0, mind, config = {}, inner, state, focus, diary = [], timeZone, budget = 1200 }) {
  if (!life?.chatFacts) return ''
  const q = String(query || '').slice(0, 500).toLowerCase()
  const facts = [
    ...lifeFacts(life),
    ...affectFacts(inner),
    ...mindFacts(mind, { query: q, config }),
    ...continuityFacts(state, { query: q, timeZone, diary, focus, gapHours, date: life.chatFacts?.date || '' }),
    ...chatFacts(gapHours, (g) => chatHint(null, g)),
  ]
  return renderFacts(selectFacts(facts, { query: q, budget }))
}
