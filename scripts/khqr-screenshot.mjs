import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = 'C:/Users/ASUS TUF/.cursor/projects/c-Users-ASUS-TUF-OneDrive-Desktop/assets/khqr-one-screen-payway-style.png'

// Tall PayWay-style card proportions (SVG stand-in for real qrImage)
const tallKhqrSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="820" viewBox="0 0 560 820">
  <rect width="560" height="820" rx="24" fill="#fff"/>
  <rect width="560" height="88" rx="24" fill="#e31837"/>
  <rect y="64" width="560" height="24" fill="#fff"/>
  <text x="280" y="58" text-anchor="middle" fill="#fff" font-size="36" font-weight="700" font-family="system-ui">KHQR</text>
  <text x="280" y="150" text-anchor="middle" fill="#111" font-size="28" font-weight="600" font-family="system-ui">69KKH NOVEL</text>
  <text x="280" y="200" text-anchor="middle" fill="#111" font-size="40" font-weight="700" font-family="system-ui">1.00 USD</text>
  <line x1="40" y1="230" x2="520" y2="230" stroke="#ddd" stroke-width="2" stroke-dasharray="8 6"/>
  <rect x="80" y="260" width="400" height="400" fill="#f8fafc" stroke="#e2e8f0"/>
  <g fill="#0f172a">
    ${Array.from({ length: 12 }, (_, row) =>
      Array.from({ length: 12 }, (_, col) =>
        ((row + col) % 3 === 0 ? `<rect x="${100 + col * 30}" y="${280 + row * 30}" width="28" height="28"/>` : ''),
      ).join(''),
    ).join('')}
  </g>
</svg>`
const qrImage = `data:image/svg+xml,${encodeURIComponent(tallKhqrSvg)}`

const session = {
  uiMock: false,
  tranId: 'screenshot_demo_tran',
  planId: 'vip_entry',
  amountLabel: '$1',
  amount: 1,
  currency: 'USD',
  merchantLabel: 'VIP-Subscription',
  qrImage,
  qrString: '',
  abapayDeeplink: '',
  appStore: '',
  playStore: '',
  returnUrl: '',
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
await context.addInitScript((payload) => {
  sessionStorage.setItem('tg_vip_aba_khqr_session_v1', JSON.stringify(payload))
}, session)
const page = await context.newPage()
await page.goto('http://localhost:5173/vip/aba-khqr?tran_id=screenshot_demo_tran&plan_id=vip_entry', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.tg-aba-khqr-page__qr', { timeout: 10000 })
await page.waitForTimeout(800)

const metrics = await page.evaluate(() => ({
  scrollHeight: document.documentElement.scrollHeight,
  clientHeight: document.documentElement.clientHeight,
  overflow: getComputedStyle(document.documentElement).overflow,
  bodyOverflow: getComputedStyle(document.body).overflow,
}))

await page.screenshot({ path: outPath, fullPage: false })
writeFileSync(join(dirname(outPath), 'khqr-scroll-metrics.json'), JSON.stringify(metrics, null, 2))
await browser.close()
console.log('saved', outPath)
console.log('metrics', metrics)
