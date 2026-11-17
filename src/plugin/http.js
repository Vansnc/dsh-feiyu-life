// Shared HTTP plumbing for plugin routes.
export function createHttpHelpers(ctx) {
  const onlyOwner = (handler) => async (req, res) => {
    try {
      const rejection = ctx.connection.requestRejection(req)
      if (rejection !== undefined) {
        const code = Number.isInteger(rejection) && rejection >= 400 && rejection <= 599 ? rejection : 403
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: false, error: code === 401 ? 'authentication_required' : 'forbidden' }))
        return
      }
      await handler(req, res)
    } catch (e) {
      try {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }))
      } catch {}
    }
  }
  const reply = (res, code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(obj))
  }
  const readBody = async (req) => {
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > 1024 * 1024) throw new Error('request body too large')
    }
    try { return JSON.parse(body || '{}') } catch { return undefined }
  }
  return { onlyOwner, reply, readBody }
}
