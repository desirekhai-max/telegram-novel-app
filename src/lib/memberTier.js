/** 登录用户的默认基础身份；只改这里，避免多处硬编码导致行为不一致。 */
export const DEFAULT_LOGGED_IN_MEMBER_TIER = 'normal'

/**
 * 兼容旧评论徽标的前端兜底身份：未登录 / 已登录默认都只落到 `normal`。
 * 正式会员/VIP/作者状态应由后端 `viewer profile` 提供，前端不再根据 Telegram Premium 或本地存储抬高身份。
 *
 * @param {{ tgUser?: { id?: number, is_premium?: boolean }, novels?: object[] }} p
 * @returns {'author' | 'vip' | 'normal' | 'paid_vip'}
 */
export function resolveBaseMemberTier(p) {
  const tg = p?.tgUser
  if (!tg?.id) return 'normal'
  return DEFAULT_LOGGED_IN_MEMBER_TIER
}

/**
 * 兼容旧调用：等价于 {@link resolveBaseMemberTier}。
 *
 * @param {{ tgUser?: { id?: number, is_premium?: boolean }, novels?: object[] }} p
 * @returns {'author' | 'vip' | 'normal' | 'paid_vip'}
 */
export function computeViewerMemberTier(p) {
  return resolveBaseMemberTier(p)
}

/**
 * 评论/举报快照写入的基础档位（与 {@link computeViewerMemberTier} 一致，不含在期购买）。
 * `p.purchasedExpireAtMs` 已忽略，保留参数仅为兼容旧调用。
 *
 * @param {{ tgUser?: { id?: number, is_premium?: boolean }, novels?: object[], purchasedExpireAtMs?: number }} p
 * @param {number} [_nowMs] 保留签名兼容，未使用
 * @returns {'author' | 'vip' | 'normal' | 'paid_vip'}
 */
export function computeCommentSnapshotMemberTier(p, _nowMs = Date.now()) {
  return resolveBaseMemberTier(p)
}

/**
 * 含本地/同步购买到期时的档位：在期购买 → `paid_vip`；否则同 {@link computeCommentSnapshotMemberTier}。
 * **头像旁、评论提交快照**请用 `computeCommentSnapshotMemberTier`，避免仅一端有购买记录时与另一设备展示不一致。
 *
 * @param {{ tgUser?: { id?: number, is_premium?: boolean }, novels?: object[], purchasedExpireAtMs?: number }} p
 * @param {number} [nowMs]
 * @returns {'author' | 'vip' | 'normal' | 'paid_vip'}
 */
export function resolveMemberTierWithPurchase(p, nowMs = Date.now()) {
  const baseTier = resolveBaseMemberTier(p)
  const expire = parseVipExpireAtMs(p?.purchasedExpireAtMs)
  if (expire > nowMs) return 'paid_vip'
  return baseTier
}

export function parseVipExpireAtMs(raw) {
  const t = Number(raw)
  return Number.isFinite(t) && t > 0 ? t : 0
}

/** @returns {'' | 'author' | 'vip' | 'normal' | 'paid_vip'} */
export function normalizeStoredMemberTier(raw) {
  const s = String(raw ?? '').toLowerCase().trim()
  if (s === 'normal' || s === 'vip' || s === 'author' || s === 'paid_vip') return s
  return ''
}
