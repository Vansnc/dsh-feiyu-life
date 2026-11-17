import { readFileSync } from 'node:fs'

export function registerMediaRoutes(deps) {
  const { ctx, prefix, onlyOwner, reply, logoFile, avatarFile, avatarActionFiles, mapFiles } = deps
  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: prefix + '/logo',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const data = readFileSync(logoFile)
          res.writeHead(200, { 'content-type': 'image/png', 'content-length': data.length, 'cache-control': 'public, max-age=86400, immutable' })
          res.end(data)
        } catch { return reply(res, 404, { ok: false, error: 'logo_not_found' }) }
      }),
    }), 'feiyu-life: logo')
  } catch {}
  for (const [behavior, file] of avatarActionFiles) {
    try {
      ctx.effect(() => ctx.webServer.register({
        kind: 'exact', path: `${prefix}/avatar/${behavior}`,
        handler: onlyOwner(async (req, res) => {
          if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
          try {
            const data = readFileSync(file)
            res.writeHead(200, { 'content-type': 'image/png', 'content-length': data.length, 'cache-control': 'no-store' })
            res.end(data)
          } catch { return reply(res, 404, { ok: false, error: 'avatar_action_not_found' }) }
        }),
      }), `feiyu-life: avatar ${behavior}`)
    } catch {}
  }
  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: prefix + '/avatar',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const url = new URL(req.url || '/', 'http://x')
          const file = avatarActionFiles.get(String(url.searchParams.get('action') || '')) || avatarFile
          const data = readFileSync(file)
          res.writeHead(200, { 'content-type': 'image/png', 'content-length': data.length, 'cache-control': 'no-store' })
          res.end(data)
        } catch { return reply(res, 404, { ok: false, error: 'avatar_not_found' }) }
      }),
    }), 'feiyu-life: avatar')
  } catch {}
  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: prefix + '/map/xueyuan',
      handler: onlyOwner(async (req, res) => {
        if (req.method !== 'GET') return reply(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const url = new URL(req.url || '/', 'http://x')
          const file = mapFiles.get(String(url.searchParams.get('layer') || 'base'))
          if (!file) return reply(res, 404, { ok: false, error: 'map_layer_not_found' })
          const data = readFileSync(file)
          res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'content-length': data.length, 'cache-control': 'no-store' })
          res.end(data)
        } catch { return reply(res, 404, { ok: false, error: 'map_layer_not_found' }) }
      }),
    }), 'feiyu-life: xueyuan map')
  } catch {}
}
