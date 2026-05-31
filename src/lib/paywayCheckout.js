/** Must match server `PAYWAY_CHECKOUT_FIELD_ALLOWLIST` — no card/CVV/expiry fields. */
const CHECKOUT_FIELD_ALLOWLIST = new Set([
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

const SENSITIVE_FIELD_RE = /(?:^|_)(?:card|cvv|cvc|pan|iban|exp(?:iry|_date|_month|_year)?|cardholder|card_?no|cardnumber)(?:$|_)/i

export const PAYWAY_CHECKOUT_SESSION_KEY = 'tg_payway_checkout_pending_v1'

export function isPayWayCheckoutUrl(url) {
  return /^https:\/\/checkout(-sandbox)?\.payway\.com\.kh\//i.test(String(url || '').trim())
}

function normalizeFormFields(formFields) {
  /** @type {Record<string, string>} */
  const out = {}
  if (!formFields || typeof formFields !== 'object') return out
  for (const [key, value] of Object.entries(formFields)) {
    const name = String(key || '').trim()
    if (!CHECKOUT_FIELD_ALLOWLIST.has(name)) continue
    if (SENSITIVE_FIELD_RE.test(name)) continue
    out[name] = String(value ?? '')
  }
  return out
}

export function savePayWayCheckoutSession(payload) {
  try {
    sessionStorage.setItem(PAYWAY_CHECKOUT_SESSION_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function loadPayWayCheckoutSession() {
  try {
    const raw = sessionStorage.getItem(PAYWAY_CHECKOUT_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function clearPayWayCheckoutSession() {
  try {
    sessionStorage.removeItem(PAYWAY_CHECKOUT_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Redirect to ABA PayWay hosted checkout. Card data is entered only on PayWay pages.
 * @returns {{ ok: boolean, reason: string }}
 */
export function submitPayWayCheckoutForm(checkoutUrl, formFields) {
  const action = String(checkoutUrl || '').trim()
  if (!action) return { ok: false, reason: 'missing_checkout_url' }
  if (!isPayWayCheckoutUrl(action)) return { ok: false, reason: 'invalid_checkout_url' }

  const fields = normalizeFormFields(formFields)
  if (!fields.hash || !fields.tran_id || !fields.merchant_id) {
    return { ok: false, reason: 'missing_required_fields' }
  }

  const form = document.createElement('form')
  form.method = 'POST'
  form.action = action
  form.acceptCharset = 'UTF-8'
  form.style.display = 'none'
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
  return { ok: true, reason: '' }
}
