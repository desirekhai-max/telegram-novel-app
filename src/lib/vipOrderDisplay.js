import { getVipPlanForPurchase } from '../data/vipPlansCatalog.js'

export const VIP_ORDER_STATUS_SUCCESS_KM = 'បង់ប្រាក់ជោគជ័យ'
export const VIP_ORDER_STATUS_FAILED_KM = 'បង់ប្រាក់មិនជោគជ័យ'

const NEUTRAL_PRODUCT_LABEL = 'VIP-Subscription'

const LEGACY_CORRUPTED_STATUS_LABEL =
  'ß₧öß₧äßƒïß₧ößƒÆß₧Üß₧╢ß₧Çßƒïß₧çßƒäß₧éß₧çßƒÉß₧Ö'

function isCorruptedVipOrderStatusLabel(label) {
  const s = String(label || '').trim()
  if (!s) return true
  if (s === LEGACY_CORRUPTED_STATUS_LABEL) return true
  return /ß[₧ƒ]/.test(s)
}

export function resolveVipOrderStatusLabel(rawLabel, status = 'success') {
  if (isCorruptedVipOrderStatusLabel(rawLabel)) {
    return String(status || '').toLowerCase() === 'success'
      ? VIP_ORDER_STATUS_SUCCESS_KM
      : VIP_ORDER_STATUS_FAILED_KM
  }
  return String(rawLabel || '').trim()
}

/** 购买记录展示时间：固定柬埔寨金边时区（与后台筛选一致）。 */
export function formatVipOrderTimeLabel(atMs) {
  const t = Number(atMs)
  if (!Number.isFinite(t) || t <= 0) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Phnom_Penh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(t))
  const pick = (type) => parts.find((p) => p.type === type)?.value || '00'
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`
}

export function resolveVipOrderProductLabel(raw = {}) {
  const stored = String(raw?.product || '').trim()
  if (stored && stored !== NEUTRAL_PRODUCT_LABEL) return stored
  const planId = String(raw?.planId || '').trim()
  if (!planId) return stored || 'VIP'
  const audience = String(raw?.audience || '').toLowerCase() === 'author' ? 'author' : 'normal'
  const plan = getVipPlanForPurchase(planId, audience)
  return plan?.titleKm || stored || 'VIP'
}
