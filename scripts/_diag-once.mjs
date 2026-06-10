import fs from 'node:fs'
import {
  buildCheckTransactionHash,
  checkPayWayTransaction,
  formatPayWayReqTime,
  getPayWaySandboxStatus,
} from '../server/payway.js'
import { getOrderByTranId, initOrdersStore } from '../server/orders-store.js'

const tranId = process.argv[2] || 'V05492680940856742'
const telegramUserId = process.argv[3] || '8707054926'

initOrdersStore()
const order = getOrderByTranId(tranId)
const paywayStatus = getPayWaySandboxStatus()
const PAYWAY_CHECK_URL = paywayStatus.checkUrl
const PAYWAY_CHECK_TX_URL = PAYWAY_CHECK_URL.replace(/\/check$/, '/check-transaction')
const PAYWAY_MERCHANT_ID = String(process.env.PAYWAY_MERCHANT_ID || '').trim()

const req_time = formatPayWayReqTime()
const hash = buildCheckTransactionHash(req_time, PAYWAY_MERCHANT_ID, tranId)
const body = new URLSearchParams({ req_time, merchant_id: PAYWAY_MERCHANT_ID, tran_id: tranId, hash })
async function fetchCheck(url) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const text = await response.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* ignore */ }
  return { url, http_status: response.status, raw: json || text }
}

const checkCurrent = await fetchCheck(PAYWAY_CHECK_URL)
const checkTransaction = await fetchCheck(PAYWAY_CHECK_TX_URL)
const checked = await checkPayWayTransaction(tranId)

const confirmRes = await fetch('http://127.0.0.1:8787/api/vip-orders/confirm-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    telegramUser: { id: Number(telegramUserId), first_name: 'Diag' },
    tranId,
    planId: order?.plan_id || 'vip_entry',
  }),
})
const confirmData = await confirmRes.json().catch(() => ({}))

const presence = JSON.parse(fs.readFileSync(new URL('../server/data/presence-data.json', import.meta.url), 'utf8'))
const profile = presence.viewerProfilesByTelegramUserId?.[telegramUserId] || null

console.log(JSON.stringify({
  tranId,
  order,
  payway_check_current_endpoint: checkCurrent,
  payway_check_transaction_endpoint: checkTransaction,
  payway_check_parsed: checked,
  confirm_payment_http_status: confirmRes.status,
  confirm_payment_body: confirmData,
  vip_profile: profile ? {
    vipActive: profile.vipActive,
    vipExpiresAt: profile.vipExpiresAt,
    memberTier: profile.memberTier,
  } : null,
  fulfilled_in_memory: null,
}, null, 2))
