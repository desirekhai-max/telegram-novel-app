import { X } from 'lucide-react'
import { Link } from 'react-router-dom'

/** @typedef {'auto_success' | 'manual_success' | 'rejected'} VipPaymentResultView */

function VipAutoPaymentSuccessBody({ durationHours }) {
  return (
    <div className="tg-aba-success-card tg-aba-success-card--modal">
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

function VipManualPaymentSuccessBody({ durationHours }) {
  return (
    <div className="tg-aba-success-card tg-aba-success-card--modal">
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

function VipPaymentRejectedBody() {
  return (
    <div className="tg-aba-success-card tg-aba-success-card--modal">
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

/**
 * @param {{
 *   open: boolean,
 *   viewState: VipPaymentResultView | null | undefined,
 *   durationHours?: number,
 *   onClose: () => void,
 * }} props
 */
export default function VipPaymentResultModal({ open, viewState, durationHours = 0, onClose }) {
  if (!open || !viewState) return null

  const isSuccess = viewState === 'auto_success' || viewState === 'manual_success'
  const isRejected = viewState === 'rejected'

  return (
    <div className="tg-vip-payment-result-modal" role="dialog" aria-modal="true" lang="km">
      <button
        type="button"
        className="tg-vip-payment-result-modal__backdrop"
        onClick={onClose}
        aria-label="បិទ"
      />
      <div className="tg-vip-payment-result-modal__panel">
        <button
          type="button"
          className="tg-vip-payment-result-modal__close"
          onClick={onClose}
          aria-label="បិទ"
        >
          <X size={18} strokeWidth={2.25} aria-hidden />
        </button>

        {viewState === 'auto_success' ? (
          <VipAutoPaymentSuccessBody durationHours={durationHours} />
        ) : null}
        {viewState === 'manual_success' ? (
          <VipManualPaymentSuccessBody durationHours={durationHours} />
        ) : null}
        {isRejected ? <VipPaymentRejectedBody /> : null}

        <div className="tg-aba-success-page__actions">
          {isSuccess ? (
            <>
              <Link
                to="/"
                className="tg-aba-success-page__btn tg-aba-success-page__btn--primary"
                lang="km"
                onClick={onClose}
              >
                ចាប់ផ្ដើមអាន
              </Link>
              <Link
                to="/"
                className="tg-aba-success-page__btn tg-aba-success-page__btn--secondary"
                lang="km"
                onClick={onClose}
              >
                ត្រឡប់ទៅទំព័រដើម
              </Link>
            </>
          ) : null}
          {isRejected ? (
            <>
              <Link
                to="/vip"
                className="tg-aba-success-page__btn tg-aba-success-page__btn--primary"
                lang="km"
                onClick={onClose}
              >
                ព្យាយាមម្ដងទៀត
              </Link>
              <Link
                to="/vip"
                className="tg-aba-success-page__btn tg-aba-success-page__btn--secondary"
                lang="km"
                onClick={onClose}
              >
                ត្រឡប់ទៅសមាជិក VIP
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
