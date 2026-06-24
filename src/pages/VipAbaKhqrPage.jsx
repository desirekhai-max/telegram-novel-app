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
import {
  buildAbaQrPageReturnUrl,
  shouldTryAbaMobileDeeplinkFirst,
  trySummonAbaMobile,
  trySummonAbaMobileInBrowser,
} from '../lib/abaMobile.js'
import { isTelegramMiniApp } from '../lib/telegramWebApp.js'
import { readVipPaymentFulfillmentHint } from '../lib/vipPaymentResultState.js'
import { confirmViewerVipPayment, fetchAbaKhqrHandoffSession } from '../lib/viewerProfileApi.js'
import {
  clearVipAbaKhqrPendingPayment,
  clearVipAbaKhqrSession,
  consumeSessionBootFromUrl,
  loadVipAbaKhqrPendingPayment,
  loadVipAbaKhqrSession,
  handoffKhqrBootShell,
  saveVipAbaKhqrSession,
} from '../lib/vipAbaKhqrSession.js'
import { preloadVipPaymentSuccessAssets } from '../lib/vipPaymentSuccessAssets.js'
import { scheduleVipPaymentSuccessNavigation } from '../lib/vipPaymentSuccessNavigation.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'
import { useDisablePageZoom } from '../hooks/useDisablePageZoom.js'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'

const ABA_SUMMON_FAILED_NOTE =
  'មិនអាចបើក ABA Mobile ។ សូម Scan QR ខាងលើដើម្បីបង់ប្រាក់'

const BROWSER_RETURN_NOTE =
  'បង់ប្រាក់រួចហើយ សូមត្រឡប់មក Telegram Mini App ដើម្បីបញ្ជាក់ VIP'

function resolvePlanDurationHours(planId, role) {
  const hours = Number(getVipPlanForPurchase(planId, role)?.durationHours)
  return Number.isFinite(hours) && hours > 0 ? hours : 0
}

function readQrSessionFromUrlParams(planIdParam, tranIdParam, searchParams) {
  const tid = String(tranIdParam || '').trim()
  const pid = String(planIdParam || '').trim()
  const qrSrc = String(searchParams?.get('qr_src') || '').trim()
  if (!tid || !qrSrc) return null
  return {
    tranId: tid,
    planId: pid,
    amountLabel: String(searchParams?.get('amount_label') || '').trim(),
    amount: 0,
    currency: 'USD',
    merchantLabel: 'VIP-Subscription',
    qrImage: qrSrc,
    qrString: '',
    abapayDeeplink: '',
    appStore: '',
    playStore: '',
    returnUrl: '',
    browserHandoffToken: String(searchParams?.get('handoff') || '').trim(),
  }
}

function readQrSession(planIdParam, tranIdParam, uiMockQuery, role, searchParams = null) {
  const stored = loadVipAbaKhqrSession()
  if (stored) return withFreshMockKhqrImage(stored)

  const fromBoot = consumeSessionBootFromUrl()
  if (fromBoot) {
    saveVipAbaKhqrSession(fromBoot)
    return withFreshMockKhqrImage(fromBoot)
  }

  const tid = String(tranIdParam || '').trim()
  if (tid) {
    const pending = loadVipAbaKhqrPendingPayment(tid)
    if (pending) {
      saveVipAbaKhqrSession(pending)
      return withFreshMockKhqrImage(pending)
    }
  }

  if (uiMockQuery && planIdParam) {
    return buildAbaKhqrUiMockSession(planIdParam, role)
  }

  if (searchParams) {
    const fromUrl = readQrSessionFromUrlParams(planIdParam, tranIdParam, searchParams)
    if (fromUrl) return withFreshMockKhqrImage(fromUrl)
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
  const handoffParam = String(searchParams.get('handoff') || '').trim()
  const autoSummonQuery = searchParams.get('auto_summon') === '1'
  const fulfillmentHint = readVipPaymentFulfillmentHint(searchParams)

  const qrSessionRef = useRef(
    readQrSession(planIdParam, tranIdParam, uiMockQuery, viewerProfile.role, searchParams),
  )
  const [sessionReady, setSessionReady] = useState(() => Boolean(qrSessionRef.current))
  const [handoffLoading, setHandoffLoading] = useState(
    () => Boolean(handoffParam && tranIdParam && !qrSessionRef.current),
  )
  const [handoffError, setHandoffError] = useState('')
  const autoSummonAttemptedRef = useRef(false)
  const qrSession = qrSessionRef.current
  const inTelegram = isTelegramMiniApp()
  const abaSummonFailedQuery = searchParams.get('aba_summon_failed') === '1'
  const shouldAutoSummonInBrowser =
    !inTelegram && !abaSummonFailedQuery && autoSummonQuery
  const shouldHideQrForAutoSummon = shouldAutoSummonInBrowser
  const [showQrAfterAutoSummon, setShowQrAfterAutoSummon] = useState(!shouldHideQrForAutoSummon)

  const isUiMock = isUiMockAbaKhqrSession(qrSession) || uiMockQuery
  const tranId = String(qrSession?.tranId || tranIdParam || '').trim()
  const planId = String(qrSession?.planId || planIdParam || '').trim()

  const [statusNote, setStatusNote] = useState(() => {
    if (isUiMockAbaKhqrSession(qrSession) || uiMockQuery) return ''
    if (searchParams.get('aba_summon_failed') === '1') return ABA_SUMMON_FAILED_NOTE
    if (!inTelegram) return BROWSER_RETURN_NOTE
    return 'កំពុងរង់ចាំការបញ្ជាក់ការទូទាត់…'
  })
  const [resultModal, setResultModal] = useState(null)
  const [successSlideOut, setSuccessSlideOut] = useState(false)
  const pollRef = useRef(0)
  const successNavRef = useRef(false)
  const pendingSuccessRef = useRef(false)
  const redirectCheckedRef = useRef(false)
  const edgeSwipeHandlers = useEdgeSwipeBack()
  const pageSwipeHandlers = resultModal ? {} : edgeSwipeHandlers

  const durationHours = useMemo(
    () => resolvePlanDurationHours(planId, viewerProfile.role),
    [planId, viewerProfile.role],
  )

  const returnToQrUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const activeSession = qrSessionRef.current || qrSession
    return buildAbaQrPageReturnUrl(tranId, planId, activeSession)
  }, [planId, qrSession, tranId])

  useEffect(() => {
    if (!inTelegram) handoffKhqrBootShell()
  }, [inTelegram])

  useEffect(() => {
    if (sessionReady || handoffError) handoffKhqrBootShell()
  }, [sessionReady, handoffError])

  useEffect(() => {
    if (inTelegram) return undefined
    const previousTitle = document.title
    document.title = '69KKH NOVEL'
    return () => {
      document.title = previousTitle
    }
  }, [inTelegram])

  useEffect(() => {
    if (searchParams.get('aba_summon_failed') === '1') {
      setStatusNote(ABA_SUMMON_FAILED_NOTE)
    }
  }, [searchParams])

  useEffect(() => {
    if (qrSessionRef.current || uiMockQuery) return undefined
    if (!tranIdParam) return undefined

    if (!handoffParam) {
      const fromUrl = readQrSessionFromUrlParams(planIdParam, tranIdParam, searchParams)
      if (fromUrl) {
        qrSessionRef.current = withFreshMockKhqrImage(fromUrl)
        saveVipAbaKhqrSession(qrSessionRef.current)
        setSessionReady(true)
      }
      return undefined
    }

    let cancelled = false
    setHandoffLoading(true)
    setHandoffError('')

    void fetchAbaKhqrHandoffSession({ tranId: tranIdParam, handoff: handoffParam }).then(
      (session) => {
        if (cancelled) return
        setHandoffLoading(false)
        if (session) {
          qrSessionRef.current = withFreshMockKhqrImage(session)
          saveVipAbaKhqrSession(qrSessionRef.current)
          setSessionReady(true)
          return
        }
        const fromUrl = readQrSessionFromUrlParams(planIdParam, tranIdParam, searchParams)
        if (fromUrl) {
          qrSessionRef.current = withFreshMockKhqrImage(fromUrl)
          saveVipAbaKhqrSession(qrSessionRef.current)
          setSessionReady(true)
          return
        }
        setHandoffError('មិនអាចផ្ទុក QR បាន សូមបិទ Browser ហើយព្យាយាមម្តងទៀត')
      },
    )

    return () => {
      cancelled = true
    }
  }, [handoffParam, planIdParam, searchParams, tranIdParam, uiMockQuery])

  useEffect(() => {
    if (!shouldAutoSummonInBrowser || inTelegram || autoSummonAttemptedRef.current || handoffLoading) {
      return undefined
    }
    if (!sessionReady) return undefined
    const session = qrSessionRef.current
    if (!session) return undefined
    const qrString = String(session.qrString || '').trim()
    const deeplink = String(session.abapayDeeplink || '').trim()
    if (!qrString && !deeplink) {
      setShowQrAfterAutoSummon(true)
      return undefined
    }

    autoSummonAttemptedRef.current = true
    const result = trySummonAbaMobileInBrowser({
      qrString,
      abapayDeeplink: deeplink,
      returnToQrUrl,
      session,
      onSummonFailed: () => {
        setStatusNote(ABA_SUMMON_FAILED_NOTE)
        setShowQrAfterAutoSummon(true)
      },
    })

    if (!result.attempted) {
      setShowQrAfterAutoSummon(true)
    }

    return undefined
  }, [handoffLoading, inTelegram, returnToQrUrl, sessionReady, shouldAutoSummonInBrowser])

  useEffect(() => {
    if (abaSummonFailedQuery) setShowQrAfterAutoSummon(true)
  }, [abaSummonFailedQuery])

  const stopPolling = useCallback(() => {
    if (!pollRef.current) return
    window.clearInterval(pollRef.current)
    pollRef.current = 0
  }, [])

  const goSuccess = useCallback(() => {
    if (successNavRef.current) return
    successNavRef.current = true
    pendingSuccessRef.current = false
    stopPolling()

    const activeSession = qrSessionRef.current
    const successPayload = {
      planId,
      priceLabel: String(activeSession?.amountLabel || '').trim(),
      durationHours,
      purchasedAt: new Date().toISOString(),
    }

    scheduleVipPaymentSuccessNavigation(
      navigate,
      successPayload,
      () => setSuccessSlideOut(true),
      {
        replace: true,
        onBeforeNavigate: () => {
          clearVipAbaKhqrSession()
          clearVipAbaKhqrPendingPayment(tranId)
          void refreshViewerProfile()
        },
      },
    )
  }, [durationHours, navigate, planId, refreshViewerProfile, stopPolling, tranId])

  const startSuccessCountdown = useCallback(() => {
    if (successNavRef.current) return
    if (document.visibilityState !== 'visible') return

    setStatusNote('ការបង់ប្រាក់បានជោគជ័យ កំពុងបញ្ជាក់…')
    void preloadVipPaymentSuccessAssets()
    goSuccess()
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
    if (!tranId || isUiMock || !inTelegram || successNavRef.current || pendingSuccessRef.current) return
    const result = await confirmViewerVipPayment({ tranId, planId })
    if (successNavRef.current || pendingSuccessRef.current) return
    if (result.ok && result.profile?.vipActive) {
      markPaymentSuccess()
      return
    }
    if (result.error === 'payment_not_confirmed') {
      setStatusNote('កំពុងរង់ចាំការបញ្ជាក់ការទូទាត់…')
    }
  }, [inTelegram, isUiMock, markPaymentSuccess, planId, tranId])

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
      qrSessionRef.current = readQrSession(
        planIdParam,
        tranIdParam,
        uiMockQuery,
        viewerProfile.role,
        searchParams,
      )
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

    if (!inTelegram) return undefined

    void pollPaymentRef.current()

    pollRef.current = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (pendingSuccessRef.current || successNavRef.current) return
      void pollPaymentRef.current()
    }, 4000)

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return

      if (!qrSessionRef.current) {
        qrSessionRef.current = readQrSession(
          planIdParam,
          tranIdParam,
          uiMockQuery,
          viewerProfile.role,
          searchParams,
        )
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
  }, [fulfillmentHint, inTelegram, isUiMock, planIdParam, stopPolling, tranId, tranIdParam, uiMockQuery, viewerProfile.role])

  const closeResultModal = useCallback(() => {
    setResultModal(null)
  }, [])

  const displaySession =
    (sessionReady ? qrSessionRef.current : null) ||
    readQrSessionFromUrlParams(planIdParam, tranIdParam, searchParams) ||
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

  const showAbaMobileButton = useMemo(() => {
    if (!inTelegram || isUiMock || !shouldTryAbaMobileDeeplinkFirst()) return false
    const qrString = String(displaySession?.qrString || '').trim()
    const deeplink = String(displaySession?.abapayDeeplink || '').trim()
    return Boolean(qrString || deeplink)
  }, [displaySession?.abapayDeeplink, displaySession?.qrString, inTelegram, isUiMock])

  const onOpenAbaMobile = useCallback(() => {
    const session = qrSessionRef.current || displaySession
    const qrString = String(session?.qrString || '').trim()
    const deeplink = String(session?.abapayDeeplink || '').trim()
    if (!qrString && !deeplink) return

    if (isUiMock) {
      setStatusNote('ABA Mobile (UI demo — app not opened)')
      return
    }

    const summonInput = {
      qrString,
      abapayDeeplink: deeplink,
      returnToQrUrl,
      session: qrSessionRef.current || displaySession,
      onSummonFailed: () => {
        setStatusNote(ABA_SUMMON_FAILED_NOTE)
      },
    }

    const result = inTelegram
      ? trySummonAbaMobile({
          ...summonInput,
          session: qrSessionRef.current || displaySession,
        })
      : trySummonAbaMobileInBrowser(summonInput)

    if (!result.attempted) {
      setStatusNote(ABA_SUMMON_FAILED_NOTE)
    }
  }, [displaySession, inTelegram, isUiMock, returnToQrUrl])

  return (
    <div
      className={[
        'tg-app tg-app--account tg-aba-khqr-page',
        successSlideOut ? 'tg-aba-khqr-page--slide-out' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...pageSwipeHandlers}
    >
      <main className="tg-list-wrap tg-aba-khqr-page__main flex min-h-0 flex-1 flex-col">
        <div className="tg-aba-khqr-page__shell">
          {handoffLoading ? (
            <p className="tg-aba-khqr-page__status" lang="km">
              កំពុងផ្ទុក QR…
            </p>
          ) : null}
          {handoffError ? (
            <p className="tg-aba-khqr-page__status" lang="km">
              {handoffError}
            </p>
          ) : null}
          {showQrAfterAutoSummon ? (
            <AbaKhqrPaymentScreen
              session={displaySession}
              statusNote={statusNote}
              showDemoActions={isUiMock}
              onSimulatePaid={markPaymentSuccess}
              onQrReady={handoffKhqrBootShell}
            />
          ) : null}

          {showAbaMobileButton ? (
            <button
              type="button"
              className="tg-aba-khqr-page__deeplink-btn"
              lang="en"
              onClick={onOpenAbaMobile}
            >
              Open ABA Mobile
            </button>
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
