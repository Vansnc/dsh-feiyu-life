// dsh-feiyu-life · state machine (single source of truth)
//
// State is derived ONLY from:
//   1. the day plan (feiyu-life-days/<date>.json, advanced by the clock);
//   2. explicit adjustments written by the life_adjust tool.
//
// It is no longer inferred from chat text. The old turn-stopping heuristic
// ("she said 洗澡 -> state = shower") was both unreliable and backwards:
// it let a technical discussion flip her state. The state machine now
// constrains what she can say, not the other way around.
//
// Identifiers are English. Persisted config keys stay Chinese because they
// are the settings contract shown in the UI.

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const factsDir = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'feiyu-life-facts')

export function factsPath(ymd) {
  return join(factsDir(), ymd + '.json')
}

export function readFacts(ymd) {
  try {
    const data = JSON.parse(readFileSync(factsPath(ymd), 'utf8'))
    if (data && data.v === 1 && Array.isArray(data.facts)) return data.facts
  } catch {}
  return []
}

export function writeFacts(ymd, list) {
  try {
    mkdirSync(factsDir(), { recursive: true })
    const tmp = factsPath(ymd) + '.tmp'
    writeFileSync(tmp, JSON.stringify({ v: 1, date: ymd, facts: list }, null, 2), 'utf8')
    renameSync(tmp, factsPath(ymd))
    return true
  } catch { return false }
}

/** One adjustment segment (start/end in ms). An older adjustment with the same start is replaced. */
export function addAdjustment(ymd, fact) {
  const kept = readFacts(ymd).filter((x) => !(x.source === 'adjust' && x.start === fact.start))
  return writeFacts(ymd, [...kept, fact])
}

/** Punch holes in base segments wherever cover segments overlap. */
function overlay(base, cover) {
  const rest = []
  for (const d of base) {
    let segs = [d]
    for (const g of cover) {
      if (!Number.isFinite(g.end) || g.end <= g.start) continue
      const next = []
      for (const r of segs) {
        if (g.end <= r.start || g.start >= r.end) { next.push(r); continue }
        if (g.start > r.start) next.push({ ...r, end: g.start })
        if (g.end < r.end) next.push({ ...r, start: g.end })
      }
      segs = next
    }
    rest.push(...segs)
  }
  return [...rest, ...cover].sort((a, b) => (a.start - b.start) || ((a.source === 'plan' ? 1 : 0) - (b.source === 'plan' ? 1 : 0)))
}

/**
 * Plan items (minute units) + adjustments (ms) -> real timeline (ms segments).
 * The plan is the default truth; adjustments override it.
 */
export function buildTimeline(planItems, facts, dayStartMs) {
  const base = (planItems || []).map((x) => ({
    start: dayStartMs + (Number(x.start) || 0) * 60000,
    end: dayStartMs + (Number(x.end) || 0) * 60000,
    what: x.what || '',
    phone: x.phone || '在手',
    outfit: x.outfit || '',
    source: 'plan',
  }))
  const cover = (facts || []).filter((f) => f && Number.isFinite(f.end) && f.end > f.start)
  return overlay(base, cover)
}

export function segmentAt(timeline, nowMs) {
  for (const x of timeline) if (nowMs >= x.start && nowMs < x.end) return x
  return null
}

/** Finished real segments inside the last window, newest first. */
export function recentSegments(timeline, nowMs, windowMin = 360) {
  return timeline
    .filter((x) => x.end <= nowMs && nowMs - x.end <= windowMin * 60000 && !/睡/.test(x.what))
    .sort((a, b) => b.end - a.end)
}

export function nextSegment(timeline, nowMs) {
  const upcoming = timeline.filter((x) => x.start > nowMs && !/睡/.test(x.what)).sort((a, b) => a.start - b.start)
  return upcoming[0] || null
}
