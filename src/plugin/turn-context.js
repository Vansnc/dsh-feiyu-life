// The chat receives a bounded selection. Planning and the settings views keep
// their detailed evidence, entity IDs and full timeline.
import { continuityView, activePeople } from '../life/continuity.js'
import { retrieveMemories } from '../cognition/mind.js'
import { chatHint } from './context-hints.js'

const clip = (value, size = 100) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, size)
const wantsPast = /昨天|前天|前几天|这几天|最近|上次|之前|还记得/
export const wantsTomorrow = /明天|明早|明晚|明儿/
const wantsPlans = /计划|安排|约定|待办|目标|进展|打算|挂念/
export const needsDiary = (query, gapHours) => wantsPast.test(query) || gapHours >= 24

// Match fragments as well as whole titles, e.g. “还书了吗” / “去图书馆还书”.
function relevant(query, value) {
  const name = clip(value).toLowerCase()
  if (!query || !name) return false
  if (query.includes(name)) return true
  return name.match(/[\p{L}\p{N}]{2,}/gu)?.some(word => {
    for (let i = 1; i < word.length; i++) if (query.includes(word.slice(i - 1, i + 1))) return true
    return false
  }) || false
}

export function turnContext({ life, query = '', gapHours = 0, mind, config = {}, inner, state, focus, diary = [], timeZone }) {
  if (!life?.chatFacts) return ''
  const q = clip(query, 500).toLowerCase()
  const facts = life.chatFacts
  const world = life.world || {}
  const location = [world.location?.name, world.moving && world.destination?.name].filter(Boolean).join(' → ')
  const lines = []
  let used = 0
  function add(label, value, max = 140) {
    const entry = clip(value, max)
    if (!entry) return
    const line = label ? `${label}：${entry}` : entry
    if (used + line.length + 1 > 1200) return
    lines.push(line)
    used += line.length + 1
  }
  add('此刻', [facts.date, facts.clock, location, life.current?.what, life.reply?.label, life.vitality?.energy < 35 && life.vitality?.label].filter(Boolean).join(' · '), 220)
  add('', '这些是她自己的生活背景。按对方这句话回应；计划只有在真实时间线完成后才能当作经历。')
  if (mind) {
    add('自我', [mind.identity?.narrative, ...(mind.identity?.traits || []), ...(mind.identity?.values || [])].filter(Boolean).join('，'), 150)
    add('', chatHint(null, gapHours))
  }
  add('', inner)
  if (wantsTomorrow.test(q)) add('明天预计', facts.tomorrow)
  if (/接下来|等会|待会|稍后|今天.*安排/.test(q)) add('接下来预计', facts.next)
  if (/刚才|刚刚|刚做|今天.*做了/.test(q)) add('刚才', facts.recent.join('，然后'))
  if (/穿|衣服|打扮|照片|自拍/.test(q)) add('衣着', life.current?.outfit)
  if (/身体|累|困|精神|睡得|舒服|心情/.test(q)) add('身体', [life.vitality?.energy < 35 ? '' : life.vitality?.label, ...(life.today || [])].filter(Boolean).join('，'))
  if (/最近|怎么样|咋样|新鲜|趣事|发生/.test(q) || relevant(q, life.moment?.title)) add('生活小事', life.moment?.text)

  if (state) {
    const items = continuityView(state, { timeZone }).entities
    const people = activePeople(state).filter(p => q.includes(p.name))
    for (const p of people.slice(0, 2)) add('认识的人', [p.name, p.relation, p.notes].filter(Boolean).join('，'))
    const related = items.filter(x => relevant(q, x.title) || people.some(p => p.id === x.personId))
    const selected = (wantsPlans.test(q) ? [...new Set([...related, ...items])] : related).slice(0, 3)
    for (const x of selected) {
      const ref = /改|取消|删除|完成|推迟|提前/.test(q) ? x.kind + ':' + x.id : ''
      add('未完成', [x.title, x.due.label, x.nextStep, ref].filter(Boolean).join('，'))
    }
    if (focus && (wantsPlans.test(q) || relevant(q, focus.title)) && !selected.some(x => x.title === focus.title)) add('当前意图', focus.title)
    if (needsDiary(q, gapHours)) {
      const offset = q.includes('昨天') ? 1 : q.includes('前天') ? 2 : 0
      const date = offset ? new Date(Date.parse(facts.date + 'T00:00:00Z') - offset * 86400000).toISOString().slice(0, 10) : ''
      const day = diary.find(x => (date ? x.date === date : x.date < facts.date) && x.segments?.length)
      if (day) add(day.date + ' 已发生', day.segments.slice(-2).map(x => x.what).join('，然后'))
    }
  }
  if (mind) {
    const askedOwner = /我(喜欢|偏好|爱吃)/.test(q) ? 'user' : /你(喜欢|偏好|爱吃)/.test(q) ? 'self' : ''
    const prefs = mind.preferences.filter(p => p.status === 'active' && p.confidence >= 0.7 && (p.owner === askedOwner || relevant(q, p.key) || relevant(q, p.value) || /聊天媒介|称呼/.test(p.key)))
    for (const p of prefs.slice(-2)) add(p.owner === 'self' ? '她的偏好' : '对方的偏好', p.key + ' · ' + p.value)
    const goals = mind.goals.filter(g => g.status === 'active' && (wantsPlans.test(q) || relevant(q, g.title)))
    for (const g of goals.slice(-2)) if (!lines.some(line => line.includes(g.title))) add('虚拟目标', g.title)
    const relation = mind.relationships.find(r => q.includes(r.name) || (r.name === '用户' && /我们|我俩|你对我/.test(q)))
    if (relation) add('主观感受', relation.summary)
    if (config.记忆启用 !== false && q.length >= 2) {
      let remaining = config.召回字数 ?? 800
      for (const item of retrieveMemories(mind, q, config).filter(m => relevant(q, m.summary)).slice(0, 2)) {
        const summary = clip(item.summary, Math.min(120, remaining))
        if (summary && !lines.some(line => line.includes(summary))) add('想起', summary)
        remaining -= summary.length
      }
    }
  }
  return lines.join('\n')
}
