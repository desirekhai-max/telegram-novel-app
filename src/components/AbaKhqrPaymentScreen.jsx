import { ABA_KHQR_MOCK_QR_DATA_URL } from '../lib/abaKhqrUiMock.js'

function formatDisplayAmount(session) {
  const label = String(session?.amountLabel || '').trim()
  if (label) return label.startsWith('$') ? label : `$ ${label.replace(/^\$/, '')}`
  const n = Number(session?.amount)
  if (Number.isFinite(n) && n > 0) return `$ ${n.toFixed(2)}`
  return '$ —'
}

/**
 * Figma Payment Screen — template3_color style KHQR card.
 * @param {{ session: { merchantLabel?: string, amountLabel?: string, amount?: number, qrImage?: string }, onSimulatePaid?: () => void, showDemoActions?: boolean }} props
 */
export default function AbaKhqrPaymentScreen({
  session,
  onSimulatePaid,
  showDemoActions = false,
}) {
  const qrSrc =
    String(session?.qrImage || '').trim() || ABA_KHQR_MOCK_QR_DATA_URL

  return (
    <>
      <header className="tg-aba-khqr-page__brand-row" lang="en" aria-label="ABA PAY">
        <span className="tg-aba-khqr-page__brand-aba">ABA</span>
        <span className="tg-aba-khqr-page__brand-pay">&apos; PAY</span>
      </header>

      <article className="tg-aba-khqr-card">
        <div className="tg-aba-khqr-card__header">
          <span className="tg-aba-khqr-card__khqr-logo">KHQR</span>
        </div>
        <div className="tg-aba-khqr-card__body">
          <p className="tg-aba-khqr-card__merchant">{session?.merchantLabel || 'VIP-Subscription'}</p>
          <p className="tg-aba-khqr-card__amount">{formatDisplayAmount(session)}</p>
          <div className="tg-aba-khqr-card__divider" aria-hidden />
          <div className="tg-aba-khqr-card__qr-wrap">
            <img src={qrSrc} alt="KHQR" className="tg-aba-khqr-card__qr" decoding="async" draggable={false} />
          </div>
          <p className="tg-aba-khqr-card__hint" lang="en">
            Scan with ABA Mobile or any KHQR supported banking app
          </p>
        </div>
      </article>

      {showDemoActions ? (
        <div className="tg-aba-khqr-page__demo-actions">
          <button type="button" className="tg-aba-khqr-page__simulate-btn" onClick={onSimulatePaid}>
            Simulate payment success
          </button>
          <p className="tg-aba-khqr-page__demo-note" lang="en">
            UI demo only — for ABA Figma review recording
          </p>
        </div>
      ) : null}
    </>
  )
}
