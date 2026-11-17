// Internal agenda runner with injected readers. It deliberately has no
// outbound sender: disabling 主动分享 must not freeze internal state, and an
// internal cycle must never send a message.
import { tickAgency } from './state-machine.js'

export function runInternalAgencyRunner(input = {}) {
  const now = Number(input.now) || Date.now()
  try {
    const cfg = input.readConfig()
    const continuity = input.readContinuity(now)
    const mind = input.readMind(cfg.人格 || {}, now)
    const affect = input.readAffect(cfg.内在, now)
    const events = input.readEvents({ timeZone: cfg.时区, now, limit: 8 }).concat(
      (Array.isArray(continuity.recentChanges) ? continuity.recentChanges : []).slice(-6).map((x, i) => ({
        id: `life-${Number(x.at) || 0}-${i}`, at: x.at, summary: x.reason, source: x.source,
      }))
    )
    const sharing = input.readSharing(now)
    const result = tickAgency({
      now, timeZone: cfg.时区, continuity, mind, affect, events,
      sharingRecent: sharing.recent,
      vitality: { energy: continuity.needs?.energy },
    })
    return { ok: true, result, focus: result.focus?.sourceKey || '', changed: result.changed === true }
  } catch (e) {
    return { ok: false, reason: String(e?.message || e).slice(0, 120) }
  }
}
