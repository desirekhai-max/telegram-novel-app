/**
 * 评论/账户旁会员身份徽标：作者（握笔）、VIP（统一圆环「VIP」）；未登录无徽标。
 */
export function CommentMemberBadges({ tier, role = '', vipActive = false }) {
  const legacyTier = String(tier ?? '').toLowerCase().trim()
  const normalizedRole = String(role ?? '').toLowerCase().trim()
  const showAuthor = normalizedRole === 'author' || legacyTier === 'author'
  const showVip = Boolean(vipActive) || legacyTier === 'vip' || legacyTier === 'paid_vip'
  if (!showAuthor && !showVip) return null
  const base = String(import.meta.env.BASE_URL || '/')
  const authorIconSrc = `${base.replace(/\/?$/, '/')}author-hand-pen.png`
  const authorPenBadge = (
    <span
      className="tg-member-badge tg-member-badge--author tg-member-badge--author-round"
      role="img"
      aria-label="អ្នកនិពន្ធ"
    >
      <img
        className="tg-member-badge__author-img"
        src={authorIconSrc}
        alt=""
        width={12}
        height={12}
        decoding="async"
        draggable={false}
      />
    </span>
  )
  return (
    <span className="tg-member-badges inline-flex flex-shrink-0 flex-wrap items-center gap-1 align-middle">
      {showAuthor ? authorPenBadge : null}
      {showVip ? (
        <span
          className="tg-member-badge tg-member-badge--author tg-member-badge--author-round tg-member-badge--paid-vip-ring"
          role="img"
          aria-label="សមាជិក VIP"
        >
          <span className="tg-member-badge__paid-vip-label" lang="en" aria-hidden>
            VIP
          </span>
        </span>
      ) : null}
    </span>
  )
}
