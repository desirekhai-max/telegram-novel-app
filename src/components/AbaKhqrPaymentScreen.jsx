import { Download } from 'lucide-react'
import { useCallback, useState } from 'react'
import { formatKhqrUsdSummary, resolveKhqrAmountParts } from '../lib/abaKhqrAmount.js'
import { downloadKhqrQrImage } from '../lib/abaKhqrDownload.js'
import { ABA_KHQR_MOCK_QR_DATA_URL, isUiMockAbaKhqrSession } from '../lib/abaKhqrUiMock.js'
import { KHQR_LOGO_HEIGHT, KHQR_LOGO_SRC, KHQR_LOGO_WIDTH } from '../lib/abaKhqrAssets.js'

const KHQR_MERCHANT_LABEL = '69KKH NOVEL'

/**
 * KHQR 支付页 — template3 样式卡片 + 动态金额/二维码。
 */
export default function AbaKhqrPaymentScreen({
  session,
  onSimulatePaid,
  showDemoActions = false,
}) {
  const amountParts = resolveKhqrAmountParts(session)
  const amountSummary = formatKhqrUsdSummary(amountParts)
  const qrSrc = isUiMockAbaKhqrSession(session)
    ? ABA_KHQR_MOCK_QR_DATA_URL
    : String(session?.qrImage || '').trim() || ABA_KHQR_MOCK_QR_DATA_URL
  const [downloadPending, setDownloadPending] = useState(false)

  const handleDownloadQr = useCallback(async () => {
    if (downloadPending) return
    setDownloadPending(true)
    try {
      await downloadKhqrQrImage(qrSrc)
    } finally {
      setDownloadPending(false)
    }
  }, [downloadPending, qrSrc])

  return (
    <div className="tg-aba-khqr-page__panel">
      <article className="tg-aba-khqr-card tg-aba-khqr-card--template3">
        <div className="tg-aba-khqr-card__header">
          <img
            src={KHQR_LOGO_SRC}
            alt="KHQR"
            className="tg-aba-khqr-card__khqr-logo"
            width={KHQR_LOGO_WIDTH}
            height={KHQR_LOGO_HEIGHT}
            decoding="sync"
            fetchPriority="high"
            draggable={false}
          />
        </div>
        <div className="tg-aba-khqr-card__body">
          <div className="tg-aba-khqr-card__info">
            <p className="tg-aba-khqr-card__merchant" lang="en">
              {KHQR_MERCHANT_LABEL}
            </p>
            <p className="tg-aba-khqr-card__amount" lang="en">
              <span className="tg-aba-khqr-card__amount-value">{amountParts.value}</span>
              <span className="tg-aba-khqr-card__amount-currency"> {amountParts.currency}</span>
            </p>
          </div>
          <div className="tg-aba-khqr-card__divider" aria-hidden />
          <div className="tg-aba-khqr-card__qr-wrap">
            <img
              src={qrSrc}
              alt="KHQR"
              className="tg-aba-khqr-card__qr"
              decoding="async"
              draggable={false}
            />
          </div>
        </div>
      </article>

      <div className="tg-aba-khqr-page__scan-block">
        <p className="tg-aba-khqr-page__scan-title" lang="en">
          Scan to Pay
        </p>
        <p className="tg-aba-khqr-page__scan-or" lang="en">
          or
        </p>
        <button
          type="button"
          className="tg-aba-khqr-page__download-btn"
          disabled={downloadPending}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void handleDownloadQr()
          }}
        >
          <Download size={18} strokeWidth={2.25} aria-hidden />
          <span lang="en">Download QR</span>
        </button>
        <p className="tg-aba-khqr-page__scan-hint" lang="en">
          and upload to Mobile Banking app
          <br />
          supporting KHQR
        </p>
      </div>

      <div className="tg-aba-khqr-page__summary" aria-label="Payment summary">
        <div className="tg-aba-khqr-page__summary-row">
          <span lang="en">Subtotal:</span>
          <span lang="en">{amountSummary}</span>
        </div>
        <div className="tg-aba-khqr-page__summary-divider" aria-hidden />
        <div className="tg-aba-khqr-page__summary-row tg-aba-khqr-page__summary-row--total">
          <span lang="en">TOTAL:</span>
          <span lang="en">{amountSummary}</span>
        </div>
      </div>

      {showDemoActions ? (
        <div className="tg-aba-khqr-page__demo-actions">
          <button
            type="button"
            className="tg-aba-khqr-page__demo-simulate-btn"
            lang="km"
            onClick={onSimulatePaid}
          >
            សាកល្បងការទូទាត់ជោគជ័យ
          </button>
        </div>
      ) : null}
    </div>
  )
}
