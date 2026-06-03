import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AbaKhqrPaymentScreen from '../components/AbaKhqrPaymentScreen.jsx'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import VipPaymentResultModal from '../components/VipPaymentResultModal.jsx'
import { getVipPlanForPurchase } from '../data/vipPlansCatalog.js'
import { buildAbaKhqrUiMockSession, isUiMockAbaKhqrSession } from '../lib/abaKhqrUiMock.js'
import { readVipPaymentFulfillmentHint } from '../lib/vipPaymentResultState.js'
import { confirmViewerVipPayment } from '../lib/viewerProfileApi.js'
import { clearVipAbaKhqrSession, loadVipAbaKhqrSession, saveVipAbaKhqrSession } from '../lib/vipAbaKhqrSession.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'

function resolvePlanDurationHours(planId, role) {
  const hours = Number(getVipPlanForPurchase(planId, role)?.durationHours)
  return Number.isFinite(hours) && hours > 0 ? hours : 0
}

export default function VipAbaKhqrPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { viewerProfile, refreshViewerProfile } = useViewerProfile()
  const uiMockQuery = searchParams.get('ui_mock') === '1'
  const planIdParam = String(searchParams.get('plan_id') || '').trim()
  const tranIdParam = String(searchParams.get('tran_id') || '').trim()
  const fulfillmentHint = readVipPaymentFulfillmentHint(searchParams)

  const sessionFromStorage = useMemo(() => loadVipAbaKhqrSession(), [])
  const session = useMemo(() => {
    if (sessionFromStorage) return sessionFromStorage
    if (uiMockQuery && planIdParam) {
      return buildAbaKhqrUiMockSession(planIdParam, viewerProfile.role)
    }
    return null
  }, [planIdParam, sessionFromStorage, uiMockQuery, viewerProfile.role])

  const isUiMock = isUiMockAbaKhqrSession(session) || uiMockQuery
  const tranId = String(session?.tranId || tranIdParam || '').trim()
  const planId = String(session?.planId || planIdParam || '').trim()

  const [statusNote, setStatusNote] = useState('')
  const [resultModal, setResultModal] = useState(null)
  const pollRef = useRef(0)
  const edgeSwipeHandlers = useEdgeSwipeBack()
  const pageSwipeHandlers = resultModal ? {} : edgeSwipeHandlers

  const durationHours = useMemo(
    () => resolvePlanDurationHours(planId, viewerProfile.role),
    [planId, viewerProfile.role],
  )

  const openSuccessModal = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = 0
    }
    clearVipAbaKhqrSession()
    setResultModal(fulfillmentHint === 'manual' ? 'manual_success' : 'auto_success')
  }, [fulfillmentHint])

  const closeResultModal = useCallback(() => {
    setResultModal(null)
  }, [])

  const goSuccess = useCallback(() => {
    openSuccessModal()
  }, [openSuccessModal])

  const pollPayment = useCallback(async () => {
    if (!tranId || isUiMock) return
    const result = await confirmViewerVipPayment({ tranId, planId })
    if (result.ok && result.profile?.vipActive) {
      await refreshViewerProfile()
      openSuccessModal()
      return
    }
    if (result.error === 'payment_not_confirmed') {
      setStatusNote('កំពុងរង់ចាំការបញ្ជាក់ការទូទាត់…')
    }
  }, [isUiMock, openSuccessModal, planId, refreshViewerProfile, tranId])

  useEffect(() => {
    if (!session || !tranId) {
      navigate('/vip', { replace: true })
      return undefined
    }

    if (isUiMock) {
      saveVipAbaKhqrSession(session)
      if (fulfillmentHint === 'rejected') {
        setResultModal('rejected')
      }
      return undefined
    }

    if (fulfillmentHint === 'rejected') {
      setResultModal('rejected')
      return undefined
    }

    void pollPayment()
    pollRef.current = window.setInterval(() => {
      void pollPayment()
    }, 4000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void pollPayment()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fulfillmentHint, isUiMock, navigate, planId, pollPayment, session, tranId])

  if (!session || !tranId) {
    return null
  }

  return (
    <div className="tg-app tg-app--account tg-aba-khqr-page" {...pageSwipeHandlers}>
      <BrandTabToolbar title="ការទូទាត់តាម ABA KHQR" titleLang="km" titleClassName="text-[16px]" />
      <main className="tg-list-wrap tg-account-scroll tg-aba-khqr-page__main flex flex-1 flex-col">
        <div className="tg-aba-khqr-page__shell">
          <AbaKhqrPaymentScreen
            session={session}
            showDemoActions={isUiMock}
            onSimulatePaid={goSuccess}
          />

          {statusNote ? (
            <p className="tg-aba-khqr-page__status text-center text-[11px] text-slate-500" lang="km">
              {statusNote}
            </p>
          ) : null}
        </div>
      </main>

      <VipPaymentResultModal
        open={Boolean(resultModal)}
        viewState={resultModal}
        durationHours={durationHours}
        onClose={closeResultModal}
      />
    </div>
  )
}
