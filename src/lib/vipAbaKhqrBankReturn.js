import { loadActiveVipAbaKhqrPending } from './vipAbaKhqrSession.js'

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
  const fromUnsafe = String(window.Telegram?.WebApp?.initDataUnsafe?.start_param || '').trim()
  if (fromUnsafe) return fromUnsafe
  try {
    const fromQuery = String(
      new URL(window.location.href).searchParams.get('tgWebAppStartParam') || '',
    ).trim()
    if (fromQuery) return fromQuery
  } catch {
    /* ignore */
  }
  return ''
}

export function readVipAbaKhqrBankReturnFromLaunch() {
  return parseVipAbaKhqrBankReturnStartParam(readTelegramMiniAppStartParam())
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/** 银行回跳：优先 start_param，其次未过期的 pending 订单（冷启动 session 丢失时兜底） */
export async function resolveVipAbaKhqrBankReturnContext(options = {}) {
  const retries = Number(options.retries) > 0 ? Number(options.retries) : 10
  for (let i = 0; i < retries; i += 1) {
    const fromStart = readVipAbaKhqrBankReturnFromLaunch()
    if (fromStart?.tranId) {
      return {
        tranId: fromStart.tranId,
        planId: String(fromStart.planId || '').trim(),
        source: 'start_param',
      }
    }
    const pending = loadActiveVipAbaKhqrPending()
    if (pending?.tranId) {
      return {
        tranId: pending.tranId,
        planId: String(pending.planId || '').trim(),
        source: 'pending',
      }
    }
    if (i + 1 < retries) {
      await sleep(i < 2 ? 80 : 200)
    }
  }
  return null
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
