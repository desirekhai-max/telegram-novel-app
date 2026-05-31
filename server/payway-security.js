/**
 * PayWay / PCI helpers: we never persist card PAN, CVV, or expiry.
 * Card entry happens only on ABA PayWay hosted checkout pages.
 *
 * Checkout copy policy: `items` / `custom_fields` must stay neutral (see `paywayNeutralCopy.js`).
 * Do not forward novel titles, Khmer plan marketing names, or user display names into PayWay fields.
 */

/** Fields allowed in our server → PayWay purchase POST (hosted checkout). */
export const PAYWAY_CHECKOUT_FIELD_ALLOWLIST = new Set([
  'req_time',
  'merchant_id',
  'tran_id',
  'amount',
  'items',
  'shipping',
  'ctid',
  'pwt',
  'firstname',
  'lastname',
  'email',
  'phone',
  'type',
  'payment_option',
  'return_url',
  'cancel_url',
  'continue_success_url',
  'return_deeplink',
  'currency',
  'custom_fields',
  'return_params',
  'hash',
])

const SENSITIVE_KEY_RE = /(?:^|_)(?:card|cvv|cvc|pan|iban|account_?number|routing|sort_?code|pin|secret|password|exp(?:iry|_date|_month|_year)?|cardholder|card_?no|cardnumber)(?:$|_)/i

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSensitivePaymentKey(value) {
  const key = String(value || '').trim()
  if (!key) return false
  const norm = key.toLowerCase().replace(/[-\s]/g, '_')
  return SENSITIVE_KEY_RE.test(norm)
}

/**
 * Drop card/CVV/expiry-like keys from objects (webhooks, API echoes, logs).
 * @param {unknown} input
 * @returns {unknown}
 */
export function stripSensitivePaymentFields(input) {
  if (input == null || typeof input !== 'object') return input
  if (Array.isArray(input)) {
    return input.map((item) => stripSensitivePaymentFields(item))
  }
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [key, value] of Object.entries(input)) {
    if (isSensitivePaymentKey(key)) continue
    out[key] = typeof value === 'object' ? stripSensitivePaymentFields(value) : value
  }
  return out
}

/**
 * Only forward PayWay checkout fields we generate server-side (no card inputs).
 * @param {Record<string, unknown>} fields
 * @returns {Record<string, string>}
 */
export function filterCheckoutFormFieldsForClient(fields) {
  /** @type {Record<string, string>} */
  const out = {}
  if (!fields || typeof fields !== 'object') return out
  for (const [key, value] of Object.entries(fields)) {
    const name = String(key || '').trim()
    if (!PAYWAY_CHECKOUT_FIELD_ALLOWLIST.has(name)) continue
    if (isSensitivePaymentKey(name)) continue
    out[name] = String(value ?? '')
  }
  return out
}

/**
 * Safe subset of PayWay check-transaction API response (status only).
 * @param {unknown} raw
 * @returns {{ status: string, code: string }}
 */
export function sanitizePayWayCheckStatus(raw) {
  const safe = stripSensitivePaymentFields(raw)
  const row = safe && typeof safe === 'object' && !Array.isArray(safe) ? safe : {}
  const status = String(
    row.status
    || row.payment_status
    || row?.data?.payment_status
    || row?.data?.status
    || '',
  ).toUpperCase()
  const code = String(row.status_code || row?.status?.code || row?.data?.status_code || '').trim()
  return { status, code }
}
