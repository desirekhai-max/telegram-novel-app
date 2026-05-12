import { getTelegramAuthPayload } from '../hooks/useTelegramUser.js'
import { apiUrl } from './apiBase.js'

function normalizeRole(raw) {
  return String(raw || '').toLowerCase() === 'author' ? 'author' : 'normal'
}

function normalizeBadgeTier(raw) {
  const s = String(raw || '').toLowerCase().trim()
  if (s === 'vip' || s === 'author' || s === 'normal') return s
  return 'normal'
}

function normalizeOrder(raw) {
  return {
    id: String(raw?.id || ''),
    planId: String(raw?.planId || ''),
    amount: String(raw?.amount || '$0'),
    status: String(raw?.status || 'success'),
    statusLabel: String(raw?.statusLabel || ''),
    time: String(raw?.time || ''),
    atMs: Number(raw?.atMs) || 0,
    product: String(raw?.product || ''),
    audience: normalizeRole(raw?.audience),
  }
}

export function getDefaultViewerProfile(tgUser = null) {
  return {
    telegramUserId: Number(tgUser?.id) || 0,
    role: 'normal',
    vipActive: false,
    vipExpireAtMs: 0,
    badgeTier: 'normal',
    canReadVipChapters: false,
    authVerified: false,
    authMode: '',
  }
}

export function normalizeViewerProfile(raw, tgUser = null) {
  const fallback = getDefaultViewerProfile(tgUser)
  if (!raw || typeof raw !== 'object') return fallback
  const vipExpireAtMs = Number(raw.vipExpireAtMs || 0)
  return {
    telegramUserId: Number(raw.telegramUserId) || fallback.telegramUserId,
    role: normalizeRole(raw.role),
    vipActive: Boolean(raw.vipActive),
    vipExpireAtMs: Number.isFinite(vipExpireAtMs) && vipExpireAtMs > 0 ? vipExpireAtMs : 0,
    badgeTier: normalizeBadgeTier(raw.badgeTier),
    canReadVipChapters: Boolean(raw.canReadVipChapters),
    authVerified: Boolean(raw.authVerified),
    authMode: String(raw.authMode || ''),
  }
}

export async function resolveViewerProfile(options = {}) {
  const { signal } = options
  const { telegramUser, initDataRaw } = getTelegramAuthPayload()
  if (!telegramUser?.id) return getDefaultViewerProfile(null)
  try {
    const res = await fetch(apiUrl('/api/viewer-profile/resolve'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUser, initDataRaw }),
      signal,
    })
    if (!res.ok) throw new Error(`resolve viewer profile failed: ${res.status}`)
    const data = await res.json()
    return normalizeViewerProfile(data?.profile, telegramUser)
  } catch {
    return getDefaultViewerProfile(telegramUser)
  }
}

export async function purchaseViewerVipPlan(planId) {
  const { telegramUser, initDataRaw } = getTelegramAuthPayload()
  if (!telegramUser?.id) {
    return { ok: false, order: null, profile: getDefaultViewerProfile(null) }
  }
  try {
    const res = await fetch(apiUrl('/api/vip-orders/purchase'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUser,
        initDataRaw,
        planId: String(planId || ''),
      }),
    })
    if (!res.ok) throw new Error(`purchase vip plan failed: ${res.status}`)
    const data = await res.json().catch(() => ({}))
    return {
      ok: Boolean(data?.ok),
      order: data?.order ? normalizeOrder(data.order) : null,
      profile: normalizeViewerProfile(data?.profile, telegramUser),
    }
  } catch {
    return { ok: false, order: null, profile: getDefaultViewerProfile(telegramUser) }
  }
}

export async function fetchViewerVipOrders(options = {}) {
  const { signal } = options
  const { telegramUser, initDataRaw } = getTelegramAuthPayload()
  if (!telegramUser?.id) return []
  try {
    const res = await fetch(apiUrl('/api/vip-orders/list'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUser, initDataRaw }),
      signal,
    })
    if (!res.ok) throw new Error(`list vip orders failed: ${res.status}`)
    const data = await res.json().catch(() => ({}))
    return Array.isArray(data?.items) ? data.items.map(normalizeOrder).filter((it) => it.id) : []
  } catch {
    return []
  }
}
