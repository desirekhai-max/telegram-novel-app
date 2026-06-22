import { useCallback, useEffect, useRef } from 'react'
import { isTelegramMiniApp } from '../lib/telegramWebApp.js'
import { clearVipAbaKhqrPendingPayment } from '../lib/vipAbaKhqrSession.js'
import { confirmViewerVipPayment } from '../lib/viewerProfileApi.js'

const POLL_MS = 4000
const DEFAULT_RELEASE_AFTER_FAILED_POLLS = 5

/**
 * Poll PayWay until VIP is active — used when user returns to Telegram after browser/ABA payment.
 * @param {{
 *   enabled?: boolean,
 *   confirmingUiActive?: boolean,
 *   tranId?: string,
 *   planId?: string,
 *   onSuccess?: () => void,
 *   onReleaseConfirming?: () => void,
 *   releaseAfterFailedPolls?: number,
 * }} options
 */
export function useVipAbaKhqrPaymentConfirm(options = {}) {
  const {
    enabled = false,
    confirmingUiActive = false,
    tranId = '',
    planId = '',
    onSuccess,
    onReleaseConfirming,
    releaseAfterFailedPolls = DEFAULT_RELEASE_AFTER_FAILED_POLLS,
  } = options
  const pollRef = useRef(0)
  const pendingSuccessRef = useRef(false)
  const failedPollsRef = useRef(0)
  const onSuccessRef = useRef(onSuccess)
  const onReleaseConfirmingRef = useRef(onReleaseConfirming)
  onSuccessRef.current = onSuccess
  onReleaseConfirmingRef.current = onReleaseConfirming

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

    const result = await confirmViewerVipPayment({ tranId: tid, planId: pid })
    if (pendingSuccessRef.current) return
    if (result.ok && result.profile?.vipActive) {
      finishSuccess()
      return
    }

    if (!confirmingUiActive) return

    failedPollsRef.current += 1
    if (failedPollsRef.current >= releaseAfterFailedPolls) {
      onReleaseConfirmingRef.current?.()
    }
  }, [confirmingUiActive, enabled, finishSuccess, planId, tranId])

  const pollOnceRef = useRef(pollOnce)
  pollOnceRef.current = pollOnce

  useEffect(() => {
    if (confirmingUiActive) {
      failedPollsRef.current = 0
    }
  }, [confirmingUiActive, tranId])

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
      if (confirmingUiActive) failedPollsRef.current = 0
      void pollOnceRef.current()
    }

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [confirmingUiActive, enabled, stopPolling, tranId])

  return { pendingSuccess: pendingSuccessRef.current }
}
