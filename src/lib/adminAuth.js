const AUTH_KEY = 'tg_admin_auth_v1'

// 临时后台账号（先用于本地门禁，后续可改为服务端验证）
const ADMIN_USER = 'admin'
const ADMIN_PASS = 'admin123'

export function isAdminAuthed() {
  try {
    return sessionStorage.getItem(AUTH_KEY) === 'ok'
  } catch {
    return false
  }
}

export function loginAdmin(username, password) {
  const ok = String(username).trim() === ADMIN_USER && String(password) === ADMIN_PASS
  if (!ok) return false
  try {
    sessionStorage.setItem(AUTH_KEY, 'ok')
  } catch {
    return false
  }
  return true
}

export function logoutAdmin() {
  try {
    sessionStorage.removeItem(AUTH_KEY)
  } catch {
    /* ignore */
  }
}
