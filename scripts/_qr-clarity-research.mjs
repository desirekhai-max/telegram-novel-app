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

function pngMeta(dataUrl) {
  const raw = String(dataUrl || '').replace(/^data:image\/png;base64,/, '')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null
  let dpi = null
  let offset = 8
  while (offset + 12 <= buf.length) {
    const len = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    if (type === 'pHYs' && len >= 9) {
      const xppu = buf.readUInt32BE(offset + 8)
      const unit = buf[offset + 16]
      if (unit === 1) dpi = Math.round(xppu * 0.0254)
    }
    offset += 12 + len
  }
  return {
    w: buf.readUInt32BE(16),
    h: buf.readUInt32BE(20),
    bytes: buf.length,
    kb: Math.round((buf.length / 1024) * 10) / 10,
    dpi,
  }
}

function formatReqTime(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
}

const merchantId = String(process.env.PAYWAY_MERCHANT_ID || '').trim()
const apiKey = String(process.env.PAYWAY_API_KEY || process.env.PAYWAY_PUBLIC_KEY || '').trim()
const currentTemplate = String(process.env.PAYWAY_QR_TEMPLATE || 'template3_color').trim()
let apiBase = String(process.env.PAYWAY_API_URL || 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1').trim().replace(/\/+$/, '')
for (const suffix of ['/payments/generate-qr', '/payments/purchase', '/payments/check']) {
  if (apiBase.toLowerCase().endsWith(suffix)) apiBase = apiBase.slice(0, -suffix.length).replace(/\/+$/, '')
}
const qrUrl = `${apiBase}/payments/generate-qr`

async function generateQr(template) {
  const req_time = formatReqTime()
  const tran_id = `cl${Date.now().toString(36)}`.slice(0, 20)
  const amount = 1
  const items = Buffer.from(JSON.stringify([{ name: 'VIP', quantity: 1, price: amount }]), 'utf8').toString('base64')
  const fields = {
    req_time, merchant_id: merchantId, tran_id, amount, items,
    first_name: 'VIP', last_name: 'Member', email: '', phone: '',
    purchase_type: 'purchase', payment_option: 'abapay_khqr',
    callback_url: '', return_deeplink: '', currency: 'USD',
    custom_fields: '', return_params: '', payout: '', lifetime: 30,
    qr_image_template: template,
  }
  const hash = crypto.createHmac('sha512', apiKey).update(Object.values(fields).join('')).digest('base64')
  const res = await fetch(qrUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, hash }),
  })
  const data = await res.json().catch(() => ({}))
  const code = String(data?.status?.code ?? '')
  const qrImage = String(data?.qrImage || data?.qr_image || '')
  const qrString = String(data?.qrString || data?.qr_string || '')
  return {
    template,
    ok: code === '0' || code === '00',
    code,
    message: String(data?.status?.message || ''),
    png: pngMeta(qrImage),
    qrStringLen: qrString.length,
    qrStringPreview: qrString.slice(0, 40) + '...',
  }
}

if (!merchantId || !apiKey) {
  console.log(JSON.stringify({ error: 'missing_credentials' }, null, 2))
  process.exit(0)
}

const templates = [
  currentTemplate,
  'template1_color', 'template2_color', 'template3_color',
  'template4_color', 'template5_color', 'template6_color',
]
const unique = [...new Set(templates)]
const results = []
for (const t of unique) {
  results.push(await generateQr(t))
  await new Promise((r) => setTimeout(r, 350))
}

// Extra: probe non-documented params (should fail or ignore)
async function probeExtraParams() {
  const req_time = formatReqTime()
  const tran_id = `xp${Date.now().toString(36)}`.slice(0, 20)
  const amount = 1
  const items = Buffer.from(JSON.stringify([{ name: 'VIP', quantity: 1, price: amount }]), 'utf8').toString('base64')
  const base = {
    req_time, merchant_id: merchantId, tran_id, amount, items,
    first_name: 'VIP', last_name: 'Member', email: '', phone: '',
    purchase_type: 'purchase', payment_option: 'abapay_khqr',
    callback_url: '', return_deeplink: '', currency: 'USD',
    custom_fields: '', return_params: '', payout: '', lifetime: 30,
    qr_image_template: currentTemplate,
    image_quality: 'high', resolution: 'hd', scale: 2, dpi: 300,
  }
  const hash = crypto.createHmac('sha512', apiKey).update(Object.values(base).join('')).digest('base64')
  const res = await fetch(qrUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...base, hash }),
  })
  const data = await res.json().catch(() => ({}))
  return {
    probe: 'extra_params_image_quality_resolution_scale_dpi',
    ok: String(data?.status?.code ?? '') === '0',
    code: String(data?.status?.code ?? res.status),
    message: String(data?.status?.message || ''),
    png: pngMeta(String(data?.qrImage || '')),
  }
}

const probe = await probeExtraParams()

console.log(JSON.stringify({
  currentTemplate,
  qrUrl,
  results,
  probe,
  apiDocNotes: {
    hasQrResolutionParam: false,
    hasHdTemplate: false,
    officialRecommendation: 'use qrString + local QR generation + KHQR frame template',
  },
}, null, 2))
