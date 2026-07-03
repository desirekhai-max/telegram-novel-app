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
import { confirmViewerVipPayment } from '../lib/viewerProfileApi.js'

const POLL_MS = 4000
const MAX_WAIT_MS = 5 * 60 * 1000

function isKhqrPaymentFulfilled(result) {
  return Boolean(result?.ok && (result?.order?.id || result?.alreadyFulfilled))
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/**
 * ABA 银行付完经 return_deeplink 冷启动回 Mini App 时，确认支付并进入 VIP 成功页。
 */
export function useVipAbaKhqrBankReturn() {
  const navigate = useNavigate()
  const location = useLocation()
  const { viewerProfile, refreshViewerProfile } = useViewerProfile()
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!isTelegramMiniApp()) return undefined
    if (location.pathname.startsWith('/vip/payment-success')) return undefined

    let cancelled = false

    const run = async () => {
      if (inFlightRef.current || cancelled) return

      const launch = await resolveVipAbaKhqrBankReturnContext()
      const tranId = String(launch?.tranId || '').trim()
      if (!tranId || wasVipAbaKhqrBankReturnHandled(tranId) || cancelled) return

      inFlightRef.current = true
      const planId = String(launch?.planId || '').trim()
      const deadline = Date.now() + MAX_WAIT_MS

      try {
        while (!cancelled && Date.now() < deadline) {
          const result = await confirmViewerVipPayment({ tranId, planId, strictVerify: true })
          if (cancelled) return
          if (result.error === 'payment_expired') break
          if (isKhqrPaymentFulfilled(result)) {
            markVipAbaKhqrBankReturnHandled(tranId)
            clearVipAbaKhqrPendingPayment(tranId)
            clearVipAbaKhqrSession()

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
            return
          }
          await sleep(POLL_MS)
        }
      } finally {
        inFlightRef.current = false
      }
    }

    void run()

    const onVisible = () => {
      if (document.visibilityState !== 'visible' || cancelled) return
      void run()
    }

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      inFlightRef.current = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [location.pathname, navigate, refreshViewerProfile, viewerProfile.role])
}
