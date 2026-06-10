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

const { generateAbaKhqrPayment, buildPayWayReturnDeeplink } = await import('../server/payway.js')

const tranId = `V${String(Date.now()).slice(-12)}`.slice(0, 20)
const returnUrl = `${process.env.PAYWAY_APP_PUBLIC_URL}/vip/payment-return?tran_id=${encodeURIComponent(tranId)}&plan_id=vip_entry`
console.log('returnUrl', returnUrl)
console.log('deeplink', buildPayWayReturnDeeplink(returnUrl))

for (const label of ['with_deeplink', 'empty_deeplink', 'example_test']) {
  const url = label === 'with_deeplink'
    ? returnUrl
    : label === 'example_test'
      ? `https://example.test/vip/payment-return?tran_id=${encodeURIComponent(tranId)}`
      : ''
  const r = await generateAbaKhqrPayment({
    tranId: `V${String(Date.now() + Math.random() * 1000).slice(-12)}`.slice(0, 20),
    amount: '1.00',
    planId: 'vip_entry',
    returnDeeplinkUrl: url,
  })
  console.log(label, r.ok, r.error || `qrString=${Boolean(r.qrString)} qrImage=${Boolean(r.qrImage)}`)
}
