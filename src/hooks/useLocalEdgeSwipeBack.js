import { useCallback, useEffect, useRef } from 'react'

const SWIPE_TRANSITION = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * 局部边缘右滑返回：只位移 targetRef 元素，露出其下方已渲染的真实页面（如首页列表）。
 * 不经过 SwipeBackProvider，避免整壳位移或顶栏跟动。
 */
export function useLocalEdgeSwipeBack({ onBack, targetRef, triggerRatio = 0.22 } = {}) {
  const triggerRatioRaw = Number(triggerRatio)
  const resolvedTriggerRatio =
    Number.isFinite(triggerRatioRaw) && triggerRatioRaw > 0 && triggerRatioRaw < 1
      ? triggerRatioRaw
      : 0.22
  const swipeRef = useRef({ startX: 0, startY: 0, tracking: false, axis: null, dx: 0, started: false })
  const resetTimerRef = useRef(0)
  const rafRef = useRef(0)
  const pendingDxRef = useRef(0)

  const applyTransform = useCallback(
    (dx, { animate = false } = {}) => {
      const el = targetRef?.current
      if (!el) return
      el.style.transition = animate ? SWIPE_TRANSITION : 'none'
      el.style.transform = dx > 0 ? `translate3d(${Math.round(dx)}px, 0, 0)` : ''
    },
    [targetRef],
  )

  const resetGesture = useCallback(() => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = 0
    }
    pendingDxRef.current = 0
    applyTransform(0, { animate: false })
    const el = targetRef?.current
    if (el) el.classList.remove('tg-local-swipe-sheet--gesture')
  }, [applyTransform, targetRef])

  useEffect(() => () => resetGesture(), [resetGesture])

  const onTouchStart = (e) => {
    const t = e.touches?.[0]
    if (!t) return
    swipeRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      tracking: t.clientX <= 36,
      axis: null,
      dx: 0,
      started: false,
    }
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = 0
    }
    resetGesture()
  }

  const onTouchMove = (e) => {
    const st = swipeRef.current
    if (!st.tracking) return
    const t = e.touches?.[0]
    if (!t) return
    const dx = t.clientX - st.startX
    const dy = t.clientY - st.startY
    st.dx = dx
    if (!st.axis) {
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      if (absDx < 6 && absDy < 6) return
      if (dx > 0 && absDx >= absDy * 0.75) {
        st.axis = 'x'
      } else {
        st.axis = 'y'
        st.tracking = false
        return
      }
    }
    if (st.axis !== 'x') return
    e.preventDefault()
    e.stopPropagation()
    if (!st.started) {
      st.started = true
      targetRef?.current?.classList.add('tg-local-swipe-sheet--gesture')
    }
    const clampedDx = Math.max(0, Math.min(dx, window.innerWidth * 0.92))
    pendingDxRef.current = clampedDx
    if (rafRef.current) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0
      applyTransform(pendingDxRef.current, { animate: false })
    })
  }

  const onTouchEnd = () => {
    const st = swipeRef.current
    if (!st.tracking) return
    const shouldBack = st.axis === 'x' && st.dx > window.innerWidth * resolvedTriggerRatio
    swipeRef.current = { startX: 0, startY: 0, tracking: false, axis: null, dx: 0, started: false }

    if (shouldBack) {
      applyTransform(Math.max(window.innerWidth, st.dx), { animate: true })
      resetTimerRef.current = window.setTimeout(() => {
        resetTimerRef.current = 0
        if (typeof onBack === 'function') onBack()
        resetGesture()
      }, 220)
      return
    }

    if (st.started) {
      applyTransform(0, { animate: true })
      resetTimerRef.current = window.setTimeout(() => {
        resetTimerRef.current = 0
        resetGesture()
      }, 220)
      return
    }

    resetGesture()
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: onTouchEnd,
  }
}
