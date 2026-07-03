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
  readVipAbaKhqrBankReturnFromLaunch,
  wasVipAbaKhqrBankReturnHandled,
} from '../lib/vipAbaKhqrBankReturn.js'
import { navigateToVipPaymentSuccess } from '../lib/vipPaymentSuccessNavigation.js'
import { confirmViewerVipPayment } from '../lib/viewerProfileApi.js'

const POLL_MS = 4000
const MAX_WAIT_MS = 5 * 60 * 1000

function isKhqrPaymentFulfilled(result) {
  return Boolean(result?.ok && (result?.profile?.vipActive || result?.alreadyFulfilled))
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

    const launch = readVipAbaKhqrBankReturnFromLaunch()
    const tranId = String(launch?.tranId || '').trim()
    if (!tranId || wasVipAbaKhqrBankReturnHandled(tranId) || inFlightRef.current) {
      return undefined
    }

    inFlightRef.current = true
    let cancelled = false

    const run = async () => {
      const planId = String(launch?.planId || '').trim()
      const deadline = Date.now() + MAX_WAIT_MS

      while (!cancelled && Date.now() < deadline) {
        const result = await confirmViewerVipPayment({ tranId, planId })
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

      inFlightRef.current = false
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [location.pathname, navigate, refreshViewerProfile, viewerProfile.role])
}
