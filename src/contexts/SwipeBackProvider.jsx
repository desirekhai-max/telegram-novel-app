import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const SWIPE_TRANSITION = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'

const SwipeBackContext = createContext(null)

export function SwipeBackProvider({ children }) {
  const foregroundRef = useRef(null)
  const rafRef = useRef(0)
  const pendingDxRef = useRef(0)
  const [gestureLive, setGestureLive] = useState(false)
  const [gestureAnimating, setGestureAnimating] = useState(false)

  const applyTransform = useCallback((dx, { animate = false } = {}) => {
    const el = foregroundRef.current
    if (!el) return
    el.style.transition = animate ? SWIPE_TRANSITION : 'none'
    el.style.transform = dx > 0 ? `translate3d(${Math.round(dx)}px, 0, 0)` : ''
  }, [])

  const registerForeground = useCallback((el) => {
    foregroundRef.current = el
  }, [])

  const resetGesture = useCallback(() => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    pendingDxRef.current = 0
    applyTransform(0, { animate: false })
    setGestureLive(false)
    setGestureAnimating(false)
  }, [applyTransform])

  const startGesture = useCallback(() => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    pendingDxRef.current = 0
    setGestureAnimating(false)
    setGestureLive(true)
    applyTransform(0, { animate: false })
  }, [applyTransform])

  const moveGesture = useCallback(
    (dx) => {
      pendingDxRef.current = dx
      if (rafRef.current) return
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0
        applyTransform(pendingDxRef.current, { animate: false })
      })
    },
    [applyTransform],
  )

  const finishGesture = useCallback(
    ({ commit, releaseDx }) => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      setGestureAnimating(true)
      if (commit) {
        applyTransform(Math.max(window.innerWidth, releaseDx), { animate: true })
        return
      }
      applyTransform(0, { animate: true })
      window.setTimeout(() => {
        resetGesture()
      }, 220)
    },
    [applyTransform, resetGesture],
  )

  useEffect(() => () => resetGesture(), [resetGesture])

  const value = useMemo(
    () => ({
      gestureLive,
      gestureAnimating,
      registerForeground,
      resetGesture,
      startGesture,
      moveGesture,
      finishGesture,
    }),
    [
      gestureLive,
      gestureAnimating,
      registerForeground,
      resetGesture,
      startGesture,
      moveGesture,
      finishGesture,
    ],
  )

  return <SwipeBackContext.Provider value={value}>{children}</SwipeBackContext.Provider>
}

export function useSwipeBack() {
  const ctx = useContext(SwipeBackContext)
  if (!ctx) {
    throw new Error('useSwipeBack must be used inside SwipeBackProvider')
  }
  return ctx
}
