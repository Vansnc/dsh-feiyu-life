// Narrow read-only snapshot interface for media. Media must not own or mutate
// life state; it may only consume these derived views.
import { readConfig, generate, zonedNow } from '../../life.js'
import { buildLifeContextSnapshot } from '../life/context.js'

export function mediaTimeZone() {
  try { return String(readConfig().时区 || 'Asia/Shanghai') } catch { return 'Asia/Shanghai' }
}
export function mediaZonedNow(at = new Date(), tz = mediaTimeZone()) {
  return zonedNow(at, tz)
}
export function mediaLifeSnapshot(now = new Date()) {
  const cfg = readConfig()
  const life = generate(cfg, now)
  const zoned = zonedNow(now, String(cfg.时区 || 'Asia/Shanghai'))
  return { state: buildLifeContextSnapshot({ life, now: now.getTime?.() || Date.now() }), zoned }
}
