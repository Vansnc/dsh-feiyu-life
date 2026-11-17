// Deterministic browser build: authoritative UI is src/ui/*.js, runtime entry is
// the generated root client.js. DSH still loads root client.js.
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const entry = fileURLToPath(new URL('../src/ui/client.js', import.meta.url))
const target = fileURLToPath(new URL('../client.js', import.meta.url))
const banner = '/* GENERATED from src/ui/client.js (bundled from src/ui/*.js) by scripts/build-client.mjs. Do not edit. */\n'
const result = await build({
  entryPoints: [entry], bundle: true, format: 'iife', platform: 'browser',
  target: ['es2020'], write: false, logLevel: 'silent', banner: { js: banner },
})
const output = result.outputFiles[0].text
if (process.argv.includes('--check')) {
  let current = ''
  try { current = readFileSync(target, 'utf8') } catch {}
  if (current !== output) {
    console.error('client.js is not reproducible; run npm run build:client')
    process.exit(1)
  }
} else {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(target, output)
}
