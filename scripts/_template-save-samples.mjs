import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outDir = 'C:/Users/ASUS TUF/.cursor/projects/c-Users-ASUS-TUF-OneDrive-Desktop/assets/payway-templates'
fs.mkdirSync(outDir, { recursive: true })
const envPath = path.join(root, '.env')
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq <= 0) continue
  const key = trimmed.slice(0, eq).trim()
  const value = trimmed.slice(eq + 1).trim()
  if (key && process.env[key] == null) process.env[key] = value
}
const merchantId = process.env.PAYWAY_MERCHANT_ID
const apiKey = process.env.PAYWAY_API_KEY || process.env.PAYWAY_PUBLIC_KEY
let apiBase = String(process.env.PAYWAY_API_URL || 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1').replace(/\/+$/, '')
for (const suffix of ['/payments/generate-qr', '/payments/purchase', '/payments/check']) {
  if (apiBase.toLowerCase().endsWith(suffix)) apiBase = apiBase.slice(0, -suffix.length).replace(/\/+$/, '')
}
const qrUrl = `${apiBase}/payments/generate-qr`
const templates = ['template2_color', 'template3_color', 'template4_color', 'template5_color']

async function save(template) {
  const req_time = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  const tran_id = `s${Date.now().toString(36)}`.slice(0, 20)
  const amount = 1
  const items = Buffer.from(JSON.stringify([{ name: 'VIP', quantity: 1, price: amount }]), 'utf8').toString('base64')
  const fields = { req_time, merchant_id: merchantId, tran_id, amount, items, first_name: 'VIP', last_name: 'Member', email: '', phone: '', purchase_type: 'purchase', payment_option: 'abapay_khqr', callback_url: '', return_deeplink: '', currency: 'USD', custom_fields: '', return_params: '', payout: '', lifetime: 30, qr_image_template: template }
  const hash = crypto.createHmac('sha512', apiKey).update(Object.values(fields).join('')).digest('base64')
  const res = await fetch(qrUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, hash }) })
  const data = await res.json()
  const qrImage = String(data?.qrImage || '')
  const raw = qrImage.replace(/^data:image\/png;base64,/, '')
  fs.writeFileSync(path.join(outDir, `${template}.png`), Buffer.from(raw, 'base64'))
  console.log('saved', template)
}
for (const t of templates) await save(t)
