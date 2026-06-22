/** ABA Mobile summon — external browser entry + in-browser retry. */

import { buildAbaKhqrPageUrl } from './vipAbaKhqrSession.js'
import { getAppPublicOrigin } from './appPublicUrl.js'

const ABA_DEEPLINK_PREFIX = 'abamobilebank://'
const ABA_BRIDGE_PATH = '/aba-open.html'
const IFRAME_CLEANUP_MS = 5000

const TELEGRAM_OPEN_LINK_OPTS = {
  try_instant_view: false,
  tryBrowser: 'external',
}

/** Still visible after this → summon failed (no ABA). */
export const ABA_SUMMON_FAILURE_TIMEOUT_MS = 2500
/** hidden then visible again within this → likely browser bounce without ABA. */
export const ABA_SUMMON_BOUNCE_MS = 3500

export function isLikelyMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod/i.test(String(navigator.userAgent || ''))
}

export function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(String(navigator.userAgent || ''))
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(String(navigator.userAgent || ''))
}

export function shouldTryAbaMobileDeeplinkFirst() {
  return isLikelyMobileDevice()
}

export function extractEncodedQrcodeFromDeeplink(deeplink) {
  const raw = String(deeplink || '').trim()
  const match = raw.match(/[?&]qrcode=([^&#]+)/i)
  return match?.[1] ? String(match[1]) : ''
}

export function extractQrcodeFromAbapayDeeplink(deeplink) {
  const encoded = extractEncodedQrcodeFromDeeplink(deeplink)
  if (!encoded) return ''
  try {
    return decodeURIComponent(encoded).trim()
  } catch {
    return encoded.trim()
  }
}

/**
 * @param {string} qrString
 * @param {string} [fallbackBackUrl] Android Intent fallback when ABA not installed
 */
export function buildPayWayAndroidIntentUrl(qrString, fallbackBackUrl = '') {
  const qr = String(qrString || '').trim()
  if (!qr) return ''
  const back = String(fallbackBackUrl || '').trim()
  let intent = `intent://ababank.com?type=payway&qrcode=${encodeURIComponent(qr)}#Intent;scheme=abamobilebank;`
  if (back) intent += `S.browser_fallback_url=${encodeURIComponent(back)};`
  intent += 'end;'
  return intent
}

export function buildPayWayAndroidIntentUrlFromDeeplink(abapayDeeplink, fallbackBackUrl = '') {
  const encoded = extractEncodedQrcodeFromDeeplink(abapayDeeplink)
  if (encoded) {
    const back = String(fallbackBackUrl || '').trim()
    let intent = `intent://ababank.com?type=payway&qrcode=${encoded}#Intent;scheme=abamobilebank;`
    if (back) intent += `S.browser_fallback_url=${encodeURIComponent(back)};`
    intent += 'end;'
    return intent
  }
  return buildPayWayAndroidIntentUrl(extractQrcodeFromAbapayDeeplink(abapayDeeplink), fallbackBackUrl)
}

/** QR page return URL — formal frontend origin (never draft / API host). */
export function buildAbaQrPageReturnUrl(tranId, planId, session = null) {
  if (session) {
    const fromSession = buildAbaKhqrPageUrl(session, planId)
    if (fromSession) return fromSession
  }
  const tid = String(tranId || '').trim()
  const pid = String(planId || '').trim()
  const origin = getAppPublicOrigin()
  if (!tid || !pid) return `${origin}/vip`
  return `${origin}/vip/aba-khqr?tran_id=${encodeURIComponent(tid)}&plan_id=${encodeURIComponent(pid)}`
}

/** Build QR return URL with failure flag for bridge / Intent fallback. */
export function buildAbaQrReturnUrl(returnToQrUrl) {
  const raw = String(returnToQrUrl || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw, getAppPublicOrigin())
    url.searchParams.set('aba_summon_failed', '1')
    return url.toString()
  } catch {
    const sep = raw.includes('?') ? '&' : '?'
    return `${raw}${sep}aba_summon_failed=1`
  }
}

/** Android intent://, iOS abamobilebank:// */
export function buildAbaMobileOpenHref(input = {}) {
  const qrString = String(input.qrString || '').trim()
  const deeplink = String(input.abapayDeeplink || '').trim()
  const backUrl = buildAbaQrReturnUrl(input.returnToQrUrl)

  if (isAndroidDevice()) {
    const fromDeeplink = deeplink ? buildPayWayAndroidIntentUrlFromDeeplink(deeplink, backUrl) : ''
    if (fromDeeplink) return fromDeeplink
    return buildPayWayAndroidIntentUrl(qrString, backUrl)
  }

  if (deeplink.toLowerCase().startsWith(ABA_DEEPLINK_PREFIX)) return deeplink
  return ''
}

function buildLegacyAbaOpenBridgeUrl(summonTarget, returnToQrUrl) {
  const target = String(summonTarget || '').trim()
  if (!target) return ''
  const bridge = new URL(ABA_BRIDGE_PATH, getAppPublicOrigin())
  bridge.searchParams.set('target', target)
  const back = buildAbaQrReturnUrl(returnToQrUrl)
  if (back) bridge.searchParams.set('back', back)
  return bridge.toString()
}

function buildAbaOpenBridgeUrl(session, planId = '') {
  const tranId = String(session?.tranId || '').trim()
  const pid = String(planId || session?.planId || '').trim()
  const handoff = String(session?.browserHandoffToken || '').trim()
  if (!tranId || !pid || !handoff) return ''

  const bridge = new URL('/aba-open.html', getAppPublicOrigin())
  bridge.searchParams.set('tran_id', tranId)
  bridge.searchParams.set('plan_id', pid)
  bridge.searchParams.set('handoff', handoff)
  return bridge.toString()
}

function launchViaHiddenIframe(url) {
  const src = String(url || '').trim()
  if (!src || typeof document === 'undefined') return false
  try {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.tabIndex = -1
    frame.style.cssText =
      'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px;top:-9999px;'
    frame.src = src
    document.body.appendChild(frame)
    window.setTimeout(() => {
      try {
        frame.remove()
      } catch {
        /* ignore */
      }
    }, IFRAME_CLEANUP_MS)
    return true
  } catch {
    return false
  }
}

function launchViaExternalOpenLink(url) {
  const target = String(url || '').trim()
  if (!target || typeof window === 'undefined') return false
  const tg = window.Telegram?.WebApp
  if (typeof tg?.openLink === 'function') {
    try {
      tg.openLink(target, TELEGRAM_OPEN_LINK_OPTS)
      return true
    } catch {
      /* fall through */
    }
  }
  try {
    window.open(target, '_blank', 'noopener,noreferrer')
    return true
  } catch {
    return false
  }
}

/**
 * @param {{ onLaunched?: () => void, onFailed?: () => void, timeoutMs?: number, bounceMs?: number }} [opts]
 */
export function watchAbaMobileSummonOutcome(opts = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    opts.onFailed?.()
    return () => {}
  }

  const timeoutMs =
    Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : ABA_SUMMON_FAILURE_TIMEOUT_MS
  const bounceMs = Number(opts.bounceMs) > 0 ? Number(opts.bounceMs) : ABA_SUMMON_BOUNCE_MS
  let settled = false
  let hiddenAt = 0

  const settle = (kind) => {
    if (settled) return
    settled = true
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.clearTimeout(timerId)
    if (kind === 'launched') opts.onLaunched?.()
    else opts.onFailed?.()
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      return
    }
    if (!hiddenAt) return
    const awayMs = Date.now() - hiddenAt
    hiddenAt = 0
    if (awayMs >= bounceMs) settle('launched')
    else settle('failed')
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  const timerId = window.setTimeout(() => {
    if (document.visibilityState === 'hidden') settle('launched')
    else settle('failed')
  }, timeoutMs)

  if (document.visibilityState === 'hidden') settle('launched')

  return () => settle('failed')
}

/**
 * iOS / Android: external bridge → ABA; bridge redirects back to QR if ABA missing.
 * @param {{ qrString?: string, abapayDeeplink?: string, returnToQrUrl?: string, session?: import('./vipAbaKhqrSession.js').VipAbaKhqrSession, onSummonFailed?: () => void }} input
 */
export function trySummonAbaMobile(input = {}) {
  if (typeof window === 'undefined') return { attempted: false, method: 'no_window' }

  const onFailed = () => {
    if (typeof input.onSummonFailed === 'function') input.onSummonFailed()
  }

  const session = input.session
  const handoffBridge = session?.browserHandoffToken
    ? buildAbaOpenBridgeUrl(session, session.planId)
    : ''

  let bridgeUrl = handoffBridge
  if (!bridgeUrl) {
    const summonTarget = buildAbaMobileOpenHref(input)
    if (!summonTarget) return { attempted: false, method: 'no_target' }
    bridgeUrl = buildLegacyAbaOpenBridgeUrl(summonTarget, input.returnToQrUrl)
    launchViaHiddenIframe(summonTarget)
  }

  console.log('[ABA] summon bridge:', bridgeUrl)

  if (bridgeUrl) launchViaHiddenIframe(bridgeUrl)

  if (!bridgeUrl || !launchViaExternalOpenLink(bridgeUrl)) {
    onFailed()
    return { attempted: false, method: 'bridge_open_failed' }
  }

  watchAbaMobileSummonOutcome({ onFailed })

  return { attempted: true, method: 'external_bridge' }
}

export function openAbaMobileDeeplink(deeplink, stores = {}) {
  return trySummonAbaMobile({
    abapayDeeplink: deeplink,
    qrString: stores.qrString,
    returnToQrUrl: stores.returnToQrUrl,
  }).attempted
}

/**
 * Already in Safari/Chrome — try deeplink/intent directly (no TG bridge).
 * @param {{ qrString?: string, abapayDeeplink?: string, returnToQrUrl?: string, onSummonFailed?: () => void }} input
 */
export function trySummonAbaMobileInBrowser(input = {}) {
  if (typeof window === 'undefined') return { attempted: false, method: 'no_window' }

  const summonTarget = buildAbaMobileOpenHref(input)
  if (!summonTarget) return { attempted: false, method: 'no_target' }

  const onFailed = () => {
    if (typeof input.onSummonFailed === 'function') input.onSummonFailed()
  }

  try {
    const frame = document.createElement('iframe')
    frame.style.cssText = 'display:none;width:0;height:0;border:0'
    frame.src = summonTarget
    document.documentElement.appendChild(frame)
    window.setTimeout(() => {
      try {
        frame.remove()
      } catch {
        /* ignore */
      }
    }, IFRAME_CLEANUP_MS)
  } catch {
    /* ignore */
  }

  window.setTimeout(() => {
    try {
      window.location.href = summonTarget
    } catch {
      onFailed()
    }
  }, 80)

  watchAbaMobileSummonOutcome({ onFailed })
  return { attempted: true, method: 'browser_direct' }
}

/**
 * VIP flow: open formal-site QR page in external browser.
 * Mobile: auto-summon ABA first, then QR fallback. Desktop: QR only (no ABA app).
 * @param {import('./vipAbaKhqrSession.js').VipAbaKhqrSession} session
 * @param {string} [planId]
 */
export function openAbaKhqrPaymentInExternalBrowser(session, planId = '') {
  if (typeof window === 'undefined') return { opened: false, method: 'no_window' }

  const extraParams = isLikelyMobileDevice() ? { auto_summon: '1' } : {}
  const qrPageUrl = buildAbaKhqrPageUrl(session, planId, extraParams)
  if (qrPageUrl && launchViaExternalOpenLink(qrPageUrl)) {
    return {
      opened: true,
      method: isLikelyMobileDevice() ? 'external_qr_page' : 'external_qr_page_desktop',
    }
  }

  return { opened: false, method: 'browser_open_failed' }
}

/**
 * Open formal-site browser QR flow (mobile + desktop Telegram).
 * @param {import('./vipAbaKhqrSession.js').VipAbaKhqrSession} session
 * @param {string} [planId]
 */
export function startAbaKhqrPaymentFlow(session, planId = '') {
  return openAbaKhqrPaymentInExternalBrowser(session, planId)
}
