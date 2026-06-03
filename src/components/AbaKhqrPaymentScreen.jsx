import { getVipPlanForPurchase } from '../data/vipPlansCatalog.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'
import { ABA_KHQR_MOCK_QR_DATA_URL } from '../lib/abaKhqrUiMock.js'

function resolveKhqrPlanTitleKm(session, role) {
  const saved = String(session?.planTitleKm || '').trim()
  if (saved) return saved
  const planId = String(session?.planId || '').trim()
  if (!planId) return ''
  return String(getVipPlanForPurchase(planId, role)?.titleKm || '').trim()
}

function formatDisplayAmount(session) {
  const label = String(session?.amountLabel || '').trim()
  if (label) return label.startsWith('$') ? label : `$ ${label.replace(/^\$/, '')}`
  const n = Number(session?.amount)
  if (Number.isFinite(n) && n > 0) return `$ ${n.toFixed(2)}`
  return '$ —'
}

/**
 * Figma Payment Screen — template3_color style KHQR card.
 * @param {{ session: { planId?: string, planTitleKm?: string, amountLabel?: string, amount?: number, qrImage?: string }, onSimulatePaid?: () => void, showDemoActions?: boolean }} props
 */
export default function AbaKhqrPaymentScreen({
  session,
  onSimulatePaid,
  showDemoActions = false,
}) {
  const { viewerProfile } = useViewerProfile()
  const planTitleKm = resolveKhqrPlanTitleKm(session, viewerProfile.role)
  const qrSrc =
    String(session?.qrImage || '').trim() || ABA_KHQR_MOCK_QR_DATA_URL

  return (
    <div className="tg-aba-khqr-page__panel">
      <header className="tg-aba-khqr-page__brand-row" lang="en" aria-label="ABA PAY">
        <span className="tg-aba-khqr-page__brand-aba">ABA</span>
        <span className="tg-aba-khqr-page__brand-pay">&apos; PAY</span>
      </header>

      <article className="tg-aba-khqr-card">
        <div className="tg-aba-khqr-card__header">
          <span className="tg-aba-khqr-card__khqr-logo">KHQR</span>
        </div>
        <div className="tg-aba-khqr-card__body">
          <p className="tg-aba-khqr-card__merchant" lang="km">
            {planTitleKm}
          </p>
          <p className="tg-aba-khqr-card__amount">{formatDisplayAmount(session)}</p>
          <div className="tg-aba-khqr-card__divider" aria-hidden />
          <div className="tg-aba-khqr-card__qr-wrap">
            <img src={qrSrc} alt="KHQR" className="tg-aba-khqr-card__qr" decoding="async" draggable={false} />
          </div>
          <p className="tg-aba-khqr-card__hint" lang="km">
            ស្កេនដោយ ABA Mobile ឬកម្មវិធីធនាគារដែលគាំទ្រ KHQR
          </p>
        </div>
      </article>

      {showDemoActions ? (
        <div className="tg-aba-khqr-page__demo-actions">
          <button type="button" className="tg-aba-khqr-page__simulate-btn" lang="km" onClick={onSimulatePaid}>
            សាកល្បងការទូទាត់ជោគជ័យ
          </button>
          <p className="tg-aba-khqr-page__demo-note" lang="km">
            សម្រាប់ការសាកល្បង UI ប៉ុណ្ណោះ
          </p>
        </div>
      ) : null}
    </div>
  )
}
