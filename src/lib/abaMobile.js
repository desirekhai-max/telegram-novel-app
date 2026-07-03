/** ABA Mobile summon — Mini App deeplink first, external QR fallback. */

import { buildAbaKhqrPageUrl, getActiveVipAbaKhqrPendingExpiry } from './vipAbaKhqrSession.js'
import { getAppPublicOrigin } from './appPublicUrl.js'
import { reportVipAbaKhqrDeeplinkOpened } from './vipAbaKhqrSession.js'
import { isTelegramMiniApp } from './telegramWebApp.js'

const ABA_ANDROID_PACKAGE = 'com.paygo24.ibank'
const ABA_DEEPLINK_PREFIX = 'abamobilebank://'
const ABA_BRIDGE_PATH = '/aba-open.html'
const IFRAME_CLEANUP_MS = 5000
const ABA_MOBILE_KNOWN_INSTALLED_KEY = 'tg_aba_mobile_known_installed_v1'

/** iOS: only users who previously entered ABA get auto-summon (avoids Open link? for no-app users). */
export function readAbaMobileKnownInstalled() {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(ABA_MOBILE_KNOWN_INSTALLED_KEY) === '1'
  } catch {
    return false
  }
}

export function markAbaMobileKnownInstalled() {
  if (typeof localStorage === 'undefined') return false
  try {
    localStorage.setItem(ABA_MOBILE_KNOWN_INSTALLED_KEY, '1')
    return true
  } catch {
    return false
  }
}

const TELEGRAM_HTTP_OPEN_LINK_OPTS = {
  try_instant_view: false,
  tryBrowser: 'external',
}

const TELEGRAM_DEEPLINK_OPEN_LINK_OPTS = {
  try_instant_view: false,
}

function isAbaMobileDeeplinkUrl(url) {
  return String(url || '')
    .trim()
    .toLowerCase()
    .startsWith(ABA_DEEPLINK_PREFIX)
}

/** Still visible after this → summon failed (no ABA). */
export const ABA_SUMMON_FAILURE_TIMEOUT_MS = 1200
/** iOS Open link? — wait for user to tap Open before treating summon as failed. */
const IOS_OPEN_LINK_CONFIRM_TIMEOUT_MS = 15000
/** iOS: quick return after Open tap without ABA → summon failed. */
const IOS_SUMMON_BOUNCE_MS = 1200
/** iOS: min wait after openLink before treating focus/pageshow as summon failed. */
const IOS_SUMMON_OPEN_LINK_GUARD_MS = 400
/** iOS: debounce after guard before settle('failed') on focus/pageshow. */
const IOS_SUMMON_DISMISS_FAIL_MS = 250
/** iOS: after summon failed, wait before QR (caps total post-fail delay). */
const IOS_QR_FALLBACK_MIN_MS = 0
const IOS_QR_FALLBACK_TARGET_MS = 0
const IOS_QR_FALLBACK_MAX_MS = 250
/** hidden then visible again within this → likely browser bounce without ABA. */
export const ABA_SUMMON_BOUNCE_MS = 3500

function delayIosQrFallbackAfterSummonFail(summonStartedAt) {
  const elapsed = Date.now() - summonStartedAt
  if (elapsed >= IOS_QR_FALLBACK_MAX_MS) {
    return Promise.resolve()
  }
  const waitForMin = IOS_QR_FALLBACK_MIN_MS - elapsed
  const waitForTarget = IOS_QR_FALLBACK_TARGET_MS - elapsed
  const waitMs = Math.min(Math.max(waitForMin, waitForTarget), IOS_QR_FALLBACK_MAX_MS - elapsed)
  if (waitMs <= 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    window.setTimeout(resolve, waitMs)
  })
}

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

/** Android external browser: lightweight bridge before React QR page. */
export function shouldUseAbaOpenBridgeInExternalBrowser() {
  return isAndroidDevice()
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
  let intent = `intent://ababank.com?type=payway&qrcode=${encodeURIComponent(qr)}#Intent;scheme=abamobilebank;package=${ABA_ANDROID_PACKAGE};`
  if (back) intent += `S.browser_fallback_url=${encodeURIComponent(back)};`
  intent += 'end;'
  return intent
}

export function buildPayWayAndroidIntentUrlFromDeeplink(abapayDeeplink, fallbackBackUrl = '') {
  const encoded = extractEncodedQrcodeFromDeeplink(abapayDeeplink)
  if (encoded) {
    const back = String(fallbackBackUrl || '').trim()
    let intent = `intent://ababank.com?type=payway&qrcode=${encoded}#Intent;scheme=abamobilebank;package=${ABA_ANDROID_PACKAGE};`
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

function buildBridgeQrFallbackUrl(session, planId = '') {
  const tid = String(session?.tranId || '').trim()
  const expiry = getActiveVipAbaKhqrPendingExpiry(tid)
  const extra = expiry?.expireAtMs ? { expire_at: String(expiry.expireAtMs) } : {}
  return buildAbaKhqrPageUrl(session, planId, extra)
}

/** Pre-built deeplink / intent for aba-open.html first-paint summon (no handoff fetch wait). */
function buildBridgeImmediateSummonTarget(session, planId = '') {
  const pid = String(planId || session?.planId || '').trim()
  const qrBack = buildBridgeQrFallbackUrl(session, pid)
  const deeplink = String(session?.abapayDeeplink || '').trim()
  const qrString = String(session?.qrString || '').trim()

  if (isAndroidDevice()) {
    const fromDeeplink = deeplink ? buildPayWayAndroidIntentUrlFromDeeplink(deeplink, qrBack) : ''
    if (fromDeeplink) return fromDeeplink
    return buildPayWayAndroidIntentUrl(qrString, qrBack)
  }

  if (deeplink.toLowerCase().startsWith(ABA_DEEPLINK_PREFIX)) return deeplink
  return ''
}

function buildAbaOpenBridgeUrl(session, planId = '', options = {}) {
  const tranId = String(session?.tranId || '').trim()
  const pid = String(planId || session?.planId || '').trim()
  const handoff = String(session?.browserHandoffToken || '').trim()
  if (!tranId || !pid || !handoff) return ''

  const bridge = new URL('/aba-open.html', getAppPublicOrigin())
  bridge.searchParams.set('tran_id', tranId)
  bridge.searchParams.set('plan_id', pid)
  bridge.searchParams.set('handoff', handoff)

  const qrBack = buildBridgeQrFallbackUrl(session, pid)
  if (qrBack) bridge.searchParams.set('back', qrBack)

  const wantImmediate =
    options.immediateSummon !== false && (options.immediateSummon === true || shouldTryAbaMobileDeeplinkFirst())
  if (wantImmediate) {
    const summonTarget = buildBridgeImmediateSummonTarget(session, pid)
    if (summonTarget) {
      bridge.searchParams.set('summon', summonTarget)
      if (bridge.toString().length > 1900) {
        bridge.searchParams.delete('summon')
        bridge.hash = `summon=${encodeURIComponent(summonTarget)}`
      }
    }
  } else if (options.iosImmediateSummon) {
    const deeplink = String(session?.abapayDeeplink || '').trim()
    if (deeplink.toLowerCase().startsWith(ABA_DEEPLINK_PREFIX)) {
      bridge.searchParams.set('summon', deeplink)
    }
  }

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
  return openExternalLinkLikeTeleAba(url)
}

/**
 * Telegram Mini App: openLink for http(s) or abamobilebank deeplink (no external browser on custom scheme).
 */
function openExternalLinkLikeTeleAba(url) {
  const target = String(url || '').trim()
  if (!target || typeof window === 'undefined') return false
  const tg = window.Telegram?.WebApp
  if (typeof tg?.openLink === 'function') {
    try {
      const opts = isAbaMobileDeeplinkUrl(target)
        ? TELEGRAM_DEEPLINK_OPEN_LINK_OPTS
        : TELEGRAM_HTTP_OPEN_LINK_OPTS
      tg.openLink(target, opts)
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

function launchSummonInTelegramMiniApp(_summonTarget, abapayDeeplink = '') {
  const deeplink = String(abapayDeeplink || '').trim()
  if (!deeplink.toLowerCase().startsWith(ABA_DEEPLINK_PREFIX)) return false
  return openExternalLinkLikeTeleAba(deeplink)
}

function waitForAbaMobileSummonOutcome(input = {}) {
  return new Promise((resolve) => {
    const deeplink = String(input.abapayDeeplink || input.session?.abapayDeeplink || '').trim()
    if (!deeplink) {
      resolve({ attempted: false, launched: false, method: 'no_deeplink' })
      return
    }

    const reportLaunched = resolveSummonReportCallback(input)
    const stopWatching = watchAbaMobileSummonOutcome({
      timeoutMs: input.timeoutMs,
      bounceMs: input.bounceMs,
      immediateLaunchOnHidden: true,
      iosOpenDismissFallback: input.iosOpenDismissFallback === true,
      iosDismissCheckMs: input.iosDismissCheckMs,
      onLaunched: () => {
        markAbaMobileKnownInstalled()
        reportLaunched?.()
        resolve({ attempted: true, launched: true, method: 'mini_app_deeplink' })
      },
      onFailed: () => {
        resolve({ attempted: true, launched: false, method: 'mini_app_deeplink_failed' })
      },
    })

    if (!launchSummonInTelegramMiniApp('', deeplink)) {
      stopWatching()
      resolve({ attempted: false, launched: false, method: 'mini_app_launch_failed' })
    }
  })
}

function resolveSummonReportCallback(input = {}) {
  const tranId = String(input.session?.tranId || input.tranId || '').trim()
  const handoff = String(input.session?.browserHandoffToken || input.handoff || '').trim()
  if (!tranId) return undefined
  return () => {
    void reportVipAbaKhqrDeeplinkOpened({ tranId, handoff: handoff || undefined })
  }
}

/**
 * @param {{ onLaunched?: () => void, onFailed?: () => void, timeoutMs?: number, bounceMs?: number, immediateLaunchOnHidden?: boolean, iosOpenDismissFallback?: boolean, iosDismissCheckMs?: number }} [opts]
 */
export function watchAbaMobileSummonOutcome(opts = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    opts.onFailed?.()
    return () => {}
  }

  const timeoutMs =
    Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : ABA_SUMMON_FAILURE_TIMEOUT_MS
  const bounceMs = Number(opts.bounceMs) > 0 ? Number(opts.bounceMs) : ABA_SUMMON_BOUNCE_MS
  const summonAt = Date.now()
  const iosDismissGuardMs = opts.iosOpenDismissFallback ? IOS_SUMMON_OPEN_LINK_GUARD_MS : 0
  const iosDismissCheckMs = Number(opts.iosDismissCheckMs) > 0 ? Number(opts.iosDismissCheckMs) : 350
  let settled = false
  let hiddenAt = 0
  let dismissTimerId = 0

  const cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (opts.iosOpenDismissFallback) {
      window.removeEventListener('focus', onIosDismiss)
      window.removeEventListener('pageshow', onIosPageShow)
    }
    window.clearTimeout(timerId)
    window.clearTimeout(dismissTimerId)
  }

  const settle = (kind) => {
    if (settled) return
    settled = true
    cleanup()
    if (kind === 'launched') opts.onLaunched?.()
    else opts.onFailed?.()
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      if (opts.immediateLaunchOnHidden) {
        settle('launched')
      }
      return
    }
    if (!hiddenAt) return
    const awayMs = Date.now() - hiddenAt
    hiddenAt = 0
    if (awayMs >= bounceMs) settle('launched')
    else settle('failed')
  }

  const tryIosDismissFailed = () => {
    if (settled) return
    if (iosDismissGuardMs > 0 && Date.now() - summonAt < iosDismissGuardMs) return
    if (document.visibilityState === 'hidden') return
    window.clearTimeout(dismissTimerId)
    dismissTimerId = window.setTimeout(() => {
      if (settled) return
      if (document.visibilityState !== 'hidden') settle('failed')
    }, iosDismissCheckMs)
  }

  const onIosDismiss = () => {
    tryIosDismissFailed()
  }

  const onIosPageShow = (ev) => {
    if (ev.persisted) return
    tryIosDismissFailed()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  if (opts.iosOpenDismissFallback) {
    window.addEventListener('focus', onIosDismiss)
    window.addEventListener('pageshow', onIosPageShow)
  }
  const timerId = window.setTimeout(() => {
    if (document.visibilityState === 'hidden') settle('launched')
    else settle('failed')
  }, timeoutMs)

  if (document.visibilityState === 'hidden') settle('launched')

  return cleanup
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
    ? buildAbaOpenBridgeUrl(session, session.planId, { immediateSummon: true })
    : ''

  let bridgeUrl = handoffBridge
  if (!bridgeUrl) {
    const summonTarget = buildAbaMobileOpenHref(input)
    if (!summonTarget) return { attempted: false, method: 'no_target' }
    bridgeUrl = buildLegacyAbaOpenBridgeUrl(summonTarget, input.returnToQrUrl)
    launchViaHiddenIframe(summonTarget)
  }

  if (bridgeUrl) launchViaHiddenIframe(bridgeUrl)

  if (!bridgeUrl || !launchViaExternalOpenLink(bridgeUrl)) {
    onFailed()
    return { attempted: false, method: 'bridge_open_failed' }
  }

  const reportLaunched = resolveSummonReportCallback({ session, tranId: session?.tranId, handoff: session?.browserHandoffToken })
  watchAbaMobileSummonOutcome({
    onLaunched: () => reportLaunched?.(),
    onFailed,
  })

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
 * Standalone mobile browser — try deeplink/intent directly (no TG bridge).
 * @param {{ qrString?: string, abapayDeeplink?: string, returnToQrUrl?: string, onSummonFailed?: () => void, session?: import('./vipAbaKhqrSession.js').VipAbaKhqrSession }} input
 */
export function trySummonAbaMobileInBrowser(input = {}) {
  if (typeof window === 'undefined') return { attempted: false, method: 'no_window' }

  const onFailed = () => {
    if (typeof input.onSummonFailed === 'function') input.onSummonFailed()
  }
  const reportLaunched = resolveSummonReportCallback(input)

  const summonTarget = buildAbaMobileOpenHref(input)
  if (!summonTarget) {
    onFailed()
    return { attempted: false, method: 'no_target' }
  }

  if (isIosDevice()) {
    try {
      window.location.href = summonTarget
    } catch {
      onFailed()
      return { attempted: false, method: 'ios_href_failed' }
    }
    watchAbaMobileSummonOutcome({
      onLaunched: () => reportLaunched?.(),
      onFailed,
      timeoutMs: 1800,
    })
    return { attempted: true, method: 'ios_browser_deeplink' }
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

  if (isAndroidDevice()) {
    window.setTimeout(() => {
      try {
        window.location.href = summonTarget
      } catch {
        onFailed()
      }
    }, 80)
  }

  watchAbaMobileSummonOutcome({
    onLaunched: () => reportLaunched?.(),
    onFailed,
  })
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

  const pid = String(planId || session?.planId || '').trim()
  let targetUrl = ''

  if (shouldTryAbaMobileDeeplinkFirst()) {
    targetUrl = buildAbaOpenBridgeUrl(session, pid, { immediateSummon: true })
    if (!targetUrl) targetUrl = buildAbaKhqrPageUrl(session, pid)
  } else {
    targetUrl = buildAbaKhqrPageUrl(session, pid)
  }

  if (targetUrl && launchViaExternalOpenLink(targetUrl)) {
    return {
      opened: true,
      method: targetUrl.includes('/aba-open.html') ? 'external_aba_bridge' : 'external_qr_page',
    }
  }

  return { opened: false, method: 'browser_open_failed' }
}

/**
 * Mini App QR page (no external browser).
 */
export function openAbaKhqrQrPageInMiniApp(session, planId = '') {
  if (typeof window === 'undefined') {
    return { opened: false, method: 'no_window', launchedInMiniApp: false }
  }

  const pid = String(planId || session?.planId || '').trim()
  const tid = String(session?.tranId || '').trim()
  if (!tid || !pid) {
    return { opened: false, method: 'no_session', launchedInMiniApp: false }
  }

  const expiry = getActiveVipAbaKhqrPendingExpiry(tid)
  const extra = expiry?.expireAtMs ? { expire_at: String(expiry.expireAtMs) } : {}
  const targetUrl = buildAbaKhqrPageUrl(session, pid, extra)
  if (!targetUrl) {
    return { opened: false, method: 'mini_app_qr_url_failed', launchedInMiniApp: false }
  }

  let miniAppQrPath = ''
  try {
    const url = new URL(targetUrl, getAppPublicOrigin())
    miniAppQrPath = `${url.pathname}${url.search}`
  } catch {
    return { opened: false, method: 'mini_app_qr_path_failed', launchedInMiniApp: false }
  }

  return {
    opened: true,
    method: 'mini_app_qr_page',
    launchedInMiniApp: true,
    showQrInMiniApp: true,
    miniAppQrPath,
  }
}

function openAbaKhqrQrFallback(session, planId = '') {
  if (isTelegramMiniApp()) {
    return openAbaKhqrQrPageInMiniApp(session, planId)
  }
  return openAbaKhqrQrPageInExternalBrowser(session, planId)
}

export function openAbaKhqrQrPageInExternalBrowser(session, planId = '') {
  if (typeof window === 'undefined') return { opened: false, method: 'no_window' }

  const pid = String(planId || session?.planId || '').trim()
  const tid = String(session?.tranId || '').trim()
  const expiry = getActiveVipAbaKhqrPendingExpiry(tid)
  const extra = expiry?.expireAtMs ? { expire_at: String(expiry.expireAtMs) } : {}
  const targetUrl = buildAbaKhqrPageUrl(session, pid, extra)

  if (targetUrl && launchViaExternalOpenLink(targetUrl)) {
    return { opened: true, method: 'external_qr_page', launchedInMiniApp: false }
  }

  return { opened: false, method: 'browser_open_failed', launchedInMiniApp: false }
}

/**
 * VIP flow — Telegram Mini App.
 * iOS installed: Open link? → bank → VIP confirming.
 * iOS not installed: Open link? → tap Open → ~0.4–1.2s fail detect → Mini App QR page.
 * Android: unchanged.
 */
export async function startAbaKhqrPaymentFlow(session, planId = '') {
  if (typeof window === 'undefined') {
    return { opened: false, method: 'no_window', launchedInMiniApp: false }
  }

  const pid = String(planId || session?.planId || '').trim()
  if (!session?.tranId || !pid) {
    return { opened: false, method: 'no_session', launchedInMiniApp: false }
  }

  const returnToQrUrl = buildAbaQrPageReturnUrl(session.tranId, pid, session)
  const summonInput = {
    session,
    planId: pid,
    qrString: session.qrString,
    abapayDeeplink: session.abapayDeeplink,
    returnToQrUrl,
  }

  if (isTelegramMiniApp() && shouldTryAbaMobileDeeplinkFirst()) {
    const summonStartedAt = Date.now()
    const summonResult = await waitForAbaMobileSummonOutcome({
      ...summonInput,
      timeoutMs: isIosDevice() ? IOS_OPEN_LINK_CONFIRM_TIMEOUT_MS : undefined,
      bounceMs: isIosDevice() ? IOS_SUMMON_BOUNCE_MS : undefined,
      iosOpenDismissFallback: isIosDevice(),
      iosDismissCheckMs: isIosDevice() ? IOS_SUMMON_DISMISS_FAIL_MS : undefined,
    })
    if (summonResult.launched) {
      return {
        opened: true,
        method: summonResult.method,
        launchedInMiniApp: true,
      }
    }

    if (isIosDevice()) {
      await delayIosQrFallbackAfterSummonFail(summonStartedAt)
      return openAbaKhqrQrPageInMiniApp(session, pid)
    }

    return openAbaKhqrQrFallback(session, pid)
  }

  if (isIosDevice() && isTelegramMiniApp()) {
    return openAbaKhqrQrPageInMiniApp(session, pid)
  }

  if (shouldTryAbaMobileDeeplinkFirst()) {
    return openAbaKhqrPaymentInExternalBrowser(session, pid)
  }

  return openAbaKhqrQrFallback(session, pid)
}
