export const VIP_ABA_KHQR_SESSION_KEY = 'tg_vip_aba_khqr_session_v1'
export const VIP_ABA_KHQR_LAST_IMAGE_KEY = 'tg_vip_aba_khqr_last_image_v1'

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
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const tranId = String(parsed.tranId || '').trim()
    if (!tranId) return null
    return {
      tranId,
      planId: String(parsed.planId || '').trim(),
      amountLabel: String(parsed.amountLabel || '').trim(),
      amount: Number(parsed.amount || 0),
      currency: String(parsed.currency || 'USD').trim(),
      merchantLabel: String(parsed.merchantLabel || 'VIP-Subscription').trim(),
      planTitleKm: String(parsed.planTitleKm || '').trim(),
      qrImage: String(parsed.qrImage || '').trim(),
      qrString: String(parsed.qrString || '').trim(),
      abapayDeeplink: String(parsed.abapayDeeplink || '').trim(),
      appStore: String(parsed.appStore || '').trim(),
      playStore: String(parsed.playStore || '').trim(),
      returnUrl: String(parsed.returnUrl || '').trim(),
      uiMock: parsed.uiMock === true,
    }
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
