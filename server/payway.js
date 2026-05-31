import crypto from 'node:crypto'
import { buildPayWayCustomFields, getPayWayItemsLine } from './paywayNeutralCopy.js'
import { sanitizePayWayCheckStatus } from './payway-security.js'

/** Card PAN / CVV / expiry are entered only on PayWay hosted pages — never in this app. */

const PAYWAY_MERCHANT_ID = String(process.env.PAYWAY_MERCHANT_ID || '').trim()
const PAYWAY_API_KEY = String(process.env.PAYWAY_API_KEY || process.env.PAYWAY_PUBLIC_KEY || '').trim()
const PAYWAY_CHECKOUT_URL = String(
  process.env.PAYWAY_CHECKOUT_URL
  || (process.env.PAYWAY_SANDBOX === '1' || process.env.PAYWAY_SANDBOX === 'true'
    ? 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase'
    : 'https://checkout.payway.com.kh/api/payment-gateway/v1/payments/purchase'),
).trim()
const PAYWAY_CHECK_URL = String(
  process.env.PAYWAY_CHECK_URL
  || (process.env.PAYWAY_SANDBOX === '1' || process.env.PAYWAY_SANDBOX === 'true'
    ? 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/check'
    : 'https://checkout.payway.com.kh/api/payment-gateway/v1/payments/check'),
).trim()

export function isPayWayConfigured() {
  return Boolean(PAYWAY_MERCHANT_ID && PAYWAY_API_KEY)
}

export function getPayWayCheckoutUrl() {
  return PAYWAY_CHECKOUT_URL
}

export function formatPayWayReqTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('')
}

function hmacSha512Base64(message, secret) {
  return crypto.createHmac('sha512', secret).update(String(message || ''), 'utf8').digest('base64')
}

/** Purchase hash field order per PayWay v2 docs. */
export function buildPurchaseHash(fields) {
  const concat = [
    fields.req_time,
    fields.merchant_id,
    fields.tran_id,
    fields.amount,
    fields.items,
    fields.shipping,
    fields.ctid,
    fields.pwt,
    fields.firstname,
    fields.lastname,
    fields.email,
    fields.phone,
    fields.type,
    fields.payment_option,
    fields.return_url,
    fields.cancel_url,
    fields.continue_success_url,
    fields.return_deeplink,
    fields.currency,
    fields.custom_fields,
    fields.return_params,
  ].join('')
  return hmacSha512Base64(concat, PAYWAY_API_KEY)
}

export function buildCheckTransactionHash(reqTime, merchantId, tranId) {
  return hmacSha512Base64(`${reqTime}${merchantId}${tranId}`, PAYWAY_API_KEY)
}

export function parseUsdAmountFromLabel(priceUsdLabel) {
  const m = String(priceUsdLabel || '').match(/(\d+(?:\.\d+)?)/)
  if (!m) return '0.00'
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return '0.00'
  return n.toFixed(2)
}

export function buildVipTranId(telegramUserId, atMs = Date.now()) {
  const uid = String(telegramUserId || '').replace(/\D/g, '').slice(-6) || '0'
  const tail = String(atMs).slice(-11)
  return `V${uid}${tail}`.slice(0, 20)
}

export function buildPurchaseFormFields(input) {
  const req_time = formatPayWayReqTime()
  const merchant_id = PAYWAY_MERCHANT_ID
  const tran_id = String(input.tranId || '').slice(0, 20)
  const amount = String(input.amount || '0.00')
  // Always neutral line item for ABA checkout (ignore caller-supplied marketing/novel titles).
  const items = Buffer.from(getPayWayItemsLine(), 'utf8').toString('base64')
  const shipping = ''
  const ctid = ''
  const pwt = ''
  const firstname = 'VIP'
  const lastname = 'Member'
  // Non-card checkout metadata only; do not collect real email/phone for card vaulting.
  const email = String(input.email || '').slice(0, 100)
  const phone = String(input.phone || '').slice(0, 20)
  const type = 'purchase'
  const payment_option = ''
  const return_url = String(input.returnUrl || '')
  const cancel_url = String(input.cancelUrl || input.returnUrl || '')
  const continue_success_url = String(input.continueSuccessUrl || input.returnUrl || '')
  const return_deeplink = ''
  const currency = String(input.currency || 'USD')
  const custom_fields =
    String(input.customFields || '').trim()
    || buildPayWayCustomFields({ tranId: tran_id, planId: input.planId })
  const return_params = String(input.returnParams || '')

  const base = {
    req_time,
    merchant_id,
    tran_id,
    amount,
    items,
    shipping,
    ctid,
    pwt,
    firstname,
    lastname,
    email,
    phone,
    type,
    payment_option,
    return_url,
    cancel_url,
    continue_success_url,
    return_deeplink,
    currency,
    custom_fields,
    return_params,
  }
  return { ...base, hash: buildPurchaseHash(base) }
}

export async function checkPayWayTransaction(tranId) {
  const tran_id = String(tranId || '').trim().slice(0, 20)
  if (!tran_id || !isPayWayConfigured()) {
    return { ok: false, status: '', raw: null, error: 'payway_not_configured' }
  }
  const req_time = formatPayWayReqTime()
  const merchant_id = PAYWAY_MERCHANT_ID
  const hash = buildCheckTransactionHash(req_time, merchant_id, tran_id)
  const body = new URLSearchParams({ req_time, merchant_id, tran_id, hash })
  try {
    const res = await fetch(PAYWAY_CHECK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const text = await res.text()
    let parsed = null
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
    const { status, code } = sanitizePayWayCheckStatus(parsed)
    const approved = status === 'APPROVED' || status === 'SUCCESS' || status === '00'
      || code === '0'
      || code === '00'
    return { ok: approved, status, error: approved ? '' : 'not_approved' }
  } catch (err) {
    return {
      ok: false,
      status: '',
      error: err instanceof Error ? err.message : 'check_failed',
    }
  }
}
