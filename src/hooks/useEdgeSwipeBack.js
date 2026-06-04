import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSwipeBack } from '../contexts/SwipeBackProvider.jsx'

export function useEdgeSwipeBack(options = {}) {
  const triggerRatioRaw = Number(options.triggerRatio)
  const triggerRatio =
    Number.isFinite(triggerRatioRaw) && triggerRatioRaw > 0 && triggerRatioRaw < 1
      ? triggerRatioRaw
      : 0.22
  const instantBack = options.instantBack === true
  const followGesture = options.followGesture !== false
  const navigate = useNavigate()
  const { resetGesture, startGesture, moveGesture, finishGesture } = useSwipeBack()
  const swipeRef = useRef({ startX: 0, startY: 0, tracking: false, axis: null, dx: 0, started: false })
  const resetTimerRef = useRef(0)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current)
      }
      resetGesture()
    }
  }, [resetGesture])

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
    if (followGesture) {
      resetGesture()
    }
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
    if (followGesture) {
      if (!st.started) {
        st.started = true
        startGesture()
      }
      const clampedDx = Math.max(0, Math.min(dx, window.innerWidth * 0.92))
      moveGesture(clampedDx)
    }
  }

  const onTouchEnd = () => {
    const st = swipeRef.current
    if (!st.tracking) return
    const shouldBack = st.axis === 'x' && st.dx > window.innerWidth * triggerRatio
    if (shouldBack) {
      if (instantBack) {
        if (followGesture) {
          resetGesture()
        }
      } else if (followGesture) {
        finishGesture({ commit: true, releaseDx: st.dx })
      }
      swipeRef.current = { startX: 0, startY: 0, tracking: false, axis: null, dx: 0, started: false }
      if (instantBack) {
        navigate(-1)
      } else {
        window.setTimeout(() => {
          navigate(-1)
        }, 220)
      }
      return
    }
    if (followGesture && st.started) {
      finishGesture({ commit: false, releaseDx: 0 })
    } else if (followGesture) {
      resetGesture()
    }
    swipeRef.current = { startX: 0, startY: 0, tracking: false, axis: null, dx: 0, started: false }
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: onTouchEnd,
  }
}
