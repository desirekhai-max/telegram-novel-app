const RAW_API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').trim()
const API_BASE = RAW_API_BASE.replace(/\/+$/, '')

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

