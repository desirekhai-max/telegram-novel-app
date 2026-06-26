/** Formal Mini App frontend — browser ABA flow always opens this origin. */
const PROD_APP_PUBLIC_URL = 'https://statuesque-scone-309617.netlify.app'

const ENV_APP_PUBLIC = String(import.meta.env.VITE_APP_PUBLIC_URL || '')
  .trim()
  .replace(/\/+$/, '')

/** @returns {string} Origin for external browser / QR return URLs (never draft Netlify hosts). */
export function getAppPublicOrigin() {
  if (ENV_APP_PUBLIC) return ENV_APP_PUBLIC
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const devOrigin = String(window.location?.origin || '').trim().replace(/\/+$/, '')
    if (devOrigin) return devOrigin
  }
  if (typeof window !== 'undefined') {
    const origin = String(window.location?.origin || '').trim().replace(/\/+$/, '')
    if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin
    }
  }
  return PROD_APP_PUBLIC_URL
}
