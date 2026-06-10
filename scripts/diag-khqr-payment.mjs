import fs from 'node:fs'
import { checkPayWayTransaction, isPayWayConfigured, getPayWaySandboxStatus } from '../server/payway.js'
import { initOrdersStore, getOrderByTranId } from '../server/orders-store.js'

const ordersPath = new URL('../server/data/orders-data.json', import.meta.url)
const presencePath = new URL('../server/data/presence-data.json', import.meta.url)
const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8')).orders || []
const presence = JSON.parse(fs.readFileSync(presencePath, 'utf8'))

initOrdersStore()
const latest = orders.slice(0, 8)

console.log('=== PayWay Config ===')
console.log(JSON.stringify({ configured: isPayWayConfigured(), sandbox: getPayWaySandboxStatus() }, null, 2))

for (const o of latest) {
  const check = await checkPayWayTransaction(o.tran_id)
  const stored = getOrderByTranId(o.tran_id)
  const tg = o.telegram_user_id
  const memberId = o.member_id
  const profiles = presence.viewerProfilesByTelegramUserId || {}
  const profile = profiles[tg] || null
  console.log('---')
  console.log(JSON.stringify({
    tran_id: o.tran_id,
    order_no: o.order_no,
    status_orders_store: stored?.status,
    paid_at: stored?.paid_at,
    telegram_user_id: tg,
    plan_id: o.plan_id,
    created_at: o.created_at,
    expire_at: o.expire_at,
    payway_check: check,
    profile_vipActive: profile?.vipActive ?? null,
    profile_vipExpiresAt: profile?.vipExpiresAt ?? null,
    in_paidMembers: (presence.paidMembers || []).includes(memberId),
  }, null, 2))
}
