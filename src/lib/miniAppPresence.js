import { apiUrl } from './apiBase.js'

function isTelegramMiniApp() {
  try {
    const w = window.Telegram?.WebApp
    // iOS 某些场景下 initData 可能延迟/为空，只要 WebApp 对象存在就允许上报
    return Boolean(w)
  } catch {
    return false
  }
}

function getTelegramPlatform() {
  try {
    return String(window.Telegram?.WebApp?.platform || '').toLowerCase()
  } catch {
    return ''
  }
}

function getUserAgent() {
  try {
    return String(navigator.userAgent || '').toLowerCase()
  } catch {
    return ''
  }
}

function mapToBucket(platform, ua) {
  if (platform === 'android') return 'android'
  if (platform === 'ios') return 'ios'
  if (platform === 'web' || platform === 'weba' || platform === 'webk') return 'web'

  if (ua.includes('android')) return 'android'
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || ua.includes('ios')) return 'ios'
  return 'web'
}

const MEMBER_ID_KEY = 'tg_presence_member_id_v1'

function getMemberId() {
  try {
    const tgUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id
    if (tgUserId) return `tg_${tgUserId}`
  } catch {
    /* ignore */
  }
  try {
    const existing = localStorage.getItem(MEMBER_ID_KEY)
    if (existing) return existing
    const generated = `anon_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`
    localStorage.setItem(MEMBER_ID_KEY, generated)
    return generated
  } catch {
    return `anon_${Math.random().toString(36).slice(2)}`
  }
}

/** 与 presence ping 同源：Telegram 为 `tg_<id>`，浏览器匿名为 `anon_…` */
export function getPresenceMemberId() {
  return getMemberId()
}

function detectDeviceBucket() {
  return mapToBucket(getTelegramPlatform(), getUserAgent())
}

export function detectMiniAppBucket(pathname = '') {
  return detectDeviceBucket()
}

export async function registerPresencePing(pathname = '', adminOnline = false) {
  if (!isTelegramMiniApp()) return
  const bucket = detectDeviceBucket()
  const memberId = getMemberId()
  try {
    await fetch(apiUrl('/api/presence/ping'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId,
        device: bucket,
        isAdmin: Boolean(adminOnline),
      }),
    })
  } catch {
    /* ignore network failure */
  }
}

export async function readActiveMembers5m() {
  try {
    const res = await fetch(apiUrl('/api/presence/online'), { cache: 'no-store' })
    if (!res.ok) throw new Error('presence online failed')
    const data = await res.json()
    return {
      android: Number(data?.counts?.android || 0),
      web: Number(data?.counts?.web || 0),
      ios: Number(data?.counts?.ios || 0),
      admin: Number(data?.counts?.admin || 0),
    }
  } catch {
    return { android: 0, web: 0, ios: 0, admin: 0 }
  }
}

export async function reportMetricEvent(type) {
  const t = String(type || '').toLowerCase()
  if (!t) return
  try {
    await fetch(apiUrl('/api/metrics/tx-event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: t }),
    })
  } catch {
    /* ignore network failure */
  }
}

/** 写入阅读记录（管理端「阅读记录管理」列表）；成功后会派发 `tg-admin-records-changed` */
export async function appendReadingRecord(record) {
  try {
    const res = await fetch(apiUrl('/api/reading-records/append'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
    if (res.ok) {
      window.dispatchEvent(new CustomEvent('tg-admin-records-changed'))
    }
  } catch {
    /* ignore network failure */
  }
}

export async function fetchNovelViewCount(novelId, baseCount = 0) {
  try {
    const res = await fetch(
      apiUrl(
        `/api/novel-views?novelId=${encodeURIComponent(String(novelId || ''))}&base=${encodeURIComponent(String(baseCount || 0))}`,
      ),
      {
      cache: 'no-store',
      },
    )
    if (!res.ok) throw new Error('fetch novel views failed')
    const data = await res.json()
    const count = Number(data?.count)
    if (Number.isFinite(count) && count >= 0) return Math.floor(count)
  } catch {
    /* ignore network failure */
  }
  const base = Number(baseCount)
  return Number.isFinite(base) && base >= 0 ? Math.floor(base) : 0
}

export async function incrementNovelViewCount(novelId, delta = 1, baseCount = 0) {
  try {
    const res = await fetch(apiUrl('/api/novel-views/increment'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novelId: String(novelId || ''),
        delta: Number(delta) || 1,
        baseCount: Number(baseCount) || 0,
      }),
    })
    if (!res.ok) throw new Error('increment novel views failed')
    const data = await res.json()
    const count = Number(data?.count)
    if (Number.isFinite(count) && count >= 0) return Math.floor(count)
  } catch {
    /* ignore network failure */
  }
  return null
}

export async function fetchNovelReviews(novelId) {
  try {
    const res = await fetch(
      apiUrl(`/api/reviews?novelId=${encodeURIComponent(String(novelId || ''))}&t=${Date.now()}`),
      {
      cache: 'no-store',
      },
    )
    if (!res.ok) throw new Error('fetch reviews failed')
    const data = await res.json()
    return Array.isArray(data?.items) ? data.items : []
  } catch {
    return []
  }
}

export async function appendNovelReview(novelId, entry) {
  try {
    const res = await fetch(apiUrl('/api/reviews/append'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novelId: String(novelId || ''),
        entry,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `append review failed: ${res.status}`)
    }
    const data = await res.json()
    return data?.item ?? null
  } catch {
    return null
  }
}

export async function appendNovelReviewVerbose(novelId, entry) {
  try {
    const endpoint = apiUrl('/api/reviews/append')
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novelId: String(novelId || ''),
        entry,
      }),
    })
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '')
      return {
        item: null,
        error: `HTTP ${res.status}${bodyText ? `: ${bodyText.slice(0, 180)}` : ''}`,
        endpoint,
      }
    }
    const data = await res.json().catch(() => ({}))
    return { item: data?.item ?? null, error: '', endpoint }
  } catch (err) {
    return {
      item: null,
      error: err instanceof Error ? err.message : 'network error',
      endpoint: apiUrl('/api/reviews/append'),
    }
  }
}

export async function fetchNovelReplies(novelId) {
  try {
    const res = await fetch(
      apiUrl(`/api/replies?novelId=${encodeURIComponent(String(novelId || ''))}&t=${Date.now()}`),
      { cache: 'no-store' },
    )
    if (!res.ok) throw new Error('fetch replies failed')
    const data = await res.json()
    return Array.isArray(data?.items) ? data.items : []
  } catch {
    return []
  }
}

export async function appendNovelReplyVerbose(novelId, parentCommentId, entry) {
  try {
    const endpoint = apiUrl('/api/replies/append')
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novelId: String(novelId || ''),
        parentCommentId: String(parentCommentId || ''),
        entry: {
          ...entry,
          parentCommentId: String(parentCommentId || ''),
        },
      }),
    })
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '')
      return {
        item: null,
        error: `HTTP ${res.status}${bodyText ? `: ${bodyText.slice(0, 180)}` : ''}`,
        endpoint,
      }
    }
    const data = await res.json().catch(() => ({}))
    return { item: data?.item ?? null, error: '', endpoint }
  } catch (err) {
    return {
      item: null,
      error: err instanceof Error ? err.message : 'network error',
      endpoint: apiUrl('/api/replies/append'),
    }
  }
}

export async function voteNovelReviewVerbose(novelId, commentId, voterId, action) {
  try {
    const endpoint = apiUrl('/api/reviews/vote')
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novelId: String(novelId || ''),
        commentId: String(commentId || ''),
        voterId: String(voterId || ''),
        action: String(action || ''),
      }),
    })
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '')
      return {
        ok: false,
        likes: null,
        dislikes: null,
        error: `HTTP ${res.status}${bodyText ? `: ${bodyText.slice(0, 180)}` : ''}`,
        endpoint,
      }
    }
    const data = await res.json().catch(() => ({}))
    return {
      ok: Boolean(data?.ok),
      likes: Number(data?.likes),
      dislikes: Number(data?.dislikes),
      error: '',
      endpoint,
    }
  } catch (err) {
    return {
      ok: false,
      likes: null,
      dislikes: null,
      error: err instanceof Error ? err.message : 'network error',
      endpoint: apiUrl('/api/reviews/vote'),
    }
  }
}
