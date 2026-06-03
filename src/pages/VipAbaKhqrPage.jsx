import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AbaKhqrPaymentScreen from '../components/AbaKhqrPaymentScreen.jsx'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { buildAbaKhqrUiMockSession, isUiMockAbaKhqrSession } from '../lib/abaKhqrUiMock.js'
import { confirmViewerVipPayment } from '../lib/viewerProfileApi.js'
import { clearVipAbaKhqrSession, loadVipAbaKhqrSession, saveVipAbaKhqrSession } from '../lib/vipAbaKhqrSession.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'

export default function VipAbaKhqrPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { viewerProfile } = useViewerProfile()
  const uiMockQuery = searchParams.get('ui_mock') === '1'
  const planIdParam = String(searchParams.get('plan_id') || '').trim()
  const tranIdParam = String(searchParams.get('tran_id') || '').trim()

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
  const pollRef = useRef(0)

  const goSuccess = useCallback(() => {
    clearVipAbaKhqrSession()
    if (isUiMock) {
      navigate(
        `/vip/payment-return?ui_mock=1&tran_id=${encodeURIComponent(tranId)}&plan_id=${encodeURIComponent(planId)}`,
        { replace: true },
      )
      return
    }
    navigate(
      `/vip/payment-return?tran_id=${encodeURIComponent(tranId)}&plan_id=${encodeURIComponent(planId)}&paid=1`,
      { replace: true },
    )
  }, [isUiMock, navigate, planId, tranId])

  const pollPayment = useCallback(async () => {
    if (!tranId || isUiMock) return
    const result = await confirmViewerVipPayment({ tranId, planId })
    if (result.ok && result.profile?.vipActive) {
      goSuccess()
      return
    }
    if (result.error === 'payment_not_confirmed') {
      setStatusNote('Waiting for payment confirmation…')
    }
  }, [goSuccess, isUiMock, planId, tranId])

  useEffect(() => {
    if (!session || !tranId) {
      navigate('/vip', { replace: true })
      return undefined
    }

    if (isUiMock) {
      saveVipAbaKhqrSession(session)
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
  }, [isUiMock, navigate, planId, pollPayment, session, tranId])

  if (!session || !tranId) {
    return null
  }

  return (
    <div className="tg-app tg-app--account tg-aba-khqr-page">
      <BrandTabToolbar title="ការទូទាត់តាម ABA KHQR" titleLang="km" titleClassName="text-[16px]" />
      <main className="tg-list-wrap tg-account-scroll flex flex-1 flex-col px-3 py-3">
        <section className="mx-auto flex w-full max-w-[420px] flex-col gap-3">
          <AbaKhqrPaymentScreen
            session={session}
            showDemoActions={isUiMock}
            onSimulatePaid={goSuccess}
          />

          {statusNote ? (
            <p className="text-center text-[11px] text-slate-500" lang="en">
              {statusNote}
            </p>
          ) : null}

          <Link
            to="/vip"
            className="text-center text-[11px] text-slate-400 underline-offset-2 hover:underline"
          >
            Cancel
          </Link>
        </section>
      </main>
    </div>
  )
}
