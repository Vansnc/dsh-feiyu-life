// Deterministic browser entry build: the authoritative UI source is
// src/ui/client.js, while DSH loads the generated root client.js.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const source = fileURLToPath(new URL('../src/ui/client.js', import.meta.url))
const target = fileURLToPath(new URL('../client.js', import.meta.url))
const banner = '/* GENERATED from src/ui/client.js by scripts/build-client.mjs. Do not edit. */\n'
const body = readFileSync(source, 'utf8')
const output = banner + body
if (process.argv.includes('--check')) {
  let current = ''
  try { current = readFileSync(target, 'utf8') } catch {}
  if (current !== output) {
    console.error('client.js is not reproducible; run npm run build:client')
    process.exit(1)
  }
} else {
  writeFileSync(target, output)
}
