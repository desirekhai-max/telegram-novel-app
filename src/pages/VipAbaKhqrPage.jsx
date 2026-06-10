import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AbaKhqrPaymentScreen from '../components/AbaKhqrPaymentScreen.jsx'
import VipPaymentResultModal from '../components/VipPaymentResultModal.jsx'
import { getVipPlanForPurchase } from '../data/vipPlansCatalog.js'
import {
  buildAbaKhqrUiMockSession,
  isUiMockAbaKhqrSession,
  withFreshMockKhqrImage,
} from '../lib/abaKhqrUiMock.js'
import { readVipPaymentFulfillmentHint } from '../lib/vipPaymentResultState.js'
import { confirmViewerVipPayment } from '../lib/viewerProfileApi.js'
import {
  clearVipAbaKhqrSession,
  loadVipAbaKhqrSession,
  handoffKhqrBootShell,
  saveVipAbaKhqrSession,
} from '../lib/vipAbaKhqrSession.js'
import { preloadVipPaymentSuccessAssets } from '../lib/vipPaymentSuccessAssets.js'
import { navigateToVipPaymentSuccess } from '../lib/vipPaymentSuccessNavigation.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'
import { useDisablePageZoom } from '../hooks/useDisablePageZoom.js'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'

const SUCCESS_NAV_DELAY_MS = 2000

function resolvePlanDurationHours(planId, role) {
  const hours = Number(getVipPlanForPurchase(planId, role)?.durationHours)
  return Number.isFinite(hours) && hours > 0 ? hours : 0
}

function readQrSession(planIdParam, uiMockQuery, role) {
  const stored = loadVipAbaKhqrSession()
  if (stored) return withFreshMockKhqrImage(stored)
  if (uiMockQuery && planIdParam) {
    return buildAbaKhqrUiMockSession(planIdParam, role)
  }
  return null
}

export default function VipAbaKhqrPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { viewerProfile, refreshViewerProfile } = useViewerProfile()
  const uiMockQuery = searchParams.get('ui_mock') === '1'
  const planIdParam = String(searchParams.get('plan_id') || '').trim()
  const tranIdParam = String(searchParams.get('tran_id') || '').trim()
  const fulfillmentHint = readVipPaymentFulfillmentHint(searchParams)

  const qrSessionRef = useRef(readQrSession(planIdParam, uiMockQuery, viewerProfile.role))
  const qrSession = qrSessionRef.current

  const isUiMock = isUiMockAbaKhqrSession(qrSession) || uiMockQuery
  const tranId = String(qrSession?.tranId || tranIdParam || '').trim()
  const planId = String(qrSession?.planId || planIdParam || '').trim()

  const [statusNote, setStatusNote] = useState(() =>
    isUiMockAbaKhqrSession(qrSession) || uiMockQuery
      ? ''
      : 'កំពុងរង់ចាំការបញ្ជាក់ការទូទាត់…',
  )
  const [resultModal, setResultModal] = useState(null)
  const pollRef = useRef(0)
  const successNavRef = useRef(false)
  const pendingSuccessRef = useRef(false)
  const successDelayTimerRef = useRef(0)
  const redirectCheckedRef = useRef(false)
  const edgeSwipeHandlers = useEdgeSwipeBack()
  const pageSwipeHandlers = resultModal ? {} : edgeSwipeHandlers

  const durationHours = useMemo(
    () => resolvePlanDurationHours(planId, viewerProfile.role),
    [planId, viewerProfile.role],
  )

  useDisablePageZoom(Boolean(qrSession))

  const stopPolling = useCallback(() => {
    if (!pollRef.current) return
    window.clearInterval(pollRef.current)
    pollRef.current = 0
  }, [])

  const goSuccess = useCallback(() => {
    if (successNavRef.current) return
    successNavRef.current = true
    pendingSuccessRef.current = false
    if (successDelayTimerRef.current) {
      window.clearTimeout(successDelayTimerRef.current)
      successDelayTimerRef.current = 0
    }
    stopPolling()

    const activeSession = qrSessionRef.current
    clearVipAbaKhqrSession()
    navigateToVipPaymentSuccess(
      navigate,
      {
        planId,
        priceLabel: String(activeSession?.amountLabel || '').trim(),
        durationHours,
        purchasedAt: new Date().toISOString(),
      },
      { replace: true, slideEnter: false },
    )
    void refreshViewerProfile()
    void preloadVipPaymentSuccessAssets()
  }, [durationHours, navigate, planId, refreshViewerProfile, stopPolling])

  const startSuccessCountdown = useCallback(() => {
    if (successNavRef.current || successDelayTimerRef.current) return
    if (document.visibilityState !== 'visible') return

    setStatusNote('ការបង់ប្រាក់បានជោគជ័យ កំពុងបញ្ជាក់…')
    void preloadVipPaymentSuccessAssets()

    successDelayTimerRef.current = window.setTimeout(() => {
      successDelayTimerRef.current = 0
      goSuccess()
    }, SUCCESS_NAV_DELAY_MS)
  }, [goSuccess])

  const markPaymentSuccess = useCallback(() => {
    if (successNavRef.current || pendingSuccessRef.current) return
    pendingSuccessRef.current = true
    stopPolling()

    if (document.visibilityState === 'visible') {
      startSuccessCountdown()
    }
  }, [startSuccessCountdown, stopPolling])

  const pollPayment = useCallback(async () => {
    if (!tranId || isUiMock || successNavRef.current || pendingSuccessRef.current) return
    const result = await confirmViewerVipPayment({ tranId, planId })
    if (successNavRef.current || pendingSuccessRef.current) return
    if (result.ok && result.profile?.vipActive) {
      markPaymentSuccess()
      return
    }
    if (result.error === 'payment_not_confirmed') {
      setStatusNote('កំពុងរង់ចាំការបញ្ជាក់ការទូទាត់…')
    }
  }, [isUiMock, markPaymentSuccess, planId, tranId])

  const pollPaymentRef = useRef(pollPayment)
  const startSuccessCountdownRef = useRef(startSuccessCountdown)
  pollPaymentRef.current = pollPayment
  startSuccessCountdownRef.current = startSuccessCountdown

  useEffect(() => {
    const qrImage = String(qrSessionRef.current?.qrImage || '').trim()
    if (!qrImage || typeof Image === 'undefined') return undefined
    const img = new Image()
    img.decoding = 'sync'
    img.src = qrImage
    return undefined
  }, [])

  useEffect(() => {
    void preloadVipPaymentSuccessAssets()
  }, [])

  useEffect(() => {
    if (redirectCheckedRef.current) return
    redirectCheckedRef.current = true

    if (!qrSessionRef.current) {
      qrSessionRef.current = readQrSession(planIdParam, uiMockQuery, viewerProfile.role)
    }
    const activeTranId = String(qrSessionRef.current?.tranId || tranIdParam || '').trim()
    if (!activeTranId) {
      navigate('/vip', { replace: true })
    }
  }, [navigate, planIdParam, tranIdParam, uiMockQuery, viewerProfile.role])

  useEffect(() => {
    if (!tranId) return undefined

    if (isUiMock) {
      if (qrSessionRef.current) saveVipAbaKhqrSession(qrSessionRef.current)
      if (fulfillmentHint === 'rejected') {
        setResultModal('rejected')
      }
      return undefined
    }

    if (fulfillmentHint === 'rejected') {
      setResultModal('rejected')
      return undefined
    }

    void pollPaymentRef.current()

    pollRef.current = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (pendingSuccessRef.current || successNavRef.current) return
      void pollPaymentRef.current()
    }, 4000)

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return

      if (!qrSessionRef.current) {
        qrSessionRef.current = readQrSession(planIdParam, uiMockQuery, viewerProfile.role)
      }

      if (pendingSuccessRef.current) {
        startSuccessCountdownRef.current()
        return
      }

      void pollPaymentRef.current()
    }

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fulfillmentHint, isUiMock, planIdParam, stopPolling, tranId, uiMockQuery, viewerProfile.role])

  useEffect(
    () => () => {
      if (successDelayTimerRef.current) {
        window.clearTimeout(successDelayTimerRef.current)
        successDelayTimerRef.current = 0
      }
    },
    [],
  )

  const closeResultModal = useCallback(() => {
    setResultModal(null)
  }, [])

  const displaySession =
    qrSession ||
    ({
      tranId: tranIdParam,
      planId: planIdParam,
      amountLabel: '',
      amount: 0,
      currency: 'USD',
      merchantLabel: 'VIP-Subscription',
      qrImage: '',
      qrString: '',
      abapayDeeplink: '',
      appStore: '',
      playStore: '',
      returnUrl: '',
    })

  return (
    <div className="tg-app tg-app--account tg-aba-khqr-page" {...pageSwipeHandlers}>
      <main className="tg-list-wrap tg-aba-khqr-page__main flex min-h-0 flex-1 flex-col">
        <div className="tg-aba-khqr-page__shell">
          <AbaKhqrPaymentScreen
            session={displaySession}
            statusNote={statusNote}
            showDemoActions={isUiMock}
            onSimulatePaid={markPaymentSuccess}
            onQrReady={handoffKhqrBootShell}
          />
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
