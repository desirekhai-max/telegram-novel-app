import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Bookmark,
  ChevronRight,
  CircleHelp,
  Crown,
  DollarSign,
  Gem,
  Info,
  Library,
  MessageCircle,
  ReceiptText,
  UserRound,
} from 'lucide-react'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { CoinLineIcon } from '../components/CoinLineIcon.jsx'
import { computeMemberTier, parseCoinBalance, parseVipExpireAtMs } from '../lib/memberTier.js'
import { tryOpenTelegramMeLink } from '../lib/telegramWebApp.js'
import { usePremiumPreview } from '../hooks/usePremiumPreview.js'
import { formatTelegramDisplayName, useTelegramUser } from '../hooks/useTelegramUser.js'

/** 未登录时 `?card_preview=vip_gold` 用于查看个人中心双档卡片样式 */
const PREVIEW_DUAL_CARD_USER = {
  id: 990001,
  first_name: 'VIP',
  last_name: '+ U-Coin',
  username: undefined,
  language_code: 'km',
  is_premium: false,
}

/** 头像：优先 Telegram photo_url；不同会员层级用不同高亮色 */
function TelegramProfileAvatar({ photoUrl, memberTier }) {
  const [failed, setFailed] = useState(false)
  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="size-full object-cover"
        width={112}
        height={112}
        decoding="async"
        onError={() => setFailed(true)}
      />
    )
  }
  const iconClass =
    memberTier === 'gold' || memberTier === 'vip_gold'
      ? 'size-14 text-amber-100/95 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)]'
      : memberTier === 'vip'
        ? 'size-14 text-blue-100/95 drop-shadow-[0_0_10px_rgba(59,130,246,0.45)]'
        : 'size-14 text-white/95'
  return (
    <UserRound
      className={iconClass}
      strokeWidth={1.65}
    />
  )
}

/** 会员头像：统一圆形头像，不再使用等级头像框 */
function ProfileAvatarBlock({ user, avatarKey, memberTier }) {
  return (
    <div
      className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#3390ec]/35 via-[#3390ec]/15 to-violet-600/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ring-2 ring-white/15"
      aria-hidden
    >
      <TelegramProfileAvatar
        key={avatarKey}
        photoUrl={user?.photo_url}
        memberTier={memberTier}
      />
    </div>
  )
}

function formatVipExpireText(raw) {
  const t = Number(raw)
  if (!Number.isFinite(t) || t <= 0) return ''
  try {
    const s = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Phnom_Penh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(t))
    // zh-CN 常见为 2026/04/21 11:25 → 统一为 2026-04-21 11:25
    return s.replace(/\//g, '-')
  } catch {
    return ''
  }
}

/** VIP 剩余时间（中文），用于实时倒计时展示 */
function formatVipCountdownZh(expireAtMs, nowMs = Date.now()) {
  const end = Number(expireAtMs)
  if (!Number.isFinite(end) || end <= nowMs) return ''
  let sec = Math.floor((end - nowMs) / 1000)
  if (sec < 0) return ''
  const d = Math.floor(sec / 86400)
  sec %= 86400
  const h = Math.floor(sec / 3600)
  sec %= 3600
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (d > 0) return `还剩 ${d} 天 ${h} 小时`
  if (h > 0) return `还剩 ${h} 小时 ${m} 分 ${s} 秒`
  if (m > 0) return `还剩 ${m} 分 ${s} 秒`
  return `还剩 ${s} 秒`
}

/** VIP 剩余时间：每秒刷新，到期后整块消失 */
function VipCountdownBlock({ expireAtMs }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!expireAtMs || expireAtMs <= Date.now()) return undefined
    const id = window.setInterval(() => setTick((x) => x + 1), 1000)
    return () => window.clearInterval(id)
  }, [expireAtMs])
  if (!expireAtMs || expireAtMs <= Date.now()) return null
  const text = formatVipCountdownZh(expireAtMs, Date.now())
  if (!text) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-500/[0.08] px-2 py-1">
      <span className="text-[10px] font-semibold text-cyan-100/75" lang="zh-Hans">
        VIP
      </span>
      <span className="text-[11px] font-medium tabular-nums tracking-tight text-cyan-100/95" lang="zh-Hans">
        {text}
      </span>
    </div>
  )
}

function formatCoinBalanceText(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return '0'
  return Math.floor(n).toLocaleString('en-US')
}

function MembershipBadge({ memberTier, vipExpireAtText, coinBalanceText, vipExpireAtMs }) {
  const vipMs = Number(vipExpireAtMs)
  const showVipCountdown = Number.isFinite(vipMs) && vipMs > 0

  if (memberTier === 'vip_gold') {
    return (
      <div className="mt-2 flex flex-col items-start gap-2">
        <div
          className="inline-flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.12] bg-gradient-to-r from-blue-500/[0.14] via-violet-500/[0.1] to-amber-500/[0.16] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          lang="km"
        >
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/25 px-2 py-0.5 text-[10px] font-semibold text-blue-50/95 ring-1 ring-blue-300/25">
            <Crown className="size-3 shrink-0 text-blue-400/95" strokeWidth={2.2} aria-hidden />
            VIP
          </span>
          <span className="text-[10px] font-bold text-white/35" aria-hidden>
            +
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/25 px-2 py-0.5 text-[10px] font-semibold text-amber-50/95 ring-1 ring-amber-300/25">
            <CoinLineIcon className="size-3 shrink-0" />
            U-Coin
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full border border-blue-300/35 bg-gradient-to-r from-[#3a65ff]/28 to-[#7d4dff]/24 px-3 py-1 text-[11px] font-medium text-blue-50 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
            lang="km"
          >
            សមាជិក VIP
          </span>
          <span
            className="inline-flex items-center rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 px-3 py-1 text-[11px] font-medium text-amber-50/95 shadow-[0_0_20px_rgba(251,191,36,0.12)]"
            lang="km"
          >
            សមាជិកកាក់
          </span>
        </div>
        <div className="flex w-full min-w-0 flex-col items-start gap-1.5">
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
            <span
              className="inline-flex shrink-0 items-center rounded-full border border-amber-300/30 bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-amber-100/95"
              lang="km"
            >
              កាក់：{coinBalanceText}
            </span>
            {vipExpireAtText ? (
              <span className="shrink-0 whitespace-nowrap text-[9px] font-medium leading-tight text-blue-100/82">
                <span lang="km">ផុតកំណត់៖</span>
                {' '}
                <span className="tabular-nums tracking-tight" lang="zh-Hans">
                  {vipExpireAtText}
                </span>
              </span>
            ) : null}
          </div>
          {showVipCountdown ? <VipCountdownBlock expireAtMs={vipMs} /> : null}
        </div>
      </div>
    )
  }
  if (memberTier === 'gold') {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 px-3 py-1 text-[11px] font-medium text-amber-50/95 shadow-[0_0_20px_rgba(251,191,36,0.12)]"
          lang="km"
        >
          សមាជិកកាក់
        </span>
        <span className="inline-flex items-center rounded-full border border-amber-300/30 bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-amber-100/95" lang="km">
          កាក់：{coinBalanceText}
        </span>
      </div>
    )
  }
  if (memberTier === 'vip') {
    return (
      <div className="mt-2 flex flex-col items-start gap-1.5">
        <div className="flex w-full min-w-0 flex-col items-start gap-1.5">
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
            <span
              className="inline-flex shrink-0 items-center rounded-full border border-blue-300/45 bg-gradient-to-r from-[#3b82f6]/26 to-[#6366f1]/24 px-3 py-1 text-[11px] font-semibold text-blue-300/95 shadow-[0_0_18px_rgba(59,130,246,0.22)]"
              lang="km"
            >
              សមាជិក VIP
            </span>
            {vipExpireAtText ? (
              <span className="shrink-0 whitespace-nowrap text-[9px] font-medium leading-tight text-blue-100/82">
                <span lang="km">ផុតកំណត់៖</span>
                {' '}
                <span className="tabular-nums tracking-tight" lang="zh-Hans">
                  {vipExpireAtText}
                </span>
              </span>
            ) : null}
          </div>
          {showVipCountdown ? <VipCountdownBlock expireAtMs={vipMs} /> : null}
        </div>
      </div>
    )
  }
  return (
    <span
      className="mt-2 inline-flex items-center rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[11px] font-medium text-white/55"
      lang="km"
    >
      គម្រោងធម្មតា
    </span>
  )
}

/** 四色锥形边框：按「经过的时间」算角度，无 CSS animation 每圈循环的边界感 */
function AccountCardGradientBorder({ variant = 'default' }) {
  const ref = useRef(null)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduce) return

    const t0 = performance.now()
    const degPerSec = variant === 'vip_gold' ? 22 : 26
    let raf = 0

    const tick = (now) => {
      const elapsed = (now - t0) / 1000
      const angle = (elapsed * degPerSec) % 360
      const el = ref.current
      if (el) {
        el.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [variant])

  const background =
    variant === 'vip_gold'
      ? 'conic-gradient(from 0deg, #f59e0b 0%, #fcd34d 12%, #60a5fa 28%, #6366f1 42%, #a855f7 58%, #38bdf8 72%, #fbbf24 88%, #f59e0b 100%)'
      : 'conic-gradient(from 0deg, #3390ec 0%, #a855f7 22%, #f472b6 48%, #22d3ee 72%, #3390ec 100%)'

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[220%] w-[220%] min-h-[280px] min-w-[280px] will-change-transform"
      style={{
        transform: 'translate(-50%, -50%) rotate(0deg)',
        background,
      }}
    />
  )
}

/** 个人中心两列功能卡：左图标 + 文案 + 右箭头（`to` 站内 / `href` 外链；可选 tileClassName / labelClassName） */
function AccountActionTile({
  to,
  href,
  icon,
  iconClassName,
  iconWrapClassName,
  label,
  labelClassName,
  tileClassName,
  disabled = false,
}) {
  const IconComp = icon
  const className = `group flex min-h-[56px] items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.06] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors active:bg-white/[0.09] ${tileClassName ?? ''}`
  const body = (
    <>
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-black/25 ring-1 ring-white/[0.06] ${iconWrapClassName ?? ''}`}
      >
        <IconComp className={iconClassName} size={20} strokeWidth={2.2} aria-hidden />
      </span>
      <span
        className={`min-w-0 flex-1 text-[15px] font-semibold leading-snug tracking-tight text-white ${labelClassName ?? ''}`}
        lang="km"
      >
        {label}
      </span>
      <ChevronRight
        className="size-[18px] shrink-0 text-white/30 transition-colors group-hover:text-white/45"
        strokeWidth={2}
        aria-hidden
      />
    </>
  )

  if (disabled) {
    return (
      <div
        className={`${className} cursor-not-allowed opacity-70`}
        aria-disabled="true"
        title="暂时不可点击"
      >
        {body}
      </div>
    )
  }

  if (href) {
    const onClick = (e) => {
      if (tryOpenTelegramMeLink(href)) e.preventDefault()
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
      >
        {body}
      </a>
    )
  }

  return (
    <Link to={to} className={className}>
      {body}
    </Link>
  )
}

export default function AccountPage() {
  const MINI_APP_LOGIN_URL = 'https://t.me/nithian_kh_bot/app'
  const [searchParams] = useSearchParams()
  const rawUser = useTelegramUser()
  const premiumPreview = usePremiumPreview()
  const user = useMemo(() => {
    if (!rawUser) return null
    if (!premiumPreview) return rawUser
    return { ...rawUser, is_premium: true }
  }, [rawUser, premiumPreview])

  const cardPreviewDual = searchParams.get('card_preview') === 'vip_gold'
  const closeCardPreviewHref = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('card_preview')
    const q = p.toString()
    return q ? `/account?${q}` : '/account'
  }, [searchParams])

  const vipExpireAtMs = useMemo(
    () => parseVipExpireAtMs(searchParams.get('vip_expire')),
    [searchParams],
  )
  const coinBalance = useMemo(
    () => parseCoinBalance(searchParams.get('ucoin')),
    [searchParams],
  )
  const coinBalanceText = useMemo(
    () => formatCoinBalanceText(coinBalance),
    [coinBalance],
  )
  const memberTier = useMemo(
    () =>
      computeMemberTier({
        user,
        memberTierQuery: String(searchParams.get('member_tier') || ''),
        vipExpireAtMs,
        coinBalance,
      }),
    [searchParams, user, vipExpireAtMs, coinBalance],
  )
  const vipExpireAtText = useMemo(() => {
    if (memberTier !== 'vip' && memberTier !== 'vip_gold') return ''
    return formatVipExpireText(vipExpireAtMs)
  }, [memberTier, vipExpireAtMs])

  const profileUser = useMemo(() => {
    if (user) return user
    if (cardPreviewDual) return PREVIEW_DUAL_CARD_USER
    return null
  }, [user, cardPreviewDual])

  /** 卡片展示用：按当前会员档位展示；未登录双档预览仍可强制 `vip_gold` */
  const cardDisplayTier = useMemo(() => {
    if (!profileUser) return 'normal'
    if (cardPreviewDual) return 'vip_gold'
    if (user) return memberTier
    return 'vip_gold'
  }, [profileUser, cardPreviewDual, user, memberTier])

  const profileCoinBalanceText = useMemo(() => {
    if (cardDisplayTier !== 'vip_gold') return coinBalanceText
    if (coinBalance > 0) return coinBalanceText
    if (cardPreviewDual) return '12,580'
    return coinBalanceText
  }, [cardDisplayTier, coinBalance, coinBalanceText, cardPreviewDual])

  /** 未登录双档预览：固定一个未来到期点，供倒计时与到期文案共用 */
  const [previewSessionVipEndMs, setPreviewSessionVipEndMs] = useState(0)
  useEffect(() => {
    if (cardPreviewDual && !user) {
      setPreviewSessionVipEndMs(Date.now() + 365 * 24 * 60 * 60 * 1000)
    } else {
      setPreviewSessionVipEndMs(0)
    }
  }, [cardPreviewDual, user])

  const profileVipExpireText = useMemo(() => {
    if (memberTier === 'vip' || memberTier === 'vip_gold') {
      if (vipExpireAtMs > Date.now()) return formatVipExpireText(vipExpireAtMs)
    }
    if (cardPreviewDual && !user && previewSessionVipEndMs > Date.now()) {
      return formatVipExpireText(previewSessionVipEndMs)
    }
    return ''
  }, [memberTier, vipExpireAtMs, cardPreviewDual, user, previewSessionVipEndMs])

  /** 徽章「ផុតកំណត់៖」行：有真实到期用真实；否则用金边时区当前日期时间占位 */
  const vipExpireDisplayText = useMemo(() => {
    if (profileVipExpireText) return profileVipExpireText
    if (cardDisplayTier === 'vip' || cardDisplayTier === 'vip_gold') {
      return formatVipExpireText(Date.now())
    }
    return ''
  }, [profileVipExpireText, cardDisplayTier])

  /** 传给徽章：有有效到期时间戳才显示 VIP 倒计时 */
  const vipExpireMsForCountdown = useMemo(() => {
    if ((memberTier === 'vip' || memberTier === 'vip_gold') && vipExpireAtMs > Date.now()) {
      return vipExpireAtMs
    }
    if (cardPreviewDual && !user && previewSessionVipEndMs > Date.now()) {
      return previewSessionVipEndMs
    }
    return 0
  }, [memberTier, vipExpireAtMs, cardPreviewDual, user, previewSessionVipEndMs])

  const displayName = profileUser ? formatTelegramDisplayName(profileUser) : null
  const avatarKey = `${profileUser?.id ?? 'anon'}-${profileUser?.photo_url ?? ''}`
  const showPreviewBanner = Boolean(
    premiumPreview && rawUser && rawUser.is_premium !== true,
  )
  const onOpenTelegramMiniAppLogin = () => {
    if (tryOpenTelegramMeLink(MINI_APP_LOGIN_URL)) return
    window.open(MINI_APP_LOGIN_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="tg-app">
      <BrandTabToolbar title="គណនី" />
      <main className="tg-list-wrap flex flex-1 flex-col px-4 pb-8 pt-2">
        {showPreviewBanner ? (
          <div className="mx-auto mb-2 flex w-full max-w-md flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
            <span lang="zh-Hans">正在本地预览 Premium 头像样式（未改 Telegram 订阅）</span>
            <Link
              to="/account?premium_preview=0"
              className="shrink-0 font-medium text-amber-200 underline decoration-amber-200/60 underline-offset-2"
              lang="zh-Hans"
            >
              关闭预览
            </Link>
          </div>
        ) : null}

        {cardPreviewDual ? (
          <div className="mx-auto mb-2 flex w-full max-w-md flex-wrap items-center justify-between gap-2 rounded-xl border border-white/15 bg-gradient-to-r from-blue-500/10 to-amber-500/12 px-3 py-2 text-xs text-white/90">
            <span lang="zh-Hans">正在预览个人中心「VIP + 金币会员」卡片样式</span>
            <Link
              to={closeCardPreviewHref}
              className="shrink-0 font-medium text-amber-200 underline decoration-amber-200/60 underline-offset-2"
              lang="zh-Hans"
            >
              关闭预览
            </Link>
          </div>
        ) : null}

        <section className="relative mx-auto w-full max-w-md" aria-labelledby="account-profile-title">
          {/* 背后柔光，让卡片从背景里浮出来 */}
          <div
            className={
              cardDisplayTier === 'vip_gold'
                ? 'pointer-events-none absolute inset-x-2 -bottom-3 top-14 rounded-[28px] bg-gradient-to-r from-amber-500/[0.12] via-[#3390ec]/[0.1] to-violet-500/[0.1] blur-3xl'
                : 'pointer-events-none absolute inset-x-2 -bottom-3 top-14 rounded-[28px] bg-[#3390ec]/[0.08] blur-3xl'
            }
            aria-hidden
          />
          <div
            className={
              cardDisplayTier === 'vip_gold'
                ? 'pointer-events-none absolute -right-4 bottom-8 h-36 w-36 rounded-full bg-amber-400/[0.12] blur-3xl'
                : 'pointer-events-none absolute -right-4 bottom-8 h-36 w-36 rounded-full bg-violet-500/[0.09] blur-3xl'
            }
            aria-hidden
          />
          <div
            className={
              cardDisplayTier === 'vip_gold'
                ? 'pointer-events-none absolute -left-2 bottom-20 h-28 w-28 rounded-full bg-blue-500/[0.1] blur-3xl'
                : 'hidden'
            }
            aria-hidden
          />

          <div
            className={
              cardDisplayTier === 'vip_gold'
                ? 'relative overflow-hidden rounded-[22px] p-[2px] shadow-[0_22px_56px_-10px_rgba(0,0,0,0.55),0_0_40px_-8px_rgba(245,158,11,0.22),0_0_48px_-12px_rgba(59,130,246,0.18)]'
                : 'relative overflow-hidden rounded-[22px] p-[2px] shadow-[0_22px_56px_-10px_rgba(0,0,0,0.55)]'
            }
          >
            {/* 四色边框：rAF + 时间连续角速度，无始无尾；系统减少动态效果时不旋转 */}
            <AccountCardGradientBorder variant={cardDisplayTier === 'vip_gold' ? 'vip_gold' : 'default'} />
            <div className="relative z-10 overflow-hidden rounded-[18px] border border-white/[0.1] bg-[var(--tg-app-surface)] shadow-[inset_0_-1px_0_rgba(0,0,0,0.22)] ring-1 ring-inset ring-white/[0.05]">
              {/* 框内四色柔光叠底（外圈旋转描边不动） */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    cardDisplayTier === 'vip_gold'
                      ? `
                    radial-gradient(ellipse 88% 70% at 10% 8%, rgba(251, 191, 36, 0.22), transparent 55%),
                    radial-gradient(ellipse 86% 68% at 92% 18%, rgba(59, 130, 246, 0.26), transparent 54%),
                    radial-gradient(ellipse 82% 62% at 8% 88%, rgba(168, 85, 247, 0.2), transparent 52%),
                    radial-gradient(ellipse 78% 58% at 88% 84%, rgba(34, 211, 238, 0.2), transparent 50%)
                  `
                      : `
                    radial-gradient(ellipse 90% 72% at 12% 6%, rgba(51, 144, 236, 0.3), transparent 56%),
                    radial-gradient(ellipse 88% 68% at 94% 20%, rgba(168, 85, 247, 0.26), transparent 54%),
                    radial-gradient(ellipse 82% 62% at 6% 90%, rgba(244, 114, 182, 0.22), transparent 52%),
                    radial-gradient(ellipse 78% 58% at 90% 86%, rgba(34, 211, 238, 0.24), transparent 50%)
                  `,
                }}
              />
              <div className="relative z-10 px-5 pb-5 pt-6">
              <div className={profileUser ? 'flex items-start gap-5' : 'flex items-center gap-5'}>
                <ProfileAvatarBlock user={profileUser} avatarKey={avatarKey} memberTier={cardDisplayTier} />
                <div className={profileUser ? 'min-w-0 flex-1 pt-0' : 'min-w-0 flex-1 flex flex-col justify-center'}>
                  {profileUser ? (
                    <h2
                      id="account-profile-title"
                      className="min-w-0 truncate text-[1.35rem] font-semibold leading-snug tracking-tight text-white"
                    >
                      <span className="inline-flex max-w-full items-center gap-1">
                        <span className="truncate">{displayName}</span>
                      {cardDisplayTier === 'vip_gold' ? (
                        <span className="inline-flex shrink-0 items-center gap-1 align-[2px]" aria-hidden>
                          <span className="motion-safe:animate-coin-icon-float relative inline-flex h-[16px] w-[16px] items-center justify-center rounded-full border-[1.5px] border-[#2f56ff]/85 bg-transparent text-[6px] font-semibold leading-none text-[#2f56ff]">
                            VIP
                          </span>
                          <span className="inline-flex items-center justify-center align-[1px]">
                            <span className="motion-safe:animate-coin-icon-float inline-flex h-[16px] w-[16px] items-center justify-center rounded-full border border-amber-300/90 bg-transparent text-[6px] font-semibold leading-none text-amber-200">
                              កាក់
                            </span>
                          </span>
                        </span>
                      ) : cardDisplayTier === 'vip' ? (
                        <span className="inline-flex shrink-0 items-center align-[2px]" aria-hidden>
                          <span className="motion-safe:animate-coin-icon-float relative inline-flex h-[16px] w-[16px] items-center justify-center rounded-full border-[1.5px] border-[#2f56ff]/85 bg-transparent text-[6px] font-semibold leading-none text-[#2f56ff]">
                            VIP
                          </span>
                        </span>
                      ) : cardDisplayTier === 'gold' ? (
                        <span className="inline-flex shrink-0 items-center align-[2px]" aria-hidden>
                          <span className="inline-flex items-center justify-center align-[1px]">
                            <span className="motion-safe:animate-coin-icon-float inline-flex h-[16px] w-[16px] items-center justify-center rounded-full border border-amber-300/90 bg-transparent text-[6px] font-semibold leading-none text-amber-200">
                              កាក់
                            </span>
                          </span>
                        </span>
                      ) : null}
                      </span>
                    </h2>
                  ) : null}

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {profileUser ? (
                      <span className="inline-flex items-center rounded-lg border border-white/[0.08] bg-black/30 px-2 py-0.5 font-mono text-[11px] tabular-nums tracking-wide text-white/55">
                        {cardPreviewDual && !user ? `ID ${profileUser.id} · មើលគំរូ` : `ID ${profileUser.id}`}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center rounded-lg border border-white/[0.16] bg-black/35 px-3 py-1 text-[18px] font-semibold tracking-wide text-white/92"
                        lang="zh-Hans"
                        onClick={onOpenTelegramMiniAppLogin}
                        title="点击进入 Telegram Mini App 登录"
                      >
                        未登录
                      </button>
                    )}
                  </div>

                  {profileUser?.username ? (
                    <p className="mt-1 truncate text-sm text-white/55">@{profileUser.username}</p>
                  ) : profileUser?.language_code ? (
                    <p className="mt-1 truncate text-sm text-white/45" lang="km">
                      ភាសា · {profileUser.language_code}
                    </p>
                  ) : !profileUser ? (
                    <p className="mt-1 text-sm text-white/50" lang="zh-Hans">
                      请在 Telegram Mini App 内打开本应用以自动登录账号。
                    </p>
                  ) : null}

                  {profileUser ? (
                    <MembershipBadge
                      memberTier={cardDisplayTier}
                      vipExpireAtText={vipExpireDisplayText}
                      coinBalanceText={profileCoinBalanceText}
                      vipExpireAtMs={vipExpireMsForCountdown}
                    />
                  ) : null}
                </div>
              </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto mt-5 w-full max-w-md" aria-label="មុខងារគណនី" lang="km">
          {/* ជួរ ១ */}
          <div className="grid grid-cols-2 gap-3">
            <AccountActionTile
              to="/vip"
              icon={Gem}
              iconClassName="text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]"
              iconWrapClassName="!rounded-md bg-amber-950/40 ring-amber-400/20"
              label="ទិញ VIP"
              disabled={!user}
            />
            <AccountActionTile
              to="/vip"
              icon={DollarSign}
              iconClassName="text-red-400"
              iconWrapClassName="!rounded-md bg-red-950/45 ring-red-400/25"
              label="បញ្ចូល U-Coin"
              labelClassName="!text-[11.5px] !leading-[1.25] tracking-normal sm:!text-[12.5px]"
              disabled={!user}
            />
          </div>
          {/* ជួរ ២ */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <AccountActionTile
              to="/vip"
              icon={ReceiptText}
              iconClassName="text-emerald-300/95"
              iconWrapClassName="!rounded-md bg-emerald-950/35 ring-emerald-400/20"
              label="ប្រវត្តិបញ្ជាទិញ"
              disabled={!user}
            />
            <AccountActionTile
              to="/"
              icon={Library}
              iconClassName="text-sky-300/95"
              label="ប្រវត្តិអាន"
              disabled={!user}
            />
          </div>
          {/* ជួរ ៣ */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <AccountActionTile
              to="/"
              icon={Bookmark}
              iconClassName="text-rose-300/95"
              iconWrapClassName="!rounded-md bg-rose-950/30 ring-rose-400/20"
              label="ចំណូលចិត្ត"
              disabled={!user}
            />
            <AccountActionTile
              to="/tasks"
              icon={CircleHelp}
              iconClassName="text-violet-300/95"
              label="មជ្ឈមណ្ឌលជំនួយ"
              labelClassName="!text-[11.5px] !leading-[1.25] tracking-normal sm:!text-[12.5px]"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <AccountActionTile
              href="https://t.me/VIP_69kkh"
              icon={MessageCircle}
              iconClassName="text-sky-300/95"
              iconWrapClassName="!rounded-md bg-sky-950/35 ring-sky-400/25"
              label="ទាក់ទងផ្នែកបម្រើអតិថិជន"
              tileClassName="col-span-2"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <AccountActionTile
              to="/about"
              icon={Info}
              iconClassName="text-white/85"
              iconWrapClassName="!rounded-md bg-white/[0.08] ring-white/15"
              label="អំពីយើងខ្ញុំ"
              tileClassName="col-span-2"
              disabled
            />
          </div>
        </section>
      </main>
    </div>
  )
}

