/**
 * VIP 支付结果页状态（A/B/C）。
 * A: ABA API / Webhook 自动确认
 * B: 后台人工审核通过
 * C: 后台人工审核拒绝
 */

/** @typedef {'auto_success' | 'manual_success' | 'rejected'} VipPaymentResultKind */

/**
 * @param {URLSearchParams} searchParams
 * @returns {'auto' | 'manual' | 'rejected' | ''}
 */
export function readVipPaymentFulfillmentHint(searchParams) {
  const raw = String(
    searchParams.get('fulfillment') || searchParams.get('result') || '',
  )
    .trim()
    .toLowerCase()
  if (raw === 'rejected' || raw === 'reject' || raw === 'failed') return 'rejected'
  if (raw === 'manual' || raw === 'manual_approved' || raw === 'manual_success') return 'manual'
  if (raw === 'auto' || raw === 'webhook' || raw === 'aba' || raw === 'auto_success') return 'auto'
  if (searchParams.get('rejected') === '1') return 'rejected'
  if (searchParams.get('manual') === '1') return 'manual'
  return ''
}

/**
 * @param {URLSearchParams} searchParams
 * @param {{ uiMock?: boolean, confirmOk?: boolean, vipActive?: boolean }} ctx
 * @returns {VipPaymentResultKind | 'loading' | 'pending' | 'need_login' | 'missing_tran' | 'error'}
 */
export function resolveVipPaymentResultView(searchParams, ctx = {}) {
  const hint = readVipPaymentFulfillmentHint(searchParams)
  if (hint === 'rejected') return 'rejected'
  if (ctx.uiMock) return hint === 'manual' ? 'manual_success' : 'auto_success'
  if (!ctx.hasTelegramUser) return 'need_login'
  if (!ctx.tranId) return 'missing_tran'
  if (ctx.confirmOk && ctx.vipActive) {
    return hint === 'manual' ? 'manual_success' : 'auto_success'
  }
  if (ctx.confirmOk && !ctx.vipActive) return 'pending'
  if (ctx.confirmError === 'payment_not_confirmed') return 'pending'
  if (ctx.confirmError) return 'error'
  return 'loading'
}
