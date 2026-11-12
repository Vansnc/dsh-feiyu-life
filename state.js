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

import { readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

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
  const next = {
    ...fact,
    id: String(fact.id || randomUUID()),
    createdAt: Number(fact.createdAt) || Date.now(),
    source: 'adjust',
  }
  return writeFacts(ymd, [...kept, next])
}

export function listAdjustments(ymd) {
  return readFacts(ymd).map((fact, index) => ({ ...fact, index }))
}

/** Delete one explicit adjustment. Old files without ids remain deletable by index. */
export function removeAdjustment(ymd, selector = {}) {
  const list = readFacts(ymd)
  const index = Number.isInteger(selector.index) ? selector.index : -1
  const id = String(selector.id || '')
  const next = list.filter((fact, i) => id ? String(fact.id || '') !== id : i !== index)
  if (next.length === list.length) return false
  return writeFacts(ymd, next)
}

/** Remove expired per-day adjustment files. */
export function cleanupFacts(retentionDays = 180, now = Date.now()) {
  const cutoff = now - Math.max(7, Number(retentionDays) || 180) * 86400000
  let removed = 0
  try {
    for (const name of readdirSync(factsDir())) {
      if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) continue
      const path = join(factsDir(), name)
      try { if (statSync(path).mtimeMs < cutoff) { unlinkSync(path); removed++ } } catch {}
    }
  } catch {}
  return removed
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
export function buildTimeline(planItems, facts, dayStartMs, minuteToMs = (minute) => dayStartMs + minute * 60000) {
  const base = (planItems || []).flatMap((x) => {
    const start = Number(x && x.start)
    const end = Number(x && x.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return []
    return [{
      start: minuteToMs(start),
      end: minuteToMs(end),
      what: String(x.what || ''),
      phone: String(x.phone || '在手'),
      outfit: String(x.outfit || ''),
      source: 'plan',
    }]
  })
  const valid = (facts || []).filter((f) => f && Number.isFinite(f.start) && Number.isFinite(f.end) && f.end > f.start)
  // Facts are stored oldest -> newest. Each newer adjustment punches a hole in
  // older ones too, so one instant can never match two adjustment segments.
  let cover = []
  for (const fact of valid) {
    cover = overlay(cover, [{
      start: fact.start,
      end: fact.end,
      what: String(fact.what || ''),
      phone: String(fact.phone || '在手'),
      outfit: String(fact.outfit || ''),
      source: 'adjust',
    }])
  }
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

