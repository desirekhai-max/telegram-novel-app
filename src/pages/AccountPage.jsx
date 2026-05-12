import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bookmark,
  Crown,
  FileText,
  Info,
  Library,
  Mail,
  MessageCircle,
  ReceiptText,
  Shield,
  Users,
  UserRound,
} from 'lucide-react'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { CommentMemberBadges } from '../components/CommentMemberBadges.jsx'
import { ACCOUNT_OPEN_IN_TELEGRAM_KM } from '../lib/errorMessagesKm.js'
import { tryOpenTelegramMeLink } from '../lib/telegramWebApp.js'
import { formatTelegramDisplayName, useTelegramUser } from '../hooks/useTelegramUser.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'

/** 头像：优先 Telegram photo_url；无图时显示默认图标 */
function TelegramProfileAvatar({ photoUrl }) {
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
  return (
    <UserRound
      className="size-14 text-white/95"
      strokeWidth={1.65}
    />
  )
}

/** 会员头像：统一圆形头像，不再使用等级头像框 */
function ProfileAvatarBlock({ user, avatarKey }) {
  return (
    <div
      className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#3390ec]/45 via-cyan-400/20 to-fuchsia-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_20px_rgba(51,144,236,0.35),0_0_32px_rgba(168,85,247,0.22)] ring-2 ring-cyan-300/35"
      aria-hidden
    >
      <TelegramProfileAvatar
        key={avatarKey}
        photoUrl={user?.photo_url}
      />
    </div>
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
  labelLang = 'km',
  labelClassName,
  tileClassName,
  coverImageUrl,
  disabled = false,
}) {
  const IconComp = icon
  const className = [
    'tg-account-tile',
    disabled ? 'tg-account-tile--disabled' : '',
    tileClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  const body = (
    <>
      {coverImageUrl ? (
        <>
          <span
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-80"
            style={{ backgroundImage: `url(${coverImageUrl})` }}
            aria-hidden
          />
          <span
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/35 to-black/45"
            aria-hidden
          />
        </>
      ) : null}
      <span className={`tg-account-tile__icon-wrap ${iconWrapClassName ?? ''}`}>
        <IconComp className={iconClassName} size={20} strokeWidth={2.15} aria-hidden />
      </span>
      <span className={`tg-account-tile__label ${labelClassName ?? ''}`} lang={labelLang}>
        {label}
      </span>
    </>
  )

  if (disabled) {
    return (
      <div className={className} aria-disabled="true" title="暂时不可点击">
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

/** 临时开关：个人中心隐藏「进入群聊」入口，后续需要展示时改回 false。 */
const HIDE_ACCOUNT_COMMUNITY_TILE = true

export default function AccountPage() {
  const MINI_APP_LOGIN_URL = 'https://t.me/nithian_kh_bot/app'
  const rawUser = useTelegramUser()
  const { viewerProfile } = useViewerProfile(rawUser)

  const profileUser = useMemo(() => {
    if (rawUser) return rawUser
    return null
  }, [rawUser])

  const displayName = profileUser ? formatTelegramDisplayName(profileUser) : null
  const accountRole = viewerProfile.role
  const accountVipActive = Boolean(viewerProfile.vipActive)
  /** 用户名下方方案胶囊：Premium / 作者 / 普通（与徽标同源） */
  const accountPlanPill = useMemo(() => {
    if (accountVipActive) {
      return { pillClass: 'tg-account-plan-badge--vip-member', labelKm: 'គម្រោង VIP' }
    }
    if (accountRole === 'author') {
      return { pillClass: 'tg-account-plan-badge--author-plan', labelKm: 'គម្រោងអ្នកនិពន្ធ' }
    }
    return { pillClass: '', labelKm: 'គម្រោងធម្មតា' }
  }, [accountRole, accountVipActive])
  const avatarKey = `${profileUser?.id ?? 'anon'}-${profileUser?.photo_url ?? ''}`
  const onOpenTelegramMiniAppLogin = () => {
    if (tryOpenTelegramMeLink(MINI_APP_LOGIN_URL)) return
    window.open(MINI_APP_LOGIN_URL, '_blank', 'noopener,noreferrer')
  }

  const accountProfileCardVipShadowOff = profileUser && accountVipActive

  return (
    <div className="tg-app tg-app--account">
      <BrandTabToolbar title="គណនី" />
      <main className="tg-list-wrap tg-account-scroll flex flex-1 flex-col px-4 pb-8 pt-2">
        <section className="relative mx-auto w-full max-w-md" aria-labelledby="account-profile-title">
          <div
            className={[
              'relative overflow-hidden rounded-[22px]',
              accountProfileCardVipShadowOff ? '' : 'shadow-[0_22px_56px_-10px_rgba(0,0,0,0.55)]',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="tg-account-profile-card__shell relative overflow-hidden rounded-[22px]">
              {/* 框内四色环境光 */}
              <div aria-hidden className="tg-account-profile-card__ambient" />
              <div className="relative z-10 px-5 pb-5 pt-6">
              <div className={profileUser ? 'flex items-start gap-5' : 'flex items-center gap-5'}>
                <ProfileAvatarBlock user={profileUser} avatarKey={avatarKey} />
                <div className={profileUser ? 'min-w-0 flex-1 pt-0' : 'min-w-0 flex-1 flex flex-col justify-center'}>
                  {profileUser ? (
                    <h2
                      id="account-profile-title"
                      className="tg-account-profile-card__title min-w-0 text-[1.35rem] font-semibold leading-snug tracking-tight text-white"
                    >
                      <span className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1">
                        <span className="min-w-0 truncate">{displayName}</span>
                        <CommentMemberBadges role={accountRole} vipActive={accountVipActive} />
                      </span>
                    </h2>
                  ) : null}

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {profileUser ? (
                      <span className="inline-flex items-center font-mono text-[11px] tabular-nums tracking-wide text-white/52">
                        {`ID ${profileUser.id}`}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center rounded-lg border border-white/[0.16] bg-black/35 px-3 py-1 text-[18px] font-semibold tracking-wide text-white/92"
                        lang="km"
                        onClick={onOpenTelegramMiniAppLogin}
                        title="សូមប៉ះដើម្បីបើក Telegram Mini App និងចូលគណនី"
                      >
                        សូមចូលគណនី
                      </button>
                    )}
                  </div>

                  {profileUser?.username ? (
                    <>
                      <p className="tg-account-profile-card__handle mt-1 truncate text-sm">@{profileUser.username}</p>
                      <div className="mt-1.5 min-w-0">
                        <span
                          lang="km"
                          className={['tg-account-plan-badge truncate', accountPlanPill.pillClass]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <span className="tg-account-plan-badge__label">{accountPlanPill.labelKm}</span>
                        </span>
                      </div>
                    </>
                  ) : profileUser?.language_code ? (
                    <p className="mt-1 truncate text-sm text-white/45" lang="km">
                      ភាសា · {profileUser.language_code}
                    </p>
                  ) : !profileUser ? (
                    <p className="mt-1 text-sm text-white/50" lang="km">
                      {ACCOUNT_OPEN_IN_TELEGRAM_KM}
                    </p>
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
              icon={Crown}
              iconClassName="text-amber-300/95"
              iconWrapClassName="border-amber-400/22 bg-amber-950/42"
              label="ទិញVIP"
            />
            <AccountActionTile
              to="/account/orders"
              icon={ReceiptText}
              iconClassName="text-emerald-300/95"
              iconWrapClassName="border-emerald-400/22 bg-emerald-950/40"
              label="ប្រវត្តិបញ្ជាទិញ"
              labelClassName="whitespace-nowrap text-[13px]"
              disabled={!rawUser}
            />
          </div>
          {/* ជួរ ២ */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <AccountActionTile
              to="/account/reading-history"
              icon={Library}
              iconClassName="text-sky-300/95"
              iconWrapClassName="border-sky-400/22 bg-sky-950/38"
              label="ប្រវត្តិអាន"
              disabled={!rawUser}
            />
            <AccountActionTile
              to="/account/saved"
              icon={Bookmark}
              iconClassName="text-rose-300/95"
              iconWrapClassName="border-rose-400/22 bg-rose-950/38"
              label="រក្សាទុក"
              disabled={!rawUser}
            />
          </div>
          {/* ជួរ ៣ */}
          <div className="mt-3 grid grid-cols-1 gap-3">
            <AccountActionTile
              href="https://t.me/VIP_69kkh"
              icon={MessageCircle}
              iconClassName="text-sky-300/95"
              iconWrapClassName="border-sky-400/25 bg-sky-950/42"
              label="ទាក់ទងផ្នែកបម្រើអតិថិជន"
            />
          </div>
          {!HIDE_ACCOUNT_COMMUNITY_TILE ? (
            <>
              {/* ជួរ ៤ */}
              <div className="mt-3 grid grid-cols-1 gap-3">
                <AccountActionTile
                  href="https://t.me/Team_69KKH"
                  icon={Users}
                  iconClassName="text-violet-300/95"
                  iconWrapClassName="border-violet-400/25 bg-violet-950/42"
                  label="ចុចទីនេះដើម្បីចូលមកជជែកលេងទាំងអស់គ្នា"
                />
              </div>
            </>
          ) : null}
          {/* ជួរ ៥ */}
          <div className="mt-3 grid grid-cols-1 gap-3">
            <AccountActionTile
              to="/about"
              icon={Info}
              iconClassName="text-white/88"
              iconWrapClassName="border-white/14 bg-white/[0.07]"
              label="អំពីយើងខ្ញុំ"
            />
          </div>
          {/* ជួរ ៦ */}
          <div className="mt-3 grid grid-cols-1 gap-3">
            <AccountActionTile
              to="/terms-of-service"
              icon={FileText}
              iconClassName="text-cyan-300/95"
              iconWrapClassName="border-cyan-400/22 bg-cyan-950/38"
              label="Terms of Service"
              labelLang="en"
              labelClassName="text-[13px]"
            />
          </div>
          {/* ជួរ ៧ */}
          <div className="mt-3 grid grid-cols-1 gap-3">
            <AccountActionTile
              to="/privacy-policy"
              icon={Shield}
              iconClassName="text-emerald-300/95"
              iconWrapClassName="border-emerald-400/22 bg-emerald-950/38"
              label="Privacy Policy"
              labelLang="en"
              labelClassName="text-[13px]"
            />
          </div>
          {/* ជួរ ៨ */}
          <div className="mt-3 grid grid-cols-1 gap-3">
            <AccountActionTile
              to="/contact-us"
              icon={Mail}
              iconClassName="text-amber-300/95"
              iconWrapClassName="border-amber-400/22 bg-amber-950/38"
              label="Contact Us"
              labelLang="en"
              labelClassName="text-[13px]"
            />
          </div>
        </section>
      </main>
    </div>
  )
}

