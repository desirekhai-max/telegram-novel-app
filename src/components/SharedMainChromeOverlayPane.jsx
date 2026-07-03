import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalEdgeSwipeBack } from '../hooks/useLocalEdgeSwipeBack.js'

/**
 * 共用顶栏叠层：右滑只位移本层，露出下方真实主 Tab 页（账户等），不拖动整壳。
 */
export default function SharedMainChromeOverlayPane({ children }) {
  const navigate = useNavigate()
  const overlayRef = useRef(null)
  const swipeHandlers = useLocalEdgeSwipeBack({
    targetRef: overlayRef,
    onBack: () => navigate(-1),
    triggerRatio: 0.1,
  })

  return (
    <div
      ref={overlayRef}
      className="tg-shared-chrome-overlay-pane tg-main-tab-host__pane tg-main-tab-host__pane--active"
      {...swipeHandlers}
    >
      {children}
    </div>
  )
}
