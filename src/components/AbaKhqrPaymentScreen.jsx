import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { resolveKhqrAmountParts } from '../lib/abaKhqrAmount.js'
import { ABA_PAY_HEADER_LOGO_SRC } from '../lib/abaKhqrAssets.js'
import { formatKhqrPendingCountdown } from '../lib/vipAbaKhqrCountdown.js'

const KHQR_CARD_MERCHANT_NAME = '69KKH NOVEL'

/** 从银行返回时首帧 session 可能短暂缺图，保留上一张 QR 避免闪空 */
let lastKhqrImageSrc = ''

/**
 * KHQR 支付页 — PayWay qrImage 为唯一主视觉（图片内已含金额/商户/KHQR 信息）。
 */
export default function AbaKhqrPaymentScreen({
  session,
  statusNote = '',
  expiryRemainingMs = 0,
  onSimulatePaid,
  onQrReady,
  showDemoActions = false,
}) {
  const nextQrImage = String(session?.qrImage || '').trim()
  if (nextQrImage) lastKhqrImageSrc = nextQrImage
  const qrImage = nextQrImage || lastKhqrImageSrc
  const qrReadyNotifiedRef = useRef(false)
  const qrLoadedRef = useRef(false)
  const headerLoadedRef = useRef(false)
  const qrImgRef = useRef(null)
  const headerImgRef = useRef(null)

  const tryHandoffBootShell = useCallback(() => {
    if (qrReadyNotifiedRef.current || !onQrReady || !qrImage) return
    if (!qrLoadedRef.current || !headerLoadedRef.current) return
    qrReadyNotifiedRef.current = true
    onQrReady()
  }, [onQrReady, qrImage])

  const markQrLoaded = useCallback(() => {
    qrLoadedRef.current = true
    tryHandoffBootShell()
  }, [tryHandoffBootShell])

  const markHeaderLoaded = useCallback(() => {
    headerLoadedRef.current = true
    tryHandoffBootShell()
  }, [tryHandoffBootShell])

  useLayoutEffect(() => {
    if (!qrImage) return undefined
    const qrEl = qrImgRef.current
    const headerEl = headerImgRef.current
    if (qrEl?.complete && qrEl.naturalWidth > 0) qrLoadedRef.current = true
    if (headerEl?.complete && headerEl.naturalWidth > 0) headerLoadedRef.current = true
    tryHandoffBootShell()
    return undefined
  }, [qrImage, tryHandoffBootShell])

  const amountParts = useMemo(() => resolveKhqrAmountParts(session), [session])
  const amountValue = useMemo(() => {
    const n = Number(amountParts.value)
    return Number.isFinite(n) ? n.toFixed(2) : amountParts.value
  }, [amountParts.value])

  const showExpiry = Number(expiryRemainingMs) > 0

  return (
    <div className="tg-aba-khqr-page__panel">
      <div className="tg-aba-khqr-page__qr-wrap">
        {qrImage ? (
          <div className="tg-aba-khqr-page__qr-stack">
            <img
              ref={qrImgRef}
              src={qrImage}
              alt="KHQR"
              className="tg-aba-khqr-page__qr"
              decoding="sync"
              fetchPriority="high"
              draggable={false}
              onLoad={markQrLoaded}
            />
            <img
              ref={headerImgRef}
              src={ABA_PAY_HEADER_LOGO_SRC}
              alt=""
              className="tg-aba-khqr-page__header-logo"
              decoding="sync"
              fetchPriority="high"
              draggable={false}
              aria-hidden
              onLoad={markHeaderLoaded}
            />
            <span className="tg-aba-khqr-page__merchant-mask" aria-hidden />
            <div className="tg-aba-khqr-page__merchant-info">
              <p className="tg-aba-khqr-page__merchant-name" lang="en">
                {KHQR_CARD_MERCHANT_NAME}
              </p>
              <p className="tg-aba-khqr-page__merchant-amount" lang="en">
                <span className="tg-aba-khqr-page__merchant-amount-value">{amountValue}</span>
                <span className="tg-aba-khqr-page__merchant-amount-currency">
                  {' '}
                  {amountParts.currency}
                </span>
              </p>
            </div>
            <p className="tg-aba-khqr-page__scan-hint" lang="en">
              Scan with ABA Mobile or any KHQR
              <br />
              supported banking app
            </p>
          </div>
        ) : (
          <div className="tg-aba-khqr-page__qr-stack tg-aba-khqr-page__qr-stack--placeholder" aria-hidden />
        )}
      </div>

      {showExpiry ? (
        <p className="tg-aba-khqr-page__expiry" lang="km" aria-live="polite">
          QR នេះមានសុពលភាព ៥ នាទី
          {' · '}
          នៅសល់ {formatKhqrPendingCountdown(expiryRemainingMs)}
        </p>
      ) : null}

      {statusNote ? (
        <p className="tg-aba-khqr-page__status" lang="km">
          {statusNote}
        </p>
      ) : null}

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
