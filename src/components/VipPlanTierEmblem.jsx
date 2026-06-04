import { useEffect, useState } from 'react'
import { VIP_PLAN_EMBLEM_SRC, VIP_PLAN_VIDEO_SRC } from '../data/vipPlanEmblems.js'
import VipPlanCinematicEmblem from './VipPlanCinematicEmblem.jsx'
import VipPlanVideoEmblem from './VipPlanVideoEmblem.jsx'

function StaticImageEmblem({ planId, className }) {
  const src = VIP_PLAN_EMBLEM_SRC[planId]
  if (!src) return null
  return <img src={src} className={className} alt="" decoding="async" draggable={false} />
}

/**
 * VIP 套餐图标：MP4 视频 → 静图 → CSS 立体书（小说主题、透明底）
 */
export default function VipPlanTierEmblem({ planId, className = '' }) {
  const videoSrc = VIP_PLAN_VIDEO_SRC[planId]
  const imageSrc = VIP_PLAN_EMBLEM_SRC[planId]
  const [videoPhase, setVideoPhase] = useState(() => (videoSrc ? 'loading' : 'off'))

  useEffect(() => {
    setVideoPhase(videoSrc ? 'loading' : 'off')
  }, [videoSrc, planId])

  if (imageSrc) {
    return <StaticImageEmblem planId={planId} className={className} />
  }

  if (videoSrc && videoPhase !== 'failed') {
    return (
      <div className="tg-vip-plan-card__emblem-media" aria-hidden>
        {videoPhase !== 'ready' ? (
          <VipPlanCinematicEmblem
            planId={planId}
            className={`${className} tg-vip-plan-card__emblem-placeholder`.trim()}
          />
        ) : null}
        <VipPlanVideoEmblem
          src={videoSrc}
          className={className}
          onReady={() => setVideoPhase('ready')}
          onFailed={() => setVideoPhase('failed')}
        />
      </div>
    )
  }

  return <VipPlanCinematicEmblem planId={planId} className={className} />
}
