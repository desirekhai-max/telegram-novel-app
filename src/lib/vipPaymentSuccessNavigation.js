import { preloadVipPaymentSuccessAssets } from './vipPaymentSuccessAssets.js'
import { saveVipPaymentSuccessPayload } from './vipPaymentSuccessState.js'

/** KHQR / payment-return 进入成功页时的路由 state（右侧滑入） */
export const VIP_PAYMENT_SUCCESS_SLIDE_STATE = { enter: 'slide' }

/**
 * 扫码支付确认成功后：只进入完整成功页，不弹其它结果层。
 * @param {import('react-router-dom').NavigateFunction} navigate
 * @param {{
 *   planId?: string,
 *   planLabel?: string,
 *   priceLabel?: string,
 *   durationHours?: number,
 *   purchasedAt?: string,
 * }} payload
 * @param {{ replace?: boolean, slideEnter?: boolean }} [options]
 */
export function navigateToVipPaymentSuccess(navigate, payload, options = {}) {
  saveVipPaymentSuccessPayload(payload)
  void preloadVipPaymentSuccessAssets()
  const planId = String(payload?.planId || 'vip_entry').trim() || 'vip_entry'
  const useSlide = options.slideEnter !== false
  navigate(`/vip/payment-success?plan_id=${encodeURIComponent(planId)}`, {
    replace: options.replace !== false,
    ...(useSlide ? { state: VIP_PAYMENT_SUCCESS_SLIDE_STATE } : {}),
  })
}
