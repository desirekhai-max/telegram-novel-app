import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { useTelegramUser } from '../hooks/useTelegramUser.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'
import { formatVipExpireDateTimeKm } from '../lib/formatVipExpireKm.js'
import { useVipExpireCountdown } from '../hooks/useVipExpireCountdown.js'
import { confirmViewerVipPayment } from '../lib/viewerProfileApi.js'
import { clearVipAbaKhqrSession } from '../lib/vipAbaKhqrSession.js'

export default function PaymentReturnPage() {
  const [searchParams] = useSearchParams()
  const tgUser = useTelegramUser()
  const { viewerProfile, refreshViewerProfile } = useViewerProfile()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  const uiMock = searchParams.get('ui_mock') === '1'
  const tranId = String(searchParams.get('tran_id') || searchParams.get('tranId') || '').trim()
  const planId = String(searchParams.get('plan_id') || searchParams.get('planId') || '').trim()
  const paidHint = searchParams.get('paid') === '1'
  const vipExpireAtMs = Number(viewerProfile?.vipExpireAtMs) || 0
  const vipCountdown = useVipExpireCountdown(viewerProfile?.vipActive ? vipExpireAtMs : 0)
  const vipExpireDateLabel =
    vipExpireAtMs > 0 ? formatVipExpireDateTimeKm(vipExpireAtMs) : ''

  useEffect(() => {
    let active = true
    clearVipAbaKhqrSession()

    if (uiMock) {
      setStatus('success')
      setMessage('')
      return () => {
        active = false
      }
    }

    if (!tgUser?.id) {
      setStatus('need_login')
      setMessage('សូមបើកក្នុង Telegram Mini App')
      return () => {
        active = false
      }
    }
    if (!tranId) {
      setStatus('missing_tran')
      setMessage('មិនឃើញលេខប្រតិបត្តិការ')
      return () => {
        active = false
      }
    }

    if (paidHint) {
      setMessage('កំពុងបើក VIP…')
    }

    void (async () => {
      const result = await confirmViewerVipPayment({ tranId, planId })
      if (!active) return
      if (result.ok && result.profile?.vipActive) {
        await refreshViewerProfile()
        setStatus('success')
        setMessage('បង់ប្រាក់ជោគជ័យ · VIP បានបើករួចហើយ')
        return
      }
      if (result.ok && !result.profile?.vipActive) {
        setStatus('pending')
        setMessage('កំពុងផ្ទៀងផ្ទាត់ការបង់ប្រាក់ សូមរង់ចាំ...')
        return
      }
      setStatus('failed')
      setMessage(result.error || 'មិនអាចបើក VIP បាន')
    })()
    return () => {
      active = false
    }
  }, [tgUser?.id, tranId, planId, paidHint, refreshViewerProfile, uiMock])

  const isSuccess =
    uiMock || status === 'success' || (viewerProfile?.vipActive && paidHint && !uiMock)

  return (
    <div
      className={[
        'tg-app tg-app--account',
        uiMock ? 'tg-aba-success-page' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <BrandTabToolbar
        title={uiMock ? 'Payment' : 'លទ្ធផលបង់ប្រាក់'}
        titleLang={uiMock ? 'en' : 'km'}
        titleClassName="text-[16px]"
      />
      <main className="tg-list-wrap tg-account-scroll flex flex-1 px-3 py-8">
        <section className="mx-auto flex w-full max-w-[420px] flex-col gap-4 text-center">
          {isSuccess ? (
            <div className={uiMock ? 'tg-aba-success-card' : 'tg-payment-success'}>
              <span
                className={uiMock ? 'tg-aba-success-card__icon' : 'tg-payment-success__icon'}
                aria-hidden
              >
                ✓
              </span>
              <h2
                className={uiMock ? 'tg-aba-success-card__title' : 'tg-payment-success__title'}
                lang={uiMock ? 'en' : 'km'}
              >
                {uiMock ? 'Payment Successful' : 'បង់ប្រាក់ជោគជ័យ'}
              </h2>
              <p
                className={uiMock ? 'tg-aba-success-card__subtitle' : 'tg-payment-success__subtitle'}
                lang={uiMock ? 'en' : 'km'}
              >
                {uiMock
                  ? 'Thank you. Your VIP subscription payment was completed.'
                  : 'VIP បានបើករួចហើយ · អាចអានជើង VIP បានហើយ'}
              </p>
              {!uiMock && viewerProfile?.vipActive ? (
                <div className="flex w-full flex-col gap-1 text-xs text-emerald-300/90" lang="km">
                  {vipCountdown ? (
                    <p className="tg-account-vip-expire__countdown">
                      <span className="tg-account-vip-expire__prefix">នៅសល់ ·</span>
                      <span className="tg-account-vip-expire__value tg-account-vip-expire__value--remaining tabular-nums">
                        {vipCountdown}
                      </span>
                    </p>
                  ) : null}
                  {vipExpireDateLabel ? (
                    <p className="tg-account-vip-expire__date">
                      <span className="tg-account-vip-expire__prefix">ផុតកំណត់ ·</span>
                      <span className="tg-account-vip-expire__value tg-account-vip-expire__value--expire tabular-nums">
                        {vipExpireDateLabel}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-[15px] font-semibold text-white/90" lang="km">
                {status === 'loading' ? 'កំពុងផ្ទៀងផ្ទាត់...' : message}
              </p>
              {viewerProfile?.vipActive ? (
                <div className="flex flex-col gap-1 text-xs text-emerald-300/90" lang="km">
                  <p>VIP សកម្ម · អាចអានជើង VIP បានហើយ</p>
                  {vipCountdown ? (
                    <p className="tg-account-vip-expire__countdown">
                      <span className="tg-account-vip-expire__prefix">នៅសល់ ·</span>
                      <span className="tg-account-vip-expire__value tg-account-vip-expire__value--remaining tabular-nums">
                        {vipCountdown}
                      </span>
                    </p>
                  ) : null}
                  {vipExpireDateLabel ? (
                    <p className="tg-account-vip-expire__date">
                      <span className="tg-account-vip-expire__prefix">ផុតកំណត់ ·</span>
                      <span className="tg-account-vip-expire__value tg-account-vip-expire__value--expire tabular-nums">
                        {vipExpireDateLabel}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          <div className="flex flex-col gap-2">
            <Link
              to="/"
              className={
                uiMock
                  ? 'tg-aba-success-page__btn tg-aba-success-page__btn--primary'
                  : 'inline-flex items-center justify-center rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-white'
              }
            >
              {uiMock ? 'Back to home' : 'រកសៀវភៅអាន'}
            </Link>
            <Link
              to={uiMock ? '/vip' : '/account'}
              className={
                uiMock
                  ? 'tg-aba-success-page__btn tg-aba-success-page__btn--secondary'
                  : 'inline-flex items-center justify-center rounded-full border border-emerald-200/40 bg-emerald-400/20 px-4 py-2 text-sm font-semibold text-emerald-50'
              }
            >
              {uiMock ? 'Back to VIP' : 'ទៅគណនី'}
            </Link>
            {!isSuccess && !uiMock ? (
              <Link
                to="/vip"
                className="inline-flex items-center justify-center rounded-full border border-amber-200/40 bg-amber-300/20 px-4 py-2 text-sm font-semibold text-amber-100"
              >
                ត្រឡប់ទៅ VIP
              </Link>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}
