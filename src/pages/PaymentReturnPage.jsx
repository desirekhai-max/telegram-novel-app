import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import VipPaymentResultModal from '../components/VipPaymentResultModal.jsx'
import { useTelegramUser } from '../hooks/useTelegramUser.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'
import { getVipPlanForPurchase } from '../data/vipPlansCatalog.js'
import { navigateToVipPaymentSuccess } from '../lib/vipPaymentSuccessNavigation.js'
import { readVipPaymentFulfillmentHint } from '../lib/vipPaymentResultState.js'
import { confirmViewerVipPayment } from '../lib/viewerProfileApi.js'
import { clearVipAbaKhqrSession } from '../lib/vipAbaKhqrSession.js'

function resolvePlanDurationHours(planId, role) {
  const hours = Number(getVipPlanForPurchase(planId, role)?.durationHours)
  return Number.isFinite(hours) && hours > 0 ? hours : 0
}

export default function PaymentReturnPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tgUser = useTelegramUser()
  const { viewerProfile, refreshViewerProfile } = useViewerProfile()
  const [viewState, setViewState] = useState('loading')
  const [statusMessage, setStatusMessage] = useState('')
  const successNavRef = useRef(false)

  const uiMock = searchParams.get('ui_mock') === '1'
  const isHostedReturn = searchParams.get('hosted') === '1'
  const tranId = String(searchParams.get('tran_id') || searchParams.get('tranId') || '').trim()
  const planId = String(searchParams.get('plan_id') || searchParams.get('planId') || '').trim()
  const fulfillmentHint = readVipPaymentFulfillmentHint(searchParams)
  const shouldRedirectToKhqr = !isHostedReturn && Boolean(tranId && planId)

  const durationHours = useMemo(
    () => resolvePlanDurationHours(planId, viewerProfile.role),
    [planId, viewerProfile.role],
  )

  const modalViewState = viewState === 'rejected' ? viewState : null

  const closeModal = () => {
    navigate('/vip', { replace: true })
  }

  const catalogPlan = useMemo(
    () => getVipPlanForPurchase(planId, viewerProfile.role),
    [planId, viewerProfile.role],
  )

  const goSuccessPage = useCallback(() => {
    if (successNavRef.current) return
    successNavRef.current = true
    navigateToVipPaymentSuccess(
      navigate,
      {
        planId: planId || catalogPlan?.planId || 'vip_entry',
        priceLabel: String(catalogPlan?.priceUsdLabel || '').trim(),
        durationHours,
        purchasedAt: new Date().toISOString(),
      },
      { replace: true, slideEnter: false },
    )
  }, [catalogPlan?.planId, catalogPlan?.priceUsdLabel, durationHours, navigate, planId])

  useEffect(() => {
    if (shouldRedirectToKhqr) return undefined

    let active = true
    clearVipAbaKhqrSession()

    if (fulfillmentHint === 'rejected') {
      setViewState('rejected')
      setStatusMessage('')
      return () => {
        active = false
      }
    }

    if (uiMock) {
      goSuccessPage()
      return () => {
        active = false
      }
    }

    if (!tgUser?.id) {
      setViewState('need_login')
      setStatusMessage('សូមបើកក្នុង Telegram Mini App')
      return () => {
        active = false
      }
    }
    if (!tranId) {
      setViewState('missing_tran')
      setStatusMessage('មិនឃើញលេខប្រតិបត្តិការ')
      return () => {
        active = false
      }
    }

    setViewState('loading')
    setStatusMessage('កំពុងផ្ទៀងផ្ទាត់ការទូទាត់…')

    void (async () => {
      const result = await confirmViewerVipPayment({ tranId, planId })
      if (!active) return

      if (result.ok && result.profile?.vipActive) {
        void refreshViewerProfile()
        goSuccessPage()
        return
      }
      if (result.ok && !result.profile?.vipActive) {
        setViewState('pending')
        setStatusMessage('កំពុងផ្ទៀងផ្ទាត់ការបង់ប្រាក់ សូមរង់ចាំ…')
        return
      }
      if (String(result.error || '') === 'payment_not_confirmed') {
        setViewState('pending')
        setStatusMessage('កំពុងផ្ទៀងផ្ទាត់ការបង់ប្រាក់ សូមរង់ចាំ…')
        return
      }
      setViewState('error')
      setStatusMessage(result.error || 'មិនអាចបើក VIP បាន')
    })()

    return () => {
      active = false
    }
  }, [
    goSuccessPage,
    shouldRedirectToKhqr,
    tgUser?.id,
    tranId,
    planId,
    refreshViewerProfile,
    uiMock,
    fulfillmentHint,
  ])

  if (shouldRedirectToKhqr) {
    return (
      <Navigate
        to={`/vip/aba-khqr?tran_id=${encodeURIComponent(tranId)}&plan_id=${encodeURIComponent(planId)}`}
        replace
      />
    )
  }

  return (
    <div className="tg-vip-payment-result-modal-host">
      {!modalViewState ? (
        <div className="tg-vip-payment-result-modal-host__status">
          <p className="tg-vip-payment-result-modal-host__status-text" lang="km">
            {viewState === 'loading' ? 'កំពុងផ្ទៀងផ្ទាត់…' : statusMessage}
          </p>
          {viewState === 'pending' || viewState === 'error' ? (
            <Link to="/vip" className="tg-vip-result-modal__btn tg-vip-result-modal__btn--ghost" lang="km">
              ត្រឡប់ទៅសមាជិក VIP
            </Link>
          ) : null}
        </div>
      ) : null}

      <VipPaymentResultModal
        open={Boolean(modalViewState)}
        viewState={modalViewState}
        durationHours={durationHours}
        onClose={closeModal}
      />
    </div>
  )
}
