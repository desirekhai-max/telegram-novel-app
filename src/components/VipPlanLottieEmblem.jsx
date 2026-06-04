import { useCallback, useEffect, useRef, useState } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * VIP 套餐透明底 Lottie（.json / .lottie）
 */
export default function VipPlanLottieEmblem({ src, className = '', onReady, onFailed }) {
  const playerRef = useRef(null)
  const readyRef = useRef(false)
  const failedRef = useRef(false)
  const onReadyRef = useRef(onReady)
  const onFailedRef = useRef(onFailed)
  onReadyRef.current = onReady
  onFailedRef.current = onFailed
  const [reduceMotion, setReduceMotion] = useState(prefersReducedMotion)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return undefined
    const onChange = () => setReduceMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (reduceMotion) onFailedRef.current?.()
  }, [reduceMotion])

  const markReady = useCallback(() => {
    if (readyRef.current || failedRef.current) return
    readyRef.current = true
    onReadyRef.current?.()
  }, [])

  const markFailed = useCallback(() => {
    if (readyRef.current || failedRef.current) return
    failedRef.current = true
    onFailedRef.current?.()
  }, [])

  useEffect(() => {
    readyRef.current = false
    failedRef.current = false
    if (reduceMotion || !src) {
      onFailedRef.current?.()
      return undefined
    }
    const timeout = window.setTimeout(() => {
      if (!readyRef.current) markFailed()
    }, 20000)
    return () => window.clearTimeout(timeout)
  }, [src, reduceMotion, markFailed])

  useEffect(() => {
    const instance = playerRef.current
    if (!instance || reduceMotion) return undefined

    const onLoad = () => {
      try {
        instance.setBackgroundColor?.('#00000000')
      } catch {
        /* ignore */
      }
      markReady()
    }

    instance.addEventListener('load', onLoad)
    instance.addEventListener('ready', onLoad)

    return () => {
      instance.removeEventListener('load', onLoad)
      instance.removeEventListener('ready', onLoad)
    }
  }, [src, reduceMotion, markReady])

  const dotLottieRefCallback = useCallback((instance) => {
    playerRef.current = instance
  }, [])

  if (!src || reduceMotion) return null

  return (
    <div className={`tg-vip-plan-card__emblem-lottie-wrap ${className}`.trim()}>
      <DotLottieReact
        key={src}
        src={src}
        loop
        autoplay
        backgroundColor="#00000000"
        renderConfig={{ autoResize: true }}
        dotLottieRefCallback={dotLottieRefCallback}
      />
    </div>
  )
}
