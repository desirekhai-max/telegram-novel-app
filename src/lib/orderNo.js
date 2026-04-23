/**
 * 订单号规则（与业务约定一致）：
 * - 前缀为「精确到秒」的日期时间，通常 14 位：YYYYMMDDHHmmss
 * - 同一秒内若有多笔（例如多用户同时阅读触发计费），前缀会相同，须在末尾追加序号等后缀，保证全局唯一
 *
 * @param {Date} [at] 取该时刻的日历（默认当前时间）
 * @param {number} [sequence] 同一秒内的序号，从 0 起；会格式化为至少 2 位（可改为更多位）
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
