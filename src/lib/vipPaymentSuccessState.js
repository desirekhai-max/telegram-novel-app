export const VIP_PAYMENT_SUCCESS_KEY = 'tg_vip_payment_success_v1'

/** @typedef {{ planId?: string, planLabel?: string, priceLabel?: string, durationHours?: number, purchasedAt?: string }} VipPaymentSuccessPayload */

/** @param {VipPaymentSuccessPayload} payload */
export function saveVipPaymentSuccessPayload(payload) {
  try {
    sessionStorage.setItem(VIP_PAYMENT_SUCCESS_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

/** @returns {VipPaymentSuccessPayload | null} */
export function loadVipPaymentSuccessPayload() {
  try {
    const raw = sessionStorage.getItem(VIP_PAYMENT_SUCCESS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function clearVipPaymentSuccessPayload() {
  try {
    sessionStorage.removeItem(VIP_PAYMENT_SUCCESS_KEY)
  } catch {
    /* ignore */
  }
}

/** 高棉月份名（支付成功页等到期展示） */
const KM_MONTH_NAMES = [
  'មករា',
  'កុម្ភៈ',
  'មីនា',
  'មេសា',
  'ឧសភា',
  'មិថុនា',
  'កក្កដា',
  'សីហា',
  'កញ្ញា',
  'តុលា',
  'វិច្ឆិកា',
  'ធ្នូ',
]

function pad2(n) {
  return String(Math.trunc(n)).padStart(2, '0')
}

/** @param {Date} date */
function formatKhmerClockLabel(date) {
  const hour24 = date.getHours()
  const minute = pad2(date.getMinutes())
  if (hour24 >= 12) {
    const hour12 = hour24 === 12 ? 12 : hour24 - 12
    return `${hour12}:${minute} ល្ងាច`
  }
  const hour12 = hour24 === 0 ? 12 : hour24
  return `${hour12}:${minute} ព្រឹក`
}

/** @param {Date} date @returns {string} 例如 `6 មិថុនា 2026 ម៉ោង 5:54 ល្ងាច` */
export function formatKhmerDateTimeLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—'
  const day = date.getDate()
  const month = KM_MONTH_NAMES[date.getMonth()] || ''
  const year = date.getFullYear()
  const clock = formatKhmerClockLabel(date)
  return `${day} ${month} ${year} ម៉ោង ${clock}`
}

export function formatVipPaymentPurchasedOn(iso) {
  const date = iso ? new Date(iso) : new Date()
  return formatKhmerDateTimeLabel(date)
}

export function formatVipPaymentPriceLabel(raw) {
  const label = String(raw || '').trim()
  if (!label) return '$1.00 USD'
  const normalized = label.startsWith('$') ? label : `$${label}`
  if (/USD/i.test(normalized)) return normalized
  const amount = Number.parseFloat(normalized.replace(/[^0-9.]/g, ''))
  if (Number.isFinite(amount)) return `$${amount.toFixed(2)} USD`
  return `${normalized} USD`
}

export function formatVipPlanHoursLabel(hours) {
  const value = Number(hours)
  if (!Number.isFinite(value) || value <= 0) return '—'
  return `${value} ម៉ោង`
}

export function formatVipPlanAccessLabel(hours) {
  const label = formatVipPlanHoursLabel(hours)
  return label === '—' ? label : `${label} Access`
}

export function formatVipPaymentExpiresAt(iso, durationHours) {
  const start = iso ? new Date(iso) : new Date()
  if (Number.isNaN(start.getTime())) return '—'
  const hours = Number(durationHours)
  const addMs = Number.isFinite(hours) && hours > 0 ? hours * 3600000 : 0
  const expires = new Date(start.getTime() + addMs)
  return formatKhmerDateTimeLabel(expires)
}
