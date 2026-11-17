// Outbound proactive scheduler adapter. All policy lives in sharing/agency;
// this module only coordinates a root session and the narrow send boundary.
export function createInitiativeRunner(deps) {
  const {
    readConfig, normalizeSharingConfig, sessions, inWorkspace, generate, readContinuity,
    activePeople, readSharing, readMind, readAffect, readAgency, buildCandidates,
    agencyShareCandidates, takeShare, buildSharePrompt, commitShare, releaseShare,
    appendEvent, eventId, markAgencyOutreach, placeCategory, zonedNow,
    lastHumanAt, lastHumanText, sharingCheckedAt, initiativeRunning, runInternalAgency,
  } = deps
  return async function runInitiative(forcedAgent = null, force = false) {
    const now = Date.now()
    // Internal cognition is independent of outbound sharing. It is rate
    // limited and never calls a model or sends a message.
    try { runInternalAgency(now) } catch {}
    const cfg = readConfig()
    const sharingCfg = normalizeSharingConfig(cfg.主动分享)
    const candidates = forcedAgent ? [forcedAgent] : sessions()
    const results = []
    for (const agent of candidates) {
      if (!agent || initiativeRunning.has(agent.id)) { if (agent) results.push({ sessionId: agent.id, sent: false, reason: 'busy' }); continue }
      const cwd = String(agent?.session?.cwd || '')
      if (!inWorkspace(cfg, cwd)) { results.push({ sessionId: agent.id, sent: false, reason: 'outside-workspace' }); continue }
      if (!sharingCfg.启用) { results.push({ sessionId: agent.id, sent: false, reason: 'disabled' }); continue }
      const checked = sharingCheckedAt.get(agent.id) || 0
      if (!force && now - checked < sharingCfg.检查间隔分钟 * 60000) { results.push({ sessionId: agent.id, sent: false, reason: 'check-interval' }); continue }
      sharingCheckedAt.set(agent.id, now)
      const continuity = readContinuity(now)
      const life = generate(cfg, new Date(now), {
        energyBaseline: cfg.连续性?.启用 === false ? undefined : continuity.needs.energy,
        people: cfg.连续性?.启用 === false ? [] : activePeople(continuity).map((x) => x.name),
      })
      const current = life.current || {}
      const ledger = readSharing(now)
      const date = life.plan?.date || zonedNow(new Date(now), String(cfg.时区 || 'Asia/Shanghai')).ymd
      const mind = readMind(cfg.人格 || {}, now)
      const affect = readAffect(cfg.内在, now)
      let agency = { focus: null, state: { focus: null, outreach: {} } }
      try {
        const state = readAgency(now)
        agency = { state, focus: state.focus }
      } catch {}
      const candidateList = buildCandidates({
        now,
        nowMinute: Number(life.currentMinute) || 0,
        date,
        life,
        ledger,
        continuityChanges: Array.isArray(continuity.recentChanges) ? continuity.recentChanges : [],
        recentText: lastHumanText.get(agent.id) || '',
      }).concat(agencyShareCandidates(agency.focus, {
        now, date, nowMinute: Number(life.currentMinute) || 0, state: agency.state, sessionId: agent.id,
      }))
      const decision = takeShare({
        now,
        timeZone: cfg.时区,
        config: sharingCfg,
        candidates: candidateList,
        lastHumanAt: lastHumanAt.get(agent.id) || now,
        phone: current.phone || '',
        behavior: life.world?.behavior || current.behavior || '',
        currentCategory: placeCategory(current),
        what: current.what || '',
        asleep: Boolean(life.vitality?.asleep),
        agentBusy: agent.status !== undefined && agent.status !== 'idle',
      })
      if (!decision.ok) { results.push({ sessionId: agent.id, sent: false, reason: decision.reason || 'no-candidate' }); continue }
      initiativeRunning.add(agent.id)
      try {
        const prompt = buildSharePrompt(decision.claim, { now, timeZone: cfg.时区 })
        const message = {
          role: 'user', id: eventId(['share-message', agent.id, now, decision.claim.eventId]),
          content: [{ type: 'text', text: prompt }],
          source: { kind: 'feiyu-life-share' },
        }
        const accepted = agent.followup(message)
        if (accepted && typeof accepted.then === 'function') await accepted
        const committed = commitShare(decision.claim.claimId, { now: Date.now(), timeZone: cfg.时区 })
        if (committed.ok && decision.claim.sourceKey) {
          try { markAgencyOutreach(decision.claim, { now: Date.now(), sessionId: agent.id, topic: decision.claim.title }) } catch {}
        }
        appendEvent({
          id: eventId(['sharing.sent', agent.id, decision.claim.eventId, now]), at: now, type: 'sharing.sent',
          source: 'feiyu-life-sharing', status: committed.ok ? 'applied' : 'commit-failed',
          reason: decision.claim.title || '生活分享', meta: {
            eventId: decision.claim.eventId, stageKey: decision.claim.stageKey,
            category: decision.claim.category, score: decision.claim.score,
            followup: decision.claim.followup, claimId: decision.claim.claimId,
          },
        }, { timeZone: cfg.时区 })
        results.push({
          sessionId: agent.id, sent: true, reason: 'shared', eventId: decision.claim.eventId,
          title: decision.claim.title, score: decision.claim.score, committed: committed.ok,
          focus: agency.focus?.sourceKey || '',
        })
      } catch (e) {
        const released = releaseShare(decision.claim.claimId, String(e?.message || e), { now: Date.now() })
        appendEvent({
          id: eventId(['sharing.failed', agent.id, decision.claim.eventId, now]), at: now, type: 'sharing.failed',
          source: 'feiyu-life-sharing', status: 'failed', reason: String(e?.message || e).slice(0, 180),
          meta: { eventId: decision.claim.eventId, stageKey: decision.claim.stageKey, released: released.ok },
        }, { timeZone: cfg.时区 })
        results.push({ sessionId: agent.id, sent: false, reason: 'followup-failed', eventId: decision.claim.eventId, error: String(e?.message || e).slice(0, 180) })
      } finally { initiativeRunning.delete(agent.id) }
    }
    return results
  }
}
