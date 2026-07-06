import { getActiveVipAbaKhqrPendingExpiry } from './vipAbaKhqrSession.js'
import { confirmViewerVipPayment } from './viewerProfileApi.js'

export const VIP_CHECK_TRANSACTION_POLL_MS = 4000
export const VIP_CHECK_TRANSACTION_MAX_MS = 5 * 60 * 1000

function isKhqrPaymentFulfilled(result) {
  return Boolean(result?.ok && (result?.order?.id || result?.alreadyFulfilled))
}

/** @type {Map<string, {
 *   tranId: string,
 *   planId: string,
 *   listeners: Set<(result: object) => void>,
 *   timerId: number,
 *   startedAt: number,
 *   lastTickStartedAt: number,
 *   stopped: boolean,
 *   inFlight: boolean,
 * }>} */
const sessions = new Map()

function clearTimer(session) {
  if (session.timerId) {
    window.clearTimeout(session.timerId)
    session.timerId = 0
  }
}

function destroySession(tranId) {
  const session = sessions.get(tranId)
  if (!session) return
  clearTimer(session)
  session.stopped = true
  sessions.delete(tranId)
}

function notifyListeners(session, result) {
  for (const listener of session.listeners) {
    listener(result)
  }
}

function scheduleNext(session) {
  if (session.stopped) return
  clearTimer(session)
  const nextAt = Math.max(
    Date.now(),
    Number(session.lastTickStartedAt || 0) + VIP_CHECK_TRANSACTION_POLL_MS,
  )
  session.timerId = window.setTimeout(() => {
    session.timerId = 0
    void tick(session)
  }, nextAt - Date.now())
}

async function tick(session) {
  if (session.stopped || session.inFlight) return
  session.lastTickStartedAt = Date.now()

  const expiry = getActiveVipAbaKhqrPendingExpiry(session.tranId)
  const withinPendingTtl = Boolean(expiry && expiry.remainingMs > 0)
  const withinMaxWait = Date.now() - session.startedAt < VIP_CHECK_TRANSACTION_MAX_MS

  if (!withinPendingTtl && !withinMaxWait) {
    notifyListeners(session, { ok: false, error: 'payment_expired' })
    destroySession(session.tranId)
    return
  }

  if (!withinMaxWait) {
    notifyListeners(session, { ok: false, error: 'payment_expired' })
    destroySession(session.tranId)
    return
  }

  session.inFlight = true
  try {
    const result = await confirmViewerVipPayment({
      tranId: session.tranId,
      planId: session.planId,
      strictVerify: true,
    })
    if (session.stopped) return

    notifyListeners(session, result)

    if (result.error === 'payment_expired') {
      destroySession(session.tranId)
      return
    }
    if (isKhqrPaymentFulfilled(result)) {
      destroySession(session.tranId)
      return
    }
  } finally {
    session.inFlight = false
  }

  if (!session.stopped) {
    scheduleNext(session)
  }
}

/**
 * One active Check Transaction poll per tran_id. Multiple subscribers share the same timer chain.
 * @param {string} tranId
 * @param {string} planId
 * @param {(result: object) => void} listener
 * @returns {() => void}
 */
export function subscribeVipCheckTransactionPoll(tranId, planId, listener) {
  const tid = String(tranId || '').trim()
  if (!tid || typeof listener !== 'function') return () => {}

  let session = sessions.get(tid)
  if (!session) {
    session = {
      tranId: tid,
      planId: String(planId || '').trim(),
      listeners: new Set(),
      timerId: 0,
      startedAt: Date.now(),
      lastTickStartedAt: 0,
      stopped: false,
      inFlight: false,
    }
    sessions.set(tid, session)
    void tick(session)
  } else if (planId) {
    const pid = String(planId || '').trim()
    if (pid) session.planId = pid
  }

  session.listeners.add(listener)

  return () => {
    const active = sessions.get(tid)
    if (!active) return
    active.listeners.delete(listener)
    if (active.listeners.size === 0) {
      destroySession(tid)
    }
  }
}

export function isVipCheckTransactionPollActive(tranId) {
  return sessions.has(String(tranId || '').trim())
}

/** @internal test hook */
export function __getVipCheckTransactionPollSession(tranId) {
  return sessions.get(String(tranId || '').trim()) || null
}
