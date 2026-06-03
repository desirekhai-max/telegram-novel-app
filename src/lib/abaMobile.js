/** ABA Mobile deeplink helpers (Figma Telegram Integration). */

const ABA_DEEPLINK_PREFIX = 'abamobilebank://'

export function isLikelyMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod/i.test(String(navigator.userAgent || ''))
}

/** Figma: prefer deeplink when user likely has ABA Mobile (mobile Telegram). */
export function shouldTryAbaMobileDeeplinkFirst() {
  return isLikelyMobileDevice()
}

/**
 * @param {string} deeplink
 * @param {{ playStore?: string, appStore?: string }} [stores]
 */
export function openAbaMobileDeeplink(deeplink, stores = {}) {
  const url = String(deeplink || '').trim()
  if (!url || !url.toLowerCase().startsWith(ABA_DEEPLINK_PREFIX)) return false
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null
  if (typeof tg?.openLink === 'function') {
    try {
      tg.openLink(url)
      return true
    } catch {
      /* fall through */
    }
  }
  try {
    window.location.href = url
    return true
  } catch {
    if (stores.playStore && /android/i.test(navigator.userAgent || '')) {
      window.open(stores.playStore, '_blank', 'noopener,noreferrer')
    } else if (stores.appStore) {
      window.open(stores.appStore, '_blank', 'noopener,noreferrer')
    }
    return false
  }
}
