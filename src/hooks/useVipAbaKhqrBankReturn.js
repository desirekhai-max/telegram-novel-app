import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getVipPlanForPurchase } from '../data/vipPlansCatalog.js'
import { useViewerProfile } from './useViewerProfile.js'
import { isTelegramMiniApp } from '../lib/telegramWebApp.js'
import {
  clearVipAbaKhqrPendingPayment,
  clearVipAbaKhqrSession,
} from '../lib/vipAbaKhqrSession.js'
import {
  markVipAbaKhqrBankReturnHandled,
  resolveVipAbaKhqrBankReturnContext,
  wasVipAbaKhqrBankReturnHandled,
} from '../lib/vipAbaKhqrBankReturn.js'
import { navigateToVipPaymentSuccess } from '../lib/vipPaymentSuccessNavigation.js'
import { subscribeVipCheckTransactionPoll } from '../lib/vipCheckTransactionPollCoordinator.js'

function isKhqrPaymentFulfilled(result) {
  return Boolean(result?.ok && (result?.order?.id || result?.alreadyFulfilled))
}

/**
 * ABA 银行付完经 return_deeplink 冷启动回 Mini App 时，确认支付并进入 VIP 成功页。
 */
export function useVipAbaKhqrBankReturn() {
  const navigate = useNavigate()
  const location = useLocation()
  const { viewerProfile, refreshViewerProfile } = useViewerProfile()
  const subscribedTranIdRef = useRef('')
  const unsubscribeRef = useRef(() => {})

  useEffect(() => {
    if (!isTelegramMiniApp()) return undefined
    if (location.pathname.startsWith('/vip/payment-success')) return undefined

    let cancelled = false

    const attachPoll = async () => {
      const launch = await resolveVipAbaKhqrBankReturnContext()
      const tranId = String(launch?.tranId || '').trim()
      if (!tranId || wasVipAbaKhqrBankReturnHandled(tranId) || cancelled) return
      if (subscribedTranIdRef.current === tranId) return

      unsubscribeRef.current()
      subscribedTranIdRef.current = tranId
      const planId = String(launch?.planId || '').trim()

      unsubscribeRef.current = subscribeVipCheckTransactionPoll(tranId, planId, (result) => {
        if (cancelled) return
        if (!isKhqrPaymentFulfilled(result)) return

        markVipAbaKhqrBankReturnHandled(tranId)
        clearVipAbaKhqrPendingPayment(tranId)
        clearVipAbaKhqrSession()
        subscribedTranIdRef.current = ''

        const role = result.profile?.role || viewerProfile.role || 'normal'
        const resolvedPlanId = String(planId || result.order?.planId || '').trim()
        const plan = resolvedPlanId ? getVipPlanForPurchase(resolvedPlanId, role) : null
        const successPayload = {
          planId: resolvedPlanId || 'vip_entry',
          planLabel: plan?.titleKm || '',
          priceLabel: String(result.order?.amount || plan?.priceUsdLabel || '').trim(),
          durationHours: Number(plan?.durationHours) || 0,
          purchasedAt: new Date().toISOString(),
        }

        void refreshViewerProfile()
        navigateToVipPaymentSuccess(navigate, successPayload, { replace: true, slideEnter: true })
      })
    }

    void attachPoll()

    const onVisible = () => {
      if (document.visibilityState !== 'visible' || cancelled) return
      void attachPoll()
    }

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      subscribedTranIdRef.current = ''
      unsubscribeRef.current()
      unsubscribeRef.current = () => {}
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [location.pathname, navigate, refreshViewerProfile])
}
