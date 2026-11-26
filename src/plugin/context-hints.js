// Plugin-level prompt hints derived from life/cognition state. This module is
// an adapter: it reads domain facades and formats short model-facing text; it
// owns no state and is not imported by the domain.
import { readPlan } from '../life/plan.js'
import { momentSummary } from '../life/moments.js'
import { readMind } from '../cognition/mind.js'
import { readAgency, agencyContext } from '../cognition/agency/index.js'
import { menstrualDay, coldEpisode } from '../life/life.js'

export function bodyHint(cfg, t, deviation = {}) {
  const detour = deviation.flat ? '今天想躺平，基本不出门'
    : deviation.outing ? '今天临时想出门走走'
      : deviation.skipAfternoon ? '今天不想去下午的课' : ''
  const d = menstrualDay(cfg, t.ymd)
  const cold = coldEpisode(cfg, t.ymd)
  const body = d && d <= 3 ? '经期头几天，腰酸、想吃甜的、没力气'
    : d ? '经期后段，肚子还坠着'
      : cold ? (cold.day === 1 ? '有点感冒，嗓子发紧、没力气' : '感冒还没好，鼻子有点堵')
        : ''
  return [body, detour].filter(Boolean).join('；')
}

export function recentSummary(cfg, t) {
  const lines = []
  for (let i = 1; i <= 3; i++) {
    const d = new Date(Date.parse(t.ymd + 'T00:00:00Z') - i * 86400000).toISOString().slice(0, 10)
    try {
      const plan = readPlan(d)
      if (!plan) continue
      const title = plan.title || (plan.type && plan.type.name) || ''
      const items = plan.items || []
      const all = items.map((x) => x.what ?? x.在).filter(Boolean).join('、')
      const small = momentSummary(d)
      const bits = [all, small.length ? '小事：' + small.join('、') : ''].filter(Boolean).join('；')
      lines.push(`- ${d}：${title}${bits ? '（' + bits + '）' : ''}`)
    } catch {}
  }
  return lines.join('\n')
}

export function selfHint(cfg, now = Date.now()) {
  const mind = readMind(cfg.人格 || {}, now)
  const goals = (Array.isArray(mind.goals) ? mind.goals : [])
    .filter((x) => x.status === 'active')
    .sort((a, b) => (Number(a.progress) || 0) - (Number(b.progress) || 0))
    .slice(0, 3)
    .map((x) => `${x.title}${x.nextStep ? `，下一步：${x.nextStep}` : ''}`)
  const preferences = (Array.isArray(mind.preferences) ? mind.preferences : [])
    .filter((x) => x.status === 'active' && x.owner === 'self')
    .slice(-3)
    .map((x) => `${x.key}：${x.value}`)
  const focus = readAgency(now).focus
  return [
    goals.length ? `- 自己的目标：${goals.join('；')}` : '',
    preferences.length ? `- 自己的长期偏好：${preferences.join('；')}` : '',
    agencyContext(focus) ? `- ${agencyContext(focus)}` : '',
  ].filter(Boolean).join('\n')
}

export function calendarLabel(calendar) {
  if (calendar.special) return `特殊：${calendar.special.名}`
  if (calendar.vacation) return `假期：${calendar.vacation.名}`
  if (calendar.term) return `学期：${calendar.term.名}`
  return '平时'
}

export function chatHint(readiness, gapHours = 0) {
  return [
    '闲聊可以一句收住。按自己的心情回应；不确定就直说。普通链接贴网址，照片可单发，语音和表情只用会话支持的工具。',
    readiness && readiness !== 'now' ? '此刻不方便细聊。' : '',
    gapHours >= 24 ? `距上次来信约${gapHours}小时。` : '',
  ].filter(Boolean).join('')
}
