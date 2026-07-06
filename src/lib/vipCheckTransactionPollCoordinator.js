import { getActiveVipAbaKhqrPendingExpiry } from './vipAbaKhqrSession.js'
import { apiUrl } from './apiBase.js'
import { confirmViewerVipPayment } from './viewerProfileApi.js'
import { getTelegramAuthPayload } from '../hooks/useTelegramUser.js'

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
let visibilityListenerAttached = false
let backgroundWorker = null
let backgroundWorkerUrl = ''

const BACKGROUND_POLL_WORKER_SOURCE = `
const sessions = new Map()

function clearSessionTimer(session) {
  if (session && session.timerId) {
    clearTimeout(session.timerId)
    session.timerId = 0
  }
}

function stopSession(tranId) {
  const tid = String(tranId || '').trim()
  const session = sessions.get(tid)
  if (!session) return
  clearSessionTimer(session)
  sessions.delete(tid)
}

function isFulfilled(result) {
  return Boolean(result && result.ok && (result.alreadyFulfilled || (result.order && result.order.id)))
}

function scheduleSession(session, nextAt) {
  clearSessionTimer(session)
  const delayMs = Math.max(0, Number(nextAt || 0) - Date.now())
  session.timerId = setTimeout(() => {
    session.timerId = 0
    void pollSession(session.tranId)
  }, delayMs)
}

async function pollSession(tranId) {
  const session = sessions.get(String(tranId || '').trim())
  if (!session) return

  if (Date.now() - session.startedAt >= session.maxMs) {
    const result = { ok: false, error: 'payment_expired', order: null, alreadyFulfilled: false }
    postMessage({ type: 'result', tranId: session.tranId, startedAt: Date.now(), result })
    stopSession(session.tranId)
    return
  }

  if (session.inFlight) return
  session.inFlight = true
  const startedAt = Date.now()

  try {
    const res = await fetch(session.confirmUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUser: session.telegramUser,
        initDataRaw: session.initDataRaw,
        tranId: session.tranId,
        planId: session.planId,
        skipVerify: false,
        strictVerify: true,
      }),
    })
    const data = await res.json().catch(() => ({}))
    const result = res.ok
      ? {
          ok: Boolean(data && data.ok),
          profile: data && data.profile ? data.profile : null,
          order: data && data.order ? data.order : null,
          alreadyFulfilled: Boolean(data && data.alreadyFulfilled),
          error: '',
        }
      : {
          ok: false,
          profile: data && data.profile ? data.profile : null,
          order: null,
          alreadyFulfilled: false,
          error: String((data && data.error) || 'confirm failed: ' + res.status),
          paywayStatus: data && data.paywayStatus,
          paywayError: data && data.paywayError,
        }

    postMessage({ type: 'result', tranId: session.tranId, startedAt, result })

    if (result.error === 'payment_expired' || isFulfilled(result)) {
      stopSession(session.tranId)
      return
    }
  } catch (err) {
    postMessage({
      type: 'result',
      tranId: session.tranId,
      startedAt,
      result: {
        ok: false,
        profile: null,
        order: null,
        alreadyFulfilled: false,
        error: err && err.message ? err.message : 'network error',
      },
    })
  } finally {
    session.inFlight = false
  }

  if (!sessions.has(session.tranId)) return
  scheduleSession(session, startedAt + session.intervalMs)
}

onmessage = (event) => {
  const message = event && event.data ? event.data : {}
  const type = String(message.type || '')
  const tranId = String(message.tranId || '').trim()
  if (!tranId) return

  if (type === 'stop') {
    stopSession(tranId)
    return
  }

  if (type !== 'start') return
  const telegramUser = message.telegramUser && typeof message.telegramUser === 'object'
    ? message.telegramUser
    : null
  if (!telegramUser || !telegramUser.id || !message.confirmUrl) return

  const session = sessions.get(tranId) || { tranId, timerId: 0, inFlight: false }
  session.planId = String(message.planId || '')
  session.confirmUrl = String(message.confirmUrl || '')
  session.telegramUser = telegramUser
  session.initDataRaw = String(message.initDataRaw || '')
  session.intervalMs = Math.max(1000, Number(message.intervalMs || 4000))
  session.startedAt = Number(message.startedAt || Date.now())
  session.maxMs = Math.max(session.intervalMs, Number(message.maxMs || 300000))
  sessions.set(tranId, session)
  scheduleSession(session, message.nextAt || Date.now())
}
`

function canUseDocument() {
  return typeof document !== 'undefined'
}

function isDocumentHidden() {
  return canUseDocument() && document.visibilityState === 'hidden'
}

function stopBackgroundPoll(tranId) {
  if (!backgroundWorker) return
  backgroundWorker.postMessage({ type: 'stop', tranId: String(tranId || '').trim() })
}

function teardownBackgroundWorkerIfIdle() {
  if (sessions.size > 0 || !backgroundWorker) return
  backgroundWorker.terminate()
  backgroundWorker = null
  if (backgroundWorkerUrl) {
    URL.revokeObjectURL(backgroundWorkerUrl)
    backgroundWorkerUrl = ''
  }
}

function getBackgroundWorker() {
  if (backgroundWorker) return backgroundWorker
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    return null
  }
  try {
    const blob = new Blob([BACKGROUND_POLL_WORKER_SOURCE], { type: 'application/javascript' })
    backgroundWorkerUrl = URL.createObjectURL(blob)
    backgroundWorker = new Worker(backgroundWorkerUrl)
    backgroundWorker.onmessage = (event) => {
      handleBackgroundWorkerMessage(event)
    }
    backgroundWorker.onerror = () => {
      backgroundWorker = null
      if (backgroundWorkerUrl) {
        URL.revokeObjectURL(backgroundWorkerUrl)
        backgroundWorkerUrl = ''
      }
    }
    return backgroundWorker
  } catch {
    backgroundWorker = null
    if (backgroundWorkerUrl) {
      URL.revokeObjectURL(backgroundWorkerUrl)
      backgroundWorkerUrl = ''
    }
    return null
  }
}

function startBackgroundPoll(session) {
  if (!session || session.stopped || !isDocumentHidden()) return
  const { telegramUser, initDataRaw } = getTelegramAuthPayload()
  if (!telegramUser?.id) return
  const worker = getBackgroundWorker()
  if (!worker) return

  const nextAt = Math.max(
    Date.now(),
    Number(session.lastTickStartedAt || 0) + VIP_CHECK_TRANSACTION_POLL_MS,
  )
  worker.postMessage({
    type: 'start',
    tranId: session.tranId,
    planId: session.planId,
    startedAt: session.startedAt,
    maxMs: VIP_CHECK_TRANSACTION_MAX_MS,
    intervalMs: VIP_CHECK_TRANSACTION_POLL_MS,
    nextAt,
    confirmUrl: apiUrl('/api/vip-orders/confirm-payment'),
    telegramUser,
    initDataRaw,
  })
}

function syncBackgroundPolls() {
  if (isDocumentHidden()) {
    for (const session of sessions.values()) {
      startBackgroundPoll(session)
    }
    return
  }

  for (const session of sessions.values()) {
    stopBackgroundPoll(session.tranId)
    if (!session.stopped && !session.inFlight) {
      const overdue = Date.now() - Number(session.lastTickStartedAt || 0) >= VIP_CHECK_TRANSACTION_POLL_MS
      if (overdue) {
        void tick(session)
      } else {
        scheduleNext(session)
      }
    }
  }
}

function ensureVisibilityListener() {
  if (visibilityListenerAttached || !canUseDocument()) return
  document.addEventListener('visibilitychange', syncBackgroundPolls)
  visibilityListenerAttached = true
}

function maybeRemoveVisibilityListener() {
  if (!visibilityListenerAttached || sessions.size > 0 || !canUseDocument()) return
  document.removeEventListener('visibilitychange', syncBackgroundPolls)
  visibilityListenerAttached = false
}

function handleBackgroundWorkerMessage(event) {
  const message = event?.data || {}
  if (message.type !== 'result') return
  const tid = String(message.tranId || '').trim()
  const session = sessions.get(tid)
  if (!session) {
    stopBackgroundPoll(tid)
    teardownBackgroundWorkerIfIdle()
    return
  }
  const result = message.result || {}
  const startedAt = Number(message.startedAt || 0)
  if (startedAt > Number(session.lastTickStartedAt || 0)) {
    session.lastTickStartedAt = startedAt
  }
  if (session.stopped) return

  notifyListeners(session, result)

  if (result.error === 'payment_expired' || isKhqrPaymentFulfilled(result)) {
    destroySession(session.tranId)
    return
  }

  if (!isDocumentHidden() && !session.inFlight) {
    scheduleNext(session)
  }
}

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
  stopBackgroundPoll(tranId)
  session.stopped = true
  sessions.delete(tranId)
  maybeRemoveVisibilityListener()
  teardownBackgroundWorkerIfIdle()
}

function notifyListeners(session, result) {
  for (const listener of session.listeners) {
    listener(result)
  }
}

function scheduleNext(session) {
  if (session.stopped) return
  if (isDocumentHidden()) {
    startBackgroundPoll(session)
  }
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

  ensureVisibilityListener()
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
  startBackgroundPoll(session)

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
