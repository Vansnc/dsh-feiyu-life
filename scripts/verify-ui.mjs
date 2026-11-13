import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from 'playwright'
import { defaultWorldConfig } from '../world.js'
import { normalizeImageConfig } from '../image.js'

let definition
globalThis.window = { __ModuleLoader__: { load(value) { definition = value } } }
await import(`../client.js?verify-ui=${Date.now()}`)
assert.equal(definition?.id, 'dsh-feiyu-life')
const plugin = definition.factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected client dependency: ${name}`)
})
const { CSS, WorldMap } = plugin.__test

const map = structuredClone(defaultWorldConfig)
map.地点.push({ id: 'clinic', name: '校医院', icon: 'hospital', x: 25, y: 72, 关键词: ['校医院'] })
map.路径.push({ from: 'dorm', to: 'clinic', minutes: 6 })
const world = {
  enabled: true,
  moving: false,
  behavior: 'bath',
  position: { x: map.地点[0].x, y: map.地点[0].y },
  location: map.地点[0],
  route: [],
}

let markup = renderToStaticMarkup(React.createElement(WorldMap, { world, map }))
const dataUri = (path, mime) => `data:${mime};base64,${readFileSync(new URL(path, import.meta.url)).toString('base64')}`
markup = markup.replace('/dsh-feiyu-life/logo?v=1.0.9', dataUri('../icon.png', 'image/png'))
for (const layer of ['base', 'anime', 'buildings']) {
  markup = markup.replace(`/dsh-feiyu-life/map/xueyuan?layer=${layer}&amp;v=1.0.8`, dataUri(`../assets/maps/xueyuan-${layer}.svg`, 'image/svg+xml'))
}
markup = markup.replace('/dsh-feiyu-life/avatar/bath?v=1.0.8', dataUri('../assets/actions/bath.png', 'image/png'))
const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}body{padding:24px;background:Canvas;color:CanvasText;font-family:system-ui,sans-serif}${CSS}</style><div data-fl-wrap>${markup}</div>`

const systemExecutable = [
  process.env.CHROMIUM_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].find((candidate) => candidate && existsSync(candidate))
let browser
let launchError
for (const executablePath of [undefined, systemExecutable].filter((value, index, all) => index === 0 || value)) {
  try {
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] })
    break
  } catch (error) { launchError = error }
}
if (!browser) {
  if (process.env.CI) throw launchError
  console.warn(`UI render verification skipped: Chromium is unavailable in this sandbox (${String(launchError?.message || launchError).split('\n')[0]})`)
  process.exit(0)
}
const page = await browser.newPage({ viewport: { width: 1200, height: 860 }, colorScheme: 'light' })
const outputDir = join(tmpdir(), 'dsh-feiyu-life-ui')
mkdirSync(outputDir, { recursive: true })

try {
  await page.setContent(html, { waitUntil: 'load' })
  const mapBox = await page.locator('[data-fl-map]').boundingBox()
  assert.ok(mapBox && mapBox.width >= 1000 && mapBox.height >= 500, 'desktop map keeps its usable canvas')
  assert.equal(await page.locator('[data-fl-map-layer]').count(), 3, 'all three real-map layers render')
  assert.equal(await page.locator('[data-fl-place]').count(), map.地点.length, 'all configured places render')
  assert.equal(await page.locator('[data-place="clinic"] [data-iconify-icon="hospital"]').count(), 1, 'custom place icon renders')
  assert.equal(await page.locator('[data-fl-avatar-motion][data-behavior="bath"]').count(), 1, 'bath keeps its own animation state')
  const spriteImage = await page.locator('[data-fl-avatar-sprite]').evaluate((el) => getComputedStyle(el).backgroundImage)
  assert.match(spriteImage, /^url\(/)
  const stacking = await page.evaluate(() => ({
    avatar: Number(getComputedStyle(document.querySelector('[data-fl-avatar]')).zIndex),
    place: Number(getComputedStyle(document.querySelector('[data-fl-place]')).zIndex),
    layers: Number(getComputedStyle(document.querySelector('[data-fl-map-layers]')).zIndex),
  }))
  assert.ok(stacking.avatar > stacking.place && stacking.place > stacking.layers, 'character stays above buildings and POIs')
  await page.screenshot({ path: join(outputDir, 'desktop-light.png'), fullPage: true })

  await page.emulateMedia({ colorScheme: 'dark' })
  const animeOpacity = Number(await page.locator('[data-fl-map-layer="anime"]').evaluate((el) => getComputedStyle(el).opacity))
  assert.ok(animeOpacity >= 0.85, 'anime middle layer remains visible in dark mode')
  await page.screenshot({ path: join(outputDir, 'desktop-dark.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileBox = await page.locator('[data-fl-map]').boundingBox()
  assert.ok(mobileBox && mobileBox.width <= 390 && mobileBox.height >= 430, 'mobile map fits the viewport and keeps enough height')
  assert.equal(await page.locator('[data-fl-avatar]').isVisible(), true)
  await page.screenshot({ path: join(outputDir, 'mobile-dark.png'), fullPage: true })

  // Mount the real photo settings component with a mocked local API. This
  // catches regressions in lazy thumbnails, batching and the lightbox flow.
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.setContent('<!doctype html><meta charset="utf-8"><div id="root"></div>')
  const photoState = {
    ok: true,
    config: normalizeImageConfig({}),
    today: 3,
    limit: 8,
    ark: { ok: true },
    hasRef: true,
    photos: Array.from({ length: 18 }, (_, i) => ({
      name: `feiyu-${1800000000000 - i}.png`, time: 1800000000000 - i * 60000, size: 800000 + i,
    })),
  }
  await page.evaluate((state) => {
    window.__ModuleLoader__ = { load(value) { window.__photoDefinition = value } }
    window.fetch = async (url) => ({
      ok: true,
      async json() {
        return String(url).includes('/models')
          ? { ok: true, models: [state.config.模型], cached: true }
          : state
      },
    })
  }, photoState)
  await page.addScriptTag({ content: readFileSync(new URL('../node_modules/react/umd/react.development.js', import.meta.url), 'utf8') })
  await page.addScriptTag({ content: readFileSync(new URL('../node_modules/react-dom/umd/react-dom.development.js', import.meta.url), 'utf8') })
  await page.addScriptTag({ content: readFileSync(new URL('../client.js', import.meta.url), 'utf8') })
  await page.evaluate(() => {
    const plugin = window.__photoDefinition.factory((name) => {
      if (name === 'react') return window.React
      throw new Error(`unexpected dependency: ${name}`)
    })
    const style = document.createElement('style')
    style.textContent = plugin.__test.imageCSS
    document.head.appendChild(style)
    window.ReactDOM.createRoot(document.getElementById('root')).render(window.React.createElement(plugin.__test.ImagePanel))
  })
  await page.locator('[data-fi-grid]').waitFor()
  assert.equal(await page.locator('[data-fi-photo]').count(), 8, 'photo gallery initially renders one small batch')
  assert.match(await page.locator('[data-fi-photo] img').first().getAttribute('src'), /thumb=1/, 'gallery requests thumbnails')
  assert.equal(await page.locator('[data-fi-photo] img[loading="lazy"]').count(), 4, 'offscreen thumbnails are lazy')
  await page.locator('[data-fi-photo]').first().click()
  assert.equal(await page.locator('[data-fi-lightbox]').count(), 1, 'clicking a thumbnail opens the lightbox')
  assert.doesNotMatch(await page.locator('[data-fi-lightbox-img]').getAttribute('src'), /thumb=1/, 'lightbox requests the full image')
  await page.locator('[data-fi-lightbox-close]').click()
  await page.getByText('再显示 8 张').click()
  assert.equal(await page.locator('[data-fi-photo]').count(), 16, 'gallery loads more photos in batches')
  assert.equal(await page.getByText('基础与模型').count(), 1)
  assert.equal(await page.getByText('角色形象与画面').count(), 1)
  await page.screenshot({ path: join(outputDir, 'photo-settings.png'), fullPage: true })
} finally {
  await browser.close()
}

console.log(`UI render verification passed; screenshots: ${outputDir}`)
