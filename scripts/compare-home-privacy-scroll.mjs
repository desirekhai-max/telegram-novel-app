/**
 * 对比首页与 Privacy Policy 滚动容器度量（需先 npm run build && npm run preview）。
 * 运行：node scripts/compare-home-privacy-scroll.mjs
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

const PREVIEW_PORT = 4173
const SCROLL_SEL = 'main.tg-home-body-scroll'

async function readScrollMetrics(page, label) {
  await page.goto(`http://127.0.0.1:${PREVIEW_PORT}${label === 'home' ? '/' : '/privacy-policy'}`, {
    waitUntil: 'networkidle',
  })
  await page.waitForSelector(SCROLL_SEL)

  return page.$eval(SCROLL_SEL, (el) => {
    const path = []
    let node = el
    while (node && node.nodeType === 1 && path.length < 12) {
      const tag = node.tagName.toLowerCase()
      const id = node.id ? `#${node.id}` : ''
      const cls =
        node.classList && node.classList.length
          ? `.${Array.from(node.classList).slice(0, 4).join('.')}`
          : ''
      path.unshift(`${tag}${id}${cls}`)
      node = node.parentElement
    }
    const cs = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    return {
      domPath: path.join(' > '),
      className: el.className,
      height: cs.height,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: cs.overflowY,
      boundingBottom: Math.round(rect.bottom),
      windowInnerHeight: window.innerHeight,
    }
  })
}

function startPreview() {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)], {
      shell: true,
      stdio: 'pipe',
    })
    let ready = false
    const onData = (buf) => {
      const s = String(buf)
      if (!ready && s.includes('Local:')) {
        ready = true
        resolve(child)
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', reject)
    globalThis.setTimeout(() => {
      if (!ready) reject(new Error('preview timeout'))
    }, 15000)
  })
}

const preview = await startPreview()
await new Promise((r) => globalThis.setTimeout(r, 800))

try {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const home = await readScrollMetrics(page, 'home')
  const privacy = await readScrollMetrics(page, 'privacy')
  await browser.close()

  console.log(JSON.stringify({ home, privacy }, null, 2))
} finally {
  preview.kill('SIGTERM')
}
