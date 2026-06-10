import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

function pngSizeFromDataUrl(dataUrl) {
  const raw = String(dataUrl || '').replace(/^data:image\/png;base64,/, '')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), bytes: buf.length }
}

function formatReqTime(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
}

const merchantId = String(process.env.PAYWAY_MERCHANT_ID || '').trim()
const apiKey = String(process.env.PAYWAY_API_KEY || process.env.PAYWAY_PUBLIC_KEY || '').trim()
let apiBase = String(process.env.PAYWAY_API_URL || 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1').trim().replace(/\/+$/, '')
for (const suffix of ['/payments/generate-qr', '/payments/purchase', '/payments/check']) {
  if (apiBase.toLowerCase().endsWith(suffix)) apiBase = apiBase.slice(0, -suffix.length).replace(/\/+$/, '')
}
const qrUrl = `${apiBase}/payments/generate-qr`

const templates = [
  'template1', 'template1_color',
  'template2', 'template2_color',
  'template3', 'template3_color',
  'template4', 'template4_color',
  'template5', 'template5_color',
  'template6', 'template6_color',
  'default',
]

async function callTemplate(template) {
  const req_time = formatReqTime()
  const tran_id = `tpl${Date.now().toString(36)}`.slice(0, 20)
  const amount = 1
  const items = Buffer.from(JSON.stringify([{ name: 'VIP', quantity: 1, price: amount }]), 'utf8').toString('base64')
  const fields = {
    req_time,
    merchant_id: merchantId,
    tran_id,
    amount,
    items,
    first_name: 'VIP',
    last_name: 'Member',
    email: '',
    phone: '',
    purchase_type: 'purchase',
    payment_option: 'abapay_khqr',
    callback_url: '',
    return_deeplink: '',
    currency: 'USD',
    custom_fields: '',
    return_params: '',
    payout: '',
    lifetime: 30,
    qr_image_template: template,
  }
  const concat = Object.values(fields).join('')
  const hash = crypto.createHmac('sha512', apiKey).update(concat).digest('base64')
  const res = await fetch(qrUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, hash }),
  })
  const data = await res.json().catch(() => ({}))
  const code = String(data?.status?.code ?? '')
  const qrImage = String(data?.qrImage || data?.qr_image || '')
  const size = pngSizeFromDataUrl(qrImage)
  return {
    template,
    ok: code === '0' || code === '00',
    code: code || String(res.status),
    message: String(data?.status?.message || data?.description || ''),
    png: size,
    kb: size ? Math.round(size.bytes / 1024) : null,
  }
}

if (!merchantId || !apiKey) {
  console.log(JSON.stringify({ error: 'missing_credentials' }, null, 2))
  process.exit(0)
}

const results = []
for (const t of templates) {
  try {
    results.push(await callTemplate(t))
  } catch (err) {
    results.push({ template: t, ok: false, error: err instanceof Error ? err.message : 'failed' })
  }
  await new Promise((r) => setTimeout(r, 400))
}
console.log(JSON.stringify({ qrUrl, results }, null, 2))
