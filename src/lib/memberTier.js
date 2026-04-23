/**
 * 与账号页一致的会员档位推导（URL ?member_tier、Premium、VIP 到期、金币双档）。
 * @param {{ user: { is_premium?: boolean } | null, memberTierQuery: string, vipExpireAtMs: number, coinBalance: number }} p
 * @returns {'normal' | 'gold' | 'vip' | 'vip_gold'}
 */
export function computeMemberTier(p) {
  const { user, memberTierQuery, vipExpireAtMs, coinBalance } = p
  if (!user) return 'normal'
  const q = String(memberTierQuery || '').toLowerCase()
  let base =
    q === 'normal' || q === 'gold' || q === 'vip' || q === 'vip_gold' ? q : 'normal'
  if (base === 'vip_gold') return 'vip_gold'
  if (base === 'vip' && vipExpireAtMs > 0 && Date.now() >= vipExpireAtMs) {
    base = 'gold'
  }
  if (base === 'vip' && coinBalance > 0) return 'vip_gold'
  if (base === 'vip') return 'vip'
  if (base === 'normal') return 'vip'
  return 'gold'
}

export function parseVipExpireAtMs(raw) {
  const t = Number(raw)
  return Number.isFinite(t) && t > 0 ? t : 0
}

export function parseCoinBalance(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

/** @returns {'' | 'normal' | 'gold' | 'vip' | 'vip_gold'} */
export function normalizeStoredMemberTier(raw) {
  const s = String(raw ?? '').toLowerCase()
  if (s === 'vip_gold' || s === 'vip' || s === 'gold' || s === 'normal') return s
  return ''
}
