/** 规范化 pathname（去尾斜杠、query、hash） */
export function normalizeAppPathname(pathname) {
  const raw = String(pathname || '/').split('?')[0].split('#')[0] || '/'
  if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1)
  return raw
}

/** 仅这些路由渲染 BottomNav（白名单）；政策页等不在列表内即无底栏。 */
const PATHS_WITH_BOTTOM_NAV = [
  '/',
  '/notifications',
  '/vip',
  '/vip/aba-khqr',
  '/vip/checkout-redirect',
  '/vip/payment-return',
  '/account',
  '/account/orders',
  '/account/reading-history',
  '/account/saved',
]

export function isPathWithBottomNav(pathname) {
  const path = normalizeAppPathname(pathname)
  if (PATHS_WITH_BOTTOM_NAV.includes(path)) return true
  return false
}
