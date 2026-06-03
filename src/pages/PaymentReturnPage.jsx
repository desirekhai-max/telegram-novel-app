import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { getVipPlanForPurchase } from '../data/vipPlansCatalog.js'
import { useTelegramUser } from '../hooks/useTelegramUser.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'
import {
  readVipPaymentFulfillmentHint,
} from '../lib/vipPaymentResultState.js'
import { confirmViewerVipPayment } from '../lib/viewerProfileApi.js'
import { clearVipAbaKhqrSession } from '../lib/vipAbaKhqrSession.js'

function resolvePlanDurationHours(planId, role) {
  const hours = Number(getVipPlanForPurchase(planId, role)?.durationHours)
  return Number.isFinite(hours) && hours > 0 ? hours : 0
}

/** A — ABA API / Webhook 自动确认成功 */
function VipAutoPaymentSuccessResult({ durationHours }) {
  return (
    <div className="tg-aba-success-card">
      <span className="tg-aba-success-card__icon" aria-hidden>
        ✅
      </span>
      <h2 className="tg-aba-success-card__title" lang="km">
        បើកសមាជិក VIP បានជោគជ័យ
      </h2>
      <p className="tg-aba-success-card__subtitle" lang="km">
        សមាជិក VIP របស់អ្នកត្រូវបានបើកដោយជោគជ័យ
      </p>
      {durationHours > 0 ? (
        <p className="tg-aba-success-card__subtitle tg-aba-success-card__subtitle--validity" lang="km">
          សុពលភាព {durationHours} ម៉ោង
        </p>
      ) : null}
    </div>
  )
}

/** B — 后台人工审核确认成功 */
function VipManualPaymentSuccessResult({ durationHours }) {
  return (
    <div className="tg-aba-success-card">
      <span className="tg-aba-success-card__icon" aria-hidden>
        ✅
      </span>
      <h2 className="tg-aba-success-card__title" lang="km">
        បើកសមាជិក VIP បានជោគជ័យ
      </h2>
      <p className="tg-aba-success-card__subtitle" lang="km">
        សមាជិក VIP របស់អ្នកត្រូវបានបើកដោយជោគជ័យ
      </p>
      {durationHours > 0 ? (
        <p className="tg-aba-success-card__subtitle tg-aba-success-card__subtitle--validity" lang="km">
          សុពលភាព {durationHours} ម៉ោង
        </p>
      ) : null}
    </div>
  )
}

/** C — 人工审核拒绝 / 审核失败 */
function VipPaymentRejectedResult() {
  return (
    <div className="tg-aba-success-card">
      <span className="tg-aba-success-card__icon tg-aba-success-card__icon--fail" aria-hidden>
        ❌
      </span>
      <h2 className="tg-aba-success-card__title" lang="km">
        ការទូទាត់មិនបានជោគជ័យ
      </h2>
      <p className="tg-aba-success-card__subtitle" lang="km">
        សូមព្យាយាមម្ដងទៀត ឬជ្រើសរើសវិធីបង់ប្រាក់ផ្សេង
      </p>
    </div>
  )
}

function VipPaymentSuccessActions() {
  return (
    <>
      <Link to="/" className="tg-aba-success-page__btn tg-aba-success-page__btn--primary" lang="km">
        ចាប់ផ្ដើមអាន
      </Link>
      <Link to="/" className="tg-aba-success-page__btn tg-aba-success-page__btn--secondary" lang="km">
        ត្រឡប់ទៅទំព័រដើម
      </Link>
    </>
  )
}

function VipPaymentRejectedActions() {
  return (
    <>
      <Link to="/vip" className="tg-aba-success-page__btn tg-aba-success-page__btn--primary" lang="km">
        ព្យាយាមម្ដងទៀត
      </Link>
      <Link to="/vip" className="tg-aba-success-page__btn tg-aba-success-page__btn--secondary" lang="km">
        ត្រឡប់ទៅសមាជិក VIP
      </Link>
    </>
  )
}

export default function PaymentReturnPage() {
  const [searchParams] = useSearchParams()
  const tgUser = useTelegramUser()
  const { viewerProfile, refreshViewerProfile } = useViewerProfile()
  const [viewState, setViewState] = useState('loading')
  const [statusMessage, setStatusMessage] = useState('')

  const uiMock = searchParams.get('ui_mock') === '1'
  const tranId = String(searchParams.get('tran_id') || searchParams.get('tranId') || '').trim()
  const planId = String(searchParams.get('plan_id') || searchParams.get('planId') || '').trim()
  const fulfillmentHint = readVipPaymentFulfillmentHint(searchParams)

  const durationHours = useMemo(
    () => resolvePlanDurationHours(planId, viewerProfile.role),
    [planId, viewerProfile.role],
  )

  useEffect(() => {
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
      setViewState(fulfillmentHint === 'manual' ? 'manual_success' : 'auto_success')
      setStatusMessage('')
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
        await refreshViewerProfile()
        setViewState(fulfillmentHint === 'manual' ? 'manual_success' : 'auto_success')
        setStatusMessage('')
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
  }, [tgUser?.id, tranId, planId, refreshViewerProfile, uiMock, fulfillmentHint])

  const showSuccessActions = viewState === 'auto_success' || viewState === 'manual_success'
  const showRejectedActions = viewState === 'rejected'

  return (
    <div className="tg-app tg-app--account tg-aba-success-page">
      <BrandTabToolbar title="លទ្ធផលបង់ប្រាក់" titleLang="km" titleClassName="text-[16px]" />
      <main className="tg-list-wrap tg-account-scroll tg-aba-success-page__main flex flex-1">
        <section className="tg-aba-success-page__content">
          {viewState === 'auto_success' ? (
            <VipAutoPaymentSuccessResult durationHours={durationHours} />
          ) : null}
          {viewState === 'manual_success' ? (
            <VipManualPaymentSuccessResult durationHours={durationHours} />
          ) : null}
          {viewState === 'rejected' ? <VipPaymentRejectedResult /> : null}
          {viewState === 'loading' ||
          viewState === 'pending' ||
          viewState === 'need_login' ||
          viewState === 'missing_tran' ||
          viewState === 'error' ? (
            <p className="text-[15px] font-semibold text-slate-700" lang="km">
              {viewState === 'loading' ? 'កំពុងផ្ទៀងផ្ទាត់…' : statusMessage}
            </p>
          ) : null}

          <div className="tg-aba-success-page__actions">
            {showSuccessActions ? <VipPaymentSuccessActions /> : null}
            {showRejectedActions ? <VipPaymentRejectedActions /> : null}
            {viewState === 'pending' || viewState === 'error' ? (
              <Link
                to="/vip"
                className="tg-aba-success-page__btn tg-aba-success-page__btn--secondary"
                lang="km"
              >
                ត្រឡប់ទៅសមាជិក VIP
              </Link>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}
