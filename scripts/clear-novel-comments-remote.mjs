/**
 * 清空正式环境 presence-data.json 中的评论相关字段（不影响其它数据）。
 *
 * 用法：node scripts/run-with-env.mjs node scripts/clear-novel-comments-remote.mjs
 * 环境变量：API_BASE、ADMIN_LEGACY_USER、ADMIN_LEGACY_PASS、ADMIN_LEGACY_OTP
 */
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
    throw new Error(`${method} ${pathname} ${res.status}: ${text.slice(0, 300)}`)
  }
  if (!res.ok) throw new Error(`${method} ${pathname} ${res.status}: ${data?.error || text}`)
  return data
}

async function main() {
  console.log(`[clear-comments] API_BASE=${API_BASE}`)

  const login = await api('/api/admin-legacy/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: ADMIN_PASS, otp: ADMIN_OTP },
  })
  const token = login.token
  if (!token) throw new Error('login ok but no token')

  const result = await api('/api/admin-legacy/clear-novel-comments', {
    method: 'POST',
    token,
  })

  console.log(`[clear-comments] clearedReviews=${result.clearedReviews ?? 0}`)
  console.log(`[clear-comments] clearedReplies=${result.clearedReplies ?? 0}`)

  const sample = await api('/api/reviews?novelId=1')
  const remaining = Array.isArray(sample?.items) ? sample.items.length : 0
  console.log(`[clear-comments] verify novelId=1 reviews remaining=${remaining}`)
  console.log('[clear-comments] done')
}

main().catch((err) => {
  console.error('[clear-comments] failed:', err?.message || err)
  process.exit(1)
})
