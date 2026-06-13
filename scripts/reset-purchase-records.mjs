/**
 * 清空购买/订单历史数据（仅擦除持久化 JSON，不修改业务写入逻辑）。
 * 用法：npm run reset:purchase-records
 * 执行前请先停止 API（npm run dev:api），否则运行中的服务可能把内存旧数据再次写回文件。
 */
import fs from 'node:fs'
import path from 'node:path'
import { PERSISTENT_DATA_DIR } from '../server/persistent-data-dir.js'
import { getOrdersDataFilePath } from '../server/orders-store.js'

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function resetOrdersFile(ordersPath) {
  const before = fs.existsSync(ordersPath)
    ? (readJson(ordersPath).orders?.length ?? 0)
    : 0
  writeJson(ordersPath, {
    version: 1,
    updatedAtMs: Date.now(),
    orders: [],
  })
  return before
}

function resetPresencePurchaseFields(presencePath) {
  if (!fs.existsSync(presencePath)) {
    return {
      existed: false,
      vipOrderUsers: 0,
      vipOrders: 0,
      pendingVip: 0,
      fulfilledTranIds: 0,
      paidMembers: 0,
      profilesVipCleared: 0,
    }
  }

  const presence = readJson(presencePath)
  const vipOrdersByUser = presence.vipOrdersByUser && typeof presence.vipOrdersByUser === 'object'
    ? presence.vipOrdersByUser
    : {}
  const vipOrderUsers = Object.keys(vipOrdersByUser).length
  const vipOrders = Object.values(vipOrdersByUser).reduce(
    (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
    0,
  )
  const pendingVip = Object.keys(presence.pendingVipOrdersByTranId || {}).length
  const fulfilledTranIds = Array.isArray(presence.fulfilledVipTranIds)
    ? presence.fulfilledVipTranIds.length
    : 0
  const paidMembers = Array.isArray(presence.paidMembers) ? presence.paidMembers.length : 0

  let profilesVipCleared = 0
  const memberProfiles = presence.memberProfiles && typeof presence.memberProfiles === 'object'
    ? presence.memberProfiles
    : {}
  for (const [key, row] of Object.entries(memberProfiles)) {
    if (!row || typeof row !== 'object') continue
    if (Number(row.vipExpireAtMs || 0) > 0) profilesVipCleared += 1
    memberProfiles[key] = { ...row, vipExpireAtMs: 0 }
  }

  const tx = presence.txMetrics && typeof presence.txMetrics === 'object' ? presence.txMetrics : {}
  presence.vipOrdersByUser = {}
  presence.pendingVipOrdersByTranId = {}
  presence.fulfilledVipTranIds = []
  presence.paidMembers = []
  presence.memberPaidAt = {}
  presence.memberProfiles = memberProfiles
  presence.txMetrics = {
    ...tx,
    orderEvents: [],
    successEvents: [],
    failedEvents: [],
    payUsdEvents: [],
  }

  writeJson(presencePath, presence)

  return {
    existed: true,
    vipOrderUsers,
    vipOrders,
    pendingVip,
    fulfilledTranIds,
    paidMembers,
    profilesVipCleared,
  }
}

const ordersPath = getOrdersDataFilePath()
const presencePath = path.join(PERSISTENT_DATA_DIR, 'presence-data.json')

const ordersBefore = resetOrdersFile(ordersPath)
const presenceStats = resetPresencePurchaseFields(presencePath)

console.log('[reset-purchase-records] persistent dir:', PERSISTENT_DATA_DIR)
console.log('[reset-purchase-records] orders file:', ordersPath)
console.log('[reset-purchase-records] cleared payment orders:', ordersBefore)
if (presenceStats.existed) {
  console.log('[reset-purchase-records] cleared vip order users:', presenceStats.vipOrderUsers)
  console.log('[reset-purchase-records] cleared vip order rows:', presenceStats.vipOrders)
  console.log('[reset-purchase-records] cleared pending vip orders:', presenceStats.pendingVip)
  console.log('[reset-purchase-records] cleared fulfilled tran ids:', presenceStats.fulfilledTranIds)
  console.log('[reset-purchase-records] cleared paidMembers:', presenceStats.paidMembers)
  console.log('[reset-purchase-records] reset profile vipExpireAtMs:', presenceStats.profilesVipCleared)
} else {
  console.log('[reset-purchase-records] presence-data.json not found, skipped')
}
console.log('[reset-purchase-records] done — 请重新启动 API（npm run dev:api）')
