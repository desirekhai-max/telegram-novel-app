import { isSharedOverlayPath } from './sharedMainChromeOverlays.js'

export { isSharedOverlayPath, getSharedOverlayToolbarTitle, SHARED_MAIN_CHROME_OVERLAY_PATHS } from './sharedMainChromeOverlays.js'

/** 规范化 pathname（去尾斜杠、query、hash） */
export function normalizeAppPathname(pathname) {
  const raw = String(pathname || '/').split('?')[0].split('#')[0] || '/'
  if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1)
  return raw
}

/** 底栏三 Tab：首页 / VIP / 账户 */
export const MAIN_TAB_PATHS = ['/', '/vip', '/account']

export function isMainTabPath(pathname) {
  return MAIN_TAB_PATHS.includes(normalizeAppPathname(pathname))
}

/** 底栏主流程 + 叠层子页：共用 AppMainTabToolbar，避免互切时顶栏闪动 */
export function isSharedMainChromePath(pathname) {
  const path = normalizeAppPathname(pathname)
  return isMainTabPath(path) || isSharedOverlayPath(path)
}

/** 共用顶栏域内互切不预挂 underlay，避免顶栏双渲染闪动 */
export function shouldMountSwipeBackUnderlay(prevPathname, currentPathname) {
  const prev = normalizeAppPathname(prevPathname)
  const curr = normalizeAppPathname(currentPathname)
  if (prev === curr) return false
  if (isSharedMainChromePath(prev) && isSharedMainChromePath(curr)) return false
  return true
}

/** 与 HomePage 相同：这些路由渲染 AppBottomNavDock */
export const PATHS_WITH_BOTTOM_NAV = [
  '/',
  '/notifications',
  '/vip',
  '/vip/checkout-redirect',
  '/vip/aba-khqr-launch',
  '/vip/payment-return',
  '/account',
  '/account/orders',
  '/account/reading-history',
  '/account/saved',
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

/** AppShell 用：是否挂载 AppBottomNavDock（与 HomePage 同一套逻辑） */
export function shouldRenderAppBottomNavDock(pathname, chrome = {}) {
  const {
    searchExploreOpen = false,
    filterPanelOpen = false,
    homeSearchInputFocused = false,
  } = chrome
  if (!isPathWithBottomNav(pathname)) return false
  if (searchExploreOpen || filterPanelOpen || homeSearchInputFocused) return false
  return true
}
