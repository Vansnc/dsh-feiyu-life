// 事实层：把域状态翻译成结构化 Fact（kind / text / priority / ttl / topics）。
// 这里不写整段句子，也不决定去留；挑选、裁剪和渲染由 turn-context.js 负责。
// 好处：改句式只动渲染层，改状态只动域层，两边不再粘在一起。
import { continuityView, activePeople } from '../life/continuity.js'
import { retrieveMemories } from '../cognition/mind.js'

const clip = (value, size = 100) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, size)

export const wantsPast = /昨天|前天|前几天|这几天|最近|上次|之前|还记得/
export const wantsTomorrow = /明天|明早|明晚|明儿/
export const wantsPlans = /计划|安排|约定|待办|目标|进展|打算|挂念/
export const needsDiary = (query, gapHours) => wantsPast.test(query) || gapHours >= 24

// Match fragments as well as whole titles, e.g. “还书了吗” / “去图书馆还书”.
export function relevant(query, value) {
  const name = clip(value).toLowerCase()
  if (!query || !name) return false
  if (query.includes(name)) return true
  return name.match(/[\p{L}\p{N}]{2,}/gu)?.some(word => {
    for (let i = 1; i < word.length; i++) if (query.includes(word.slice(i - 1, i + 1))) return true
    return false
  }) || false
}

/**
 * 一条事实：kind 决定它是什么，text 是可读内容，priority 决定预算不够时谁先被砍，
 * ttlMinutes 留给将来「过期自动丢弃」（0 = 跟着状态走，不单独过期），topics 用来按来信话题触发。
 */
export function makeFact(kind, text, opts = {}) {
  const body = clip(text, opts.max || 240)
  if (!body) return null
  return {
    kind,
    text: body,
    label: String(opts.label || ''),
    priority: Math.max(1, Math.min(100, Number(opts.priority) || 50)),
    ttlMinutes: Math.max(0, Number(opts.ttlMinutes) || 0),
    topics: Array.isArray(opts.topics) ? opts.topics : [],
  }
}

// ── life：当前时刻、时间线、小事、身体、衣着 ──
export function lifeFacts(life) {
  const facts = []
  if (!life?.chatFacts) return facts
  const meta = life.chatFacts || {}
  const world = life.world || {}
  const location = [world.location?.name, world.moving && world.destination?.name].filter(Boolean).join(' → ')
  facts.push(makeFact('now', [meta.date, meta.clock, location, life.current?.what, life.reply?.label, life.vitality?.energy < 35 && life.vitality?.label].filter(Boolean).join(' · '), { label: '此刻', priority: 100, max: 180 }))
  facts.push(makeFact('context', '这些是她自己的生活背景。按对方这句话回应；计划只有在真实时间线完成后才能当作经历。', { priority: 96, max: 120 }))
  facts.push(makeFact('rule', '这是你自己的日子，别当时间表念：不提时间段、不列清单，他问起挑一两件说就行；别改正在做的事、地点和手机状态。他说自己在地铁/公司/家，那是他的场景，别安到你身上。', { label: '说话', priority: 97, max: 180 }))
  if (meta.tomorrow) facts.push(makeFact('tomorrow', meta.tomorrow, { label: '明天预计', priority: 55, topics: ['明天', '明早', '明晚', '明儿'] }))
  if (meta.next) facts.push(makeFact('next', meta.next, { label: '接下来预计', priority: 55, topics: ['接下来', '等会', '待会', '稍后', '安排'] }))
  if (meta.recent?.length) facts.push(makeFact('recent', meta.recent.join('，然后'), { label: '刚才', priority: 60, topics: ['刚才', '刚刚', '刚做', '今天.*做了'] }))
  if (life.current?.outfit) facts.push(makeFact('outfit', life.current.outfit, { label: '衣着', priority: 50, topics: ['穿', '衣服', '打扮', '照片', '自拍'] }))
  const body = [life.vitality?.energy < 35 ? '' : life.vitality?.label, ...(life.today || [])].filter(Boolean).join('，')
  if (body) facts.push(makeFact('body', body, { label: '身体', priority: 50, topics: ['身体', '累', '困', '精神', '睡得', '舒服', '心情'] }))
  if (life.moment?.text) facts.push(makeFact('moment', life.moment.text, { label: '生活小事', priority: 55, topics: ['最近', '怎么样', '咋样', '新鲜', '趣事', '发生'] }))
  return facts.filter(Boolean)
}

// ── mind：自我、偏好、目标、关系、记忆召回 ──
export function mindFacts(mind, ctx = {}) {
  const { query = '', config = {} } = ctx
  const facts = []
  if (!mind) return facts
  const narrative = String(mind.identity?.narrative || '').replace(/[。；;，,]+$/, '')
  const identity = [narrative, ...(mind.identity?.traits || []), ...(mind.identity?.values || [])].filter(Boolean).join('，')
  if (identity) facts.push(makeFact('self', identity, { label: '自我', priority: 90, max: 120 }))
  const askedOwner = /我(喜欢|偏好|爱吃)/.test(query) ? 'user' : /你(喜欢|偏好|爱吃)/.test(query) ? 'self' : ''
  const prefs = (mind.preferences || []).filter(p => p.status === 'active' && p.confidence >= 0.7 && (p.owner === askedOwner || relevant(query, p.key) || relevant(query, p.value) || /聊天媒介|称呼/.test(p.key)))
  for (const p of prefs.slice(-2)) facts.push(makeFact('preference', `${p.key} · ${p.value}`, { label: p.owner === 'self' ? '她的偏好' : '对方的偏好', priority: 62 }))
  const goals = (mind.goals || []).filter(g => g.status === 'active' && (wantsPlans.test(query) || relevant(query, g.title)))
  for (const g of goals.slice(-2)) facts.push(makeFact('goal', g.title, { label: '虚拟目标', priority: 58 }))
  const relation = (mind.relationships || []).find(r => query.includes(r.name) || (r.name === '用户' && /我们|我俩|你对我/.test(query)))
  if (relation) facts.push(makeFact('relation', relation.summary, { label: '主观感受', priority: 55 }))
  if (config.记忆启用 !== false && query.length >= 2) {
    for (const item of retrieveMemories(mind, query, config).filter(m => relevant(query, m.summary)).slice(0, 2)) facts.push(makeFact('memory', item.summary, { label: '想起', priority: 60 }))
  }
  return facts.filter(Boolean)
}

// ── reflection：情绪底色 ──
export function affectFacts(inner) {
  return inner ? [makeFact('mood', inner, { priority: 88 })] : []
}

// ── continuity：人物、未完成、当前意图、日记 ──
export function continuityFacts(state, ctx = {}) {
  const { query = '', timeZone, diary = [], focus, gapHours = 0, date = '' } = ctx
  const facts = []
  if (!state) return facts
  const items = continuityView(state, { timeZone }).entities
  const people = activePeople(state).filter(p => query.includes(p.name))
  for (const p of people.slice(0, 2)) facts.push(makeFact('person', [p.name, p.relation, p.notes].filter(Boolean).join('，'), { label: '认识的人', priority: 70 }))
  const related = items.filter(x => relevant(query, x.title) || people.some(p => p.id === x.personId))
  const selected = (wantsPlans.test(query) ? [...new Set([...related, ...items])] : related).slice(0, 3)
  for (const x of selected) {
    const ref = /改|取消|删除|完成|推迟|提前/.test(query) ? x.kind + ':' + x.id : ''
    facts.push(makeFact('plan', [x.title, x.due.label, x.nextStep, ref].filter(Boolean).join('，'), { label: '未完成', priority: 66 }))
  }
  if (focus && (wantsPlans.test(query) || relevant(query, focus.title)) && !selected.some(x => x.title === focus.title)) {
    facts.push(makeFact('focus', focus.title, { label: '当前意图', priority: 60 }))
  }
  if (needsDiary(query, gapHours) && date) {
    const offset = query.includes('昨天') ? 1 : query.includes('前天') ? 2 : 0
    const target = offset ? new Date(Date.parse(date + 'T00:00:00Z') - offset * 86400000).toISOString().slice(0, 10) : ''
    const day = diary.find(x => (target ? x.date === target : x.date < date) && x.segments?.length)
    if (day) facts.push(makeFact('diary', day.segments.slice(-2).map(x => x.what).join('，然后'), { label: day.date + ' 已发生', priority: 65 }))
  }
  return facts.filter(Boolean)
}

// ── 聊天规则（固定事实，预算不够时最先砍）──
export function chatFacts(gapHours = 0, buildHint) {
  const hint = typeof buildHint === 'function' ? buildHint(gapHours) : ''
  return hint ? [makeFact('hint', hint, { priority: 80, max: 200 })] : []
}

// ── 外层：挑选 + 渲染 ──
export function renderFact(fact) {
  return fact.label ? `${fact.label}：${fact.text}` : fact.text
}

// 必选项先占位：这些事实无论预算多紧都要优先留下，避免被低优先级短句挤掉。
// 但必选组本身也有上限（总预算的 60%），超了就从优先级最低的开始砍——先砍「说话」，别砍「此刻」。
const REQUIRED_KINDS = new Set(['now', 'rule', 'self', 'context', 'hint'])
const REQUIRED_SHARE = 0.75

export function selectFacts(facts, { query = '', budget = 1200 } = {}) {
  const candidates = facts.filter(Boolean).filter((fact) => {
    if (!fact.topics.length) return true
    return fact.topics.some((topic) => new RegExp(topic).test(query))
  })
  const required = candidates.filter(f => REQUIRED_KINDS.has(f.kind))
  const optional = candidates.filter(f => !REQUIRED_KINDS.has(f.kind)).sort((a, b) => b.priority - a.priority)
  const requiredBudget = Math.round(budget * REQUIRED_SHARE)
  const kept = new Set()
  let used = 0
  // 必选组：按优先级从高到低放，超过必选预算就停；只有「此刻」是硬保底
  for (const fact of required.slice().sort((a, b) => b.priority - a.priority)) {
    const line = renderFact(fact)
    if (fact.kind !== 'now' && used + line.length + 1 > requiredBudget) break
    kept.add(fact)
    used += line.length + 1
  }
  const picked = required.filter(f => kept.has(f))
  // 剩余预算按优先级从高到低填；放不下就停（后面只会更低）
  for (const fact of optional) {
    const line = renderFact(fact)
    if (used + line.length + 1 > budget) break
    picked.push(fact)
    used += line.length + 1
  }
  return picked
}

export function renderFacts(facts) {
  return facts.map(renderFact).join('\n')
}
