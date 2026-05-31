/** 将 VIP 到期时间格式化为个人中心展示用文案（高棉语标签 + 数字） */

function pad2(n) {
  return String(Math.trunc(n)).padStart(2, '0')
}

/**
 * @param {number} expireAtMs
 * @returns {string} 例如 `2026-05-26 14:30`
 */
export function formatVipExpireDateTimeKm(expireAtMs) {
  const t = Number(expireAtMs)
  if (!Number.isFinite(t) || t <= 0) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * @param {number} expireAtMs
 * @param {number} [nowMs]
 * @returns {string | null} 未过期返回剩余时间；已过期返回 null
 */
export function formatVipRemainingKm(expireAtMs, nowMs = Date.now()) {
  const end = Number(expireAtMs)
  if (!Number.isFinite(end) || end <= 0) return null
  const leftMs = end - nowMs
  if (leftMs <= 0) return null

  const totalSec = Math.floor(leftMs / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  const parts = []
  if (days > 0) parts.push(`${days}ថ្ងៃ`)
  if (hours > 0 || days > 0) parts.push(`${hours}ម៉ោង`)
  if (days === 0) {
    parts.push(`${minutes}នាទី`)
    if (hours === 0) parts.push(`${seconds}វិនាទី`)
  }
  return parts.length ? parts.join(' ') : `${seconds}វិនាទី`
}
