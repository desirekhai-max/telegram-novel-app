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

function resolvePaymentEntryFromRaw(raw) {
  const explicit = String(raw?.payment_entry || raw?.paymentEntry || '').trim().toLowerCase()
  if (explicit === 'aba_deeplink' || explicit === 'khqr_qr') return explicit
  if (Boolean(raw?.aba_app_launched || raw?.abaAppLaunched)) return 'aba_deeplink'
  const channel = String(raw?.payment_channel || raw?.paymentChannel || '').toLowerCase()
  if (channel === 'aba_khqr') return 'khqr_qr'
  return ''
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
    refunded_at: Number(raw?.refunded_at || raw?.refundedAt || 0) || 0,
    aba_app_launched: Boolean(raw?.aba_app_launched || raw?.abaAppLaunched),
    aba_app_launched_at: Number(raw?.aba_app_launched_at || raw?.abaAppLaunchedAt || 0) || 0,
    payment_entry: resolvePaymentEntryFromRaw(raw),
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
  const channel = String(input.payment_channel || '').trim().slice(0, 32)
  const order = normalizeOrderIn({
    order_no: allocateOrderNo(createdAt),
    tran_id: tranId,
    telegram_user_id: input.telegram_user_id,
    member_id: input.member_id,
    plan_id: input.plan_id,
    amount: input.amount,
    currency: input.currency || 'USD',
    status: 'pending',
    payment_channel: channel,
    payment_entry: input.payment_entry || (channel === 'aba_khqr' ? 'khqr_qr' : ''),
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

export function markOrderAbaAppLaunched(tranId, atMs = now()) {
  initOrdersStore()
  const order = getOrderByTranId(tranId)
  if (!order) return null
  if (order.aba_app_launched) return order
  const next = {
    ...order,
    aba_app_launched: true,
    aba_app_launched_at: Number(atMs) || now(),
    payment_entry: 'aba_deeplink',
  }
  registerOrder(next)
  persistOrders()
  return next
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

export function listAllOrdersSorted() {
  initOrdersStore()
  return [...ordersByOrderNo.values()].sort(
    (a, b) => Number(b.created_at) - Number(a.created_at),
  )
}

function parseDateStartMs(value) {
  const matched = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!matched) return NaN
  const [, y, m, d] = matched
  return new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0).getTime()
}

function parseDateEndMs(value) {
  const matched = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!matched) return NaN
  const [, y, m, d] = matched
  return new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999).getTime()
}

function normalizePaymentChannelFilter(raw) {
  const text = String(raw || '').trim().toLowerCase()
  if (!text || text === 'all') return ''
  if (text === 'aba_khqr' || text === 'aba' || text === 'aba khqr') return 'aba_khqr'
  if (text === 'payway_hosted' || text === 'payway') return 'payway_hosted'
  if (text === 'vip_purchase' || text === 'vip purchase' || text === 'vip内购') return 'vip_purchase'
  if (text === 'vip_gift' || text === 'vip gift' || text === 'vip赠送') return 'vip_gift'
  return text
}

function resolveDisplayStatus(order, atMs = now()) {
  const status = String(order?.status || '').trim().toLowerCase()
  if (status === 'refunded') return 'refunded'
  if (status === 'paid' || status === 'success') return 'paid'
  if (status === 'failed') return 'failed'
  if (status === 'pending') {
    const expireAt = Number(order?.expire_at || 0)
    if (expireAt && expireAt <= atMs) return 'expired'
    return 'pending'
  }
  return status || 'pending'
}

function includesOrderKeyword(order, keyword) {
  const key = String(keyword || '').trim().toLowerCase()
  if (!key) return true
  const fields = [
    order.order_no,
    order.tran_id,
    order.telegram_user_id,
    order.member_id,
    order.plan_id,
    order.vip_order_id,
  ]
  return fields.some((field) => String(field || '').toLowerCase().includes(key))
}

function resolveOrderDateMs(order, dateField = 'created') {
  const field = String(dateField || 'created').toLowerCase()
  if (field === 'paid') {
    return Number(order.paid_at || order.created_at || 0)
  }
  return Number(order.created_at || order.paid_at || 0)
}

function filterAdminOrders(orders, filters = {}) {
  const status = String(filters.status || '').trim().toLowerCase()
  const paymentChannel = normalizePaymentChannelFilter(filters.payment_method || filters.paymentMethod)
  const dateFromMs = parseDateStartMs(filters.date_from || filters.dateFrom)
  const dateToMs = parseDateEndMs(filters.date_to || filters.dateTo)
  const dateField = String(filters.date_field || filters.dateField || 'created').toLowerCase()
  const keyword = filters.keyword || filters.q || filters.search || ''
  const atMs = now()

  return orders.filter((order) => {
    const displayStatus = resolveDisplayStatus(order, atMs)
    if (status && displayStatus !== status) return false
    if (paymentChannel && String(order.payment_channel || '').toLowerCase() !== paymentChannel) {
      return false
    }
    const dateMs = resolveOrderDateMs(order, dateField)
    if (Number.isFinite(dateFromMs) && Number.isFinite(dateMs) && dateMs < dateFromMs) return false
    if (Number.isFinite(dateToMs) && Number.isFinite(dateMs) && dateMs > dateToMs) return false
    if (!includesOrderKeyword(order, keyword)) return false
    return true
  })
}

function paginateAdminOrders(orders, { page = 1, pageSize = 50 } = {}) {
  const size = Math.min(100, Math.max(1, Number(pageSize) || 50))
  const total = orders.length
  const totalPages = Math.max(1, Math.ceil(total / size))
  const currentPage = Math.min(totalPages, Math.max(1, Number(page) || 1))
  const start = (currentPage - 1) * size
  return {
    items: orders.slice(start, start + size),
    total,
    page: currentPage,
    pageSize: size,
    totalPages,
  }
}

export function filterAndPaginateAdminOrders(orders, filters = {}) {
  const filtered = filterAdminOrders(orders, filters)
  return paginateAdminOrders(filtered, filters)
}

export function searchAdminOrders(filters = {}) {
  initOrdersStore()
  return filterAndPaginateAdminOrders(listAllOrdersSorted(), filters)
}

export function getAdminOrderByKey(idOrNo) {
  initOrdersStore()
  const key = String(idOrNo || '').trim()
  if (!key) return null
  const direct = ordersByOrderNo.get(key)
  if (direct) return direct
  const byTran = orderNoByTranId.get(key)
  if (byTran) return ordersByOrderNo.get(byTran) || null
  for (const order of ordersByOrderNo.values()) {
    if (order.tran_id === key) return order
  }
  return null
}

export function markOrderRefunded(idOrNo) {
  initOrdersStore()
  const order = getAdminOrderByKey(idOrNo)
  if (!order) return null
  if (String(order.status || '').toLowerCase() !== 'paid') {
    throw new Error('only paid orders can be refunded')
  }
  const next = {
    ...order,
    status: 'refunded',
    refunded_at: now(),
  }
  registerOrder(next)
  persistOrders()
  return next
}
