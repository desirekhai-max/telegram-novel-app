import { useEffect, useMemo, useState } from 'react'
import { formatVipRemainingKm } from '../lib/formatVipExpireKm.js'

/**
 * VIP 到期倒计时（每秒刷新）。`expireAtMs <= 0` 或已过期时返回 null。
 * @param {number} expireAtMs
 */
export function useVipExpireCountdown(expireAtMs) {
  const end = Number(expireAtMs) || 0
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!end || end <= Date.now()) return undefined
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [end])

  return useMemo(() => {
    if (!end) return null
    return formatVipRemainingKm(end, nowMs)
  }, [end, nowMs])
}
