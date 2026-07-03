import { useCallback, useEffect, useRef } from 'react'
import { isTelegramMiniApp } from '../lib/telegramWebApp.js'
import { getActiveVipAbaKhqrPendingExpiry } from '../lib/vipAbaKhqrSession.js'
import { confirmViewerVipPayment } from '../lib/viewerProfileApi.js'

const POLL_MS = 4000

function isKhqrPaymentFulfilled(result) {
  return Boolean(result?.ok && (result?.order?.id || result?.alreadyFulfilled))
}

/**
 * Poll PayWay until VIP is active — used when user returns to Telegram after browser/ABA payment.
 * Confirming UI stays up until payment succeeds or the 5-minute pending TTL expires.
 * @param {{
 *   enabled?: boolean,
 *   tranId?: string,
 *   planId?: string,
 *   onSuccess?: () => void,
 *   onExpired?: () => void,
 * }} options
 */
export function useVipAbaKhqrPaymentConfirm(options = {}) {
  const {
    enabled = false,
    tranId = '',
    planId = '',
    onSuccess,
    onExpired,
  } = options
  const pollRef = useRef(0)
  const pendingSuccessRef = useRef(false)
  const deferredSuccessRef = useRef(false)
  const deliveredSuccessRef = useRef(false)
  const onSuccessRef = useRef(onSuccess)
  const onExpiredRef = useRef(onExpired)
  onSuccessRef.current = onSuccess
  onExpiredRef.current = onExpired

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = 0
    }
  }, [])

  const deliverSuccess = useCallback(() => {
    if (deliveredSuccessRef.current) return
    deliveredSuccessRef.current = true
    deferredSuccessRef.current = false
    pendingSuccessRef.current = true
    stopPolling()
    onSuccessRef.current?.()
  }, [stopPolling])

  const finishSuccess = useCallback(() => {
    if (pendingSuccessRef.current || deliveredSuccessRef.current) return
    pendingSuccessRef.current = true
    stopPolling()
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      deferredSuccessRef.current = true
      return
    }
    deliverSuccess()
  }, [deliverSuccess, stopPolling])

  const pollOnce = useCallback(async () => {
    const tid = String(tranId || '').trim()
    const pid = String(planId || '').trim()
    if (!enabled || !tid || pendingSuccessRef.current || deliveredSuccessRef.current) return
    if (!isTelegramMiniApp()) return

    const expiry = getActiveVipAbaKhqrPendingExpiry(tid)
    if (!expiry || expiry.remainingMs <= 0) {
      onExpiredRef.current?.()
      return
    }

    const result = await confirmViewerVipPayment({ tranId: tid, planId: pid, strictVerify: true })
    if (pendingSuccessRef.current || deliveredSuccessRef.current) return
    if (result.error === 'payment_expired') {
      onExpiredRef.current?.()
      return
    }
    if (isKhqrPaymentFulfilled(result)) {
      finishSuccess()
    }
  }, [enabled, finishSuccess, planId, tranId])

  const pollOnceRef = useRef(pollOnce)
  pollOnceRef.current = pollOnce

  useEffect(() => {
    pendingSuccessRef.current = false
    deferredSuccessRef.current = false
    deliveredSuccessRef.current = false
    if (!enabled || !String(tranId || '').trim()) {
      stopPolling()
      return undefined
    }
    if (!isTelegramMiniApp()) return undefined

    void pollOnceRef.current()

    pollRef.current = window.setInterval(() => {
      if (pendingSuccessRef.current || deliveredSuccessRef.current) return
      void pollOnceRef.current()
    }, POLL_MS)

    const onVisible = () => {
      if (deferredSuccessRef.current) {
        deliverSuccess()
        return
      }
      if (document.visibilityState !== 'visible') return
      if (pendingSuccessRef.current || deliveredSuccessRef.current) return
    }

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [deliverSuccess, enabled, stopPolling, tranId, planId])

  return { pendingSuccess: pendingSuccessRef.current }
}
