/** Telegram startapp 前缀：ABA 银行付完回 Mini App 后进 VIP 成功页 */
export const VIP_ABA_BANK_RETURN_START_PREFIX = 'vp_'

const HANDLED_KEY_PREFIX = 'tg_vip_aba_bank_return_handled_v1:'

/** @returns {{ tranId: string, planId: string } | null} */
export function parseVipAbaKhqrBankReturnStartParam(raw) {
  const s = String(raw || '').trim()
  if (!s.startsWith(VIP_ABA_BANK_RETURN_START_PREFIX)) return null
  const body = s.slice(VIP_ABA_BANK_RETURN_START_PREFIX.length)
  if (!body) return null
  const splitAt = body.indexOf('__')
  if (splitAt < 0) return { tranId: body, planId: '' }
  return {
    tranId: body.slice(0, splitAt),
    planId: body.slice(splitAt + 2),
  }
}

export function readTelegramMiniAppStartParam() {
  if (typeof window === 'undefined') return ''
  return String(window.Telegram?.WebApp?.initDataUnsafe?.start_param || '').trim()
}

export function readVipAbaKhqrBankReturnFromLaunch() {
  return parseVipAbaKhqrBankReturnStartParam(readTelegramMiniAppStartParam())
}

export function wasVipAbaKhqrBankReturnHandled(tranId) {
  const tid = String(tranId || '').trim()
  if (!tid || typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(`${HANDLED_KEY_PREFIX}${tid}`) === '1'
  } catch {
    return false
  }
}

export function markVipAbaKhqrBankReturnHandled(tranId) {
  const tid = String(tranId || '').trim()
  if (!tid || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(`${HANDLED_KEY_PREFIX}${tid}`, '1')
  } catch {
    /* ignore */
  }
}
