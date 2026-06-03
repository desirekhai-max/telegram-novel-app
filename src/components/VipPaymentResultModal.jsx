import { CheckCircle2, X, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

/** @typedef {'auto_success' | 'manual_success' | 'rejected'} VipPaymentResultView */

/** A — ABA API / Webhook 自动确认成功 */
function VipAutoPaymentSuccessBody({ durationHours }) {
  return (
    <div className="tg-vip-result-modal__content">
      <div className="tg-vip-result-modal__icon-wrap tg-vip-result-modal__icon-wrap--success" aria-hidden>
        <CheckCircle2 size={28} strokeWidth={2.25} />
      </div>
      <h2 className="tg-vip-result-modal__title" lang="km">
        បើកសមាជិក VIP បានជោគជ័យ
      </h2>
      <p className="tg-vip-result-modal__subtitle" lang="km">
        សមាជិក VIP របស់អ្នកត្រូវបានបើកដោយជោគជ័យ
      </p>
      {durationHours > 0 ? (
        <p className="tg-vip-result-modal__validity" lang="km">
          <span className="tg-vip-result-modal__validity-label">សុពលភាព</span>
          <span className="tg-vip-result-modal__validity-value">{durationHours} ម៉ោង</span>
        </p>
      ) : null}
    </div>
  )
}

/** B — 后台人工审核确认成功 */
function VipManualPaymentSuccessBody({ durationHours }) {
  return (
    <div className="tg-vip-result-modal__content">
      <div className="tg-vip-result-modal__icon-wrap tg-vip-result-modal__icon-wrap--success" aria-hidden>
        <CheckCircle2 size={28} strokeWidth={2.25} />
      </div>
      <h2 className="tg-vip-result-modal__title" lang="km">
        បើកសមាជិក VIP បានជោគជ័យ
      </h2>
      <p className="tg-vip-result-modal__subtitle" lang="km">
        សមាជិក VIP របស់អ្នកត្រូវបានបើកដោយជោគជ័យ
      </p>
      {durationHours > 0 ? (
        <p className="tg-vip-result-modal__validity" lang="km">
          <span className="tg-vip-result-modal__validity-label">សុពលភាព</span>
          <span className="tg-vip-result-modal__validity-value">{durationHours} ម៉ោង</span>
        </p>
      ) : null}
    </div>
  )
}

/** C — 人工审核拒绝 / 审核失败 */
function VipPaymentRejectedBody() {
  return (
    <div className="tg-vip-result-modal__content">
      <div className="tg-vip-result-modal__icon-wrap tg-vip-result-modal__icon-wrap--fail" aria-hidden>
        <XCircle size={28} strokeWidth={2.25} />
      </div>
      <h2 className="tg-vip-result-modal__title" lang="km">
        ការទូទាត់មិនបានជោគជ័យ
      </h2>
      <p className="tg-vip-result-modal__subtitle" lang="km">
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
    <div className="tg-vip-result-modal" role="dialog" aria-modal="true" lang="km">
      <button
        type="button"
        className="tg-vip-result-modal__backdrop"
        onClick={onClose}
        aria-label="បិទ"
      />
      <div
        className={[
          'tg-vip-result-modal__sheet',
          isSuccess ? 'tg-vip-result-modal__sheet--success' : '',
          isRejected ? 'tg-vip-result-modal__sheet--fail' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type="button"
          className="tg-vip-result-modal__close"
          onClick={onClose}
          aria-label="បិទ"
        >
          <X size={17} strokeWidth={2.25} aria-hidden />
        </button>

        {viewState === 'auto_success' ? (
          <VipAutoPaymentSuccessBody durationHours={durationHours} />
        ) : null}
        {viewState === 'manual_success' ? (
          <VipManualPaymentSuccessBody durationHours={durationHours} />
        ) : null}
        {isRejected ? <VipPaymentRejectedBody /> : null}

        <div className="tg-vip-result-modal__actions">
          {isSuccess ? (
            <>
              <Link
                to="/"
                className="tg-vip-result-modal__btn tg-vip-result-modal__btn--primary"
                lang="km"
                onClick={onClose}
              >
                ចាប់ផ្ដើមអាន
              </Link>
              <Link
                to="/"
                className="tg-vip-result-modal__btn tg-vip-result-modal__btn--ghost"
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
                className="tg-vip-result-modal__btn tg-vip-result-modal__btn--primary"
                lang="km"
                onClick={onClose}
              >
                ព្យាយាមម្ដងទៀត
              </Link>
              <Link
                to="/vip"
                className="tg-vip-result-modal__btn tg-vip-result-modal__btn--ghost"
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
