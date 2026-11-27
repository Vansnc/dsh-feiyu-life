import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..'
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')
const importsOf = (file) => [...read(file).matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1])
function resolveImport(from, spec) {
  const base = resolve(dirname(resolve(ROOT, from)), spec)
  return base.endsWith('.js') ? base : base + '.js'
}
function graph(entries) {
  const seen = new Set()
  const visit = (file) => {
    if (seen.has(file) || !existsSync(file)) return
    seen.add(file)
    for (const spec of importsOf(file)) visit(resolveImport(file, spec))
  }
  for (const entry of entries) visit(resolve(ROOT, entry))
  return seen
}

test('root facades and package exports stay stable', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.name, 'dsh-feiyu-life')
  assert.equal(pkg.version, '2.7.7')
  assert.ok(pkg.files.includes('src/'))
  const allowedRoot = new Set(['assets','docs','locale','scripts','src','test','node_modules','.git','.codex','.github','.editorconfig','.gitignore','index.js','client.js','package.json','package-lock.json','cordis.patch.yml','README.md','CHANGELOG.md','CONTRIBUTING.md','LICENSE','icon.png'])
  for (const name of readdirSync(ROOT)) assert.equal(allowedRoot.has(name), true, `unexpected root entry: ${name}`)
  for (const file of ['index.js', 'client.js', 'package.json', 'package-lock.json', 'cordis.patch.yml', 'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE']) {
    assert.equal(existsSync(resolve(ROOT, file)), true, file)
  }
  for (const file of ['agency.js', 'agency-runner.js', 'backup.js', 'continuity.js', 'gen.js', 'image.js', 'image-prompt.js', 'life.js', 'mind.js', 'moments.js', 'plan.js', 'reflection.js', 'runtime.js', 'sharing.js', 'state.js', 'storage.js', 'world.js']) {
    assert.equal(existsSync(resolve(ROOT, file)), false, `root implementation should be gone: ${file}`)
  }
  assert.match(read('index.js'), /src\/plugin\/app\.js/)
  assert.match(read('client.js'), /GENERATED from src\/ui\/client\.js/)
  assert.match(read('client.js'), /GENERATED from src\/ui\/client\.js/)
  assert.equal(existsSync(resolve(ROOT, 'storage.js')), false)
  assert.equal(existsSync(resolve(ROOT, 'image-prompt.js')), false)
})

test('DSH root entry and domain exports remain stable', async () => {
  const root = await import('../index.js')
  assert.equal(root.name, 'feiyu-life')
  assert.ok(Array.isArray(root.inject))
  assert.equal(typeof root.apply, 'function')
  const agency = await import('../src/cognition/agency/index.js')
  for (const name of ['AGENCY_VERSION', 'AGENCY_LIMITS', 'agencyPath', 'defaultAgency', 'normalizeAgency', 'readAgency', 'writeAgency', 'buildAgencyCandidates', 'tickAgency', 'agencyContext', 'agencyShareCandidates', 'markAgencyOutreach', 'observeAgencyReply', 'handleAgencyInboxReply', 'inboxReplyReference', 'agencyStatus']) {
    assert.equal(typeof agency[name] !== 'undefined', true, name)
  }
  const life = await import('../src/life/life.js')
  for (const name of ['LIFE_CONFIG_VERSION', 'defaultConfig', 'normalizeConfig', 'validateConfig', 'readConfig', 'saveConfig', 'generate', 'zonedNow', 'todayCalendar', 'lastNightSleep']) {
    assert.equal(typeof life[name] !== 'undefined', true, name)
  }
  const prompt = await import('../src/media/image-prompt.js')
  for (const name of ['buildElements', 'templatePrompt', 'modelPrompt', 'checkImage', 'generatePrompt']) {
    assert.equal(typeof prompt[name] !== 'undefined', true, name)
  }
})

test('route, tool, tab and data-file contracts are unchanged', () => {
  const index = read('src/plugin/app.js')
  const routeSources = index + read('src/plugin/routes/media.js') + read('src/plugin/routes/backup.js')
  for (const route of ['/state', '/mind', '/affect', '/continuity', '/save', '/preview', '/replay', '/settings-backup', '/settings-restore', '/regenerate', '/undo-regenerate']) {
    assert.match(routeSources, new RegExp(route.replace('/', '\\/')))
  }
  const tools = read('src/plugin/tools.js')
  for (const tool of ['life_adjust', 'life_person', 'life_task', 'life_commitment', 'life_thread', 'mind_remember', 'mind_preference', 'mind_goal']) {
    assert.match(tools, new RegExp(tool))
  }
  const client = read('src/ui/constants.js')
  for (const tab of ['now', 'share', 'persona', 'inner', 'continuity', 'replay', 'map', 'year', 'week', 'day', 'body', 'photo', 'data']) {
    assert.match(client, new RegExp(`\\['${tab}'`))
  }
  const agency = read('src/cognition/agency/schema.js')
  assert.match(agency, /feiyu-life-agency\.json/)
  assert.match(read('src/persistence/storage.js'), /withLock|atomic/)
})

test('no import cycles and no domain-to-plugin dependencies', () => {
  const files = graph(['index.js', 'client.js', 'src/plugin/app.js', 'src/life/life.js', 'src/proactive/sharing.js', 'src/media/image.js', 'src/persistence/storage.js'])
  const visiting = new Set()
  const done = new Set()
  const stack = []
  const visit = (file) => {
    if (done.has(file)) return
    assert.equal(visiting.has(file), false, `cycle: ${[...stack, file].join(' -> ')}`)
    visiting.add(file)
    stack.push(file)
    for (const spec of importsOf(file)) visit(resolveImport(file, spec))
    stack.pop()
    visiting.delete(file)
    done.add(file)
  }
  for (const file of files) visit(file)
  for (const rel of ['src/media/image.js', 'src/media/image-prompt.js']) {
    assert.doesNotMatch(read(rel), /from ['"]\.\.\/\.\.\/life\.js['"]/, rel)
  }
  for (const file of files) {
    const rel = file.slice(ROOT.length + 1)
    if (rel.startsWith('src/cognition/') || rel.startsWith('src/life/')) {
      assert.doesNotMatch(read(rel), /from ['"].*(?:index|client)\.js['"]/, rel)
    }
  }
})

test('critical source modules are inside the declared layout', () => {
  for (const file of [
    'src/plugin/context-hints.js', 'src/plugin/initiative.js', 'src/plugin/tools.js', 'src/plugin/http.js', 'src/plugin/lifecycle.js', 'src/plugin/routes/media.js', 'src/plugin/routes/backup.js', 'src/life/time.js', 'src/life/context.js', 'src/cognition/agency/schema.js',
    'src/cognition/agency/candidates.js', 'src/cognition/agency/executor.js',
    'src/cognition/agency/outreach.js', 'src/cognition/agency/state-machine.js',
    'src/cognition/agency/runner.js', 'src/media/image-prompt.js', 'src/media/image.js', 'src/media/life-snapshot.js', 'src/ui/client.js', 'src/ui/app.js', 'src/ui/styles.js', 'src/ui/constants.js', 'src/ui/image-panel.js', 'src/persistence/storage.js',
  ]) assert.equal(existsSync(resolve(ROOT, file)), true, file)
})
