// Offline 14-day simulation for feiyu-life sharing. It never creates an agent,
// never calls followup, and writes only to a temporary DSH_HOME.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generate, normalizeConfig, placeCategory } from '../src/life/life.js'
import { buildCandidates, buildSharePrompt, commitShare, defaultSharingConfig, normalizeSharingConfig, readSharing, takeShare } from '../src/proactive/sharing.js'

process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'feiyu-share-sim-'))
const cfg = normalizeConfig({})
const sharing = normalizeSharingConfig({
  ...defaultSharingConfig, 启用: true,
  每日上限: Number(process.env.DAILY || defaultSharingConfig.每日上限),
  全局冷却分钟: Number(process.env.GLOBAL || defaultSharingConfig.全局冷却分钟),
  同类冷却分钟: Number(process.env.SAME || defaultSharingConfig.同类冷却分钟),
  最低分: Number(process.env.MIN || defaultSharingConfig.最低分),
})
const start = new Date('2026-11-16T00:00:00+08:00')
const days = []
const reasons = new Map()
const categories = new Map()
let totalTicks = 0
let totalShares = 0

for (let d = 0; d < 14; d++) {
  const date = new Date(start.getTime() + d * 86400000)
  const ymd = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
  const day = { date: ymd, shares: [], reasons: {}, contexts: [] }
  for (let minute = 7 * 60; minute < 23 * 60; minute += 10) {
    const now = new Date(date.getTime() + minute * 60000)
    const nowMs = now.getTime()
    const life = generate(cfg, now, { energyBaseline: 65 })
    const ledger = readSharing(nowMs)
    const candidates = buildCandidates({
      now: nowMs, nowMinute: life.currentMinute, date: ymd, life, ledger,
      continuityChanges: [], recentText: '',
    })
    const current = life.current || {}
    const result = takeShare({
      now: nowMs, timeZone: 'Asia/Shanghai', config: sharing, candidates,
      lastHumanAt: 0, phone: current.phone || '', behavior: current.behavior || '',
      currentCategory: placeCategory(current), what: current.what || '',
      asleep: Boolean(life.vitality?.asleep), agentBusy: false,
    })
    totalTicks++
    if (result.ok) {
      const claim = result.claim
      commitShare(claim.claimId, { now: nowMs, timeZone: 'Asia/Shanghai' })
      totalShares++
      const row = { at: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`, title: claim.title, category: claim.category, score: claim.score, followup: claim.followup }
      day.shares.push(row)
      categories.set(row.category, (categories.get(row.category) || 0) + 1)
      if (day.contexts.length < 2) day.contexts.push(buildSharePrompt(claim))
    } else {
      const reason = result.reason || 'unknown'
      day.reasons[reason] = (day.reasons[reason] || 0) + 1
      reasons.set(reason, (reasons.get(reason) || 0) + 1)
    }
  }
  days.push(day)
}

const lines = []
lines.push(`# 主动分享 14 天离线模拟`)
lines.push('')
lines.push(`- 时间：2026-11-16 至 2026-11-29，07:00–23:00，每 10 分钟检查一次`)
lines.push(`- 检查次数：${totalTicks}｜触发次数：${totalShares}｜日均：${(totalShares / 14).toFixed(2)}`)
lines.push(`- 每日上限：${sharing.每日上限}｜全局冷却：${sharing.全局冷却分钟} 分钟｜同类冷却：${sharing.同类冷却分钟} 分钟｜最低分：${sharing.最低分}`)
lines.push('')
lines.push('| 日期 | 触发 | 类别 | 抑制原因（前四项） |')
lines.push('|---|---:|---|---|')
for (const day of days) {
  const reasonText = Object.entries(day.reasons).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join('；')
  lines.push(`| ${day.date} | ${day.shares.length} | ${day.shares.map((x) => x.category).join('、') || '—'} | ${reasonText || '—'} |`)
}
const totalDaysWithShares = days.filter((d) => d.shares.length).length
const followups = days.flatMap((d) => d.shares).filter((x) => x.followup).length
const sameDayCategoryRepeats = days.reduce((sum, d) => {
  const seen = new Set()
  let repeats = 0
  for (const row of d.shares) { if (seen.has(row.category)) repeats++; seen.add(row.category) }
  return sum + repeats
}, 0)
const categoriesSorted = [...categories.entries()].sort((a, b) => b[1] - a[1])
let consecutiveSame = 0
for (let i = 1; i < days.length; i++) {
  const prev = days[i - 1].shares[0]?.category
  const cur = days[i].shares[0]?.category
  if (prev && cur && prev === cur) consecutiveSame++
}
lines.push('')
lines.push(`## 汇总`)
lines.push('')
lines.push(`- 有分享的天数：${totalDaysWithShares}/14`)
lines.push(`- 类别分布：${categoriesSorted.map(([k, v]) => `${k} ${v}`).join('；') || '无'}`)
lines.push(`- 连续两天首条同类别：${consecutiveSame}/${Math.max(0, days.length - 1)}`)
lines.push(`- 同一事件后续：${followups} 次（同一 eventId 的新阶段）`)
lines.push(`- 同一天同类别重复：${sameDayCategoryRepeats} 次（全部为后续，不是陌生事件重发）`)
lines.push(`- 抑制原因：${[...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('；')}`)
lines.push('')
lines.push('## 示例上下文')
lines.push('')
for (const day of days.filter((d) => d.contexts.length).slice(0, 4)) {
  lines.push(`### ${day.date}`)
  lines.push('```text')
  lines.push(day.contexts[0])
  lines.push('```')
}
lines.push('')
lines.push('> 这是纯离线模拟，没有创建会话、没有调用 followup、没有向任何真实会话发送消息；账本和时刻都落在临时 DSH_HOME。')
console.log(lines.join('\n'))
