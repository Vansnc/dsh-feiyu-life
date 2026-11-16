import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from 'playwright'
import { defaultWorldConfig } from '../world.js'
import { defaultConfig } from '../life.js'
import { normalizeImageConfig } from '../image.js'

let definition
globalThis.window = { __ModuleLoader__: { load(value) { definition = value } } }
await import(`../client.js?verify-ui=${Date.now()}`)
assert.equal(definition?.id, 'dsh-feiyu-life')
const plugin = definition.factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected client dependency: ${name}`)
})
const { CSS, WorldMap, replayFrameAt } = plugin.__test
assert.match(CSS, /data-fl-backup-card/, 'settings backup UI styles are bundled')
assert.equal(replayFrameAt([{ minute: 0, id: 'sleep' }, { minute: 480, id: 'wake' }], 479).id, 'sleep')
assert.equal(replayFrameAt([{ minute: 0, id: 'sleep' }, { minute: 480, id: 'wake' }], 480).id, 'wake')

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

  // Mount the complete settings panel and verify continuity + relationship state.
  await page.setContent('<!doctype html><meta charset="utf-8"><div id="root"></div>')
  const lifeState = {
    ok: true, config: defaultConfig, preview: { text: '此刻在宿舍', evidence: [] }, timeline: [],
    currentMinute: 600, current: { what: '整理作品集' }, world: { enabled: true, behavior: 'study', location: defaultWorldConfig.地点[0] },
    adjustments: [], meta: { dayType: { name: '没课日' }, plan: { source: 'llm', title: '普通的一天' }, planHistoryCount: 0 },
  }
  const continuityState = {
    ok: true,
    state: {
      needs: { energy: 68, stress: 32, socialNeed: 24, sleepDebtMinutes: 30 },
      threads: [{ id: 't1', title: '视觉作品集', status: 'active', progress: 20, origin: '用户明确提出', nextStep: '整理封面' }],
      tasks: [{ id: 'q1', title: '取快递', status: 'open', origin: '设置页' }], commitments: [],
      people: [{ id: 'p1', name: '小满', relation: '室友', notes: '最近在为恋爱烦恼', status: 'active', closeness: 67, interactionCount: 3, origin: '角色设定' }],
    },
    view: { needs: ['有点累', '压力尚可', '社交需求平常', '有一点睡眠欠账'], entities: [
      { id: 't1', due: { label: '', state: 'none' } }, { id: 'q1', due: { label: '今天 18:00', state: 'today' } },
    ] },
    memories: [{ date: '2026-11-14', summary: '真实时间线已结算 3 段' }],
    planSync: { date: '2026-11-17', synced: false, source: 'llm' },
  }
  const affectState = {
    ok: true,
    state: { valence: 68, arousal: 43, label: '心情不错', dimensions: { joy: 18, calm: 24, worry: 3, sadness: 0 }, lastReason: '用户认真听她讲完了', lastConfidence: 0.86, lastEventAt: Date.now() },
    usage: { attempted: 3, limit: 30, remaining: 27 },
    privacy: '本地只保存反思结论、原因、候选摘要与用量，不保存对话原文。',
    events: [{ id: 'r1', at: Date.now(), type: 'turn.reflection', source: 'human', status: 'applied', reason: '用户认真听她讲完了', model: 'test/model', memoryCandidates: [{ summary: '用户愿意听她聊作品集' }] }],
  }
  const mindState = {
    ok: true,
    counts: { memories: 2, preferences: 1, goals: 1, relationships: 1 },
    integrations: { memory: false, mood: false, speakUp: false, bili: true },
    mind: {
      identity: { narrative: '我是大肥鱼，也在慢慢形成自己的看法。', traits: ['嘴硬心软', '重感情'], values: ['真诚', '尊重边界'] },
      memories: [{ id: 'm1', summary: '月见喜欢在咖啡店安静写东西', kind: 'preference', importance: 0.9, status: 'active', source: 'reflection' }],
      preferences: [{ id: 'p1', owner: 'self', key: '散步', value: '喜欢傍晚慢慢走', status: 'active' }],
      goals: [{ id: 'g1', title: '整理本周生活片段', status: 'active', progress: 20, scope: 'local', nextStep: '挑三段真实时间线' }],
      relationships: [{ id: 'r1', name: '月见', summary: '愿意认真听她讲完', warmth: 62, trust: 58, tension: 2 }],
    },
  }
  await page.evaluate(({ life, continuity, affect, mind }) => {
    window.fetch = async (url) => ({
      ok: true,
      async json() { return String(url).includes('/continuity') ? continuity : String(url).includes('/affect') ? affect : String(url).includes('/mind') ? mind : life },
    })
    const plugin = window.__photoDefinition.factory((name) => {
      if (name === 'react') return window.React
      throw new Error(`unexpected dependency: ${name}`)
    })
    const style = document.createElement('style'); style.textContent = plugin.__test.CSS; document.head.appendChild(style)
    window.ReactDOM.createRoot(document.getElementById('root')).render(window.React.createElement(plugin.__test.Panel))
  }, { life: lifeState, continuity: continuityState, affect: affectState, mind: mindState })
  await page.getByText('连续性', { exact: true }).click()
  await page.getByText('视觉作品集').waitFor()
  assert.equal(await page.getByText('取快递', { exact: true }).count(), 1, 'one-off pickup is rendered as a short task')
  assert.equal(await page.getByText('计划只是意图', { exact: false }).count(), 1, 'completion boundary is visible')
  assert.equal(await page.getByText('同步到明日剧本', { exact: true }).count(), 1, 'stale tomorrow plan can be explicitly synchronized')
  assert.equal(await page.getByText('小满', { exact: true }).count(), 1, 'known people are visible as durable relationship cards')
  assert.equal(await page.getByText('最近在为恋爱烦恼', { exact: true }).count(), 1, 'relationship notes are visible')
  await page.screenshot({ path: join(outputDir, 'continuity-settings.png'), fullPage: true })
  await page.getByText('内在', { exact: true }).click()
  await page.getByText('统一事件账本', { exact: true }).waitFor()
  assert.equal(await page.getByText('心情不错', { exact: false }).count(), 1, 'native affect label is visible')
  assert.equal(await page.getByText('用户认真听她讲完了', { exact: false }).count() >= 1, true, 'auditable affect reason is visible')
  assert.equal(await page.getByText('记忆候选（已交由人格策略）', { exact: false }).count(), 1, 'candidate policy boundary is explicit')
  await page.screenshot({ path: join(outputDir, 'inner-settings.png'), fullPage: true })
  await page.getByText('人格', { exact: true }).click()
  await page.getByText('明确添加记忆', { exact: true }).waitFor()
  assert.equal(await page.getByText('月见喜欢在咖啡店安静写东西', { exact: true }).count(), 1, 'durable memory is inspectable')
  assert.equal(await page.getByText('整理本周生活片段', { exact: true }).count(), 1, 'self goal is inspectable')
  assert.equal(await page.getByText('主动性', { exact: true }).count(), 1, 'initiative controls are visible')
  assert.equal(await page.getByText('dsh-bili-subagent', { exact: false }).count(), 1, 'external integration status is visible')
  await page.screenshot({ path: join(outputDir, 'personality-settings.png'), fullPage: true })
} finally {
  await browser.close()
}

console.log(`UI render verification passed; screenshots: ${outputDir}`)
