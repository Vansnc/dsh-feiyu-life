export function installMaintenance(ctx, deps) {
  const { readConfig, readImageConfig, cleanupPlans, cleanupFacts, cleanupContinuity, cleanupEvents, cleanupPhotos, cleanupMoments } = deps
  const maintain = () => {
    try {
      const cfg = readConfig()
      cleanupPlans(cfg.历史保留天数)
      cleanupFacts(cfg.历史保留天数)
      cleanupContinuity(Math.max(365, cfg.历史保留天数))
      cleanupEvents(cfg.历史保留天数)
      cleanupPhotos(readImageConfig())
      cleanupMoments(Math.min(120, Math.max(30, Number(cfg.历史保留天数) || 180)))
    } catch (e) {
      try { ctx.logger?.warn?.('feiyu-life: 自动清理失败 ' + String((e && e.message) || e)) } catch {}
    }
  }
  try { ctx.effect(() => { const timer = setTimeout(maintain, 15000); return () => clearTimeout(timer) }) } catch {}
  try { ctx.effect(() => ctx.interval(maintain, 24 * 60 * 60 * 1000)) } catch {}
}
