/** VIP 支付成功页静态资源 */
export const VIP_PAYMENT_SUCCESS_HERO_SRC = `${import.meta.env.BASE_URL}vip/payment-success-hero.png`
export const VIP_PAYMENT_SUCCESS_HERO_2X_SRC = `${import.meta.env.BASE_URL}vip/payment-success-hero@2x.png`

export const VIP_PAYMENT_SUCCESS_HERO_WIDTH = 1024
export const VIP_PAYMENT_SUCCESS_HERO_HEIGHT = 486

const loaded = new Set()

/** @param {number} [dpr] */
export function resolveVipPaymentSuccessHeroSrc(dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) {
  return dpr >= 2 ? VIP_PAYMENT_SUCCESS_HERO_2X_SRC : VIP_PAYMENT_SUCCESS_HERO_SRC
}

/** @param {number} [dpr] */
export function isVipPaymentSuccessHeroCached(dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) {
  const src = resolveVipPaymentSuccessHeroSrc(dpr)
  if (loaded.has(src)) return true
  if (typeof Image === 'undefined') return false
  const img = new Image()
  img.src = src
  return img.complete && img.naturalWidth > 0
}

function preloadImage(src) {
  const url = String(src || '').trim()
  if (!url || loaded.has(url) || typeof Image === 'undefined') return Promise.resolve()
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'sync'
    img.onload = () => {
      loaded.add(url)
      resolve()
    }
    img.onerror = () => resolve()
    img.src = url
  })
}

/** KHQR 页进入成功页前预载头图，避免 69KKH NOVEL 顶图首帧闪动 */
export function preloadVipPaymentSuccessAssets() {
  const primary = resolveVipPaymentSuccessHeroSrc()
  const secondary = resolveVipPaymentSuccessHeroSrc(1)
  return preloadImage(primary).then(() => preloadImage(secondary))
}

if (typeof window !== 'undefined') {
  void preloadVipPaymentSuccessAssets()
}
