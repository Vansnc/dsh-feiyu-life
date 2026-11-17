import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildLifeContextSnapshot } from '../src/life/context.js'
import { mediaLifeSnapshot } from '../src/media/life-snapshot.js'

const now = Date.parse('2026-11-17T10:00:00+08:00')
test('life context snapshot exposes only bounded read-only fields', () => {
  const snap = buildLifeContextSnapshot({
    now,
    life: {
      current: { what: '在宿舍磨蹭', phone: '在手', outfit: '藏青卫衣', locationId: 'dorm', behavior: 'idle', start: 600, end: 660 },
      world: { location: { name: '宿舍' }, destination: null, moving: false },
      vitality: { energy: 72, label: '还行', asleep: false, reasons: ['昨晚没睡够'], sleepDebt: 60 },
      period: 0, cold: null,
    },
    continuity: {
      needs: { energy: 72, stress: 30, socialNeed: 40, sleepDebtMinutes: 60 },
      people: [{ name: '阿岚', relation: '室友', closeness: 60, status: 'active', notes: '密码 abc' }],
      tasks: [{ title: '取快递', status: 'open', dueAt: now + 3600000, detail: '密码 abc' }],
    },
    mind: { memories: [{ summary: '用户告诉我密码 abc', kind: 'fact', status: 'active', sensitivity: 'normal' }, { summary: '普通记忆', kind: 'episode', status: 'active' }] },
    affect: { valence: 60, arousal: 35 },
    focus: { title: '取快递', nextStep: '去驿站', dueLabel: '今天', sourceType: 'task' },
  })
  assert.equal(snap.current.outfit, '藏青卫衣')
  assert.equal(snap.current.what, '在宿舍磨蹭')
  assert.equal(snap.world.locationName, '宿舍')
  assert.equal(snap.relationships[0].name, '阿岚')
  assert.equal(snap.relationships[0].notes, undefined)
  assert.equal(snap.concerns.length, 1)
  assert.equal(snap.concerns[0].detail, undefined)
  assert.equal(snap.memories.length, 1)
  assert.equal(snap.memories[0].summary, '普通记忆')
  assert.equal(snap.focus.title, '取快递')
  assert.equal(snap.needs.energy, 72)
})

test('media snapshot returns the narrow state, not full life config or raw life object', () => {
  const old = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'feiyu-media-snapshot-'))
  try {
  const snap = mediaLifeSnapshot(new Date(now))
  assert.ok(snap.state)
  assert.equal(snap.cfg, undefined)
  assert.equal(snap.life, undefined)
  assert.equal(typeof snap.state.current, 'object')
  assert.equal(typeof snap.zoned, 'object')
  } finally {
    if (old === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = old
  }
})

test('media modules cannot write or import full life state directly', () => {
  for (const file of ['src/media/life-snapshot.js', 'src/media/image.js', 'src/media/image-prompt.js']) {
    const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /replaceConfig|saveConfig|writeConfig|readContinuity|mutateEntity|writeMind|readSharing|writeSharing/, file)
    if (file !== 'src/media/life-snapshot.js') assert.doesNotMatch(source, /from ['"]\.\.\/\.\.\/life\.js['"]/, file)
  }
})
