import { getTelegramAuthPayload } from '../hooks/useTelegramUser.js'
import { apiUrl } from './apiBase.js'
import {
  formatVipOrderTimeLabel,
  resolveVipOrderProductLabel,
  resolveVipOrderStatusLabel,
} from './vipOrderDisplay.js'

function normalizeRole(raw) {
  return String(raw || '').toLowerCase() === 'author' ? 'author' : 'normal'
}

function normalizeBadgeTier(raw) {
  const s = String(raw || '').toLowerCase().trim()
  if (s === 'vip' || s === 'author' || s === 'normal') return s
  return 'normal'
}

function normalizeOrder(raw) {
  const status = String(raw?.status || 'success')
  const audience = normalizeRole(raw?.audience)
  return {
    id: String(raw?.id || ''),
    planId: String(raw?.planId || ''),
    amount: String(raw?.amount || '$0'),
    status,
    statusLabel: resolveVipOrderStatusLabel(raw?.statusLabel, status),
    time: formatVipOrderTimeLabel(raw?.atMs) || String(raw?.time || ''),
    atMs: Number(raw?.atMs) || 0,
    product: resolveVipOrderProductLabel({ ...raw, audience }),
    audience,
  }
}

export function getDefaultViewerProfile(tgUser = null) {
  return {
    telegramUserId: Number(tgUser?.id) || 0,
    role: 'normal',
    vipActive: false,
    vipExpireAtMs: 0,
    vipPlanId: '',
    badgeTier: 'normal',
    canReadVipChapters: false,
    authVerified: false,
    authMode: '',
    isBanned: false,
    whitelist: false,
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
    vipPlanId: String(raw.vipPlanId || '').trim(),
    badgeTier: normalizeBadgeTier(raw.badgeTier),
    canReadVipChapters: Boolean(raw.canReadVipChapters),
    authVerified: Boolean(raw.authVerified),
    authMode: String(raw.authMode || ''),
    isBanned: Boolean(raw.isBanned),
    whitelist: Boolean(raw.whitelist),
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

export async function startViewerVipAbaKhqr(planId) {
  const { telegramUser, initDataRaw } = getTelegramAuthPayload()
  if (!telegramUser?.id) {
    return {
      ok: false,
      paywayConfigured: false,
      error: 'telegram_user_required',
      session: null,
    }
  }
  try {
    const res = await fetch(apiUrl('/api/vip-orders/aba-khqr'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUser,
        initDataRaw,
        planId: String(planId || ''),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 503 && data?.error === 'payway_not_configured') {
      return { ok: false, paywayConfigured: false, error: 'payway_not_configured', session: null }
    }
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        paywayConfigured: Boolean(data?.paywayConfigured !== false),
        error: String(data?.error || `aba_khqr failed: ${res.status}`),
        session: null,
      }
    }
    return {
      ok: true,
      paywayConfigured: true,
      error: '',
      session: {
        tranId: String(data.tranId || ''),
        planId: String(data.planId || planId || ''),
        amountLabel: String(data.amountLabel || ''),
        amount: Number(data.amount || 0),
        currency: String(data.currency || 'USD'),
        merchantLabel: String(data.merchantLabel || 'VIP-Subscription'),
        qrImage: String(data.qrImage || ''),
        qrString: String(data.qrString || ''),
        abapayDeeplink: String(data.abapayDeeplink || ''),
        appStore: String(data.appStore || ''),
        playStore: String(data.playStore || ''),
        returnUrl: String(data.returnUrl || ''),
        browserHandoffToken: String(data.browserHandoffToken || ''),
        expireAtMs: Number(data.expireAt || 0),
      },
    }
  } catch (err) {
    return {
      ok: false,
      paywayConfigured: false,
      error: err instanceof Error ? err.message : 'aba_khqr_network_error',
      session: null,
    }
  }
}

export async function fetchAbaKhqrHandoffSession({ tranId, handoff, signal } = {}) {
  const tid = String(tranId || '').trim()
  const token = String(handoff || '').trim()
  if (!tid || !token) return null
  try {
    const qs = new URLSearchParams({ tran_id: tid, handoff: token })
    const res = await fetch(apiUrl(`/api/vip-orders/aba-khqr-handoff?${qs.toString()}`), {
      method: 'GET',
      signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.ok || !data?.session) return null
    const session = data.session
    return {
      tranId: String(session.tranId || tid),
      planId: String(session.planId || ''),
      amountLabel: String(session.amountLabel || ''),
      amount: Number(session.amount || 0),
      currency: String(session.currency || 'USD'),
      merchantLabel: String(session.merchantLabel || 'VIP-Subscription'),
      qrImage: String(session.qrImage || ''),
      qrString: String(session.qrString || ''),
      abapayDeeplink: String(session.abapayDeeplink || ''),
      appStore: String(session.appStore || ''),
      playStore: String(session.playStore || ''),
      returnUrl: String(session.returnUrl || ''),
      browserHandoffToken: token,
    }
  } catch {
    return null
  }
}

export async function startViewerVipPayWayCheckout(planId) {
  const { telegramUser, initDataRaw } = getTelegramAuthPayload()
  if (!telegramUser?.id) {
    return {
      ok: false,
      paywayConfigured: false,
      checkout: null,
      error: 'telegram_user_required',
      profile: getDefaultViewerProfile(null),
    }
  }
  try {
    const res = await fetch(apiUrl('/api/vip-orders/checkout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUser,
        initDataRaw,
        planId: String(planId || ''),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 503 && data?.error === 'payway_not_configured') {
      return {
        ok: false,
        paywayConfigured: false,
        checkout: null,
        error: '',
        profile: normalizeViewerProfile(data?.profile, telegramUser),
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        paywayConfigured: false,
        checkout: null,
        error: String(data?.error || `checkout failed: ${res.status}`),
        profile: normalizeViewerProfile(data?.profile, telegramUser),
      }
    }
    const formFields = data?.formFields && typeof data.formFields === 'object' ? data.formFields : null
    const checkoutUrl = String(data?.checkoutUrl || '')
    const hasCheckout = Boolean(data?.ok && checkoutUrl && formFields && Object.keys(formFields).length > 0)
    return {
      ok: hasCheckout,
      paywayConfigured: Boolean(data?.paywayConfigured !== false),
      checkout: hasCheckout
        ? {
            tranId: String(data?.tranId || ''),
            checkoutUrl,
            formFields,
          }
        : null,
      error: hasCheckout ? '' : 'checkout_payload_invalid',
      profile: normalizeViewerProfile(data?.profile, telegramUser),
    }
  } catch (err) {
    return {
      ok: false,
      paywayConfigured: false,
      checkout: null,
      error: err instanceof Error ? err.message : 'checkout_network_error',
      profile: getDefaultViewerProfile(telegramUser),
    }
  }
}

export async function confirmViewerVipPayment({
  tranId,
  planId,
  skipVerify = false,
  strictVerify = false,
} = {}) {
  const { telegramUser, initDataRaw } = getTelegramAuthPayload()
  if (!telegramUser?.id) {
    return { ok: false, profile: getDefaultViewerProfile(null), order: null, alreadyFulfilled: false }
  }
  try {
    const res = await fetch(apiUrl('/api/vip-orders/confirm-payment'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUser,
        initDataRaw,
        tranId: String(tranId || ''),
        planId: String(planId || ''),
        skipVerify: Boolean(skipVerify),
        strictVerify: Boolean(strictVerify),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        profile: normalizeViewerProfile(data?.profile, telegramUser),
        order: null,
        alreadyFulfilled: false,
        error: String(data?.error || `confirm failed: ${res.status}`),
      }
    }
    return {
      ok: Boolean(data?.ok),
      profile: normalizeViewerProfile(data?.profile, telegramUser),
      order: data?.order ? normalizeOrder(data.order) : null,
      alreadyFulfilled: Boolean(data?.alreadyFulfilled),
      error: '',
    }
  } catch (err) {
    return {
      ok: false,
      profile: getDefaultViewerProfile(telegramUser),
      order: null,
      alreadyFulfilled: false,
      error: err instanceof Error ? err.message : 'network error',
    }
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

export async function reportViewerVipAbaAppOpened({ tranId, handoff } = {}) {
  const { telegramUser, initDataRaw } = getTelegramAuthPayload()
  const tid = String(tranId || '').trim()
  const token = String(handoff || '').trim()
  if (!tid) return { ok: false, error: 'tran_id_required' }

  if (token) {
    try {
      const res = await fetch(apiUrl('/api/vip-orders/aba-app-opened'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tranId: tid, handoff: token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        return { ok: false, error: String(data?.error || `aba_app_opened failed: ${res.status}`) }
      }
      return { ok: true, error: '' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'network error' }
    }
  }

  if (!telegramUser?.id) return { ok: false, error: 'telegram_user_required' }
  try {
    const res = await fetch(apiUrl('/api/vip-orders/aba-app-opened'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUser,
        initDataRaw,
        tranId: tid,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.ok) {
      return { ok: false, error: String(data?.error || `aba_app_opened failed: ${res.status}`) }
    }
    return { ok: true, error: '' }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'network error',
    }
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
