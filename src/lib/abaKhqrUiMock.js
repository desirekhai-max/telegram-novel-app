import { getVipPlansCatalogForRole } from '../data/vipPlansCatalog.js'

/** UI-only demo flow for ABA Figma review (no PayWay / no backend payment). */
export function isAbaKhqrUiMockFlowEnabled() {
  const raw = String(import.meta.env.VITE_ABA_UI_MOCK_FLOW ?? 'false').trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off'
}

const MOCK_QR_MODULE_COUNT = 37
const MOCK_QR_MODULE_PX = 8
const MOCK_QR_CANVAS = MOCK_QR_MODULE_COUNT * MOCK_QR_MODULE_PX

function isFinderArea(x, y, size) {
  return (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)
}

function finderModuleOn(lx, ly) {
  const onBorder = lx === 0 || lx === 6 || ly === 0 || ly === 6
  const inInner = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4
  return onBorder || inInner
}

function isCenterLogoArea(x, y, size) {
  const center = (size - 1) / 2
  const dx = x - center
  const dy = y - center
  return dx * dx + dy * dy <= 3.2 * 3.2
}

function shouldPaintMockModule(x, y, size) {
  if (isCenterLogoArea(x, y, size)) return false

  if (isFinderArea(x, y, size)) {
    const local = (fx, fy) => finderModuleOn(fx, fy)
    if (x < 7 && y < 7) return local(x, y)
    if (x >= size - 7 && y < 7) return local(x - (size - 7), y)
    return local(x, y - (size - 7))
  }

  if (x === 6 || y === 6) return (x + y) % 2 === 0

  return ((x * 17 + y * 31 + ((x * y) % 7)) % 5) < 3
}

function buildKhqrMockQrSvg() {
  const size = MOCK_QR_MODULE_COUNT
  const px = MOCK_QR_MODULE_PX
  const canvas = MOCK_QR_CANVAS
  const center = canvas / 2
  const rects = []

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!shouldPaintMockModule(x, y, size)) continue
      rects.push(`<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}"/>`)
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas} ${canvas}" width="${canvas}" height="${canvas}">
  <rect width="${canvas}" height="${canvas}" fill="#fff"/>
  <g fill="#0f172a">${rects.join('')}</g>
  <circle cx="${center}" cy="${center}" r="30" fill="#fff"/>
  <circle cx="${center}" cy="${center}" r="24" fill="#0f172a"/>
  <text x="${center}" y="${center + 9}" text-anchor="middle" font-size="28" font-weight="700" fill="#fff" font-family="system-ui,-apple-system,'Segoe UI',sans-serif">$</text>
</svg>`
}

export const ABA_KHQR_MOCK_QR_DATA_URL = `data:image/svg+xml,${encodeURIComponent(buildKhqrMockQrSvg())}`

function parseUsdAmount(label) {
  const n = Number(String(label || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * @param {string} planId
 * @param {'normal' | 'author'} [role]
 */
export function buildAbaKhqrUiMockSession(planId, role = 'normal') {
  const plan = getVipPlansCatalogForRole(role).find((p) => p.planId === planId)
  const amountLabel = plan?.priceUsdLabel || '$1'
  const amount = parseUsdAmount(amountLabel)
  const tranId = `mock_${Date.now().toString(36)}`
  return {
    uiMock: true,
    tranId,
    planId: String(planId || plan?.planId || 'vip_entry'),
    amountLabel,
    amount,
    currency: 'USD',
    merchantLabel: 'VIP-Subscription',
    planTitleKm: String(plan?.titleKm || '').trim(),
    qrImage: ABA_KHQR_MOCK_QR_DATA_URL,
    qrString: '',
    abapayDeeplink: '',
    appStore: '',
    playStore: '',
    returnUrl: '',
  }
}

export function isUiMockAbaKhqrSession(session) {
  return Boolean(session && session.uiMock === true)
}

/** 演示 session 始终用当前 mock 二维码，避免 sessionStorage 缓存旧图。 */
export function withFreshMockKhqrImage(session) {
  if (!isUiMockAbaKhqrSession(session)) return session
  return { ...session, qrImage: ABA_KHQR_MOCK_QR_DATA_URL }
}
