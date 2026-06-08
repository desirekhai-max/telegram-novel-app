/**
 * 从项目根目录 .env 加载变量并执行子命令（不将凭证写入代码）
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const envPath = path.join(root, '.env')

if (fs.existsSync(envPath)) {
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (key && process.env[key] == null) process.env[key] = value
  }
}

const [cmd, ...args] = process.argv.slice(2)
if (!cmd) {
  console.error('usage: node scripts/run-with-env.mjs <command> [args...]')
  process.exit(1)
}

const child = spawn(cmd, args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
  cwd: root,
})
child.on('exit', (code) => process.exit(code ?? 1))
