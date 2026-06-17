/**
 * 将 src/data/novels.js 中全部演示书同步到远程后台（元数据 + 章节正文）。
 * - 已有 id：PUT 元数据，逐章 PUT/POST 同步，多余旧章 DELETE
 * - 缺失 id：POST 创建（含 chapters）
 *
 * 用法：node scripts/run-with-env.mjs node scripts/sync-demo-novels-to-production.mjs
 * 环境变量：API_BASE、ADMIN_LEGACY_USER、ADMIN_LEGACY_PASS、ADMIN_LEGACY_OTP
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
    signal: AbortSignal.timeout(120000),
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`${method} ${path} ${res.status}: ${text.slice(0, 300)}`)
  }
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${data?.error || text}`)
  return data
}

function novelMetaPayload(raw) {
  return {
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
  }
}

function novelCreatePayload(raw) {
  return {
    id: raw.id,
    ...novelMetaPayload(raw),
    chapters: (raw.chapters || []).map((ch) => ({
      title: ch.title,
      body: ch.body,
      isVip: ch.isVip === true,
    })),
  }
}

function chapterPayload(ch) {
  return {
    title: ch.title,
    body: ch.body,
    isVip: ch.isVip === true,
  }
}

async function syncChapters(token, raw, remoteNovel) {
  const bundled = raw.chapters || []
  let remoteCount = Array.isArray(remoteNovel?.chapters) ? remoteNovel.chapters.length : 0

  while (remoteCount > bundled.length) {
    await api(`/api/admin-legacy/chapters/${encodeURIComponent(raw.id)}/${remoteCount - 1}`, {
      method: 'DELETE',
      token,
    })
    remoteCount -= 1
  }

  for (let i = 0; i < bundled.length; i += 1) {
    const payload = chapterPayload(bundled[i])
    if (i < remoteCount) {
      await api(`/api/admin-legacy/chapters/${encodeURIComponent(raw.id)}/${i}`, {
        method: 'PUT',
        token,
        body: payload,
      })
    } else {
      await api('/api/admin-legacy/chapters', {
        method: 'POST',
        token,
        body: { novelId: raw.id, ...payload },
      })
    }
  }
}

async function main() {
  console.log(`[sync-all] API_BASE=${API_BASE}`)
  console.log(`[sync-all] bundled novels=${novels.length}`)

  const login = await api('/api/admin-legacy/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: ADMIN_PASS, otp: ADMIN_OTP },
  })
  const token = login.token
  if (!token) throw new Error('login ok but no token')

  const existing = await api('/api/admin-legacy/novels?pageSize=100', { token })
  const existingIds = new Set((existing.items || []).map((n) => String(n.id)))

  let created = 0
  let updated = 0

  for (const raw of novels) {
    const id = String(raw.id)
    if (!existingIds.has(id)) {
      await api('/api/admin-legacy/novels', { method: 'POST', token, body: novelCreatePayload(raw) })
      created += 1
      console.log(`[sync-all] created id=${id} ${raw.title}`)
      continue
    }

    await api(`/api/admin-legacy/novels/${encodeURIComponent(id)}`, {
      method: 'PUT',
      token,
      body: novelMetaPayload(raw),
    })

    const remote = await api(`/api/admin-legacy/novels/${encodeURIComponent(id)}`, { token })
    await syncChapters(token, raw, remote.novel)

    updated += 1
    console.log(`[sync-all] updated id=${id} ${raw.title} chapters=${(raw.chapters || []).length}`)
  }

  const catalog = await api('/api/novels-catalog')
  const count = Array.isArray(catalog.novels) ? catalog.novels.length : 0
  console.log(`[sync-all] done created=${created} updated=${updated} catalogTotal=${count}`)
  catalog.novels?.forEach((n) => console.log(`  - ${n.id} ${n.title}`))
}

main().catch((err) => {
  console.error('[sync-all] failed:', err?.message || err)
  process.exit(1)
})
