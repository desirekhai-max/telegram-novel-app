const RAW_API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').trim()
const ENV_API_BASE = RAW_API_BASE.replace(/\/+$/, '')
const PROD_API_FALLBACK = 'https://telegram-novel-app-production-7f1e.up.railway.app'

function resolveApiBase() {
  if (ENV_API_BASE) return ENV_API_BASE
  try {
    const host = String(window.location.hostname || '').toLowerCase()
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1'
    return isLocal ? '' : PROD_API_FALLBACK
  } catch {
    return PROD_API_FALLBACK
  }
}

const API_BASE = resolveApiBase()

/**
 * Build API URL for both local dev and production.
 * - No VITE_API_BASE_URL: return relative path (use Vite /api proxy)
 * - With VITE_API_BASE_URL: return absolute backend URL
 */
export function apiUrl(path) {
  const p = String(path || '')
  const normalized = p.startsWith('/') ? p : `/${p}`
  return API_BASE ? `${API_BASE}${normalized}` : normalized
}

