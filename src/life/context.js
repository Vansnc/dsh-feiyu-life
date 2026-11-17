// Read-only, bounded life snapshot for cross-domain consumers (media/UI/tests).
// It owns no state and deliberately never exposes full config or arbitrary
// notes. Callers pass already-computed life/continuity/mind/affect views.
const sensitive = /密码|口令|验证码|私钥|助记词|api[ _-]?key|access[ _-]?token|secret|身份证|银行卡|信用卡/i
const text = (value, max = 160) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
const safe = (value, max = 160) => sensitive.test(String(value || '')) ? '' : text(value, max)
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback

export function buildLifeContextSnapshot({ life = {}, continuity = {}, mind = {}, affect = {}, focus = null, now = Date.now() } = {}) {
  const current = life.current || {}
  const world = life.world || {}
  const needs = continuity?.needs || {}
  const people = (Array.isArray(continuity?.people) ? continuity.people : [])
    .filter((x) => x && x.status === 'active')
    .slice(-8)
    .map((x) => ({ name: safe(x.name, 40), relation: safe(x.relation, 40), closeness: finite(x.closeness, 50) }))
    .filter((x) => x.name)
  const concerns = [...(continuity?.threads || []), ...(continuity?.tasks || []), ...(continuity?.commitments || [])]
    .filter((x) => x && ['active', 'open', 'paused'].includes(x.status))
    .slice(0, 8)
    .map((x) => ({ title: safe(x.title, 100), dueAt: finite(x.dueAt), kind: text(x.kind, 40) }))
    .filter((x) => x.title)
  const memories = (Array.isArray(mind?.memories) ? mind.memories : [])
    .filter((x) => x && x.status === 'active' && x.sensitivity !== 'sensitive')
    .slice(-6)
    .map((x) => ({ summary: safe(x.summary, 160), kind: text(x.kind, 30) }))
    .filter((x) => x.summary)
  return {
    v: 1,
    at: now,
    current: {
      what: safe(current.what, 160), phone: text(current.phone, 20), outfit: safe(current.outfit, 40),
      locationId: text(current.locationId, 40), behavior: text(current.behavior, 30),
      start: finite(current.start), end: finite(current.end),
    },
    world: {
      locationName: safe(world.location?.name, 60),
      destinationName: safe(world.destination?.name, 60),
      moving: world.moving === true,
    },
    vitality: life.vitality ? {
      energy: finite(life.vitality.energy, 0), label: safe(life.vitality.label, 40),
      asleep: life.vitality.asleep === true, reasons: (life.vitality.reasons || []).map((x) => safe(x, 80)).filter(Boolean).slice(0, 3),
      sleepDebtMinutes: finite(life.vitality.sleepDebt, 0),
    } : null,
    body: { period: finite(life.period, 0), coldDay: finite(life.cold?.day, 0) },
    mood: affect ? { valence: finite(affect.valence, 50), arousal: finite(affect.arousal, 35), label: safe(affect.label, 40) } : null,
    needs: { energy: finite(needs.energy, 70), stress: finite(needs.stress, 30), socialNeed: finite(needs.socialNeed, 30), sleepDebtMinutes: finite(needs.sleepDebtMinutes, 0) },
    relationships: people,
    concerns,
    memories,
    focus: focus ? { title: safe(focus.title, 100), nextStep: safe(focus.nextStep, 100), dueLabel: safe(focus.dueLabel, 40), sourceType: text(focus.sourceType, 30) } : null,
  }
}
