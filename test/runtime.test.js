import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { appendRotatingLog, withStreamTimeout } from '../runtime.js'

test('model stream timeout stays hard even when iterator close hangs', async () => {
  const iterable = {
    [Symbol.asyncIterator]() {
      return {
        next: () => new Promise(() => {}),
        return: () => new Promise(() => {}),
      }
    },
  }
  const started = Date.now()
  await assert.rejects(async () => {
    for await (const _ of withStreamTimeout(iterable, 25, 'test model')) {}
  }, (error) => error && error.code === 'ETIMEDOUT')
  assert.ok(Date.now() - started < 250)
})

test('logs rotate instead of growing without a bound', () => {
  const dir = mkdtempSync(join(tmpdir(), 'feiyu-runtime-'))
  try {
    const path = join(dir, 'life.log')
    writeFileSync(path, '1234567890')
    appendRotatingLog(path, 'new', 10, 2)
    assert.equal(readFileSync(path, 'utf8'), 'new')
    assert.equal(readFileSync(path + '.1', 'utf8'), '1234567890')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
