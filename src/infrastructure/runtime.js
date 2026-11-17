// Shared runtime helpers: bounded async streams, fetch deadlines and rotating logs.

import { appendFileSync, existsSync, renameSync, statSync, unlinkSync } from 'node:fs'

export class TimeoutError extends Error {
  constructor(label, timeoutMs) {
    super(`${label} timed out after ${timeoutMs}ms`)
    this.name = 'TimeoutError'
    this.code = 'ETIMEDOUT'
  }
}

/** Wrap an async iterable with one hard deadline for the whole stream. */
export async function* withStreamTimeout(iterable, timeoutMs, label = 'model stream') {
  const iterator = iterable[Symbol.asyncIterator]()
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, timeoutMs)), timeoutMs)
  })
  try {
    while (true) {
      const step = await Promise.race([iterator.next(), timeout])
      if (step.done) return
      yield step.value
    }
  } finally {
    clearTimeout(timer)
    // A broken provider may also hang while closing. Start cancellation but do
    // not await it, otherwise the timeout wrapper itself would no longer be hard.
    try {
      const closing = iterator.return?.()
      if (closing && typeof closing.catch === 'function') closing.catch(() => {})
    } catch {}
  }
}

export function timeoutSignal(timeoutMs) {
  return typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined
}

/** Rotate file -> .1 -> .2 before appending, so logs cannot grow forever. */
export function appendRotatingLog(path, line, maxBytes = 1024 * 1024, keep = 3) {
  try {
    if (existsSync(path) && statSync(path).size >= maxBytes) {
      try { unlinkSync(`${path}.${keep}`) } catch {}
      for (let i = keep - 1; i >= 1; i--) {
        try { renameSync(`${path}.${i}`, `${path}.${i + 1}`) } catch {}
      }
      renameSync(path, `${path}.1`)
    }
    appendFileSync(path, line)
  } catch {}
}
