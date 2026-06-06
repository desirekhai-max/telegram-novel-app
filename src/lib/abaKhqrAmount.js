/** 从 KHQR 支付 session 解析展示用金额 */
export function resolveKhqrAmountParts(session) {
  const n = Number(session?.amount)
  if (Number.isFinite(n) && n > 0) {
    const value = Number.isInteger(n) ? String(n) : n.toFixed(2)
    return { value, currency: String(session?.currency || 'USD').trim() || 'USD' }
  }
  const label = String(session?.amountLabel || '').trim()
  const match = label.match(/([0-9]+(?:\.[0-9]{1,2})?)/)
  if (match) {
    return { value: match[1], currency: 'USD' }
  }
  return { value: '—', currency: 'USD' }
}

export function formatKhqrUsdSummary(amountParts) {
  if (amountParts.value === '—') return '— USD'
  return `${amountParts.value} ${amountParts.currency}`
}
