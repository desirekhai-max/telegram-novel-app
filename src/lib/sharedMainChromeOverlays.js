import { normalizeAppPathname } from './bottomNavRoutes.js'

/** 共用 AppMainTabToolbar 的叠层子页（从账户等入口进入，顶栏不重挂） */
export const SHARED_MAIN_CHROME_OVERLAY_PATHS = [
  '/notifications',
  '/account/orders',
  '/account/reading-history',
  '/account/saved',
  '/contact-us',
  '/about',
  '/terms-of-service',
  '/privacy-policy',
]

export const SHARED_OVERLAY_TOOLBAR_TITLES = {
  '/notifications': { title: 'ការជូនដំណឹង', lang: 'km', className: 'tg-toolbar__title--overlay' },
  '/account/orders': { title: 'ប្រវត្តិបញ្ជាទិញ', lang: 'km', className: '' },
  '/account/reading-history': { title: 'ប្រវត្តិអាន', lang: 'km', className: '' },
  '/account/saved': { title: 'រក្សាទុក', lang: 'km', className: '' },
  '/contact-us': { title: 'Contact Us · ទាក់ទងមកយើង', lang: 'en', className: 'text-[16px]' },
  '/about': { title: 'About Us · អំពីពួកយើង', lang: 'en', className: 'text-[16px]' },
  '/terms-of-service': {
    title: 'Terms of Service · លក្ខខណ្ឌប្រើប្រាស់',
    lang: 'en',
    className: 'text-[16px]',
  },
  '/privacy-policy': {
    title: 'Privacy Policy · គោលការណ៍ឯកជនភាព',
    lang: 'en',
    className: 'text-[16px]',
  },
}

export function isSharedOverlayPath(pathname) {
  return SHARED_MAIN_CHROME_OVERLAY_PATHS.includes(normalizeAppPathname(pathname))
}

export function getSharedOverlayToolbarTitle(pathname) {
  return SHARED_OVERLAY_TOOLBAR_TITLES[normalizeAppPathname(pathname)] ?? null
}
