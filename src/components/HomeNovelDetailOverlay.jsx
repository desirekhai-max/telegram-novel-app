import { useRef } from 'react'
import { NovelDetailEmbedContext } from '../contexts/novelDetailEmbedContext.js'
import { useLocalEdgeSwipeBack } from '../hooks/useLocalEdgeSwipeBack.js'
import ReaderPage from '../pages/ReaderPage.jsx'

/**
 * 首页书本详情：嵌在 Home 内容区内，共用 AppMainTabToolbar，复用 ReaderPage 完整详情与互动。
 * 右滑只位移本层，露出下方真实首页列表（非全局 SwipeBack 壳层）。
 */
export default function HomeNovelDetailOverlay({ novelId, onClose }) {
  const overlayRef = useRef(null)
  const id = String(novelId || '').trim()
  const swipeHandlers = useLocalEdgeSwipeBack({
    targetRef: overlayRef,
    onBack: onClose,
    triggerRatio: 0.1,
  })

  if (!id) return null

  return (
    <NovelDetailEmbedContext.Provider value={{ novelId: id, hideHeader: true, onClose }}>
      <div
        ref={overlayRef}
        className="tg-home-novel-detail-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="ព័ត៌មានលម្អិតសៀវភៅ"
        {...swipeHandlers}
      >
        <div className="tg-home-novel-detail-overlay__scroller">
          <ReaderPage />
        </div>
      </div>
    </NovelDetailEmbedContext.Provider>
  )
}
