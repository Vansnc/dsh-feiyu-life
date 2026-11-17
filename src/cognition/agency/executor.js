import { AGENCY_LIMITS } from './schema.js'

export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

export function mergeSteps(existing = [], incoming = []) {
  return incoming.map((step, i) => {
    const old = existing[i]
    if (old && (old.status === 'done' || old.status === 'skipped')) {
      return { ...step, label: old.label, status: old.status, evidence: old.evidence }
    }
    if (old && old.status === 'active' && step.status === 'pending') return { ...step, status: 'active' }
    return { ...step }
  })
}

export function advanceProgress(steps, evidence, now) {
  // A review step is the safe internal action. Do not advance a waiting step
  // before that review has actually been recorded.
  if (steps.some((x) => x.kind === 'review' && x.status !== 'done')) return { steps, stepIndex: 0 }
  const index = steps.findIndex((x) => x.status === 'active' && x.kind !== 'review')
  if (index < 0) return { steps, stepIndex: 0 }
  const updated = steps.map((x, i) => i === index ? { ...x, status: 'done', evidence } : x)
  const next = updated[index + 1]
  if (next && next.status === 'pending') next.status = 'active'
  return { steps: updated, stepIndex: Math.min(updated.length - 1, index + 1) }
}

export function executeReview(state, focus, now) {
  if (!focus || !['goal', 'thread', 'interest', 'relationship'].includes(focus.sourceType)) return false
  if (focus.lastReviewAt && now - focus.lastReviewAt < AGENCY_LIMITS.reviewIntervalMs) return false
  const index = focus.steps.findIndex((x) => x.kind === 'review' && x.status !== 'done')
  if (index < 0) return false
  const evidence = `内部复盘：${focus.title}${focus.nextStep ? `，下一步仍是 ${focus.nextStep}` : ''}；没有外部事实，不记为完成。`
  focus.steps = focus.steps.map((x, i) => i === index ? { ...x, status: 'done', evidence } : x)
  const next = focus.steps[index + 1]
  if (next && next.status === 'pending') next.status = 'active'
  focus.stepIndex = Math.min(focus.steps.length - 1, index + 1)
  focus.lastReviewAt = now
  focus.lastActionAt = now
  if (focus.pendingProgress) {
    const advanced = advanceProgress(focus.steps, focus.pendingProgress, now)
    focus.steps = advanced.steps
    focus.stepIndex = Math.max(focus.stepIndex, advanced.stepIndex)
    focus.pendingProgress = ''
  }
  focus.reason = '内部复盘完成，等待真实进展'
  focus.internalPlan = {
    at: now,
    nextAction: focus.nextStep || '等待真实进展',
    evidence,
  }
  state.executions.push({ at: now, sourceKey: focus.sourceKey, action: 'review', evidence })
  state.executions = state.executions.slice(-AGENCY_LIMITS.executions)
  return true
}

