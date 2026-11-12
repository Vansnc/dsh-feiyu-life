import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const behaviors = ['idle', 'walk', 'sleep', 'study', 'eat', 'phone', 'photo']

test('each avatar behavior is an isolated four-frame PNG strip', () => {
  for (const behavior of behaviors) {
    const png = readFileSync(new URL(`../assets/actions/${behavior}.png`, import.meta.url))
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], behavior)
    assert.equal(png.readUInt32BE(16), 512, `${behavior} width`)
    assert.equal(png.readUInt32BE(20), 128, `${behavior} height`)
  }
})

test('client animation only advances horizontally through isolated strips', () => {
  const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  assert.match(client, /background-size:320px 80px/)
  assert.match(client, /\/avatar\/\$\{spriteBehavior\}/)
  assert.doesNotMatch(client, /--fl-sprite-y|background-position-y/)
})

test('real map assets share one viewport and keep OpenStreetMap attribution', () => {
  for (const layer of ['base', 'anime', 'buildings']) {
    const svg = readFileSync(new URL(`../assets/maps/xueyuan-${layer}.svg`, import.meta.url), 'utf8')
    assert.match(svg, /viewBox="0 0 1000 560"/, layer)
    assert.doesNotMatch(svg, /<text\b/, `${layer} must not duplicate runtime POI names`)
  }
  const attribution = readFileSync(new URL('../assets/maps/ATTRIBUTION.md', import.meta.url), 'utf8')
  assert.match(attribution, /OpenStreetMap contributors/)
  assert.match(attribution, /ODbL/)
})

test('map renders configured paths as layered roads with active-route state', () => {
  const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  assert.match(client, /data-fl-map-layer/)
  assert.match(client, /layer=base/)
  assert.match(client, /layer=anime/)
  assert.match(client, /layer=buildings/)
  assert.match(client, /data-fl-road-base/)
  assert.match(client, /data-fl-road-mark/)
  assert.match(client, /routePairs\.has\(pair\)/)
  assert.match(client, /\[data-fl-avatar\]\{position:absolute;z-index:8/)
  assert.match(client, /calc\(-100% - 48px\)/)
  assert.match(client, /data-fl-place-glyph/)
  assert.match(client, /id === 'mcdonalds'/)
  assert.match(client, /data-fl-brand-mark/)
  assert.doesNotMatch(client, /data-fl-place-icon|🐋|🐳|🌲|🌳/)
  assert.doesNotMatch(client, /data-fl-map-lines\] line/)
})
