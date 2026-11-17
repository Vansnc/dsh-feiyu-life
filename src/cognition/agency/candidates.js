import { AGENCY_LIMITS, clamp, text, sensitiveText } from './schema.js'

export function sourceMap(continuity, mind, candidates = []) {
  const map = new Map()
  for (const entity of Array.isArray(candidates) ? candidates : []) {
    if (!map.has(entity?.sourceKey)) map.set(entity.sourceKey, { ...entity, status: 'active' })
  }
  for (const [kind, list] of [['task', continuity?.tasks], ['commitment', continuity?.commitments], ['thread', continuity?.threads]]) {
    for (const entity of Array.isArray(list) ? list.slice(-20) : []) {
      map.set(`continuity:${kind}:${entity.id}`, {
        ...entity, sourceType: kind,
        sourceUpdatedAt: Math.max(0, Number(entity.updatedAt) || 0),
      })
    }
  }
  for (const goal of Array.isArray(mind?.goals) ? mind.goals.slice(-20) : []) {
    map.set(`mind:goal:${goal.id}`, {
      ...goal, sourceType: 'goal', sourceUpdatedAt: Math.max(0, Number(goal.updatedAt) || 0),
    })
  }
  return map
}

function dueRank(entity, now) {
  const due = Number(entity?.dueAt) || 0
  if (!due) return 5
  const delta = due - now
  if (delta < 0) return 0
  if (delta <= 6 * 3600000) return 1
  if (delta <= 36 * 3600000) return 2
  return 3
}

function stepsFor(entity, type) {
  if (type === 'rest') return [{ label: text(entity.nextStep, 120) || '先休息一下', kind: 'rest', status: 'active', evidence: '' }]
  if (type === 'goal' || type === 'thread') {
    return [
      { label: `复盘：${text(entity.title, 100)}`, kind: 'review', status: 'active', evidence: '' },
      { label: entity.nextStep ? `下一步：${text(entity.nextStep, 120)}` : '等待真实进展', kind: 'wait', status: 'pending', evidence: '' },
    ]
  }
  if (type === 'interest' || type === 'relationship') {
    return [
      { label: `想一想：${text(entity.title, 100)}`, kind: 'review', status: 'active', evidence: '' },
      { label: '放回心里，不急着说', kind: 'wait', status: 'pending', evidence: '' },
    ]
  }
  return [
    { label: '等待合适时机', kind: 'wait', status: 'active', evidence: '' },
    { label: '完成后再确认', kind: 'confirm', status: 'pending', evidence: '' },
  ]
}

export function candidateForEntity(entity, sourceKey, now) {
  const type = entity.sourceType
  if (type === 'goal' && entity.status !== 'active') return null
  if (type === 'goal' && entity.scope && !['virtual', 'local'].includes(entity.scope)) return null
  if (['task', 'commitment'].includes(type) && !['open', 'paused'].includes(entity.status)) return null
  if (type === 'thread' && entity.status !== 'active') return null
  const due = dueRank(entity, now)
  const dueAt = Math.max(0, Number(entity.dueAt) || 0)
  let score = type === 'commitment' ? 64 : type === 'task' ? 58 : type === 'thread' ? 62 : 54
  if (due === 0) score += 26
  else if (due === 1) score += 18
  else if (due === 2) score += 8
  if (type === 'thread') score += Math.max(0, 100 - (Number(entity.progress) || 0)) * 0.08
  if (entity.nextStep) score += 4
  if (entity.personId) score += 3
  if (type === 'goal' && Number(entity.progress) > 70) score += 3
  const cost = type === 'task' ? 1 : type === 'commitment' ? 2 : type === 'thread' ? 3 : 2
  score -= cost * 4
  return {
    id: `agc-${sourceKey.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48)}`,
    sourceKey,
    sourceId: text(entity.id, 120),
    sourceType: type,
    scope: ['virtual', 'local'].includes(entity.scope) ? entity.scope : '',
    title: text(entity.title, 120),
    detail: text(entity.detail, 180),
    nextStep: text(entity.nextStep, 160),
    dueAt,
    dueLabel: dueAt ? (due === 0 ? '已经逾期' : due === 1 ? '今天到期' : due === 2 ? '这两天到期' : '有期限') : '',
    sourceUpdatedAt: Math.max(0, Number(entity.sourceUpdatedAt || entity.updatedAt) || 0),
    expiresAt: 0,
    priority: type === 'commitment' ? 80 : type === 'task' ? 70 : type === 'thread' ? 72 : 60,
    score: clamp(score, 0, 100, 50),
    cost,
    risk: 0,
    steps: stepsFor(entity, type),
    stepIndex: 0,
    progress: clamp(entity.progress, 0, 100, 0),
    reason: dueAt ? '有实际截止时间' : (entity.nextStep ? '有明确下一步' : '还没完成'),
  }
}

/** Pure candidates from persisted sources; no invented people/places/weather. */
export function buildAgencyCandidates({ now = Date.now(), continuity, mind, vitality = {}, affect = {}, events = [] } = {}) {
  const map = sourceMap(continuity, mind)
  const out = []
  const needAt = Math.max(0, Number(continuity?.needs?.updatedAt) || 0)
  const affectAt = Math.max(0, Number(affect?.lastEventAt) || 0)
  for (const [sourceKey, entity] of map) {
    const candidate = candidateForEntity(entity, sourceKey, now)
    if (candidate && candidate.title) out.push(candidate)
  }
  if (Number(vitality.energy) < 45) {
    out.push({
      id: 'agc-need-energy', sourceKey: 'needs:energy', sourceId: 'energy', sourceType: 'rest',
      title: '给自己留点空隙', detail: '精力偏低', nextStep: '先休息一下，别硬撑',
      dueAt: 0, dueLabel: '', sourceUpdatedAt: needAt, expiresAt: 0,
      priority: 55, score: 56, cost: 1, risk: 0,
      steps: [{ label: '先休息一下，别硬撑', kind: 'rest', status: 'active', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '精力偏低',
    })
  }
  if (Number(affect.valence) < 35) {
    out.push({
      id: 'agc-need-mood', sourceKey: 'needs:mood', sourceId: 'mood', sourceType: 'rest',
      title: '缓一缓', detail: '情绪偏低', nextStep: '不急着处理所有事',
      dueAt: 0, dueLabel: '', sourceUpdatedAt: affectAt, expiresAt: 0,
      priority: 50, score: 50, cost: 1, risk: 0,
      steps: [{ label: '不急着处理所有事', kind: 'rest', status: 'active', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '情绪偏低',
    })
  }
  if (Number(continuity?.needs?.stress) > 75) {
    out.push({
      id: 'agc-need-stress', sourceKey: 'needs:stress', sourceId: 'stress', sourceType: 'rest',
      title: '松一口气', detail: '压力偏高', nextStep: '先把手头的事放一放',
      dueAt: 0, dueLabel: '', sourceUpdatedAt: needAt,
      expiresAt: 0, priority: 45, score: 48, cost: 1, risk: 0,
      steps: [{ label: '先把手头的事放一放', kind: 'rest', status: 'active', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '压力偏高',
    })
  }
  if (Number(continuity?.needs?.socialNeed) > 70) {
    out.push({
      id: 'agc-need-social', sourceKey: 'needs:social', sourceId: 'social', sourceType: 'relationship',
      title: '想找人说说话', detail: '社交需求偏高', nextStep: '找合适的时机和人聊两句',
      dueAt: 0, dueLabel: '', sourceUpdatedAt: needAt,
      expiresAt: 0, priority: 45, score: 45, cost: 2, risk: 0,
      steps: [{ label: '等一个不打扰人的时机', kind: 'wait', status: 'active', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '社交需求偏高',
    })
  }
  for (const memory of Array.isArray(mind?.memories) ? mind.memories.slice(-8) : []) {
    if (memory.kind !== 'promise' || memory.status !== 'active' || !memory.summary || sensitiveText.test(memory.summary)) continue
    const sourceKey = `mind:promise:${memory.id}`
    out.push({
      id: `agc-${sourceKey.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48)}`,
      sourceKey, sourceId: text(memory.id, 120), sourceType: 'task',
      title: `答应过：${text(memory.summary, 100)}`, detail: '一个明确的承诺',
      nextStep: '', dueAt: 0, dueLabel: '', sourceUpdatedAt: Number(memory.updatedAt) || 0,
      expiresAt: Number(memory.expiresAt) || (Number(memory.updatedAt) ? Number(memory.updatedAt) + 7 * 86400000 : 0), priority: 45, score: 45, cost: 1, risk: 0,
      steps: [{ label: '等合适的时机兑现', kind: 'wait', status: 'active', evidence: '' }, { label: '兑现后再确认', kind: 'confirm', status: 'pending', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '明确承诺',
    })
  }
  for (const person of Array.isArray(continuity?.people) ? continuity.people.slice(-12) : []) {
    if (person.status !== 'active' || !person.notes || sensitiveText.test(person.notes) || Number(person.updatedAt) < now - 7 * 86400000) continue
    const sourceKey = `relationship:${person.id}`
    out.push({
      id: `agc-${sourceKey.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48)}`,
      sourceKey, sourceId: text(person.id, 120), sourceType: 'relationship',
      title: `想起${text(person.name, 40)}: ${text(person.notes, 100)}`, detail: '最近记录的关系',
      nextStep: '', dueAt: 0, dueLabel: '', sourceUpdatedAt: Number(person.updatedAt) || 0,
      expiresAt: Number(person.updatedAt) ? Number(person.updatedAt) + 3 * 86400000 : 0, priority: 35, score: 42, cost: 1, risk: 0,
      steps: [{ label: `想一想：${text(person.name, 40)}`, kind: 'review', status: 'active', evidence: '' }, { label: '等自然的话题出现', kind: 'wait', status: 'pending', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '最近记录的关系',
    })
  }
  // Persisted self preferences are low-priority interests, not requests for
  // the user to do anything. TTL keeps them from becoming permanent clutter.
  for (const pref of Array.isArray(mind?.preferences) ? mind.preferences.slice(-12) : []) {
    if (pref.owner !== 'self' || pref.status !== 'active' || !pref.key || sensitiveText.test(`${pref.key} ${pref.value}`)) continue
    const sourceKey = `mind:preference:${pref.id || pref.key}`
    out.push({
      id: `agc-${sourceKey.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48)}`,
      sourceKey, sourceId: text(pref.id || pref.key, 120), sourceType: 'interest',
      title: `想${text(pref.key, 60)}：${text(pref.value, 100)}`, detail: '自己的偏好',
      nextStep: '', dueAt: 0, dueLabel: '', sourceUpdatedAt: Number(pref.updatedAt) || 0,
      expiresAt: Number(pref.updatedAt) ? Number(pref.updatedAt) + 7 * 86400000 : 0, priority: 40, score: 40, cost: 1, risk: 0,
      steps: [{ label: `想一想：${text(pref.key, 60)}`, kind: 'review', status: 'active', evidence: '' }, { label: '放回心里，不急着说', kind: 'wait', status: 'pending', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '自己的偏好',
    })
  }
  // A persisted recent event can become a quiet reflection candidate. It is
  // intentionally low priority and expires quickly; it never invents details.
  for (const event of Array.isArray(events) ? events.slice(-4) : []) {
    const summary = text(event?.summary || event?.reason || event?.text, 120)
    if (!summary || !event?.id || sensitiveText.test(summary)) continue
    const at = Math.max(0, Number(event.at) || now)
    out.push({
      id: `agc-event-${String(event.id).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40)}`,
      sourceKey: `event:${event.id}`, sourceId: text(event.id, 120), sourceType: 'interest',
      title: `想起：${summary}`, detail: '最近落盘的经历', nextStep: '', dueAt: 0, dueLabel: '',
      sourceUpdatedAt: at, expiresAt: at + 24 * 3600000, priority: 35, score: 38, cost: 1, risk: 0,
      steps: [{ label: '想一想这段经历', kind: 'review', status: 'active', evidence: '' }, { label: '只是想一想，不急着说', kind: 'wait', status: 'pending', evidence: '' }],
      stepIndex: 0, progress: 0, reason: '近期经历',
    })
  }
  return out.filter((x) => !x.expiresAt || x.expiresAt > now).sort((a, b) => b.score - a.score || a.sourceKey.localeCompare(b.sourceKey)).slice(0, AGENCY_LIMITS.candidates)
}

