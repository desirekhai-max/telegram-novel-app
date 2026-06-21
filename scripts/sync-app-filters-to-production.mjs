/**
 * 将 server/data/filter-*.json 同步到远程后台（Railway Volume）。
 *
 * 用法：node scripts/run-with-env.mjs node scripts/sync-app-filters-to-production.mjs
 * 环境变量：API_BASE、ADMIN_LEGACY_USER、ADMIN_LEGACY_PASS、ADMIN_LEGACY_OTP
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'server', 'data')

const API_BASE = String(process.env.API_BASE || 'https://telegram-novel-app-production-7f1e.up.railway.app').replace(/\/+$/, '')
const ADMIN_USER = String(process.env.ADMIN_LEGACY_USER || 'admin')
const ADMIN_PASS = String(process.env.ADMIN_LEGACY_PASS || 'admin123')
const ADMIN_OTP = String(process.env.ADMIN_LEGACY_OTP || '123456')

const SECTIONS = [
  { key: 'genres', file: 'filter-genres.json' },
  { key: 'tags', file: 'filter-tags.json' },
  { key: 'status', file: 'filter-status.json' },
  { key: 'wordRanges', file: 'filter-word-ranges.json' },
  { key: 'sort', file: 'filter-sort.json' },
]

async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`${method} ${pathname} ${res.status}: ${text.slice(0, 300)}`)
  }
  if (!res.ok) throw new Error(`${method} ${pathname} ${res.status}: ${data?.error || text}`)
  return data
}

function readLocalItems(filename) {
  const filePath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(filePath)) throw new Error(`missing ${filePath}`)
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (!Array.isArray(parsed?.items)) throw new Error(`${filename}: items array required`)
  return parsed.items
}

async function main() {
  console.log(`[sync-filters] API_BASE=${API_BASE}`)
  console.log(`[sync-filters] source=${DATA_DIR}`)

  const login = await api('/api/admin-legacy/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: ADMIN_PASS, otp: ADMIN_OTP },
  })
  const token = login.token
  if (!token) throw new Error('login ok but no token')

  for (const { key, file } of SECTIONS) {
    const items = readLocalItems(file)
    const result = await api(`/api/admin-legacy/app-filters/${key}`, {
      method: 'PUT',
      token,
      body: { items },
    })
    const count = result?.items?.length ?? items.length
    console.log(`[sync-filters] ${key}: ${count} item(s) ok`)
  }

  const panel = await api('/api/home-filter-panel-config')
  const genreSample = panel?.groups?.find((g) => g.key === 'genre')?.options?.[1]?.label
  console.log(`[sync-filters] verify genre[1].label=${genreSample}`)
  console.log('[sync-filters] done')
}

main().catch((err) => {
  console.error('[sync-filters] failed:', err?.message || err)
  process.exit(1)
})
