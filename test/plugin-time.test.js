import test from 'node:test'
import assert from 'node:assert/strict'
import { requestedAt } from '../src/plugin/app.js'
import { zonedNow } from '../src/life/life.js'

test('preview and replay local dates are interpreted in the configured timezone', () => {
  const params = new URLSearchParams({ date: '2026-11-18', minute: '510' })
  const at = requestedAt(params, { 时区: 'Asia/Shanghai' })
  const local = zonedNow(at, 'Asia/Shanghai')
  assert.equal(local.ymd, '2026-11-18')
  assert.equal(local.minuteOfDay, 510)
})

test('timestamp links stay backward compatible and malformed local input is ignored', () => {
  const expected = Date.UTC(2026, 10, 18, 8)
  const fallback = new Date(123)
  assert.equal(requestedAt(new URLSearchParams({ ts: String(expected) }), {}, fallback).getTime(), expected)
  assert.equal(requestedAt(new URLSearchParams({ date: 'bad', minute: '510' }), {}, fallback).getTime(), 123)
})
