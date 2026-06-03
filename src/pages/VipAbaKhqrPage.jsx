import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { openAbaMobileDeeplink, shouldTryAbaMobileDeeplinkFirst } from '../lib/abaMobile.js'
import { confirmViewerVipPayment } from '../lib/viewerProfileApi.js'
import { clearVipAbaKhqrSession, loadVipAbaKhqrSession } from '../lib/vipAbaKhqrSession.js'

function formatDisplayAmount(session) {
  const label = String(session?.amountLabel || '').trim()
  if (label) return label.startsWith('$') ? label : `$ ${label.replace(/^\$/, '')}`
  const n = Number(session?.amount)
  if (Number.isFinite(n) && n > 0) return `$ ${n.toFixed(2)}`
  return '$ —'
}

export default function VipAbaKhqrPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const session = useMemo(() => loadVipAbaKhqrSession(), [])
  const tranId = String(session?.tranId || searchParams.get('tran_id') || '').trim()
  const planId = String(session?.planId || searchParams.get('plan_id') || '').trim()
  const [statusNote, setStatusNote] = useState('')
  const [deeplinkTried, setDeeplinkTried] = useState(false)
  const pollRef = useRef(0)
  const deeplinkOnceRef = useRef(false)

  const goSuccess = useCallback(() => {
    clearVipAbaKhqrSession()
    navigate(
      `/vip/payment-return?tran_id=${encodeURIComponent(tranId)}&plan_id=${encodeURIComponent(planId)}&paid=1`,
      { replace: true },
    )
  }, [navigate, planId, tranId])

  const pollPayment = useCallback(async () => {
    if (!tranId) return
    const result = await confirmViewerVipPayment({ tranId, planId })
    if (result.ok && result.profile?.vipActive) {
      goSuccess()
      return
    }
    if (result.error === 'payment_not_confirmed') {
      setStatusNote('Waiting for payment confirmation…')
    }
  }, [goSuccess, planId, tranId])

  useEffect(() => {
    if (!session || !tranId) {
      navigate('/vip', { replace: true })
      return undefined
    }

    if (shouldTryAbaMobileDeeplinkFirst() && session.abapayDeeplink && !deeplinkOnceRef.current) {
      deeplinkOnceRef.current = true
      const opened = openAbaMobileDeeplink(session.abapayDeeplink, {
        playStore: session.playStore,
        appStore: session.appStore,
      })
      setDeeplinkTried(opened)
      if (opened) setStatusNote('Opening ABA Mobile…')
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
  }, [navigate, planId, pollPayment, session, tranId])

  const onOpenAbaMobile = () => {
    if (!session?.abapayDeeplink) return
    const opened = openAbaMobileDeeplink(session.abapayDeeplink, {
      playStore: session.playStore,
      appStore: session.appStore,
    })
    setDeeplinkTried(opened)
    setStatusNote(opened ? 'Opening ABA Mobile…' : 'Could not open ABA Mobile')
  }

  if (!session || !tranId) {
    return null
  }

  const qrSrc = session.qrImage.startsWith('data:')
    ? session.qrImage
    : session.qrImage || ''

  return (
    <div className="tg-app tg-app--account tg-aba-khqr-page">
      <BrandTabToolbar title="ABA KHQR" titleLang="en" titleClassName="text-[16px]" />
      <main className="tg-list-wrap tg-account-scroll flex flex-1 flex-col px-3 py-5">
        <section className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
          <p className="tg-aba-khqr-page__brand" lang="en">
            ABA&apos; PAY
          </p>

          <article className="tg-aba-khqr-card">
            <div className="tg-aba-khqr-card__header">
              <span className="tg-aba-khqr-card__khqr-logo">KHQR</span>
            </div>
            <div className="tg-aba-khqr-card__body">
              <p className="tg-aba-khqr-card__merchant">{session.merchantLabel}</p>
              <p className="tg-aba-khqr-card__amount">{formatDisplayAmount(session)}</p>
              <div className="tg-aba-khqr-card__qr-wrap">
                {qrSrc ? (
                  <img src={qrSrc} alt="KHQR" className="tg-aba-khqr-card__qr" decoding="async" />
                ) : (
                  <p className="tg-aba-khqr-card__qr-fallback" lang="en">
                    QR unavailable — use ABA Mobile below
                  </p>
                )}
              </div>
              <p className="tg-aba-khqr-card__hint" lang="en">
                Scan with ABA Mobile or any KHQR supported banking app
              </p>
            </div>
          </article>

          {session.abapayDeeplink ? (
            <button
              type="button"
              className="tg-aba-khqr-page__deeplink-btn"
              onClick={onOpenAbaMobile}
            >
              {deeplinkTried ? 'Open ABA Mobile again' : 'Pay with ABA Mobile'}
            </button>
          ) : null}

          {statusNote ? (
            <p className="text-center text-[11px] text-white/55" lang="en">
              {statusNote}
            </p>
          ) : null}

          <Link to="/vip" className="text-center text-[11px] text-white/45 underline-offset-2 hover:underline">
            Cancel
          </Link>
        </section>
      </main>
    </div>
  )
}
