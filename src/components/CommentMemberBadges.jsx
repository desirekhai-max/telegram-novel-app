/**
 * 与账号页名字后会员标一致（评论/回复行内紧凑展示）。
 * @param {{ tier: 'normal' | 'gold' | 'vip' | 'vip_gold' }} props
 */
export function CommentMemberBadges({ tier }) {
  if (tier === 'vip_gold') {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 align-[2px]" aria-hidden>
        <span className="motion-safe:animate-coin-icon-float relative inline-flex h-[15px] w-[15px] items-center justify-center rounded-full border-[1.5px] border-[#2f56ff]/85 bg-transparent text-[6px] font-semibold leading-none text-[#2f56ff]">
          VIP
        </span>
        <span className="motion-safe:animate-coin-icon-float inline-flex h-[15px] w-[15px] items-center justify-center rounded-full border border-amber-300/90 bg-transparent text-[6px] font-semibold leading-none text-amber-200">
          កាក់
        </span>
      </span>
    )
  }
  if (tier === 'vip') {
    return (
      <span className="inline-flex shrink-0 items-center align-[2px]" aria-hidden>
        <span className="motion-safe:animate-coin-icon-float relative inline-flex h-[15px] w-[15px] items-center justify-center rounded-full border-[1.5px] border-[#2f56ff]/85 bg-transparent text-[6px] font-semibold leading-none text-[#2f56ff]">
          VIP
        </span>
      </span>
    )
  }
  if (tier === 'gold') {
    return (
      <span className="inline-flex shrink-0 items-center align-[2px]" aria-hidden>
        <span className="motion-safe:animate-coin-icon-float inline-flex h-[15px] w-[15px] items-center justify-center rounded-full border border-amber-300/90 bg-transparent text-[6px] font-semibold leading-none text-amber-200">
          កាក់
        </span>
      </span>
    )
  }
  return null
}

