import fs from 'node:fs'
import path from 'node:path'
import { PERSISTENT_DATA_DIR } from './persistent-data-dir.js'
import { buildOrderNo, buildOrderNoSecondPrefix } from './order-no.js'

const DATA_FILE = path.join(PERSISTENT_DATA_DIR, 'orders-data.json')

/** @type {Map<string, object>} */
const ordersByOrderNo = new Map()
/** @type {Map<string, string>} */
const orderNoByTranId = new Map()
/** @type {Map<string, number>} */
const sequenceBySecondPrefix = new Map()

let loaded = false

function now() {
  return Date.now()
}

export function getOrdersDataFilePath() {
  return DATA_FILE
}

export function getOrdersCount() {
  return ordersByOrderNo.size
}

function normalizeTelegramUserId(raw) {
  const id = String(raw || '').replace(/\D/g, '').trim()
  return id || ''
}

function normalizeOrderIn(raw) {
  const orderNo = String(raw?.order_no || raw?.orderNo || '').trim().slice(0, 32)
  const tranId = String(raw?.tran_id || raw?.tranId || '').trim().slice(0, 20)
  if (!orderNo || !tranId) return null
  const createdAt = Number(raw?.created_at || raw?.createdAt || 0) || now()
  const expireAt = Number(raw?.expire_at || raw?.expireAt || 0) || 0
  const paidAt = Number(raw?.paid_at || raw?.paidAt || 0) || 0
  const status = String(raw?.status || 'pending').trim().slice(0, 32)
  return {
    order_no: orderNo,
    tran_id: tranId,
    telegram_user_id: normalizeTelegramUserId(raw?.telegram_user_id || raw?.telegramUserId),
    member_id: String(raw?.member_id || raw?.memberId || '').trim().slice(0, 64),
    plan_id: String(raw?.plan_id || raw?.planId || '').trim().slice(0, 80),
    amount: String(raw?.amount ?? '').trim().slice(0, 40),
    currency: String(raw?.currency || 'USD').trim().slice(0, 8).toUpperCase(),
    status,
    payment_channel: String(raw?.payment_channel || raw?.paymentChannel || '').trim().slice(0, 32),
    created_at: createdAt,
    expire_at: expireAt,
    paid_at: paidAt,
    payway_env: String(raw?.payway_env || raw?.paywayEnv || 'sandbox').trim().slice(0, 16),
    fail_reason: String(raw?.fail_reason || raw?.failReason || '').trim().slice(0, 240),
  }
}

function rebuildSequenceCounters() {
  sequenceBySecondPrefix.clear()
  for (const order of ordersByOrderNo.values()) {
    const prefix = String(order.order_no || '').slice(0, 14)
    if (!/^\d{14}$/.test(prefix)) continue
    const suffix = Number(String(order.order_no).slice(14)) || 0
    const prev = sequenceBySecondPrefix.get(prefix) || 0
    sequenceBySecondPrefix.set(prefix, Math.max(prev, suffix + 1))
  }
}

function persistOrders() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
    const payload = {
      version: 1,
      updatedAtMs: now(),
      orders: [...ordersByOrderNo.values()].sort(
        (a, b) => Number(b.created_at) - Number(a.created_at),
      ),
    }
    fs.writeFileSync(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  } catch {
    /* ignore file system failures */
  }
}

function registerOrder(order) {
  ordersByOrderNo.set(order.order_no, order)
  orderNoByTranId.set(order.tran_id, order.order_no)
}

function allocateOrderNo(atMs = now()) {
  const at = new Date(atMs)
  const prefix = buildOrderNoSecondPrefix(at)
  const seq = sequenceBySecondPrefix.get(prefix) || 0
  sequenceBySecondPrefix.set(prefix, seq + 1)
  return buildOrderNo(at, seq)
}

export function initOrdersStore() {
  if (loaded) return
  loaded = true
  ordersByOrderNo.clear()
  orderNoByTranId.clear()
  sequenceBySecondPrefix.clear()
  try {
    if (!fs.existsSync(DATA_FILE)) return
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    const rows = Array.isArray(parsed?.orders) ? parsed.orders : []
    for (const row of rows) {
      const order = normalizeOrderIn(row)
      if (!order) continue
      registerOrder(order)
    }
    rebuildSequenceCounters()
  } catch {
    ordersByOrderNo.clear()
    orderNoByTranId.clear()
    sequenceBySecondPrefix.clear()
  }
}

/**
 * @param {{
 *   tran_id: string,
 *   telegram_user_id: string,
 *   member_id?: string,
 *   plan_id: string,
 *   amount: string | number,
 *   currency?: string,
 *   payment_channel: 'aba_khqr' | 'payway_hosted' | string,
 *   created_at?: number,
 *   expire_at: number,
 * }} input
 */
export function createPaymentOrder(input) {
  initOrdersStore()
  const tranId = String(input.tran_id || '').trim().slice(0, 20)
  if (!tranId) return null
  if (orderNoByTranId.has(tranId)) {
    const existingNo = orderNoByTranId.get(tranId)
    return existingNo ? ordersByOrderNo.get(existingNo) || null : null
  }
  const createdAt = Number(input.created_at || 0) || now()
  const order = normalizeOrderIn({
    order_no: allocateOrderNo(createdAt),
    tran_id: tranId,
    telegram_user_id: input.telegram_user_id,
    member_id: input.member_id,
    plan_id: input.plan_id,
    amount: input.amount,
    currency: input.currency || 'USD',
    status: 'pending',
    payment_channel: input.payment_channel,
    created_at: createdAt,
    expire_at: Number(input.expire_at || 0) || 0,
    paid_at: 0,
    payway_env: 'sandbox',
    fail_reason: '',
  })
  if (!order) return null
  registerOrder(order)
  persistOrders()
  return order
}

export function getOrderByTranId(tranId) {
  initOrdersStore()
  const tid = String(tranId || '').trim().slice(0, 20)
  if (!tid) return null
  const orderNo = orderNoByTranId.get(tid)
  return orderNo ? ordersByOrderNo.get(orderNo) || null : null
}

export function getOrderByOrderNo(orderNo) {
  initOrdersStore()
  const no = String(orderNo || '').trim()
  if (!no) return null
  return ordersByOrderNo.get(no) || null
}

export function markOrderPaid(tranId, paidAt = now()) {
  initOrdersStore()
  const order = getOrderByTranId(tranId)
  if (!order) return null
  if (order.status === 'paid') return order
  const next = {
    ...order,
    status: 'paid',
    paid_at: Number(paidAt) || now(),
    fail_reason: '',
  }
  registerOrder(next)
  persistOrders()
  return next
}

export function markOrderFailed(tranId, reason = '') {
  initOrdersStore()
  const order = getOrderByTranId(tranId)
  if (!order) return null
  if (order.status === 'paid') return order
  const next = {
    ...order,
    status: 'failed',
    fail_reason: String(reason || '').trim().slice(0, 240),
  }
  registerOrder(next)
  persistOrders()
  return next
}

export function listOrdersByTelegramUserId(telegramUserId) {
  initOrdersStore()
  const id = normalizeTelegramUserId(telegramUserId)
  if (!id) return []
  return [...ordersByOrderNo.values()]
    .filter((row) => row.telegram_user_id === id)
    .sort((a, b) => Number(b.created_at) - Number(a.created_at))
}
