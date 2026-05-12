/**
 * 购买型 VIP（按时长）：与 `computeViewerMemberTier` 里 Telegram Premium → 徽标 `vip` 不是同一概念。
 * 默认无任何本地购买记录 → `purchasedExpireAtMs === 0`。个人中心「ផុតកំណត់」**仅展示** `extendPurchasedVipWithPlan` 写入的真实到期（购买成功时刻 + 套餐小时），见 `AccountPage`。
 * 在 Telegram Mini App 内会额外与 WebApp CloudStorage 同步同一 JSON，便于手机与电脑（同一账号、同一 Bot）读到同一份到期；纯浏览器无 CloudStorage 时仍仅用 localStorage。
 * 上线后支付成功应由服务端下发到期时间。
 */

import { getVipPlanForPurchase } from '../data/vipPlansCatalog.js'
import { buildOrderNo } from './orderNo.js'
import { parseVipExpireAtMs } from './memberTier.js'

// v2: 与旧测试数据（v1）隔离，避免历史本地/云端缓存导致身份误判。
export const VIP_PURCHASE_STORAGE_KEY = 'tg-vip-purchase:v2'
export const VIP_PURCHASE_CLOUD_KEY = 'tg_vip_purchase_map_v2'
export const VIP_PURCHASE_ORDERS_STORAGE_KEY = 'tg-vip-purchase-orders:v1'
export const VIP_PURCHASE_CHANGED_EVENT = 'tg-vip-purchase-changed'

/** @typedef {{ purchasedExpireAtMs: number }} VipPurchaseRecord */
/** @typedef {{ id: string, planId: string, amount: string, status: 'success', statusLabel: string, time: string, atMs: number }} VipPurchaseOrder */

export function getDefaultVipPurchaseRecord() {
  return { purchasedExpireAtMs: 0 }
}

function readAllMap() {
  try {
    const raw = localStorage.getItem(VIP_PURCHASE_STORAGE_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw)
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function mergePurchaseMaps(local, remote) {
  const out = {}
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})])
  for (const k of keys) {
    const ms = Math.max(
      parseVipExpireAtMs(local?.[k]?.purchasedExpireAtMs),
      parseVipExpireAtMs(remote?.[k]?.purchasedExpireAtMs),
    )
    if (ms > 0) out[k] = { purchasedExpireAtMs: ms }
  }
  return out
}

function purchaseMapsEqual(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  for (const k of keys) {
    if (parseVipExpireAtMs(a?.[k]?.purchasedExpireAtMs) !== parseVipExpireAtMs(b?.[k]?.purchasedExpireAtMs)) return false
  }
  return true
}

function writePurchaseMapToCloud(json) {
  try {
    const cs = window.Telegram?.WebApp?.CloudStorage
    if (cs && typeof cs.setItem === 'function') {
      cs.setItem(VIP_PURCHASE_CLOUD_KEY, json, () => {})
    }
  } catch {
    /* ignore */
  }
}

function writeAllMap(map) {
  let json = ''
  try {
    json = JSON.stringify(map)
    localStorage.setItem(VIP_PURCHASE_STORAGE_KEY, json)
  } catch {
    /* 隐私模式或配额满 */
  }
  if (json) writePurchaseMapToCloud(json)
  try {
    window.dispatchEvent(new Event(VIP_PURCHASE_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}

function readAllOrdersMap() {
  try {
    const raw = localStorage.getItem(VIP_PURCHASE_ORDERS_STORAGE_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw)
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function writeAllOrdersMap(map) {
  try {
    localStorage.setItem(VIP_PURCHASE_ORDERS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function formatOrderTime(ms) {
  const d = new Date(ms)
  const pad2 = (n) => String(Math.trunc(n)).padStart(2, '0')
  const y = d.getFullYear()
  const mo = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const h = pad2(d.getHours())
  const mi = pad2(d.getMinutes())
  const s = pad2(d.getSeconds())
  return `${y}-${mo}-${day} ${h}:${mi}:${s}`
}

/**
 * 启动时从 Telegram CloudStorage 拉取并与 localStorage 按 userId 取较大到期合并（仅 Mini App 内有 CloudStorage）。
 */
export function hydrateVipPurchaseFromTelegramCloud() {
  const cs = window.Telegram?.WebApp?.CloudStorage
  if (!cs || typeof cs.getItem !== 'function') return

  cs.getItem(VIP_PURCHASE_CLOUD_KEY, (err, value) => {
    if (err || value == null || value === '') return
    let cloud = null
    try {
      cloud = JSON.parse(value)
    } catch {
      return
    }
    if (!cloud || typeof cloud !== 'object') return

    const local = readAllMap()
    const merged = mergePurchaseMaps(local, cloud)
    if (purchaseMapsEqual(local, merged)) return
    writeAllMap(merged)
  })
}

/**
 * @param {string | number | null | undefined} tgUserId
 * @returns {VipPurchaseRecord}
 */
export function loadVipPurchaseRecord(tgUserId) {
  const id = tgUserId != null ? String(tgUserId).trim() : ''
  if (!id) return getDefaultVipPurchaseRecord()
  const all = readAllMap()
  const row = all[id]
  return { purchasedExpireAtMs: parseVipExpireAtMs(row?.purchasedExpireAtMs) }
}

/**
 * @param {string | number | null | undefined} tgUserId
 * @param {VipPurchaseRecord} record
 */
export function saveVipPurchaseRecord(tgUserId, record) {
  const id = tgUserId != null ? String(tgUserId).trim() : ''
  if (!id) return
  const all = readAllMap()
  all[id] = { purchasedExpireAtMs: parseVipExpireAtMs(record?.purchasedExpireAtMs) }
  writeAllMap(all)
}

/**
 * @param {string | number | null | undefined} tgUserId
 * @returns {VipPurchaseOrder[]}
 */
export function loadVipPurchaseOrders(tgUserId) {
  const id = tgUserId != null ? String(tgUserId).trim() : ''
  if (!id) return []
  const all = readAllOrdersMap()
  const list = Array.isArray(all[id]) ? all[id] : []
  return list
    .map((row) => ({
      id: String(row?.id || ''),
      planId: String(row?.planId || ''),
      amount: String(row?.amount || '$0'),
      status: 'success',
      statusLabel: String(row?.statusLabel || 'បង់ប្រាក់ជោគជ័យ'),
      time: String(row?.time || ''),
      atMs: Number(row?.atMs) || 0,
    }))
    .filter((row) => row.id)
    .sort((a, b) => Number(b.atMs || 0) - Number(a.atMs || 0))
}

/**
 * @param {VipPurchaseRecord | number} recordOrExpireMs
 * @param {number} [nowMs]
 */
export function isPurchasedVipActiveAt(recordOrExpireMs, nowMs = Date.now()) {
  const ms =
    typeof recordOrExpireMs === 'number'
      ? parseVipExpireAtMs(recordOrExpireMs)
      : parseVipExpireAtMs(recordOrExpireMs?.purchasedExpireAtMs)
  return ms > nowMs
}

/**
 * @param {string | number | null | undefined} tgUserId
 * @returns {number} `purchasedExpireAtMs`，供 `useSyncExternalStore` 快照（无用户则为 0）
 */
export function getPurchasedVipExpireAtMsSnapshot(tgUserId) {
  return loadVipPurchaseRecord(tgUserId).purchasedExpireAtMs
}

export function subscribePurchasedVip(listener) {
  const fn = () => listener()
  window.addEventListener(VIP_PURCHASE_CHANGED_EVENT, fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(VIP_PURCHASE_CHANGED_EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}

/**
 * 购买成功：新到期 = max(本次购买成功时间, 当前已记录的到期时间) + 本单套餐时长（小时）。
 * - **在期内续费**：当前到期晚于「现在」→ 从**原到期时刻**往后加时长（剩余时间保留 + 新购时长）。
 * - **已过期或首购**：原到期 ≤ 购买时刻 → 从**购买成功时刻**起加时长。
 * 未传 `purchaseSuccessAtMs` 时用调用瞬间 `Date.now()`；**上线后请传支付回执时间戳**。
 *
 * @param {string | number} tgUserId
 * @param {string} planId
 * @param {{ id?: number, is_premium?: boolean } | null | undefined} tgUserForTier 须与 VIP 页 `userForTier` 一致
 * @param {number} [purchaseSuccessAtMs] 支付成功时刻（毫秒）
 * @returns {VipPurchaseRecord}
 */
export function extendPurchasedVipWithPlan(tgUserId, planId, tgUserForTier, purchaseSuccessAtMs) {
  const id = tgUserId != null ? String(tgUserId).trim() : ''
  if (!id) return getDefaultVipPurchaseRecord()
  const plan = getVipPlanForPurchase(planId, tgUserForTier)
  if (!plan) return loadVipPurchaseRecord(id)
  const hours = Math.max(0, Number(plan.durationHours) || 0)
  const addMs = hours * 3600 * 1000
  const at =
    typeof purchaseSuccessAtMs === 'number' &&
    Number.isFinite(purchaseSuccessAtMs) &&
    purchaseSuccessAtMs > 0
      ? purchaseSuccessAtMs
      : Date.now()
  const cur = loadVipPurchaseRecord(id)
  const base = Math.max(at, cur.purchasedExpireAtMs)
  const next = { purchasedExpireAtMs: base + addMs }
  saveVipPurchaseRecord(id, next)
  const allOrders = readAllOrdersMap()
  const seq = Array.isArray(allOrders[id]) ? allOrders[id].length : 0
  const order = {
    id: buildOrderNo(new Date(at), seq),
    planId: String(plan.planId || ''),
    amount: String(plan.priceUsdLabel || '$0'),
    status: 'success',
    statusLabel: 'បង់ប្រាក់ជោគជ័យ',
    time: formatOrderTime(at),
    atMs: at,
  }
  const list = Array.isArray(allOrders[id]) ? [...allOrders[id], order] : [order]
  allOrders[id] = list.slice(-200)
  writeAllOrdersMap(allOrders)
  try {
    window.dispatchEvent(new Event(VIP_PURCHASE_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
  return next
}

/**
 * 无在期本地购买时，个人中心「到期」展示用：仅由 Telegram `user.id` 推导，**手机与电脑同一用户恒相同**（展示用，非支付凭证）。
 */
export function getPlatformDefaultVipExpireDisplayMsForUser(tgUserId) {
  const id = Number(tgUserId)
  if (!Number.isFinite(id) || id <= 0) {
    return new Date('2099-12-31T23:59:59+07:00').getTime()
  }
  const daySpan = 2000 + (Math.abs(id) % 5000)
  const anchor = new Date('2030-01-01T12:00:00+07:00').getTime()
  return anchor + daySpan * 86400000
}

/**
 * 兼容用：有在期/未过期本地记录返回该时间；否则返回占位展示时间（**账户页已不再用此函数展示 VIP 到期**，仅保留供旧代码或调试）。
 * @param {number} storedExpireAtMs
 * @param {number | null | undefined} tgUserId
 * @param {number} [nowMs]
 */
export function getAccountVipExpireDisplayMs(storedExpireAtMs, tgUserId, nowMs = Date.now()) {
  const stored = parseVipExpireAtMs(storedExpireAtMs)
  if (stored > nowMs) return stored
  return getPlatformDefaultVipExpireDisplayMsForUser(tgUserId)
}
