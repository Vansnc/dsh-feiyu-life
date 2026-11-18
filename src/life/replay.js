import { generate, zonedNow } from './life.js'
import { readPlan } from './plan.js'

export function replayDay(config, selected, now = new Date()) {
  const date = zonedNow(selected, config.时区).ymd
  const clock = zonedNow(now, config.时区)
  const today = clock.ymd
  const isToday = date === today
  const result = {
    ok: true, date, today, currentMinute: isToday ? clock.minuteOfDay : 0,
    map: config.地图, timeline: [], frames: [],
  }
  if (!config.总开关) return { ...result, reason: 'disabled' }
  if (date > today) return { ...result, reason: 'future' }
  if (!isToday && !readPlan(date)) return { ...result, reason: 'missing' }
  const life = generate(config, isToday ? now : selected, { replay: true, archived: !isToday, moments: false })
  const end = isToday ? clock.minuteOfDay + 1 : 1440
  result.timeline = life.timeline.filter(row => row.start < end).map(row => ({ ...row, end: Math.min(row.end, end) }))
  result.frames = life.replay.filter(frame => frame.minute < end)
  return result
}
