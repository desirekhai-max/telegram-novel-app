/**
 * 将 src/data/novels.js 中尚未入库的演示书补入远程目录（不覆盖已有 id）。
 * 用法：node scripts/sync-missing-demo-novels.mjs
 * 环境变量：API_BASE（默认 Railway 生产）、ADMIN_LEGACY_USER/PASS/OTP
 */
import { novels } from '../src/data/novels.js'

const API_BASE = String(process.env.API_BASE || 'https://telegram-novel-app-production-7f1e.up.railway.app').replace(/\/+$/, '')
const ADMIN_USER = String(process.env.ADMIN_LEGACY_USER || 'admin')
const ADMIN_PASS = String(process.env.ADMIN_LEGACY_PASS || 'admin123')
const ADMIN_OTP = String(process.env.ADMIN_LEGACY_OTP || '123456')

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`${method} ${path} ${res.status}: ${text.slice(0, 200)}`)
  }
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${data?.error || text}`)
  return data
}

function novelToCreatePayload(raw) {
  return {
    id: raw.id,
    title: raw.title,
    author: raw.author,
    synopsis: raw.synopsis,
    coverUrl: raw.coverUrl,
    genreId: raw.genreId,
    status: raw.status,
    source: raw.source,
    audience: raw.audience,
    tags: raw.tags,
    listThemes: raw.listThemes,
    accent: raw.accent,
    authorTelegramIds: raw.authorTelegramIds,
    chapters: (raw.chapters || []).map((ch) => ({
      title: ch.title,
      body: ch.body,
      isVip: ch.isVip === true,
    })),
  }
}

async function main() {
  console.log(`[sync] API_BASE=${API_BASE}`)

  const login = await api('/api/admin-legacy/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: ADMIN_PASS, otp: ADMIN_OTP },
  })
  const token = login.token
  if (!token) throw new Error('login ok but no token')

  const existing = await api('/api/admin-legacy/novels?pageSize=100', { token })
  const existingIds = new Set((existing.items || []).map((n) => String(n.id)))
  console.log(`[sync] existing catalog ids (${existingIds.size}):`, [...existingIds].sort().join(', '))

  const missing = novels.filter((n) => !existingIds.has(String(n.id)))
  console.log(`[sync] missing bundled novels to import: ${missing.length}`)

  let imported = 0
  for (const raw of missing) {
    const payload = novelToCreatePayload(raw)
    await api('/api/admin-legacy/novels', { method: 'POST', token, body: payload })
    imported += 1
    console.log(`[sync] imported id=${raw.id} title=${raw.title}`)
  }

  const catalog = await api('/api/novels-catalog')
  const count = Array.isArray(catalog.novels) ? catalog.novels.length : 0
  console.log(`[sync] done imported=${imported} catalogTotal=${count}`)
  catalog.novels?.forEach((n) => console.log(`  - ${n.id} ${n.title}`))
}

main().catch((err) => {
  console.error('[sync] failed:', err?.message || err)
  process.exit(1)
})
