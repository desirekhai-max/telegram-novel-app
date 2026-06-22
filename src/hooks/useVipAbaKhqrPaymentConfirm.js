import { useCallback, useEffect, useRef } from 'react'
import { isTelegramMiniApp } from '../lib/telegramWebApp.js'
import { clearVipAbaKhqrPendingPayment, getActiveVipAbaKhqrPendingExpiry } from '../lib/vipAbaKhqrSession.js'
import { confirmViewerVipPayment } from '../lib/viewerProfileApi.js'

const POLL_MS = 4000

/**
 * Poll PayWay until VIP is active — used when user returns to Telegram after browser/ABA payment.
 * Confirming UI stays up until payment succeeds or the 2-minute pending TTL expires.
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
  const onSuccessRef = useRef(onSuccess)
  const onExpiredRef = useRef(onExpired)
  onSuccessRef.current = onSuccess
  onExpiredRef.current = onExpired

  const stopPolling = useCallback(() => {
    if (!pollRef.current) return
    window.clearInterval(pollRef.current)
    pollRef.current = 0
  }, [])

  const finishSuccess = useCallback(() => {
    if (pendingSuccessRef.current) return
    pendingSuccessRef.current = true
    stopPolling()
    clearVipAbaKhqrPendingPayment(tranId)
    onSuccessRef.current?.()
  }, [stopPolling, tranId])

  const pollOnce = useCallback(async () => {
    const tid = String(tranId || '').trim()
    const pid = String(planId || '').trim()
    if (!enabled || !tid || pendingSuccessRef.current) return
    if (!isTelegramMiniApp()) return

    const expiry = getActiveVipAbaKhqrPendingExpiry(tid)
    if (!expiry || expiry.remainingMs <= 0) {
      onExpiredRef.current?.()
      return
    }

    const result = await confirmViewerVipPayment({ tranId: tid, planId: pid })
    if (pendingSuccessRef.current) return
    if (result.error === 'payment_expired') {
      onExpiredRef.current?.()
      return
    }
    if (result.ok && result.profile?.vipActive) {
      finishSuccess()
    }
  }, [enabled, finishSuccess, planId, tranId])

  const pollOnceRef = useRef(pollOnce)
  pollOnceRef.current = pollOnce

  useEffect(() => {
    pendingSuccessRef.current = false
    if (!enabled || !String(tranId || '').trim()) {
      stopPolling()
      return undefined
    }
    if (!isTelegramMiniApp()) return undefined

    void pollOnceRef.current()

    pollRef.current = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (pendingSuccessRef.current) return
      void pollOnceRef.current()
    }, POLL_MS)

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (pendingSuccessRef.current) return
      void pollOnceRef.current()
    }

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, stopPolling, tranId])

  return { pendingSuccess: pendingSuccessRef.current }
}
