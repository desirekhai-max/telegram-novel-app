import { chromium } from 'playwright'

const tallKhqrSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="820" viewBox="0 0 560 820">
  <rect width="560" height="820" rx="24" fill="#fff"/>
  <rect width="560" height="88" rx="24" fill="#e31837"/>
  <text x="280" y="58" text-anchor="middle" fill="#fff" font-size="36" font-weight="700" font-family="system-ui">KHQR</text>
  <text x="280" y="150" text-anchor="middle" fill="#111" font-size="28" font-weight="600" font-family="system-ui">69KKH NOVEL</text>
  <text x="280" y="200" text-anchor="middle" fill="#111" font-size="40" font-weight="700" font-family="system-ui">1.00 USD</text>
  <line x1="40" y1="230" x2="520" y2="230" stroke="#ddd" stroke-width="2" stroke-dasharray="8 6"/>
  <rect x="80" y="260" width="400" height="400" fill="#f8fafc" stroke="#e2e8f0"/>
</svg>`
const session = {
  uiMock: false,
  tranId: 'measure_tran',
  planId: 'vip_entry',
  amountLabel: '$1',
  amount: 1,
  currency: 'USD',
  merchantLabel: 'VIP-Subscription',
  qrImage: `data:image/svg+xml,${encodeURIComponent(tallKhqrSvg)}`,
  qrString: '',
  abapayDeeplink: '',
  appStore: '',
  playStore: '',
  returnUrl: '',
}

const base = process.argv[2] || 'http://localhost:5174'
const out = process.argv[3] || ''
const vw = Number(process.argv[4] || 390)
const vh = Number(process.argv[5] || 844)

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: vw, height: vh } })
await context.addInitScript((payload) => {
  sessionStorage.setItem('tg_vip_aba_khqr_session_v1', JSON.stringify(payload))
}, session)
const page = await context.newPage()
await page.goto(`${base}/vip/aba-khqr?tran_id=measure_tran&plan_id=vip_entry`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.tg-aba-khqr-page__qr', { timeout: 10000 })
await page.evaluate(() => {
  const p = document.createElement('p')
  p.className = 'tg-aba-khqr-page__status'
  p.lang = 'km'
  p.textContent = 'កំពុងរង់ចាំការបញ្ជាក់ការទូទាត់…'
  document.querySelector('.tg-aba-khqr-page__panel')?.appendChild(p)
})

const report = await page.evaluate(() => {
  const img = document.querySelector('.tg-aba-khqr-page__qr')
  const cs = img ? getComputedStyle(img) : null
  const rect = img?.getBoundingClientRect()
  const vh = window.innerHeight
  const maxHeightPx = cs ? parseFloat(cs.maxHeight) || 0 : 0
  const naturalW = img?.naturalWidth || 0
  const naturalH = img?.naturalHeight || 0
  const renderedW = Math.round(rect?.width || 0)
  const renderedH = Math.round(rect?.height || 0)
  const widthIfNoMaxHeight = naturalW && naturalH ? Math.round((vh * 0.8) * (naturalW / naturalH) * (naturalH / naturalW)) : 0
  const scaleByHeight = naturalW && naturalH && maxHeightPx ? maxHeightPx / naturalH : 0
  const widthFromMaxHeight = naturalW && scaleByHeight ? Math.round(naturalW * scaleByHeight * (renderedH / (naturalH * scaleByHeight || 1))) : 0
  const expectedAt80vw = Math.round(window.innerWidth * 0.8)
  const heightLimited = maxHeightPx > 0 && renderedH >= maxHeightPx - 1
  const widthLimited = cs && renderedW >= (parseFloat(cs.maxWidth) || Infinity) - 1

  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    natural: { w: naturalW, h: naturalH },
    rendered: { w: renderedW, h: renderedH },
    css: {
      width: cs?.width,
      maxWidth: cs?.maxWidth,
      maxHeight: cs?.maxHeight,
      height: cs?.height,
      objectFit: cs?.objectFit,
    },
    maxHeightPx: Math.round(maxHeightPx),
    expected80vw: expectedAt80vw,
    heightLimitedByMaxHeight: heightLimited,
    widthLimitedByMaxWidth: widthLimited,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    panelRect: (() => {
      const r = document.querySelector('.tg-aba-khqr-page__panel')?.getBoundingClientRect()
      return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null
    })(),
    shellWidth: (() => {
      const cs2 = getComputedStyle(document.querySelector('.tg-aba-khqr-page__shell'))
      return cs2?.width
    })(),
  }
})

if (out && out.endsWith('.png')) await page.screenshot({ path: out, fullPage: false })
await browser.close()
console.log(JSON.stringify(report, null, 2))
