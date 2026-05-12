import { apiUrl } from './apiBase.js'
import {
  ADMIN_LOGIN_FAIL_DEFAULT_KM,
  ADMIN_SESSION_UNAVAILABLE_KM,
  translateBackendLoginErrorKm,
} from './errorMessagesKm.js'

const AUTH_KEY = 'tg_admin_auth_v2'
const USERNAME_KEY = 'tg_admin_user_v1'

export function isAdminAuthed() {
  try {
    return Boolean(sessionStorage.getItem(AUTH_KEY))
  } catch {
    return false
  }
}

export function getAdminToken() {
  try {
    return sessionStorage.getItem(AUTH_KEY) || ''
  } catch {
    return ''
  }
}

export function getAdminAuthHeaders() {
  const token = getAdminToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function getAdminUsername() {
  try {
    return sessionStorage.getItem(USERNAME_KEY) || ''
  } catch {
    return ''
  }
}

export async function verifyAdminSession() {
  const token = getAdminToken()
  if (!token) return false
  try {
    const res = await fetch(apiUrl('/api/admin-legacy/session'), {
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return false
    const data = await res.json()
    if (data?.ok && data?.username) {
      try {
        sessionStorage.setItem(USERNAME_KEY, String(data.username))
      } catch {
        /* ignore */
      }
    }
    return Boolean(data?.ok)
  } catch {
    return false
  }
}

export async function loginAdmin(username, password, otpCode) {
  const res = await fetch(apiUrl('/api/admin-legacy/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: String(username || '').trim(),
      password: String(password || '').trim(),
      otp: String(otpCode || '').trim(),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.ok || !data?.token) {
    return {
      ok: false,
      error: translateBackendLoginErrorKm(data?.error) || ADMIN_LOGIN_FAIL_DEFAULT_KM,
    }
  }
  try {
    sessionStorage.setItem(AUTH_KEY, String(data.token))
    sessionStorage.setItem(USERNAME_KEY, String(data.username || username || '').trim())
  } catch {
    return { ok: false, error: ADMIN_SESSION_UNAVAILABLE_KM }
  }
  return { ok: true }
}

export async function logoutAdmin() {
  const token = getAdminToken()
  if (token) {
    try {
      await fetch(apiUrl('/api/admin-legacy/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      /* ignore */
    }
  }
  try {
    sessionStorage.removeItem(AUTH_KEY)
    sessionStorage.removeItem(USERNAME_KEY)
  } catch {
    /* ignore */
  }
}
