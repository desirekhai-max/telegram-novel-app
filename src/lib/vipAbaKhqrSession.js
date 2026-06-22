import { getAppPublicOrigin } from './appPublicUrl.js'

export const VIP_ABA_KHQR_SESSION_KEY = 'tg_vip_aba_khqr_session_v1'
export const VIP_ABA_KHQR_LAST_IMAGE_KEY = 'tg_vip_aba_khqr_last_image_v1'
export const VIP_ABA_KHQR_ACTIVE_PENDING_KEY = 'tg_vip_aba_khqr_active_pending_v1'
export const VIP_ABA_KHQR_PENDING_PREFIX = 'tg_vip_aba_khqr_pending_v1:'

const BOOT_SESSION_KEYS = [
  'tranId',
  'planId',
  'amountLabel',
  'amount',
  'currency',
  'merchantLabel',
  'planTitleKm',
  'qrImage',
  'qrString',
  'abapayDeeplink',
  'appStore',
  'playStore',
  'returnUrl',
  'browserHandoffToken',
  'uiMock',
]

let khqrBootHandoffDone = false

/**
 * @typedef {{
 *   tranId: string,
 *   planId: string,
 *   amountLabel: string,
 *   amount: number,
 *   currency: string,
 *   merchantLabel: string,
 *   planTitleKm?: string,
 *   qrImage: string,
 *   qrString: string,
 *   abapayDeeplink: string,
 *   appStore: string,
 *   playStore: string,
 *   returnUrl: string,
 *   browserHandoffToken?: string,
 *   uiMock?: boolean,
 * }} VipAbaKhqrSession
 */

/** @param {VipAbaKhqrSession} payload */
export function saveVipAbaKhqrSession(payload) {
  try {
    sessionStorage.setItem(VIP_ABA_KHQR_SESSION_KEY, JSON.stringify(payload))
    const qrImage = String(payload?.qrImage || '').trim()
    if (qrImage) {
      try {
        localStorage.setItem(VIP_ABA_KHQR_LAST_IMAGE_KEY, qrImage)
      } catch {
        /* ignore */
      }
    }
    return true
  } catch {
    return false
  }
}

/** @returns {VipAbaKhqrSession | null} */
export function loadVipAbaKhqrSession() {
  try {
    const raw = sessionStorage.getItem(VIP_ABA_KHQR_SESSION_KEY)
    if (!raw) return null
    return normalizeVipAbaKhqrSession(JSON.parse(raw))
  } catch {
    return null
  }
}

export function clearVipAbaKhqrSession() {
  try {
    sessionStorage.removeItem(VIP_ABA_KHQR_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/** @param {VipAbaKhqrSession} raw */
function normalizeVipAbaKhqrSession(raw) {
  if (!raw || typeof raw !== 'object') return null
  const tranId = String(raw.tranId || '').trim()
  if (!tranId) return null
  return {
    tranId,
    planId: String(raw.planId || '').trim(),
    amountLabel: String(raw.amountLabel || '').trim(),
    amount: Number(raw.amount || 0),
    currency: String(raw.currency || 'USD').trim(),
    merchantLabel: String(raw.merchantLabel || 'VIP-Subscription').trim(),
    planTitleKm: String(raw.planTitleKm || '').trim(),
    qrImage: String(raw.qrImage || '').trim(),
    qrString: String(raw.qrString || '').trim(),
    abapayDeeplink: String(raw.abapayDeeplink || '').trim(),
    appStore: String(raw.appStore || '').trim(),
    playStore: String(raw.playStore || '').trim(),
    returnUrl: String(raw.returnUrl || '').trim(),
    browserHandoffToken: String(raw.browserHandoffToken || '').trim(),
    uiMock: raw.uiMock === true,
  }
}

function toBase64Url(value) {
  const text = String(value || '')
  if (!text || typeof btoa !== 'function') return ''
  try {
    const bytes = new TextEncoder().encode(text)
    let binary = ''
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  } catch {
    return ''
  }
}

function fromBase64Url(value) {
  const raw = String(value || '').trim()
  if (!raw || typeof atob !== 'function') return ''
  try {
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/')
    const mod = padded.length % 4
    const normalized = mod ? `${padded}${'='.repeat(4 - mod)}` : padded
    const binary = atob(normalized)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

/** Compact session payload for browser handoff (Safari/Chrome cannot read TG sessionStorage). */
export function encodeSessionBootParam(session) {
  const normalized = normalizeVipAbaKhqrSession(session)
  if (!normalized) return ''
  /** @type {Record<string, unknown>} */
  const payload = {}
  BOOT_SESSION_KEYS.forEach((key) => {
    const value = normalized[key]
    if (value === '' || value === 0 || value === false) return
    payload[key] = value
  })
  return toBase64Url(JSON.stringify(payload))
}

/** @param {string} boot */
export function decodeSessionBootParam(boot) {
  const raw = fromBase64Url(boot)
  if (!raw) return null
  try {
    return normalizeVipAbaKhqrSession(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Read `#boot=` or `?boot=` once and strip from the address bar. */
export function consumeSessionBootFromUrl() {
  if (typeof window === 'undefined') return null

  const fromSearch = (() => {
    try {
      return String(new URL(window.location.href).searchParams.get('boot') || '').trim()
    } catch {
      return ''
    }
  })()

  const fromHash = (() => {
    const hash = String(window.location.hash || '').replace(/^#/, '')
    if (!hash) return ''
    if (hash.startsWith('boot=')) return hash.slice(5)
    try {
      return String(new URLSearchParams(hash).get('boot') || '').trim()
    } catch {
      return ''
    }
  })()

  const boot = fromSearch || fromHash
  const session = boot ? decodeSessionBootParam(boot) : null
  if (!session) return null

  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('boot')
    if (url.hash.startsWith('#boot=')) url.hash = ''
    window.history.replaceState(window.history.state, '', url.toString())
  } catch {
    /* ignore */
  }

  return session
}

/**
 * Short QR page URL on formal frontend (no boot hash — avoids HTTP 414).
 * @param {VipAbaKhqrSession} session
 * @param {string} [planId]
 * @param {Record<string, string>} [extraParams]
 */
export function buildAbaKhqrPageUrl(session, planId = '', extraParams = {}) {
  const normalized = normalizeVipAbaKhqrSession(session)
  if (!normalized) return ''
  const tranId = normalized.tranId
  const pid = String(planId || normalized.planId || '').trim()
  const url = new URL('/vip/aba-khqr', getAppPublicOrigin())
  url.searchParams.set('tran_id', tranId)
  if (pid) url.searchParams.set('plan_id', pid)
  if (normalized.uiMock) url.searchParams.set('ui_mock', '1')
  const handoff = String(
    extraParams.handoff || normalized.browserHandoffToken || '',
  ).trim()
  if (handoff) url.searchParams.set('handoff', handoff)
  const qrImage = String(normalized.qrImage || '').trim()
  if (qrImage.startsWith('http') && qrImage.length <= 900) {
    url.searchParams.set('qr_src', qrImage)
  }
  if (normalized.amountLabel) {
    url.searchParams.set('amount_label', normalized.amountLabel)
  }
  Object.entries(extraParams).forEach(([key, value]) => {
    if (key === 'handoff') return
    const next = String(value || '').trim()
    if (next) url.searchParams.set(key, next)
  })
  return url.toString()
}

/** @param {VipAbaKhqrSession} session */
export function saveVipAbaKhqrPendingPayment(session) {
  const normalized = normalizeVipAbaKhqrSession(session)
  if (!normalized) return false
  try {
    localStorage.setItem(`${VIP_ABA_KHQR_PENDING_PREFIX}${normalized.tranId}`, JSON.stringify(normalized))
    localStorage.setItem(VIP_ABA_KHQR_ACTIVE_PENDING_KEY, normalized.tranId)
    return true
  } catch {
    return false
  }
}

/** @param {string} tranId */
export function loadVipAbaKhqrPendingPayment(tranId) {
  const tid = String(tranId || '').trim()
  if (!tid) return null
  try {
    const raw = localStorage.getItem(`${VIP_ABA_KHQR_PENDING_PREFIX}${tid}`)
    if (!raw) return null
    return normalizeVipAbaKhqrSession(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Latest pending payment started from VIP page (for return-to-TG success detection). */
export function loadActiveVipAbaKhqrPending() {
  try {
    const tranId = String(localStorage.getItem(VIP_ABA_KHQR_ACTIVE_PENDING_KEY) || '').trim()
    if (!tranId) return null
    return loadVipAbaKhqrPendingPayment(tranId)
  } catch {
    return null
  }
}

/** @param {string} [tranId] */
export function clearVipAbaKhqrPendingPayment(tranId) {
  const tid = String(tranId || localStorage.getItem(VIP_ABA_KHQR_ACTIVE_PENDING_KEY) || '').trim()
  try {
    if (tid) localStorage.removeItem(`${VIP_ABA_KHQR_PENDING_PREFIX}${tid}`)
    const active = String(localStorage.getItem(VIP_ABA_KHQR_ACTIVE_PENDING_KEY) || '').trim()
    if (!tid || active === tid) localStorage.removeItem(VIP_ABA_KHQR_ACTIVE_PENDING_KEY)
  } catch {
    /* ignore */
  }
}

/** @returns {boolean} */
export function hasKhqrBootShell() {
  if (typeof document === 'undefined') return false
  return Boolean(document.getElementById('tg-khqr-boot-shell'))
}

/** React QR ready — hand off from index.html boot shell without flash. */
export function handoffKhqrBootShell() {
  if (typeof document === 'undefined' || khqrBootHandoffDone) return
  if (!hasKhqrBootShell()) return
  khqrBootHandoffDone = true
  document.documentElement.classList.remove('tg-khqr-boot')
  document.getElementById('tg-khqr-boot-shell')?.remove()
}
