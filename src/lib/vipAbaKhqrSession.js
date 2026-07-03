import { getAppPublicOrigin } from './appPublicUrl.js'
import { reportViewerVipAbaAppOpened } from './viewerProfileApi.js'

export const VIP_ABA_KHQR_SESSION_KEY = 'tg_vip_aba_khqr_session_v1'
export const VIP_ABA_KHQR_LAST_IMAGE_KEY = 'tg_vip_aba_khqr_last_image_v1'
export const VIP_ABA_KHQR_ACTIVE_PENDING_KEY = 'tg_vip_aba_khqr_active_pending_v1'
export const VIP_ABA_KHQR_PENDING_PREFIX = 'tg_vip_aba_khqr_pending_v1:'
export const VIP_ABA_KHQR_BROWSER_FLOW_KEY = 'tg_vip_aba_khqr_browser_flow_v1'
export const VIP_ABA_KHQR_CONFIRMING_DISMISSED_KEY = 'tg_vip_aba_khqr_confirming_dismissed_v1'
/** Client-side pending / QR validity shown to user (5 minutes). */
export const VIP_ABA_KHQR_PENDING_TTL_MS = 5 * 60 * 1000

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
  const expireAtMs = Number(extraParams.expire_at || extraParams.expireAtMs || 0)
  if (expireAtMs > 0) url.searchParams.set('expire_at', String(Math.floor(expireAtMs)))

  Object.entries(extraParams).forEach(([key, value]) => {
    if (key === 'handoff' || key === 'expire_at' || key === 'expireAtMs') return
    const next = String(value || '').trim()
    if (next) url.searchParams.set(key, next)
  })
  return url.toString()
}

/** Read pending expiry for QR page URLs (external browser cannot read TG localStorage). */
export function resolveVipAbaKhqrQrPageExpireAtMs(tranId, searchParams = null) {
  const fromUrl = Number(searchParams?.get?.('expire_at') || 0)
  if (fromUrl > Date.now()) return fromUrl
  const expiry = getActiveVipAbaKhqrPendingExpiry(tranId)
  if (expiry?.expireAtMs) return expiry.expireAtMs
  return Date.now() + VIP_ABA_KHQR_PENDING_TTL_MS
}

/** @param {Record<string, unknown> | null | undefined} raw */
function readPendingMeta(raw) {
  if (!raw || typeof raw !== 'object') return null
  const startedAtMs = Number(raw.pendingStartedAtMs || 0)
  const expireAtMs = Number(raw.pendingExpireAtMs || 0)
  if (!startedAtMs && !expireAtMs) return null
  return {
    startedAtMs,
    expireAtMs: expireAtMs || startedAtMs + VIP_ABA_KHQR_PENDING_TTL_MS,
  }
}

/** @param {Record<string, unknown> | null | undefined} raw */
function isPendingRecordExpired(raw) {
  const meta = readPendingMeta(raw)
  if (!meta) return true
  return Date.now() > meta.expireAtMs
}

/** @param {string} tranId */
function loadPendingRecordRaw(tranId) {
  const tid = String(tranId || '').trim()
  if (!tid) return null
  try {
    const raw = localStorage.getItem(`${VIP_ABA_KHQR_PENDING_PREFIX}${tid}`)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** @param {VipAbaKhqrSession} session @param {{ expireAtMs?: number }} [opts] */
export function saveVipAbaKhqrPendingPayment(session, opts = {}) {
  const normalized = normalizeVipAbaKhqrSession(session)
  if (!normalized) return false
  const startedAtMs = Date.now()
  const serverExpireAtMs = Number(opts.expireAtMs || 0)
  const clientExpireAtMs = startedAtMs + VIP_ABA_KHQR_PENDING_TTL_MS
  const pendingExpireAtMs =
    serverExpireAtMs > startedAtMs
      ? Math.min(serverExpireAtMs, clientExpireAtMs)
      : clientExpireAtMs
  try {
    localStorage.setItem(
      `${VIP_ABA_KHQR_PENDING_PREFIX}${normalized.tranId}`,
      JSON.stringify({
        ...normalized,
        pendingStartedAtMs: startedAtMs,
        pendingExpireAtMs,
      }),
    )
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
  const record = loadPendingRecordRaw(tid)
  if (!record) return null
  if (isPendingRecordExpired(record)) {
    clearVipAbaKhqrPendingPayment(tid)
    return null
  }
  return normalizeVipAbaKhqrSession(record)
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

/** @param {string} [tranId] @returns {{ expireAtMs: number, remainingMs: number } | null} */
export function getActiveVipAbaKhqrPendingExpiry(tranId) {
  const tid = String(tranId || localStorage.getItem(VIP_ABA_KHQR_ACTIVE_PENDING_KEY) || '').trim()
  if (!tid) return null
  const record = loadPendingRecordRaw(tid)
  if (!record || isPendingRecordExpired(record)) {
    clearVipAbaKhqrPendingPayment(tid)
    return null
  }
  const meta = readPendingMeta(record)
  if (!meta) return null
  return {
    expireAtMs: meta.expireAtMs,
    remainingMs: Math.max(0, meta.expireAtMs - Date.now()),
  }
}

/** Mark that user opened browser / bank for this tran (same Mini App session). */
export function markVipAbaKhqrBrowserFlowOpen(session) {
  const tranId = String(session?.tranId || '').trim()
  if (!tranId || typeof sessionStorage === 'undefined') return false
  try {
    sessionStorage.setItem(
      VIP_ABA_KHQR_BROWSER_FLOW_KEY,
      JSON.stringify({
        tranId,
        openedAtMs: Date.now(),
        returnedFromBrowser: false,
        tgBackgrounded: false,
        bankSummoned: false,
      }),
    )
    clearVipAbaKhqrConfirmingUiDismissed()
    return true
  } catch {
    return false
  }
}

/** 成功唤起 ABA App 后上报 payment_entry=aba_deeplink（失败/仅打开浏览器不上报） */
export function reportVipAbaKhqrDeeplinkOpened({ tranId, handoff } = {}) {
  const tid = String(tranId || '').trim()
  if (tid) markVipAbaKhqrBankSummoned(tid)
  void reportViewerVipAbaAppOpened({ tranId: tid, handoff })
}

/** User entered ABA Mobile after summon (Mini App should show single confirming UI). */
export function markVipAbaKhqrBankSummoned(tranId) {
  const tid = String(tranId || '').trim()
  if (!tid || typeof sessionStorage === 'undefined') return false
  try {
    const parsed = readVipAbaKhqrBrowserFlowRecord(tid)
    if (!parsed) return false
    sessionStorage.setItem(
      VIP_ABA_KHQR_BROWSER_FLOW_KEY,
      JSON.stringify({ ...parsed, bankSummoned: true, tgBackgrounded: true }),
    )
    clearVipAbaKhqrConfirmingUiDismissed()
    return true
  } catch {
    return false
  }
}

function hasVipAbaKhqrBankSummoned(tranId) {
  const parsed = readVipAbaKhqrBrowserFlowRecord(tranId)
  return parsed?.bankSummoned === true
}

export function markVipAbaKhqrConfirmingUiDismissed() {
  try {
    sessionStorage.setItem(VIP_ABA_KHQR_CONFIRMING_DISMISSED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearVipAbaKhqrConfirmingUiDismissed() {
  try {
    sessionStorage.removeItem(VIP_ABA_KHQR_CONFIRMING_DISMISSED_KEY)
  } catch {
    /* ignore */
  }
}

function isVipAbaKhqrConfirmingUiDismissed() {
  try {
    return sessionStorage.getItem(VIP_ABA_KHQR_CONFIRMING_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function readVipAbaKhqrBrowserFlowRecord(tranId) {
  const tid = String(tranId || '').trim()
  if (!tid || typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(VIP_ABA_KHQR_BROWSER_FLOW_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (String(parsed?.tranId || '').trim() !== tid) return null
    return parsed
  } catch {
    return null
  }
}

function hasVipAbaKhqrBrowserFlowReturned(tranId) {
  const parsed = readVipAbaKhqrBrowserFlowRecord(tranId)
  return parsed?.returnedFromBrowser === true
}

function hasVipAbaKhqrBrowserFlowBackgrounded(tranId) {
  const parsed = readVipAbaKhqrBrowserFlowRecord(tranId)
  return parsed?.tgBackgrounded === true
}

/** Mini App went to background while browser / bank flow is active (sync, before paint). */
export function markVipAbaKhqrBrowserFlowBackgrounded(tranId) {
  const tid = String(tranId || '').trim()
  if (!tid || typeof sessionStorage === 'undefined') return false
  try {
    const parsed = readVipAbaKhqrBrowserFlowRecord(tid)
    if (!parsed) return false
    sessionStorage.setItem(
      VIP_ABA_KHQR_BROWSER_FLOW_KEY,
      JSON.stringify({ ...parsed, tgBackgrounded: true }),
    )
    return true
  } catch {
    return false
  }
}

/** Mark that user came back to Mini App after opening browser / bank. */
export function markVipAbaKhqrBrowserFlowReturned(tranId) {
  const tid = String(tranId || '').trim()
  if (!tid || typeof sessionStorage === 'undefined') return false
  try {
    const raw = sessionStorage.getItem(VIP_ABA_KHQR_BROWSER_FLOW_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    if (String(parsed?.tranId || '').trim() !== tid) return false
    sessionStorage.setItem(
      VIP_ABA_KHQR_BROWSER_FLOW_KEY,
      JSON.stringify({ ...parsed, returnedFromBrowser: true }),
    )
    clearVipAbaKhqrConfirmingUiDismissed()
    return true
  } catch {
    return false
  }
}

/** @param {string} [tranId] */
export function shouldShowVipAbaKhqrConfirmingUi(tranId) {
  const tid = String(tranId || loadActiveVipAbaKhqrPending()?.tranId || '').trim()
  if (!tid) return false
  if (isVipAbaKhqrConfirmingUiDismissed()) return false
  if (!hasActiveVipAbaKhqrBrowserFlow(tid)) return false
  if (!loadVipAbaKhqrPendingPayment(tid)) return false
  if (hasVipAbaKhqrBankSummoned(tid)) return true
  if (hasVipAbaKhqrBrowserFlowReturned(tid)) return true
  if (hasVipAbaKhqrBrowserFlowBackgrounded(tid)) return true
  return false
}

const VIP_MINI_APP_INSTANCE_KEY = 'tg_vip_mini_app_instance_v1'

/**
 * True once per Mini App instance (sessionStorage cleared when user fully closes Mini App).
 * Used to reset VIP plan/consent on reopen without affecting in-session bank/QR return.
 */
export function consumeVipMiniAppColdStart() {
  if (typeof sessionStorage === 'undefined') return false
  try {
    const alive = sessionStorage.getItem(VIP_MINI_APP_INSTANCE_KEY) === '1'
    sessionStorage.setItem(VIP_MINI_APP_INSTANCE_KEY, '1')
    return !alive
  } catch {
    return false
  }
}

/** Clear VIP purchase / ABA pending state after Mini App cold start. */
export function resetVipPurchaseFlowOnMiniAppColdStart() {
  clearVipAbaKhqrPendingPayment()
  clearVipAbaKhqrBrowserFlowMark()
  clearVipAbaKhqrSession()
  clearVipAbaKhqrConfirmingUiDismissed()
}

/** Restore VIP tab awaiting / confirming UI after in-app navigation or cold mount. */
export function resolveVipAbaKhqrAwaitingUiState() {
  const pending = loadActiveVipAbaKhqrPending()
  if (!pending?.tranId) {
    return { awaiting: false, confirming: false, pending: null }
  }
  return {
    awaiting: true,
    confirming: shouldShowVipAbaKhqrConfirmingUi(pending.tranId),
    pending,
  }
}

export function clearVipAbaKhqrBrowserFlowMark() {
  try {
    sessionStorage.removeItem(VIP_ABA_KHQR_BROWSER_FLOW_KEY)
  } catch {
    /* ignore */
  }
}

/** @param {string} [tranId] */
export function hasActiveVipAbaKhqrBrowserFlow(tranId) {
  const tid = String(tranId || '').trim()
  if (!tid || typeof sessionStorage === 'undefined') return false
  try {
    const raw = sessionStorage.getItem(VIP_ABA_KHQR_BROWSER_FLOW_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return String(parsed?.tranId || '').trim() === tid
  } catch {
    return false
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
  clearVipAbaKhqrBrowserFlowMark()
  clearVipAbaKhqrConfirmingUiDismissed()
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
