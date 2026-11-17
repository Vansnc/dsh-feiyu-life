// dsh-feiyu-life · small, dependency-free persistence helpers.
//
// All plugin-owned JSON goes through here for three reasons:
//   1. a fixed ".tmp" name lets two writers clobber each other's rename;
//   2. an unbounded read of a corrupt/giant file can freeze a turn;
//   3. a crashed process must not leave a permanent lock behind.
//
// Everything is synchronous: these files are small, and the plugin calls them
// from synchronous context builders and bounded HTTP handlers.

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomBytes } from 'node:crypto'

export const DEFAULT_MAX_JSON_BYTES = 1024 * 1024

/** Read a small JSON file without ever trusting its size or content. */
export function readJsonBounded(path, options = {}) {
  const maxBytes = Math.max(1024, Number(options.maxBytes) || DEFAULT_MAX_JSON_BYTES)
  let st
  try { st = statSync(path) } catch (e) {
    return { ok: false, reason: e && e.code === 'ENOENT' ? 'missing' : 'stat-failed' }
  }
  if (!st.isFile()) return { ok: false, reason: 'not-a-file' }
  if (st.size > maxBytes) return { ok: false, reason: 'too-large', size: st.size, mtimeMs: st.mtimeMs }
  try {
    return { ok: true, value: JSON.parse(readFileSync(path, 'utf8')), size: st.size, mtimeMs: st.mtimeMs }
  } catch { return { ok: false, reason: 'invalid', size: st.size, mtimeMs: st.mtimeMs } }
}

/** Write bytes, then rename over the target so readers never see a partial file. */
export function atomicWrite(path, data) {
  const dir = dirname(path)
  const tmp = join(dir, `.${process.pid}.${Date.now()}.${randomBytes(4).toString('hex')}.tmp`)
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(tmp, data, 'utf8')
    renameSync(tmp, path)
    return true
  } catch {
    try { unlinkSync(tmp) } catch {}
    return false
  }
}

export function atomicWriteJson(path, value) {
  return atomicWrite(path, JSON.stringify(value, null, 2) + '\n')
}

/**
 * Move an unreadable file aside once, so a corrupt config cannot silently
 * shadow every later write. The caller decides whether to recreate defaults.
 */
export function quarantine(path) {
  if (!existsSync(path)) return null
  const target = `${path}.corrupt-${Date.now()}`
  try { renameSync(path, target); return target } catch { return null }
}

/**
 * Best-effort single-writer lock shared by processes. Returns null when another
 * writer is active; stale locks (a crashed process) are reclaimed after staleMs.
 */
export function acquireLock(path, options = {}) {
  const staleMs = Math.max(1000, Number(options.staleMs) || 120000)
  mkdirSync(dirname(path), { recursive: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, 'wx')
      try { writeFileSync(fd, `${process.pid} ${Date.now()}\n`) } catch {}
      return { fd, path }
    } catch {
      try {
        if (attempt === 0 && existsSync(path) && Date.now() - statSync(path).mtimeMs > staleMs) unlinkSync(path)
      } catch {}
    }
  }
  return null
}

export function releaseLock(lock) {
  if (!lock) return
  try { closeSync(lock.fd) } catch {}
  try { unlinkSync(lock.path) } catch {}
}

/** Run fn under a lock. Returns undefined (not throwing) when the lock is busy. */
export function withLock(path, fn, options = {}) {
  const lock = acquireLock(path, options)
  if (!lock) return undefined
  try { return fn() } finally { releaseLock(lock) }
}
