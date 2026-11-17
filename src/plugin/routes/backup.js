export function registerBackupRoutes(deps) {
  const {
    ctx, prefix, onlyOwner, reply, readBody, readConfig, readImageConfig, readMind,
    createSettingsBackup, restoreSettingsBackup, replaceConfig, replaceImageConfig, writeMind,
  } = deps
  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: prefix + '/settings-backup',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const cfg = readConfig()
          const backup = createSettingsBackup(cfg, readImageConfig(), readMind(cfg.人格))
          const data = Buffer.from(JSON.stringify(backup, null, 2), 'utf8')
          const day = backup.exportedAt.slice(0, 10)
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8', 'content-length': data.length,
            'content-disposition': `attachment; filename="dsh-feiyu-life-settings-${day}.json"`,
            'cache-control': 'no-store',
          })
          res.end(data)
        } catch (e) { return reply(res, 500, { ok: false, error: String(e && e.message) }) }
      }),
    }), 'feiyu-life: settings backup')
  } catch {}
  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: prefix + '/settings-restore',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'method not allowed' })
        let body
        try { body = await readBody(req) } catch (e) { return reply(res, 413, { ok: false, error: String(e.message || e) }) }
        let restored
        try { restored = restoreSettingsBackup(body && body.backup) } catch (e) { return reply(res, 400, { ok: false, error: String((e && e.message) || e) }) }
        const previousLife = readConfig()
        const previousCamera = readImageConfig()
        const previousMind = readMind(previousLife.人格)
        try {
          replaceConfig(restored.life)
          replaceImageConfig(restored.camera)
          if (restored.mind) writeMind(restored.mind, restored.life.人格)
          return reply(res, 200, { ok: true, summary: restored.summary, issues: restored.issues })
        } catch (e) {
          try { replaceConfig(previousLife); replaceImageConfig(previousCamera); writeMind(previousMind, previousLife.人格) } catch {}
          return reply(res, 500, { ok: false, error: '恢复写入失败，已回滚原设置：' + String((e && e.message) || e) })
        }
      }),
    }), 'feiyu-life: settings restore')
  } catch {}
}
