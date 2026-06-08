/**
 * 服务端订单号生成（与 `src/lib/orderNo.js` 规则一致）：
 * - 前缀 YYYYMMDDHHmmss（14 位）
 * - 同秒内追加 2 位序号，保证全局唯一
 *
 * @param {Date} [at]
 * @param {number} [sequence] 同秒内序号，从 0 起
 * @returns {string}
 */
export function buildOrderNo(at = new Date(), sequence = 0) {
  const pad2 = (n) => String(Math.trunc(n)).padStart(2, '0')
  const y = at.getFullYear()
  const mo = pad2(at.getMonth() + 1)
  const d = pad2(at.getDate())
  const h = pad2(at.getHours())
  const mi = pad2(at.getMinutes())
  const s = pad2(at.getSeconds())
  const prefix = `${y}${mo}${d}${h}${mi}${s}`
  const seq = Math.max(0, Math.min(9999, Number(sequence) || 0))
  const suffix = String(seq).padStart(2, '0')
  return `${prefix}${suffix}`
}

/**
 * @param {Date} [at]
 * @returns {string} YYYYMMDDHHmmss
 */
export function buildOrderNoSecondPrefix(at = new Date()) {
  const pad2 = (n) => String(Math.trunc(n)).padStart(2, '0')
  const y = at.getFullYear()
  const mo = pad2(at.getMonth() + 1)
  const d = pad2(at.getDate())
  const h = pad2(at.getHours())
  const mi = pad2(at.getMinutes())
  const s = pad2(at.getSeconds())
  return `${y}${mo}${d}${h}${mi}${s}`
}
