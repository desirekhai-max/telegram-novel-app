import { useEffect, useRef } from 'react'

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * VIP 套餐循环短视频（MP4/WebM，建议深色场景便于融入卡片）
 */
export default function VipPlanVideoEmblem({ src, className = '', onReady, onFailed }) {
  const failedRef = useRef(false)
  const onReadyRef = useRef(onReady)
  const onFailedRef = useRef(onFailed)
  onReadyRef.current = onReady
  onFailedRef.current = onFailed

  useEffect(() => {
    failedRef.current = false
    if (!src || prefersReducedMotion()) {
      onFailedRef.current?.()
    }
  }, [src])

  if (!src || prefersReducedMotion()) return null

  return (
    <video
      className={`tg-vip-plan-card__emblem-video ${className}`.trim()}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      onLoadedData={() => {
        if (failedRef.current) return
        onReadyRef.current?.()
      }}
      onCanPlay={() => {
        if (failedRef.current) return
        onReadyRef.current?.()
      }}
      onError={() => {
        if (failedRef.current) return
        failedRef.current = true
        onFailedRef.current?.()
      }}
    />
  )
}
