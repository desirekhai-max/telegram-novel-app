/** ABA KHQR 官方标识（`public/aba-khqr-logo.png`） */
export const ABA_KHQR_LOGO_SRC = `${import.meta.env.BASE_URL}aba-khqr-logo.png`

/** KHQR 支付卡顶栏字标（自官方图裁切，`public/khqr-logo.png`） */
export const KHQR_LOGO_SRC = `${import.meta.env.BASE_URL}khqr-logo.png`

/** `public/khqr-logo.png` 原始尺寸，用于占位避免首帧布局跳动 */
export const KHQR_LOGO_WIDTH = 306
export const KHQR_LOGO_HEIGHT = 66

const preloaded = new Set()

function preloadImage(src) {
  const url = String(src || '').trim()
  if (!url || preloaded.has(url) || typeof Image === 'undefined') return Promise.resolve()
  preloaded.add(url)
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'sync'
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = url
  })
}

/** VIP / KHQR 页用到的静态图，进入支付流程前预载，避免顶栏字标闪一下 */
export function preloadAbaKhqrPaymentAssets() {
  return Promise.all([preloadImage(KHQR_LOGO_SRC), preloadImage(ABA_KHQR_LOGO_SRC)])
}

if (typeof window !== 'undefined') {
  void preloadAbaKhqrPaymentAssets()
}
