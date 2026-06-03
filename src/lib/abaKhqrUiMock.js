import { getVipPlansCatalogForRole } from '../data/vipPlansCatalog.js'

/** UI-only demo flow for ABA Figma review (no PayWay / no backend payment). */
export function isAbaKhqrUiMockFlowEnabled() {
  const raw = String(import.meta.env.VITE_ABA_UI_MOCK_FLOW ?? 'true').trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off'
}

const MOCK_QR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
  <rect width="240" height="240" fill="#fff"/>
  <g fill="#0f172a">
    <rect x="16" y="16" width="56" height="56"/><rect x="88" y="16" width="16" height="16"/><rect x="120" y="16" width="40" height="16"/>
    <rect x="168" y="16" width="56" height="56"/><rect x="16" y="88" width="16" height="16"/><rect x="56" y="88" width="24" height="16"/>
    <rect x="120" y="88" width="56" height="16"/><rect x="200" y="88" width="24" height="16"/><rect x="16" y="120" width="40" height="40"/>
    <rect x="88" y="120" width="16" height="56"/><rect x="120" y="120" width="24" height="24"/><rect x="168" y="120" width="56" height="40"/>
    <rect x="56" y="168" width="16" height="56"/><rect x="120" y="168" width="40" height="16"/><rect x="200" y="168" width="24" height="56"/>
    <rect x="16" y="200" width="56" height="24"/><rect x="88" y="200" width="56" height="24"/><rect x="168" y="200" width="56" height="24"/>
  </g>
  <circle cx="120" cy="120" r="26" fill="#e31837"/>
  <circle cx="120" cy="120" r="18" fill="#fff"/>
  <path fill="#e31837" d="M120 108l8 12h-6l2 10-8-12h6z"/>
</svg>`

export const ABA_KHQR_MOCK_QR_DATA_URL = `data:image/svg+xml,${encodeURIComponent(MOCK_QR_SVG)}`

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
