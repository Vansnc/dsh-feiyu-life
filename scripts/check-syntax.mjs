import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.codex') continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path)
    else if (name.endsWith('.js') || name.endsWith('.mjs')) files.push(path)
  }
}
walk(root)
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' })
console.log(`syntax ok: ${files.length} files`)
