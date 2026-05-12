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
  const { setSwipe } = useSwipeBack()
  const swipeRef = useRef({ startX: 0, startY: 0, tracking: false, axis: null, dx: 0 })
  const resetTimerRef = useRef(0)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current)
      }
      setSwipe({ active: false, dx: 0, animating: false })
    }
  }, [setSwipe])

  const onTouchStart = (e) => {
    const t = e.touches?.[0]
    if (!t) return
    swipeRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      tracking: t.clientX <= 36,
      axis: null,
      dx: 0,
    }
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = 0
    }
    if (followGesture) {
      setSwipe({ active: false, dx: 0, animating: false })
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
      const clampedDx = Math.max(0, Math.min(dx, window.innerWidth * 0.92))
      setSwipe({ active: true, dx: clampedDx, animating: false })
    }
  }

  const onTouchEnd = () => {
    const st = swipeRef.current
    if (!st.tracking) return
    const shouldBack = st.axis === 'x' && st.dx > window.innerWidth * triggerRatio
    if (shouldBack) {
      if (instantBack) {
        if (followGesture) {
          setSwipe({ active: false, dx: 0, animating: false })
        }
      } else {
        // 成功返回时不要先“弹回原位”再跳页，避免视觉晃动。
        if (followGesture) {
          setSwipe({
            active: true,
            dx: Math.max(window.innerWidth, st.dx),
            animating: true,
          })
        }
      }
      swipeRef.current = { startX: 0, startY: 0, tracking: false, axis: null, dx: 0 }
      if (instantBack) {
        navigate(-1)
      } else {
        window.setTimeout(() => {
          navigate(-1)
        }, 180)
      }
      return
    }
    if (followGesture) {
      setSwipe({ active: false, dx: 0, animating: true })
      resetTimerRef.current = window.setTimeout(() => {
        setSwipe({ active: false, dx: 0, animating: false })
        resetTimerRef.current = 0
      }, 220)
    }
    swipeRef.current = { startX: 0, startY: 0, tracking: false, axis: null, dx: 0 }
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: onTouchEnd,
  }
}
