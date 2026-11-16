// dsh-feiyu-life · state machine (single source of truth)
//
// State is derived ONLY from:
//   1. the day plan (feiyu-life-days/<date>.json, advanced by the clock);
//   2. explicit adjustments written by the life_adjust tool.
//
// It is not inferred from chat text. The old turn-stopping heuristic
// ("she said 洗澡 -> state = shower") was both unreliable and backwards:
// it let a technical discussion flip her state. The state machine now
// constrains what she can say, not the other way around.
//
// Persistence is bounded: one file per date, at most MAX_ADJUSTMENTS entries,
// atomic replacement, and a size-capped read so a damaged file cannot stall a
// turn or grow without limit.
//
// Identifiers are English. Persisted config keys stay Chinese because they
// are the settings contract shown in the UI.

import { readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { atomicWriteJson, readJsonBounded, withLock } from './storage.js'

const factsDir = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'feiyu-life-facts')
const FACTS_MAX_BYTES = 512 * 1024
export const MAX_ADJUSTMENTS_PER_DAY = 64
const phoneChoices = ['在手', '静音', '在床头', '不在手边']
const behaviorPattern = /^[a-z][a-z0-9-]{0,19}$/
const locationPattern = /^[a-zA-Z0-9_-]{1,40}$/

export function factsPath(ymd) {
  return join(factsDir(), ymd + '.json')
}

const cache = new Map()
const remember = (path, value, meta) => {
  cache.set(path, { ...meta, value })
  while (cache.size > 8) cache.delete(cache.keys().next().value)
}
const forget = (path) => cache.delete(path)

function sanitizeFact(fact) {
  if (!fact || typeof fact !== 'object') return null
  const start = Math.round(Number(fact.start))
  const end = Math.round(Number(fact.end))
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  if (end - start > 24 * 60 * 60000) return null
  const what = String(fact.what || '').trim().slice(0, 40)
  if (!what) return null
  const phone = phoneChoices.includes(String(fact.phone)) ? String(fact.phone) : '在手'
  return {
    id: String(fact.id || randomUUID()).slice(0, 80),
    start,
    end,
    what,
    phone,
    outfit: String(fact.outfit || '').trim().slice(0, 24),
    locationId: locationPattern.test(String(fact.locationId || '')) ? String(fact.locationId) : '',
    behavior: behaviorPattern.test(String(fact.behavior || '')) ? String(fact.behavior) : '',
    source: 'adjust',
    createdAt: Math.max(0, Number(fact.createdAt) || Date.now()),
  }
}

/** Keep a day's adjustments bounded, dropping already-finished ones first. */
function capFacts(list, now = Date.now()) {
  const rows = list.slice().sort((a, b) => a.start - b.start)
  while (rows.length > MAX_ADJUSTMENTS_PER_DAY) {
    let index = rows.findIndex((x) => x.end <= now)
    if (index < 0) index = 0
    rows.splice(index, 1)
  }
  return rows
}

export function readFacts(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))) return []
  const path = factsPath(ymd)
  const read = readJsonBounded(path, { maxBytes: FACTS_MAX_BYTES })
  if (!read.ok) return []
  const hit = cache.get(path)
  if (hit && hit.mtimeMs === read.mtimeMs && hit.size === read.size) return hit.value
  if (!read.value || !Array.isArray(read.value.facts)) return []
  const facts = read.value.facts.map(sanitizeFact).filter(Boolean).slice(0, MAX_ADJUSTMENTS_PER_DAY)
  remember(path, facts, { mtimeMs: read.mtimeMs, size: read.size })
  return facts
}

export function writeFacts(ymd, list) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))) return false
  const facts = capFacts((Array.isArray(list) ? list : []).map(sanitizeFact).filter(Boolean))
  const path = factsPath(ymd)
  if (!atomicWriteJson(path, { v: 1, date: ymd, facts })) return false
  forget(path)
  return true
}

/** One adjustment segment (start/end in ms). An older adjustment with the same start is replaced. */
export function addAdjustment(ymd, fact) {
  const next = sanitizeFact({ ...fact, source: 'adjust' })
  if (!next) return false
  // Read-modify-write across processes: the atomic file prevents corruption,
  // the lock prevents two simultaneous adjustments from dropping each other.
  const result = withLock(factsPath(ymd) + '.lock', () => {
    const kept = readFacts(ymd).filter((x) => !(x.source === 'adjust' && x.start === next.start))
    return writeFacts(ymd, [...kept, next])
  }, { staleMs: 5000 })
  return result === undefined ? false : result
}

export function listAdjustments(ymd) {
  return readFacts(ymd).map((fact, index) => ({ ...fact, index }))
}

/** Delete one explicit adjustment. Old files without ids remain deletable by index. */
export function removeAdjustment(ymd, selector = {}) {
  const result = withLock(factsPath(ymd) + '.lock', () => {
    const list = readFacts(ymd)
    const index = Number.isInteger(selector.index) ? selector.index : -1
    const id = String(selector.id || '')
    const next = list.filter((fact, i) => id ? String(fact.id || '') !== id : i !== index)
    if (next.length === list.length) return false
    return writeFacts(ymd, next)
  }, { staleMs: 5000 })
  return result === undefined ? false : result
}

/** Remove expired per-day adjustment files. */
export function cleanupFacts(retentionDays = 180, now = Date.now()) {
  const cutoff = now - Math.max(7, Number(retentionDays) || 180) * 86400000
  let removed = 0
  try {
    for (const name of readdirSync(factsDir())) {
      if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) continue
      const path = join(factsDir(), name)
      try { if (statSync(path).mtimeMs < cutoff) { unlinkSync(path); removed++; forget(path) } } catch {}
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
        if (g.start > r.start) next.push({ ...r, end: g.start, overridden: r.overridden || r.source === 'plan' })
        if (g.end < r.end) next.push({ ...r, start: g.end, overridden: r.overridden || r.source === 'plan' })
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
      plannedStart: minuteToMs(start),
      plannedEnd: minuteToMs(end),
      what: String(x.what || ''),
      phone: String(x.phone || '在手'),
      outfit: String(x.outfit || ''),
      locationId: String(x.locationId || ''),
      behavior: String(x.behavior || ''),
      links: Array.isArray(x.links) ? x.links : [],
      people: Array.isArray(x.people) ? x.people : [],
      overridden: false,
      source: 'plan',
    }]
  }).sort((a, b) => a.start - b.start)
  // A spring-forward gap can collapse a wall-clock segment to zero length
  // (02:30 and 03:30 are the same instant). Fill the resulting real-time hole
  // with the previous activity so `segmentAt` still has an answer.
  const filled = []
  for (const row of base) {
    const previous = filled[filled.length - 1]
    if (previous && row.start < previous.end) {
      if (row.end <= previous.end) continue
      row.start = previous.end
    }
    if (previous && row.start > previous.end) {
      filled.push({ ...previous, start: previous.end, end: row.start, links: [], people: [] })
    }
    filled.push(row)
  }
  base.length = 0
  base.push(...filled)
  const valid = (facts || []).map(sanitizeFact).filter(Boolean)
  // Facts are stored oldest -> newest. Each newer adjustment punches a hole in
  // older ones too, so one instant can never match two adjustment segments.
  let cover = []
  for (const fact of valid) {
    cover = overlay(cover, [{
      start: fact.start,
      end: fact.end,
      what: fact.what,
      phone: fact.phone,
      outfit: fact.outfit,
      locationId: fact.locationId,
      behavior: fact.behavior,
      links: [],
      people: [],
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
