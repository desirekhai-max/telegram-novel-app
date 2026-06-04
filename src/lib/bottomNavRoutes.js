/** 规范化 pathname（去尾斜杠、query、hash） */
export function normalizeAppPathname(pathname) {
  const raw = String(pathname || '/').split('?')[0].split('#')[0] || '/'
  if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1)
  return raw
}

/** 仅这些路由渲染 BottomNav（白名单） */
export const PATHS_WITH_BOTTOM_NAV = [
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

/** 政策/关于页：绝不渲染 BottomNav */
export const PATHS_WITHOUT_BOTTOM_NAV = [
  '/about',
  '/contact-us',
  '/terms-of-service',
  '/privacy-policy',
  '/refund-policy',
]

export function isPathWithBottomNav(pathname) {
  const path = normalizeAppPathname(pathname)
  return PATHS_WITH_BOTTOM_NAV.includes(path)
}

export function isPathWithoutBottomNav(pathname) {
  const path = normalizeAppPathname(pathname)
  return PATHS_WITHOUT_BOTTOM_NAV.includes(path)
}

/** AppShell 用：是否挂载 AppBottomNavDock */
export function shouldRenderAppBottomNavDock(pathname, chrome = {}) {
  const {
    searchExploreOpen = false,
    filterPanelOpen = false,
    homeSearchInputFocused = false,
  } = chrome
  if (isPathWithoutBottomNav(pathname)) return false
  if (!isPathWithBottomNav(pathname)) return false
  if (searchExploreOpen || filterPanelOpen || homeSearchInputFocused) return false
  return true
}
