import { useCallback, useEffect, useRef } from 'react'
import { isTelegramMiniApp } from '../lib/telegramWebApp.js'
import { clearVipAbaKhqrPendingPayment } from '../lib/vipAbaKhqrSession.js'
import { confirmViewerVipPayment } from '../lib/viewerProfileApi.js'

const POLL_MS = 4000
const SUCCESS_NAV_DELAY_MS = 2000

/**
 * Poll PayWay until VIP is active — used when user returns to Telegram after browser/ABA payment.
 * @param {{
 *   enabled?: boolean,
 *   tranId?: string,
 *   planId?: string,
 *   onSuccess?: () => void,
 * }} options
 */
export function useVipAbaKhqrPaymentConfirm(options = {}) {
  const { enabled = false, tranId = '', planId = '', onSuccess } = options
  const pollRef = useRef(0)
  const pendingSuccessRef = useRef(false)
  const successTimerRef = useRef(0)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess

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
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current)
      successTimerRef.current = 0
    }
    successTimerRef.current = window.setTimeout(() => {
      successTimerRef.current = 0
      onSuccessRef.current?.()
    }, SUCCESS_NAV_DELAY_MS)
  }, [stopPolling, tranId])

  const pollOnce = useCallback(async () => {
    const tid = String(tranId || '').trim()
    const pid = String(planId || '').trim()
    if (!enabled || !tid || pendingSuccessRef.current) return
    if (!isTelegramMiniApp()) return

    const result = await confirmViewerVipPayment({ tranId: tid, planId: pid })
    if (pendingSuccessRef.current) return
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
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current)
        successTimerRef.current = 0
      }
    }
  }, [enabled, stopPolling, tranId])

  return { pendingSuccess: pendingSuccessRef.current }
}
