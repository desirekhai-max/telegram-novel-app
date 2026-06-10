import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { buildPayWayCustomFields, buildPayWayQrCustomFieldsBase64 } from '../server/paywayNeutralCopy.js'
import { buildPayWayReturnDeeplink } from '../server/payway.js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const envPath = path.join(root, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (key && process.env[key] == null) process.env[key] = value
  }
}

const mid = process.env.PAYWAY_MERCHANT_ID
const key = process.env.PAYWAY_API_KEY
const base = String(process.env.PAYWAY_API_URL || '')
  .trim()
  .replace(/\/payments\/generate-qr$/i, '')
  .replace(/\/+$/, '')
const qrUrl = `${base}/payments/generate-qr`

function hmac(message, secret) {
  return crypto.createHmac('sha512', secret).update(message, 'utf8').digest('base64')
}

function reqTime() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return [d.getUTCFullYear(), p(d.getUTCMonth() + 1), p(d.getUTCDate()), p(d.getUTCHours()), p(d.getUTCMinutes()), p(d.getUTCSeconds())].join('')
}

const itemsPlainB64 = Buffer.from('VIP-Subscription', 'utf8').toString('base64')
const itemsJsonB64 = Buffer.from(JSON.stringify([{ name: 'VIP-Subscription', quantity: 1, price: 1 }]), 'utf8').toString('base64')
const customPlain = JSON.stringify({ order_title: 'VIP-Subscription', ref: 'TEST' })
const customB64 = Buffer.from(customPlain, 'utf8').toString('base64')

const fullCustomB64 = Buffer.from(
  buildPayWayCustomFields({ tranId: 'VTEST123', planId: 'vip_entry' }),
  'utf8',
).toString('base64')

const variants = [
  { label: 'plain_custom_plain_items', items: itemsPlainB64, custom_fields: customPlain },
  { label: 'b64_custom_plain_items', items: itemsPlainB64, custom_fields: customB64 },
  { label: 'b64_custom_json_items', items: itemsJsonB64, custom_fields: customB64 },
  { label: 'empty_custom_json_items', items: itemsJsonB64, custom_fields: '' },
  { label: 'full_custom_json_items', items: itemsJsonB64, custom_fields: fullCustomB64 },
  {
    label: 'qr_custom_json_items',
    items: itemsJsonB64,
    custom_fields: buildPayWayQrCustomFieldsBase64({ tranId: 'VTEST123', planId: 'vip_entry' }),
  },
]

const netlifyReturn = `${process.env.PAYWAY_APP_PUBLIC_URL}/vip/payment-return?tran_id=VTEST123&plan_id=vip_entry`
variants.push({
  label: 'qr_custom_with_deeplink',
  items: itemsJsonB64,
  custom_fields: buildPayWayQrCustomFieldsBase64({ tranId: 'VTEST123', planId: 'vip_entry' }),
  return_deeplink: buildPayWayReturnDeeplink(netlifyReturn),
})

for (const variant of variants) {
  const tran_id = `V${String(Date.now()).slice(-12)}`.slice(0, 20)
  const req_time = reqTime()
  const baseFields = {
    req_time,
    merchant_id: mid,
    tran_id,
    first_name: 'VIP',
    last_name: 'Member',
    email: '',
    phone: '',
    amount: 1,
    currency: 'USD',
    purchase_type: 'purchase',
    payment_option: 'abapay_khqr',
    items: variant.items,
    callback_url: '',
    return_deeplink: variant.return_deeplink || '',
    custom_fields: variant.custom_fields,
    return_params: '',
    payout: '',
    lifetime: 30,
    qr_image_template: 'template3_color',
  }
  const concat = [
    baseFields.req_time,
    baseFields.merchant_id,
    baseFields.tran_id,
    baseFields.amount,
    baseFields.items,
    baseFields.first_name,
    baseFields.last_name,
    baseFields.email,
    baseFields.phone,
    baseFields.purchase_type,
    baseFields.payment_option,
    baseFields.callback_url,
    baseFields.return_deeplink,
    baseFields.currency,
    baseFields.custom_fields,
    baseFields.return_params,
    baseFields.payout,
    baseFields.lifetime,
    baseFields.qr_image_template,
  ].join('')
  const hash = hmac(concat, key)
  const res = await fetch(qrUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...baseFields, hash }),
  })
  const text = await res.text()
  console.log(variant.label, res.status, text.slice(0, 220))
}
