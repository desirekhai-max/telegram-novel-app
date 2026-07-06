import crypto from 'node:crypto'
import {
  buildPayWayCustomFields,
  buildPayWayQrCustomFieldsBase64,
  getPayWayItemsLine,
} from './paywayNeutralCopy.js'
import { sanitizePayWayCheckStatus } from './payway-security.js'

/** Card PAN / CVV / expiry are entered only on PayWay hosted pages — never in this app. */

const PAYWAY_MERCHANT_ID = String(process.env.PAYWAY_MERCHANT_ID || '').trim()
const PAYWAY_API_KEY = String(process.env.PAYWAY_API_KEY || process.env.PAYWAY_PUBLIC_KEY || '').trim()

const DEFAULT_SANDBOX_API_BASE = 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1'

const PAYWAY_QR_TEMPLATE = String(process.env.PAYWAY_QR_TEMPLATE || 'template3_color').trim()
const PAYWAY_QR_LIFETIME_MIN = Math.min(
  43200,
  Math.max(3, Math.floor(Number(process.env.PAYWAY_QR_LIFETIME_MIN || 5) || 5)),
)

function isSandboxModeEnabled() {
  const flag = String(process.env.PAYWAY_SANDBOX ?? '1').trim().toLowerCase()
  return flag === '1' || flag === 'true' || flag === 'yes'
}

function isProductionPayWayUrl(url) {
  const u = String(url || '').trim().toLowerCase()
  if (!u) return false
  return u.includes('checkout.payway.com.kh') && !u.includes('checkout-sandbox.payway.com.kh')
}

function normalizeApiBaseUrl(raw) {
  let url = String(raw || '').trim().replace(/\/+$/, '')
  if (!url) return ''
  const suffixes = [
    '/payments/purchase',
    '/payments/check-transaction-2',
    '/payments/check-transaction',
    '/payments/check',
    '/payments/generate-qr',
  ]
  for (const suffix of suffixes) {
    if (url.toLowerCase().endsWith(suffix)) {
      url = url.slice(0, -suffix.length).replace(/\/+$/, '')
      break
    }
  }
  return url.replace(/\/+$/, '')
}

function resolveApiBaseUrl() {
  const explicit = normalizeApiBaseUrl(process.env.PAYWAY_API_URL || '')
  if (explicit) return explicit
  if (isSandboxModeEnabled()) return DEFAULT_SANDBOX_API_BASE
  return ''
}

function joinApiEndpoint(base, segment) {
  const root = normalizeApiBaseUrl(base)
  if (!root) return ''
  return `${root}/${String(segment || '').replace(/^\/+/, '')}`
}

function resolveEndpointUrl(envOverride, segment, legacyProductionUrl) {
  const override = String(envOverride || '').trim()
  if (override) return override
  const base = resolveApiBaseUrl()
  if (base) return joinApiEndpoint(base, segment)
  if (isSandboxModeEnabled()) return joinApiEndpoint(DEFAULT_SANDBOX_API_BASE, segment)
  return legacyProductionUrl
}

const PAYWAY_CHECKOUT_URL = resolveEndpointUrl(
  process.env.PAYWAY_CHECKOUT_URL,
  'payments/purchase',
  'https://checkout.payway.com.kh/api/payment-gateway/v1/payments/purchase',
)
const PAYWAY_CHECK_URL = resolveEndpointUrl(
  process.env.PAYWAY_CHECK_URL,
  'payments/check-transaction-2',
  'https://checkout.payway.com.kh/api/payment-gateway/v1/payments/check-transaction-2',
)
const PAYWAY_QR_URL = resolveEndpointUrl(
  process.env.PAYWAY_QR_URL,
  'payments/generate-qr',
  'https://checkout.payway.com.kh/api/payment-gateway/v1/payments/generate-qr',
)

const PAYWAY_APPROVED_STATUSES = new Set(['APPROVED', 'SUCCESS', 'PAID', 'COMPLETED', '00'])

function isPhase1SandboxOnly() {
  if (!isSandboxModeEnabled()) return false
  const allowProduction = String(process.env.PAYWAY_ALLOW_PRODUCTION || '').trim() === '1'
  if (allowProduction) return true
  const urls = [PAYWAY_CHECKOUT_URL, PAYWAY_CHECK_URL, PAYWAY_QR_URL]
  return !urls.some(isProductionPayWayUrl)
}

export function isPayWayConfigured() {
  if (!PAYWAY_MERCHANT_ID || !PAYWAY_API_KEY) return false
  return isPhase1SandboxOnly()
}

export function getPayWayQrLifetimeMinutes() {
  return PAYWAY_QR_LIFETIME_MIN
}

export function getPayWaySandboxStatus() {
  return {
    sandboxMode: isSandboxModeEnabled(),
    configured: isPayWayConfigured(),
    merchantIdPresent: Boolean(PAYWAY_MERCHANT_ID),
    apiKeyPresent: Boolean(PAYWAY_API_KEY),
    apiBaseUrl: resolveApiBaseUrl() || null,
    checkoutUrl: PAYWAY_CHECKOUT_URL || null,
    checkUrl: PAYWAY_CHECK_URL || null,
    qrUrl: PAYWAY_QR_URL || null,
    qrLifetimeMin: PAYWAY_QR_LIFETIME_MIN,
    phase1SandboxOnly: isPhase1SandboxOnly(),
  }
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

/** PayWay QR API: base64 JSON { ios_scheme, android_scheme }; encoded length must be ≤ 255. */
export function buildPayWayReturnDeeplink(returnUrl) {
  const url = String(returnUrl || '').trim()
  if (!url) return ''
  const encode = (target) => {
    const payload = { ios_scheme: target, android_scheme: target }
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  }
  const encodePlatformTargets = (iosTarget, androidTarget) => {
    const payload = { ios_scheme: iosTarget, android_scheme: androidTarget }
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  }
  const full = encode(url)
  if (full.length <= 255) return full
  try {
    const parsed = new URL(url)
    const lower = new URL(url)
    const upper = new URL(url)
    lower.searchParams.delete('startApp')
    upper.searchParams.delete('startapp')
    if (
      parsed.searchParams.has('startapp')
      && parsed.searchParams.has('startApp')
      && lower.toString() !== upper.toString()
    ) {
      const platformTargets = encodePlatformTargets(lower.toString(), lower.toString())
      if (platformTargets.length <= 255) return platformTargets
    }
  } catch {
    /* ignore */
  }
  const withoutQuery = url.split('?')[0]
  if (withoutQuery && withoutQuery !== url) {
    const shortened = encode(withoutQuery)
    if (shortened.length <= 255) return shortened
  }
  return ''
}

function buildGenerateQrHash(fields) {
  const concat = [
    fields.req_time,
    fields.merchant_id,
    fields.tran_id,
    fields.amount,
    fields.items,
    fields.first_name,
    fields.last_name,
    fields.email,
    fields.phone,
    fields.purchase_type,
    fields.payment_option,
    fields.callback_url,
    fields.return_deeplink,
    fields.currency,
    fields.custom_fields,
    fields.return_params,
    fields.payout,
    fields.lifetime,
    fields.qr_image_template,
  ].join('')
  return hmacSha512Base64(concat, PAYWAY_API_KEY)
}

/**
 * ABA KHQR + abapay_deeplink (Figma Telegram Integration flow).
 * @param {{
 *   tranId: string,
 *   amount: string,
 *   planId?: string,
 *   returnDeeplinkUrl: string,
 *   callbackUrl?: string,
 * }} input
 */
export async function generateAbaKhqrPayment(input) {
  if (!isPayWayConfigured()) {
    return { ok: false, error: 'payway_not_configured' }
  }
  const tran_id = String(input.tranId || '').trim().slice(0, 20)
  if (!tran_id) return { ok: false, error: 'tran_id_required' }
  const amountNum = Number(String(input.amount || '0'))
  if (!Number.isFinite(amountNum) || amountNum <= 0) return { ok: false, error: 'invalid_amount' }

  const req_time = formatPayWayReqTime()
  const merchant_id = PAYWAY_MERCHANT_ID
  // QR API requires base64-encoded JSON array for items (not plain-text line).
  const items = Buffer.from(
    JSON.stringify([{ name: getPayWayItemsLine(), quantity: 1, price: amountNum }]),
    'utf8',
  ).toString('base64')
  // QR API: base64(JSON) custom_fields, max 255 chars encoded (see buildPayWayQrCustomFieldsBase64).
  const custom_fields = buildPayWayQrCustomFieldsBase64({ tranId: tran_id, planId: input.planId })
  const return_deeplink = buildPayWayReturnDeeplink(input.returnDeeplinkUrl)
  const callback_url = input.callbackUrl
    ? Buffer.from(String(input.callbackUrl), 'utf8').toString('base64')
    : ''

  const base = {
    req_time,
    merchant_id,
    tran_id,
    first_name: 'VIP',
    last_name: 'Member',
    email: '',
    phone: '',
    amount: amountNum,
    currency: 'USD',
    purchase_type: 'purchase',
    payment_option: 'abapay_khqr',
    items,
    callback_url,
    return_deeplink,
    custom_fields,
    return_params: '',
    payout: '',
    lifetime: PAYWAY_QR_LIFETIME_MIN,
    qr_image_template: PAYWAY_QR_TEMPLATE,
  }
  const hash = buildGenerateQrHash(base)
  const body = { ...base, hash }

  try {
    const res = await fetch(PAYWAY_QR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let parsed = null
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
    const statusCode = String(parsed?.status?.code ?? parsed?.status ?? '')
    if (!res.ok || (statusCode && statusCode !== '0' && statusCode !== '00')) {
      return {
        ok: false,
        error: String(parsed?.status?.message || parsed?.description || `qr_http_${res.status}`),
      }
    }
    const qrImage = String(parsed?.qrImage || parsed?.qr_image || '').trim()
    const qrString = String(parsed?.qrString || parsed?.qr_string || '').trim()
    const abapayDeeplink = String(parsed?.abapay_deeplink || parsed?.abapayDeeplink || '').trim()
    if (!qrImage && !qrString && !abapayDeeplink) {
      return { ok: false, error: 'qr_payload_empty' }
    }
    return {
      ok: true,
      tranId: tran_id,
      amount: amountNum,
      currency: String(parsed?.currency || 'USD'),
      qrImage,
      qrString,
      abapayDeeplink,
      appStore: String(parsed?.app_store || parsed?.appStore || '').trim(),
      playStore: String(parsed?.play_store || parsed?.playStore || '').trim(),
      qrImageTemplate: PAYWAY_QR_TEMPLATE,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'qr_request_failed',
    }
  }
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
  const checkStartedAt = new Date().toISOString()
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
    const { status } = sanitizePayWayCheckStatus(parsed)
    const approved = PAYWAY_APPROVED_STATUSES.has(status)
    console.log(`[payway] check-transaction tran_id=${tran_id} at=${checkStartedAt}`)
    return { ok: approved, status, error: approved ? '' : 'not_approved' }
  } catch (err) {
    return {
      ok: false,
      status: '',
      error: err instanceof Error ? err.message : 'check_failed',
    }
  }
}
