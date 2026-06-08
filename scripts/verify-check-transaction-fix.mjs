import fs from 'node:fs'
import {
  checkPayWayTransaction,
  getPayWaySandboxStatus,
} from '../server/payway.js'
import { getOrderByTranId, initOrdersStore } from '../server/orders-store.js'

const tranId = process.argv[2] || 'V05492680940856742'
const telegramUserId = process.argv[3] || '8707054926'
const planId = process.argv[4] || 'vip_entry'
const baseUrl = String(process.argv[5] || 'http://127.0.0.1:8787').replace(/\/+$/, '')

initOrdersStore()
const beforeOrder = getOrderByTranId(tranId)
const payway = getPayWaySandboxStatus()
const checked = await checkPayWayTransaction(tranId)

const confirmRes = await fetch(`${baseUrl}/api/vip-orders/confirm-payment`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    telegramUser: { id: Number(telegramUserId), first_name: 'Verify' },
    tranId,
    planId,
  }),
})
const confirmData = await confirmRes.json().catch(() => ({}))
initOrdersStore()
const afterOrder = getOrderByTranId(tranId)

const presencePath = new URL('../server/data/presence-data.json', import.meta.url)
const presence = JSON.parse(fs.readFileSync(presencePath, 'utf8'))
const profile = presence.viewerProfilesByTelegramUserId?.[telegramUserId] || null

const pollWouldSucceed = Boolean(confirmData?.ok && confirmData?.profile?.vipActive)

console.log(JSON.stringify({
  tranId,
  payway_check_url: payway.checkUrl,
  check_transaction: checked,
  confirm_payment: {
    http_status: confirmRes.status,
    body: confirmData,
  },
  orders_store: {
    before: beforeOrder,
    after: afterOrder,
  },
  vip_profile: profile ? {
    vipActive: profile.vipActive,
    vipExpiresAt: profile.vipExpiresAt,
    memberTier: profile.memberTier,
  } : null,
  khqr_poll_would_redirect: pollWouldSucceed,
}, null, 2))

const pass = checked.ok
  && checked.status === 'APPROVED'
  && confirmRes.status === 200
  && confirmData?.ok === true
  && afterOrder?.status === 'paid'
  && confirmData?.profile?.vipActive === true
  && pollWouldSucceed

process.exit(pass ? 0 : 1)
