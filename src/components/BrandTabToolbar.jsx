import { Bell } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { refreshAppFromLogo } from '../lib/refreshAppFromLogo.js'
import { useTelegramUser } from '../hooks/useTelegramUser.js'
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount.js'

/** 任务 / VIP / 账户：左 LOGO（回首页）或返回「&lt;」、中间标题 */
export default function BrandTabToolbar({
  title,
  titleLang = 'km',
  backTo,
  titleClassName = '',
  showDivider = false,
}) {
  const tgUser = useTelegramUser()
  const unreadNotificationCount = useUnreadNotificationCount(tgUser)
  const left = backTo ? (
    <Link
      to={backTo}
      className="tg-toolbar__brand-tab-logo tg-toolbar__brand-tab-back m-0 flex h-10 min-w-10 shrink-0 items-center justify-center leading-none text-white/90 transition-colors active:text-white"
      aria-label="返回"
    >
      <span
        className="select-none font-sans text-[1.2rem] font-light leading-none tracking-tight text-white/80"
        aria-hidden
      >
        {'<'}
      </span>
    </Link>
  ) : (
    <button
      type="button"
      className="tg-toolbar__logo tg-toolbar__brand-tab-logo m-0 shrink-0 cursor-pointer leading-none"
      aria-label="刷新界面"
      onClick={() => refreshAppFromLogo()}
    >
      <img
        src="/logo.png"
        alt=""
        className="tg-toolbar__logo-img tg-toolbar__logo-img--tab"
        width="120"
        height="32"
        decoding="async"
      />
    </button>
  )

  return (
    <header
      className={[
        'tg-toolbar',
        'tg-toolbar--large',
        'tg-toolbar--brand-tab',
        showDivider ? '' : 'tg-toolbar--no-divider',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {left}
      <div className="tg-toolbar__tab-center">
        <h1 className={`tg-toolbar__title tg-toolbar__title--tab m-0 ${titleClassName}`.trim()} lang={titleLang}>
          {title}
        </h1>
      </div>
      <div className="tg-toolbar__tab-end">
        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            ['tg-toolbar-notify', isActive ? 'tg-toolbar-notify--active' : ''].filter(Boolean).join(' ')
          }
          aria-label="通知"
        >
          <Bell size={20} strokeWidth={2} aria-hidden />
          {unreadNotificationCount > 0 ? (
            <span className="tg-toolbar-notify__badge" aria-label={`未读通知 ${unreadNotificationCount}`}>
              {unreadNotificationCount > 99 ? '99+' : String(unreadNotificationCount)}
            </span>
          ) : null}
        </NavLink>
      </div>
    </header>
  )
}
