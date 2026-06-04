import { useLocation } from 'react-router-dom'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'
import { normalizeAppPathname } from '../lib/bottomNavRoutes.js'

/** 从账户等入口进入的政策页：右缘左滑返回，跟手露出真实上一页（AppShell underlay） */
const EDGE_SWIPE_BACK_PATHS = new Set([
  '/about',
  '/contact-us',
  '/terms-of-service',
  '/privacy-policy',
  '/refund-policy',
])

/**
 * HomePage 页面骨架（政策页复用同一 DOM / className / 底栏占位）。
 */
export default function HomePageDom({ shellClassName = '', toolbar, children, afterMain = null }) {
  const location = useLocation()
  const edgeSwipeBack = EDGE_SWIPE_BACK_PATHS.has(normalizeAppPathname(location.pathname))
  const swipeHandlers = useEdgeSwipeBack()
  const gestureHandlers = edgeSwipeBack ? swipeHandlers : {}

  return (
    <div
      className={['tg-app', 'tg-app--home', shellClassName].filter(Boolean).join(' ')}
      {...gestureHandlers}
    >
      {toolbar}
      <div className="tg-home-main-rule" aria-hidden />
      <main className="tg-list-wrap tg-home-body-scroll flex min-h-0 flex-1 flex-col">
        {children}
      </main>
      {afterMain}
    </div>
  )
}
