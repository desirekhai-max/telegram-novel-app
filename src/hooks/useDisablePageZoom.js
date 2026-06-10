import { useEffect } from 'react'

function isDesktopPointerContext() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: fine) and (min-width: 768px)').matches
}

/**
 * 桌面端禁用浏览器页面缩放（Ctrl+滚轮 / Ctrl+± / Ctrl+0），避免 KHQR 遮罩露缝。
 * 触屏设备不拦截，保留双指缩放。
 */
export function useDisablePageZoom(enabled = true) {
  useEffect(() => {
    if (!enabled || !isDesktopPointerContext()) return undefined

    const preventWheelZoom = (event) => {
      if (event.ctrlKey) event.preventDefault()
    }

    const preventKeyZoom = (event) => {
      if (!event.ctrlKey && !event.metaKey) return
      if (event.key === '+' || event.key === '-' || event.key === '=' || event.key === '0') {
        event.preventDefault()
      }
    }

    const wheelOptions = { passive: false }
    window.addEventListener('wheel', preventWheelZoom, wheelOptions)
    window.addEventListener('keydown', preventKeyZoom)

    return () => {
      window.removeEventListener('wheel', preventWheelZoom, wheelOptions)
      window.removeEventListener('keydown', preventKeyZoom)
    }
  }, [enabled])
}
