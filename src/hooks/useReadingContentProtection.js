import { useEffect } from 'react'

function isNodeWithinTarget(target, node) {
  return Boolean(target && node instanceof Node && target.contains(node))
}

function isEventWithinTarget(target, event) {
  if (!target || !event) return false
  if (isNodeWithinTarget(target, event.target)) return true
  if (typeof event.composedPath !== 'function') return false
  return event.composedPath().some((item) => item === target || isNodeWithinTarget(target, item))
}

function isSelectionWithinTarget(target) {
  if (!target || typeof window === 'undefined' || typeof window.getSelection !== 'function') return false
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  return isNodeWithinTarget(target, sel.anchorNode) || isNodeWithinTarget(target, sel.focusNode)
}

/**
 * 仅在阅读正文层启用：禁止选中文本、复制/剪切/粘贴、右键菜单。
 * 不拦截滚动/触摸移动，避免影响 Telegram Mini App 阅读体验。
 *
 * @param {{ current: HTMLElement | null }} targetRef
 * @param {boolean} active
 */
export function useReadingContentProtection(targetRef, active) {
  useEffect(() => {
    if (!active) return undefined
    const target = targetRef.current
    if (!target) return undefined

    const prevent = (event) => {
      event.preventDefault()
      event.stopPropagation()
    }

    const preventIfInsideTarget = (event) => {
      const current = targetRef.current
      if (!current) return
      if (isEventWithinTarget(current, event) || isSelectionWithinTarget(current)) {
        prevent(event)
      }
    }

    const eventTypes = ['copy', 'cut', 'paste', 'contextmenu', 'selectstart']
    for (const type of eventTypes) {
      target.addEventListener(type, preventIfInsideTarget, true)
      document.addEventListener(type, preventIfInsideTarget, true)
    }

    return () => {
      for (const type of eventTypes) {
        target.removeEventListener(type, preventIfInsideTarget, true)
        document.removeEventListener(type, preventIfInsideTarget, true)
      }
    }
  }, [active, targetRef])
}
