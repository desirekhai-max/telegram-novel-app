/**
 * 将 public/covers/novel-*.png 上传到生产 API 持久化目录，并更新对应书的 coverUrl。
 * 用法：node scripts/run-with-env.mjs node scripts/publish-bundled-covers.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COVERS_DIR = path.join(__dirname, '..', 'public', 'covers')

const API_BASE = String(process.env.API_BASE || 'https://telegram-novel-app-production-7f1e.up.railway.app').replace(/\/+$/, '')
const ADMIN_USER = String(process.env.ADMIN_LEGACY_USER || 'admin')
const ADMIN_PASS = String(process.env.ADMIN_LEGACY_PASS || 'admin123')
const ADMIN_OTP = String(process.env.ADMIN_LEGACY_OTP || '123456')

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
    throw new Error(`${method} ${pathname} ${res.status}: ${text.slice(0, 200)}`)
  }
  if (!res.ok) throw new Error(`${method} ${pathname} ${res.status}: ${data?.error || text}`)
  return data
}

function mimeForFile(name) {
  const ext = path.extname(name).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  return 'image/jpeg'
}

async function main() {
  const login = await api('/api/admin-legacy/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: ADMIN_PASS, otp: ADMIN_OTP },
  })
  const token = login.token
  if (!token) throw new Error('login failed')

  const files = fs.readdirSync(COVERS_DIR).filter((f) => /^novel-\d+\.png$/i.test(f))
  console.log(`[covers] uploading ${files.length} file(s) to ${API_BASE}`)

  const updates = []
  for (const file of files.sort()) {
    const m = file.match(/^novel-(\d+)\.png$/i)
    if (!m) continue
    const novelId = m[1]
    const buffer = fs.readFileSync(path.join(COVERS_DIR, file))
    const mimeType = mimeForFile(file)

    const remote = await api(`/api/admin-legacy/novels/${encodeURIComponent(novelId)}`, { token })
    const previousCoverUrl = String(remote?.novel?.coverUrl || '')

    const uploaded = await api('/api/admin-legacy/novels/cover-upload', {
      method: 'POST',
      token,
      body: {
        mimeType,
        base64: buffer.toString('base64'),
        previousCoverUrl,
      },
    })

    const coverUrl = String(uploaded.coverUrl || '')
    if (!coverUrl) throw new Error(`upload failed for ${file}`)

    await api(`/api/admin-legacy/novels/${encodeURIComponent(novelId)}`, {
      method: 'PUT',
      token,
      body: { coverUrl },
    })

    updates.push({ novelId, file, coverUrl })
    console.log(`[covers] id=${novelId} -> ${coverUrl}`)
  }

  console.log(`[covers] done ${updates.length} upload(s)`)
  for (const u of updates) {
    console.log(`  novel-${u.novelId}.png => ${u.coverUrl}`)
  }
}

main().catch((err) => {
  console.error('[covers] failed:', err?.message || err)
  process.exit(1)
})
