const ALLOW_LANDSCAPE_CLASS = 'tg-allow-landscape'
const PORTRAIT_LOCK_CLASS = 'tg-portrait-lock'
const NATIVE_LOCKED_CLASS = 'tg-portrait-native-locked'

let listenersBound = false

function isAdminPath(pathname = '') {
  const path = String(pathname || (typeof window !== 'undefined' ? window.location.pathname : '')).trim()
  return path === '/admin' || path === '/admin-login'
}

async function tryLockPortraitOrientation() {
  if (typeof window === 'undefined' || isAdminPath()) return false

  try {
    const orientation = screen.orientation
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('portrait-primary')
      document.documentElement.classList.add(NATIVE_LOCKED_CLASS)
      return true
    }
  } catch {
    document.documentElement.classList.remove(NATIVE_LOCKED_CLASS)
  }

  try {
    const legacyLock =
      screen.lockOrientation || screen.mozLockOrientation || screen.msLockOrientation
    if (typeof legacyLock === 'function') {
      const locked =
        legacyLock.call(screen, 'portrait-primary') ?? legacyLock.call(screen, 'portrait')
      if (locked !== false) {
        document.documentElement.classList.add(NATIVE_LOCKED_CLASS)
        return true
      }
    }
  } catch {
    document.documentElement.classList.remove(NATIVE_LOCKED_CLASS)
  }

  document.documentElement.classList.remove(NATIVE_LOCKED_CLASS)
  return false
}

/** 按路由切换是否允许横屏（后台管理页保留横屏）。 */
export function syncPortraitLockRoute(pathname) {
  if (typeof document === 'undefined') return
  const allowLandscape = isAdminPath(pathname)
  document.documentElement.classList.toggle(ALLOW_LANDSCAPE_CLASS, allowLandscape)
  document.documentElement.classList.toggle(PORTRAIT_LOCK_CLASS, !allowLandscape)
  if (!allowLandscape) {
    void tryLockPortraitOrientation()
  } else {
    document.documentElement.classList.remove(NATIVE_LOCKED_CLASS)
  }
}

/** 锁定为纵向：优先系统 API，失败时用 CSS 横屏补偿（见 index.css）。 */
export function initPortraitOrientationLock() {
  if (typeof window === 'undefined') return

  syncPortraitLockRoute(window.location.pathname)
  if (listenersBound) return
  listenersBound = true

  const relock = () => {
    if (!isAdminPath()) void tryLockPortraitOrientation()
  }

  window.addEventListener('orientationchange', relock, { passive: true })
  window.addEventListener('focus', relock, { passive: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') relock()
  })
}
