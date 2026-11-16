import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  buildCandidates, buildSharePrompt, commitShare, defaultSharingConfig, defaultSharingLedger,
  normalizeSharingConfig, readSharing, releaseShare, selectShareCandidate, sharingPath, takeShare, writeSharing,
} from '../sharing.js'

function withHome(fn) {
  const old = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'feiyu-sharing-'))
  try { return fn() } finally {
    if (old === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = old
  }
}

const noon = Date.parse('2026-11-16T04:00:00Z') // 12:00 Asia/Shanghai
const config = normalizeSharingConfig(defaultSharingConfig)

function lifeAt(overrides = {}) {
  return {
    plan: { date: '2026-11-16' },
    currentMinute: 12 * 60,
    timeline: [
      { start: 0, end: 8 * 60, what: '睡着了', behavior: 'sleep', locationId: 'dorm' },
      { start: 8 * 60, end: 10 * 60, what: '上专业课', behavior: 'study', locationId: 'classroom' },
      { start: 10 * 60, end: 11 * 60, what: '食堂吃饭', behavior: 'eat', locationId: 'canteen' },
      { start: 11 * 60, end: 12 * 60, what: '出门走了走', behavior: 'walk', locationId: 'outdoor' },
      { start: 12 * 60, end: 14 * 60, what: '在宿舍剪片', behavior: 'study', locationId: 'dorm' },
      { start: 14 * 60, end: 15 * 60, what: '未来的事', behavior: 'idle', locationId: 'dorm' },
    ],
    moment: { id: 'package', title: '快递', text: '快递拿回来了，箱子搁在门口', stageIndex: 1, ageMinutes: 60 },
    cold: null,
    period: 0,
    deviation: {},
    ...overrides,
  }
}

function select(overrides = {}) {
  const now = overrides.now || noon
  const candidates = overrides.candidates || buildCandidates({ now, nowMinute: 12 * 60, date: '2026-11-16', life: lifeAt(), ledger: defaultSharingLedger(now) })
  return selectShareCandidate({
    now, timeZone: 'Asia/Shanghai', config, ledger: defaultSharingLedger(now), candidates,
    currentCategory: 'dorm', phone: '在手', behavior: 'idle', asleep: false, lastHumanAt: 0,
    ...overrides,
  })
}

test('future segments and early moment stages are never candidates', () => {
  const candidates = buildCandidates({ now: noon, nowMinute: 12 * 60, date: '2026-11-16', life: lifeAt(), ledger: defaultSharingLedger(noon) })
  assert.equal(candidates.some((x) => x.title === '未来的事'), false)
  const early = buildCandidates({ now: noon, nowMinute: 12 * 60, date: '2026-11-16', life: lifeAt({ moment: { id: 'package', title: '快递', text: '驿站短信', stageIndex: 0, ageMinutes: 30 } }), ledger: defaultSharingLedger(noon) })
  assert.equal(early.some((x) => x.kind === 'moment'), false)
  assert.ok(candidates.some((x) => x.kind === 'moment' && x.title === '快递'))
})

test('ordinary completed outings qualify, but banal class/meal rows do not cross the threshold', () => {
  const candidates = buildCandidates({ now: noon, nowMinute: 12 * 60, date: '2026-11-16', life: lifeAt(), ledger: defaultSharingLedger(noon) })
  assert.ok(candidates.some((x) => x.kind === 'completed' && /出门/.test(x.title) && x.score >= config.最低分))
  assert.equal(candidates.some((x) => x.title === '上专业课' && x.score >= config.最低分), false)
  assert.equal(candidates.some((x) => x.title === '食堂吃饭' && x.score >= config.最低分), false)
})

test('sleep, class, phone-away, quiet hours, recent conversation and busy states suppress', () => {
  assert.equal(select({ asleep: true }).reason, 'sleep-or-bath')
  assert.equal(select({ currentCategory: 'class', what: '上专业课' }).reason, 'class')
  assert.equal(select({ phone: '不在手边' }).reason, 'phone-away')
  assert.equal(select({ now: Date.parse('2026-11-15T19:00:00Z') }).reason, 'quiet-hours')
  assert.equal(select({ lastHumanAt: noon - 5 * 60000 }).reason, 'recent-conversation')
  assert.equal(select({ agentBusy: true }).reason, 'busy')
  assert.notEqual(select({ what: '睡不着，躺床上刷手机', behavior: 'phone', currentCategory: 'dorm', candidates: buildCandidates({ now: noon, nowMinute: 12 * 60, date: '2026-11-16', life: lifeAt({ moment: null, cold: { day: 1 } }), ledger: defaultSharingLedger(noon) }) }).reason, 'sleep-or-bath')
})

test('global cooldown, daily quota, event dedupe and category cooldown are separate', () => {
  const candidates = buildCandidates({ now: noon, nowMinute: 12 * 60, date: '2026-11-16', life: lifeAt(), ledger: defaultSharingLedger(noon) })
  const base = defaultSharingLedger(noon)
  assert.equal(select({ candidates, ledger: { ...base, lastSharedAt: noon - 60 * 60000 } }).reason, 'global-cooldown')
  assert.equal(select({ candidates, ledger: { ...base, date: '2026-11-16', dailyCount: 2 } }).reason, 'daily-limit')
  const shared = candidates.find((x) => x.kind === 'moment')
  const recent = [{ eventId: shared.eventId, stageKey: shared.stageKey, category: shared.category, at: noon - 60 * 60000 }]
  const onlyMoment = candidates.filter((x) => x.category === shared.category)
  assert.equal(select({ candidates: onlyMoment, ledger: { ...base, date: '2026-11-16', recent, lastSharedAt: 0 } }).reason, 'deduped-or-cooldown')
})

test('a later stage is a follow-up of the same event and needs a gap, not a category reset', () => {
  const stageOne = buildCandidates({ now: noon, nowMinute: 12 * 60, date: '2026-11-16', life: lifeAt(), ledger: defaultSharingLedger(noon) }).find((x) => x.kind === 'moment')
  const ledger = {
    ...defaultSharingLedger(noon),
    date: '2026-11-16',
    dailyCount: 1,
    lastSharedAt: noon - 2 * 3600000,
    recent: [{ eventId: stageOne.eventId, stageKey: stageOne.stageKey, category: stageOne.category, at: noon - 2 * 3600000 }],
  }
  const later = lifeAt({ moment: { id: 'package', title: '快递', text: '箱子拆了，纸壳还没扔', stageIndex: 2, ageMinutes: 20 } })
  const candidates = buildCandidates({ now: noon, nowMinute: 12 * 60, date: '2026-11-16', life: later, ledger })
  const follow = candidates.find((x) => x.kind === 'moment')
  assert.equal(follow.followup, true)
  const picked = select({ now: noon, candidates, ledger })
  assert.equal(picked.ok, true)
  assert.equal(picked.candidate.eventId, follow.eventId)
  assert.equal(picked.candidate.stageKey, follow.stageKey)
})

test('take is leased, commit records once, release is bounded, and restart keeps dedupe', () => withHome(() => {
  const candidates = buildCandidates({ now: noon, nowMinute: 12 * 60, date: '2026-11-16', life: lifeAt(), ledger: defaultSharingLedger(noon) }).filter((x) => x.kind === 'moment')
  const input = { now: noon, timeZone: 'Asia/Shanghai', config, candidates, currentCategory: 'dorm', phone: '在手', behavior: 'idle', lastHumanAt: 0 }
  const first = takeShare(input)
  assert.equal(first.ok, true)
  assert.equal(takeShare(input).reason, 'claim-active')
  const committed = commitShare(first.claim.claimId, { now: noon, timeZone: 'Asia/Shanghai' })
  assert.equal(committed.ok, true)
  assert.equal(readSharing(noon).dailyCount, 1)
  assert.equal(readSharing(noon).pending, null)
  assert.equal(readSharing(noon).recent[0].stageKey, first.claim.stageKey)

  // A fresh process would read the same ledger and reject the same stage.
  const again = takeShare(input)
  assert.equal(again.ok, false)

  const later = noon + 2 * 3600000
  const secondCandidates = buildCandidates({ now: later, nowMinute: 14 * 60, date: '2026-11-16', life: lifeAt({ currentMinute: 14 * 60, moment: { id: 'package', title: '快递', text: '箱子拆了，纸壳还没扔', stageIndex: 2, ageMinutes: 20 } }), ledger: readSharing(noon) }).filter((x) => x.kind === 'moment')
  const second = takeShare({ ...input, now: later, candidates: secondCandidates })
  assert.equal(second.ok, true)
  const released = releaseShare(second.claim.claimId, 'network down', { now: later })
  assert.equal(released.ok, true)
  assert.equal(readSharing(later).pending, null)
  assert.equal(readSharing(later).failures[second.claim.eventId], 1)
}))

test('an expired lease can be reclaimed; the prompt is short and non-coercive', () => withHome(() => {
  const candidates = buildCandidates({ now: noon, nowMinute: 12 * 60, date: '2026-11-16', life: lifeAt(), ledger: defaultSharingLedger(noon) })
  writeSharing({
    ...defaultSharingLedger(noon), date: '2026-11-16', pending: {
      ...candidates[0], claimId: 'old-claim', claimedAt: noon - 10 * 60000, leaseUntil: noon - 5 * 60000,
    },
  })
  const taken = takeShare({ now: noon, timeZone: 'Asia/Shanghai', config, candidates, currentCategory: 'dorm', phone: '在手', behavior: 'idle', lastHumanAt: 0 })
  assert.equal(taken.ok, true)
  assert.notEqual(taken.claim.claimId, 'old-claim')
  const prompt = buildSharePrompt(taken.claim)
  assert.match(prompt, /feiyu-share/)
  assert.match(prompt, /1–2 句/)
  assert.match(prompt, /不强制提问或称呼/)
  assert.doesNotMatch(prompt, /按日程|时间表/)
}))

test('no candidate means no hardcoded filler, and config is bounded', () => {
  const none = select({ candidates: [] })
  assert.equal(none.ok, false)
  assert.equal(none.reason, 'no-candidate')
  const clamped = normalizeSharingConfig({ 每日上限: 99, 全局冷却分钟: 1, 最低分: 1000, 安静开始: -2, 安静结束: 30 })
  assert.equal(clamped.每日上限, 6)
  assert.equal(clamped.全局冷却分钟, 30)
  assert.equal(clamped.最低分, 100)
  assert.equal(clamped.安静开始, 0)
  assert.equal(clamped.安静结束, 23)
})


test('body changes are candidates only on their first day', () => {
  const first = buildCandidates({ now: noon, nowMinute: 12 * 60, date: '2026-11-16', life: lifeAt({ moment: null, cold: { day: 1 }, period: 1 }), ledger: defaultSharingLedger(noon) })
  assert.ok(first.some((x) => x.category === 'body' && x.title === '感冒'))
  assert.ok(first.some((x) => x.category === 'body' && x.title === '身体'))
  const second = buildCandidates({ now: noon, nowMinute: 12 * 60, date: '2026-11-17', life: lifeAt({ moment: null, cold: { day: 2 }, period: 2 }), ledger: defaultSharingLedger(noon) })
  assert.equal(second.some((x) => x.category === 'body'), false)
  const picked = select({ candidates: first })
  assert.equal(picked.ok, true)
  assert.equal(picked.candidate.category, 'body')
})


test('a new local day resets the per-day count instead of accumulating forever', () => withHome(() => {
  const first = buildCandidates({ now: noon, nowMinute: 12 * 60, date: '2026-11-16', life: lifeAt(), ledger: defaultSharingLedger(noon) }).filter((x) => x.kind === 'moment')
  const one = takeShare({ now: noon, timeZone: 'Asia/Shanghai', config, candidates: first, currentCategory: 'dorm', phone: '在手', behavior: 'idle', lastHumanAt: 0 })
  assert.equal(one.ok, true)
  assert.equal(commitShare(one.claim.claimId, { now: noon, timeZone: 'Asia/Shanghai' }).ok, true)
  const nextNoon = noon + 86400000
  const nextLife = lifeAt({ plan: { date: '2026-11-17' }, currentMinute: 12 * 60 })
  const next = buildCandidates({ now: nextNoon, nowMinute: 12 * 60, date: '2026-11-17', life: nextLife, ledger: readSharing(nextNoon) }).filter((x) => x.kind === 'moment')
  const two = takeShare({ now: nextNoon, timeZone: 'Asia/Shanghai', config, candidates: next, currentCategory: 'dorm', phone: '在手', behavior: 'idle', lastHumanAt: 0 })
  assert.equal(two.ok, true)
  assert.equal(commitShare(two.claim.claimId, { now: nextNoon, timeZone: 'Asia/Shanghai' }).ok, true)
  assert.equal(readSharing(nextNoon).date, '2026-11-17')
  assert.equal(readSharing(nextNoon).dailyCount, 1)
}))


test('two independent pollers cannot both claim the same candidate', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'feiyu-sharing-race-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try {
  const modulePath = fileURLToPath(new URL('../sharing.js', import.meta.url))
  const candidates = buildCandidates({ now: noon, nowMinute: 12 * 60, date: '2026-11-16', life: lifeAt(), ledger: defaultSharingLedger(noon) }).filter((x) => x.kind === 'moment')
  const input = { now: noon, timeZone: 'Asia/Shanghai', config, candidates, currentCategory: 'dorm', phone: '在手', behavior: 'idle', lastHumanAt: 0 }
  const script = `import { takeShare } from ${JSON.stringify(modulePath)}; const input = JSON.parse(process.env.SHARING_INPUT); process.stdout.write(JSON.stringify(takeShare(input)))`
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, DSH_HOME: dir, SHARING_INPUT: JSON.stringify(input) }, stdio: ['ignore', 'pipe', 'ignore'],
    })
    let out = ''
    child.stdout.on('data', (chunk) => { out += chunk })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`child exited ${code}`))
      try { resolve(JSON.parse(out)) } catch (e) { reject(e) }
    })
  })
  const results = await Promise.all([run(), run()])
  assert.equal(results.filter((x) => x.ok).length, 1)
  assert.ok(results.some((x) => ['claim-active', 'locked'].includes(x.reason)))
  assert.equal(readSharing(noon).pending !== null, true)
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
  }
})
