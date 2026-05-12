import { createContext, useContext, useMemo, useState } from 'react'

const SwipeBackContext = createContext(null)

export function SwipeBackProvider({ children }) {
  const [swipe, setSwipe] = useState({ active: false, dx: 0, animating: false })
  const value = useMemo(() => ({ swipe, setSwipe }), [swipe])
  return <SwipeBackContext.Provider value={value}>{children}</SwipeBackContext.Provider>
}

export function useSwipeBack() {
  const ctx = useContext(SwipeBackContext)
  if (!ctx) {
    throw new Error('useSwipeBack must be used inside SwipeBackProvider')
  }
  return ctx
}
