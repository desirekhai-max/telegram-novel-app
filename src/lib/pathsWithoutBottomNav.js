/** 不渲染 BottomNav 的路由（DOM 中不出现底栏）。 */
export const PATHS_WITHOUT_BOTTOM_NAV = new Set([
  '/about',
  '/contact-us',
  '/terms-of-service',
  '/privacy-policy',
  '/refund-policy',
])

export function isPathWithoutBottomNav(pathname) {
  return PATHS_WITHOUT_BOTTOM_NAV.has(pathname)
}
