import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

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
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), bytes: buf.length, kb: Math.round(buf.length / 1024 * 10) / 10 }
}

function formatReqTime(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
}

async function fetchSession() {
  const merchantId = process.env.PAYWAY_MERCHANT_ID
  const apiKey = process.env.PAYWAY_API_KEY || process.env.PAYWAY_PUBLIC_KEY
  const template = process.env.PAYWAY_QR_TEMPLATE || 'template3_color'
  let apiBase = String(process.env.PAYWAY_API_URL || 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1').replace(/\/+$/, '')
  for (const suffix of ['/payments/generate-qr', '/payments/purchase', '/payments/check']) {
    if (apiBase.toLowerCase().endsWith(suffix)) apiBase = apiBase.slice(0, -suffix.length).replace(/\/+$/, '')
  }
  const tran_id = `ap${Date.now().toString(36)}`.slice(0, 20)
  const amount = 1
  const items = Buffer.from(JSON.stringify([{ name: 'VIP', quantity: 1, price: amount }]), 'utf8').toString('base64')
  const fields = {
    req_time: formatReqTime(), merchant_id: merchantId, tran_id, amount, items,
    first_name: 'VIP', last_name: 'Member', email: '', phone: '',
    purchase_type: 'purchase', payment_option: 'abapay_khqr',
    callback_url: '', return_deeplink: '', currency: 'USD',
    custom_fields: '', return_params: '', payout: '', lifetime: 30,
    qr_image_template: template,
  }
  const hash = crypto.createHmac('sha512', apiKey).update(Object.values(fields).join('')).digest('base64')
  const res = await fetch(`${apiBase}/payments/generate-qr`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, hash }),
  })
  const data = await res.json()
  const qrImage = String(data?.qrImage || '')
  return {
    uiMock: false, tranId: tran_id, planId: 'vip_entry', amountLabel: '$1', amount: 1,
    currency: 'USD', merchantLabel: 'VIP-Subscription', qrImage,
    qrString: String(data?.qrString || ''), abapayDeeplink: '', appStore: '', playStore: '', returnUrl: '',
  }
}

const assets = 'C:/Users/ASUS TUF/.cursor/projects/c-Users-ASUS-TUF-OneDrive-Desktop/assets'
const outShot = path.join(assets, 'qr-pixel-verify-app-console.png')
const session = await fetchSession()
const png = pngMeta(session.qrImage)
const base = process.env.VITE_DEV_URL || 'http://localhost:5174'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await context.addInitScript((payload) => {
  sessionStorage.setItem('tg_vip_aba_khqr_session_v1', JSON.stringify(payload))
}, session)
const page = await context.newPage()
const logs = []
page.on('console', (m) => logs.push(m.text()))

await page.goto(`${base}/vip/aba-khqr?tran_id=${encodeURIComponent(session.tranId)}&plan_id=vip_entry`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.tg-aba-khqr-page__qr', { timeout: 15000 })

const result = await page.evaluate((pngMeta) => {
  const img = document.querySelector('.tg-aba-khqr-page__qr')
  const cs = getComputedStyle(img)
  const rect = img.getBoundingClientRect()
  const lines = [
    '=== REAL APP: VipAbaKhqrPage .tg-aba-khqr-page__qr ===',
    '',
    '1. img.naturalWidth: ' + img.naturalWidth,
    '2. img.naturalHeight: ' + img.naturalHeight,
    '',
    '3. PNG decoded (IHDR):',
    '   width: ' + pngMeta.w,
    '   height: ' + pngMeta.h,
    '   kb: ' + pngMeta.kb,
    '',
    '4. CSS vs real pixels:',
    '   CSS width: ' + cs.width,
    '   CSS height: ' + cs.height,
    '   display rect width: ' + Math.round(rect.width),
    '   display rect height: ' + Math.round(rect.height),
    '   scaled horizontally: ' + (Math.round(rect.width) !== img.naturalWidth),
    '   scaled vertically: ' + (Math.round(rect.height) !== img.naturalHeight),
    '   scaleX: ' + (rect.width / img.naturalWidth).toFixed(3),
    '   scaleY: ' + (rect.height / img.naturalHeight).toFixed(3),
    '   devicePixelRatio: ' + window.devicePixelRatio,
  ]
  const text = lines.join('\n')
  console.log(text)
  const pre = document.createElement('pre')
  pre.id = 'pixel-log'
  pre.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;margin:0;padding:10px;background:#111;color:#0f0;font:11px monospace;white-space:pre-wrap;max-height:45vh;overflow:auto;'
  pre.textContent = text
  document.body.prepend(pre)
  return {
    naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
    displayWidth: Math.round(rect.width), displayHeight: Math.round(rect.height),
    scaleX: rect.width / img.naturalWidth, scaleY: rect.height / img.naturalHeight,
    scaledH: Math.round(rect.width) !== img.naturalWidth,
    scaledV: Math.round(rect.height) !== img.naturalHeight,
    cssWidth: cs.width, cssHeight: cs.height,
  }
}, png)

await page.locator('#pixel-log').screenshot({ path: outShot })
fs.writeFileSync(path.join(assets, 'qr-pixel-verify-app-result.json'), JSON.stringify({ png, result, logs, url: base }, null, 2))
console.log(JSON.stringify({ png, result, screenshot: outShot }, null, 2))
await browser.close()
