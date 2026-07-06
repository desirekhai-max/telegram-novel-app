import { useCallback, useEffect, useRef } from 'react'
import { isTelegramMiniApp } from '../lib/telegramWebApp.js'
import { subscribeVipCheckTransactionPoll } from '../lib/vipCheckTransactionPollCoordinator.js'

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
  const pendingSuccessRef = useRef(false)
  const deferredSuccessRef = useRef(false)
  const deliveredSuccessRef = useRef(false)
  const onSuccessRef = useRef(onSuccess)
  const onExpiredRef = useRef(onExpired)
  onSuccessRef.current = onSuccess
  onExpiredRef.current = onExpired

  const deliverSuccess = useCallback(() => {
    if (deliveredSuccessRef.current) return
    deliveredSuccessRef.current = true
    deferredSuccessRef.current = false
    pendingSuccessRef.current = true
    onSuccessRef.current?.()
  }, [])

  const finishSuccess = useCallback(() => {
    if (pendingSuccessRef.current || deliveredSuccessRef.current) return
    pendingSuccessRef.current = true
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      deferredSuccessRef.current = true
      return
    }
    deliverSuccess()
  }, [deliverSuccess])

  useEffect(() => {
    pendingSuccessRef.current = false
    deferredSuccessRef.current = false
    deliveredSuccessRef.current = false

    const tid = String(tranId || '').trim()
    if (!enabled || !tid || !isTelegramMiniApp()) {
      return undefined
    }

    const unsubscribe = subscribeVipCheckTransactionPoll(tid, planId, (result) => {
      if (pendingSuccessRef.current || deliveredSuccessRef.current) return
      if (result.error === 'payment_expired') {
        onExpiredRef.current?.()
        return
      }
      if (isKhqrPaymentFulfilled(result)) {
        finishSuccess()
      }
    })

    const onVisible = () => {
      if (deferredSuccessRef.current) {
        deliverSuccess()
      }
    }

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [deliverSuccess, enabled, finishSuccess, planId, tranId])

  return { pendingSuccess: pendingSuccessRef.current }
}
