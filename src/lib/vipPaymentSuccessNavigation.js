import { preloadVipPaymentSuccessAssets } from './vipPaymentSuccessAssets.js'
import { saveVipPaymentSuccessPayload } from './vipPaymentSuccessState.js'

/** KHQR / payment-return 进入成功页时的路由 state（右侧滑入） */
export const VIP_PAYMENT_SUCCESS_SLIDE_STATE = { enter: 'slide' }

/** 确认页左滑出后再跳转成功页的时长（ms） */
export const VIP_PAYMENT_SUCCESS_SLIDE_OUT_MS = 280

/**
 * 确认页先左滑出，再进入带右侧滑入动画的成功页。
 * @param {import('react-router-dom').NavigateFunction} navigate
 * @param {Parameters<typeof navigateToVipPaymentSuccess>[1]} payload
 * @param {() => void} [onSlideOutStart]
 * @param {{ replace?: boolean, onBeforeNavigate?: () => void }} [options]
 */
export function scheduleVipPaymentSuccessNavigation(navigate, payload, onSlideOutStart, options = {}) {
  const { onBeforeNavigate, ...navOptions } = options
  onSlideOutStart?.()
  window.setTimeout(() => {
    onBeforeNavigate?.()
    navigateToVipPaymentSuccess(navigate, payload, { replace: true, slideEnter: true, ...navOptions })
  }, VIP_PAYMENT_SUCCESS_SLIDE_OUT_MS)
}

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
