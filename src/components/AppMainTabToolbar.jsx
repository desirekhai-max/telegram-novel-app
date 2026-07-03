import { Bell, Search, X } from 'lucide-react'
import { useLayoutEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAppChrome } from '../contexts/useAppChrome.js'
import { useTelegramUser } from '../hooks/useTelegramUser.js'
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount.js'
import {
  isMainTabPath,
  isSharedOverlayPath,
  normalizeAppPathname,
} from '../lib/bottomNavRoutes.js'
import { getSharedOverlayToolbarTitle } from '../lib/sharedMainChromeOverlays.js'
import { refreshAppFromLogo } from '../lib/refreshAppFromLogo.js'

const MAIN_TAB_TITLES = {
  '/vip': { title: 'សមាជិកVIP', lang: 'km', className: 'text-[16px]' },
  '/account': { title: 'គណនី', lang: 'km', className: '' },
}

/**
 * 底栏三 Tab 共用顶栏：logo / 通知只挂载一次；中间区用显隐切换，避免 Tab 切换像重新加载。
 */
export default function AppMainTabToolbar({ activePathname }) {
  const activePath = normalizeAppPathname(activePathname)
  const isHome = activePath === '/'
  const isOverlay = isSharedOverlayPath(activePath)
  const isNotifications = activePath === '/notifications'
  const tgUser = useTelegramUser()
  const unreadNotificationCount = useUnreadNotificationCount(tgUser)
  const {
    homeSearchDraft,
    setHomeSearchDraft,
    setHomeCommittedQuery,
    homeCommittedQuery,
    homeSearchInputRef,
    homeSearchInputFocused,
    setHomeSearchInputFocused,
    callNotificationsMarkAll,
  } = useAppChrome()

  const titleMeta = isMainTabPath(activePath) ? MAIN_TAB_TITLES[activePath] : null
  const overlayMeta = isOverlay ? getSharedOverlayToolbarTitle(activePath) : null

  useLayoutEffect(() => {
    if (isHome) return
    homeSearchInputRef.current?.blur()
    if (homeSearchInputFocused) setHomeSearchInputFocused(false)
  }, [activePath, homeSearchInputFocused, homeSearchInputRef, isHome, setHomeSearchInputFocused])

  const commitHomeSearch = () => {
    const q = homeSearchDraft.trim()
    setHomeSearchDraft(q)
    setHomeCommittedQuery(q)
    homeSearchInputRef.current?.blur()
  }

  const onSearchBlur = () => {
    window.setTimeout(() => {
      setHomeSearchInputFocused(false)
      const q = homeSearchDraft.trim()
      if (!q) return
      if (q === homeCommittedQuery.trim()) return
      setHomeSearchDraft(q)
      setHomeCommittedQuery(q)
    }, 120)
  }

  const clearHomeSearch = () => {
    setHomeSearchDraft('')
    setHomeCommittedQuery('')
  }

  return (
    <header
      className={[
        'tg-toolbar',
        'tg-toolbar--large',
        'tg-toolbar--main-tab',
        'tg-toolbar--brand-tab',
        'tg-toolbar--no-divider',
        isOverlay ? 'tg-toolbar--overlay-route' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
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
          decoding="sync"
          fetchPriority="high"
          loading="eager"
        />
      </button>

      <div className="tg-main-tab-toolbar__center min-w-0 flex-1">
        <div
          className={[
            'tg-main-tab-toolbar__panel',
            'tg-main-tab-toolbar__panel--home',
            isHome ? 'tg-main-tab-toolbar__panel--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="search"
          aria-hidden={!isHome}
        >
          <div className="tg-toolbar__search-slot min-w-0">
            <form
              className="tg-search-field"
              onSubmit={(e) => {
                e.preventDefault()
                commitHomeSearch()
              }}
            >
              <span className="tg-search-field__icon" aria-hidden="true">
                <Search size={17} strokeWidth={2} />
              </span>
              <input
                ref={homeSearchInputRef}
                className="tg-search-field__input"
                type="search"
                enterKeyHint="search"
                inputMode="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="ស្វែងរកសៀវភៅ ឬអ្នកនិពន្ធ..."
                value={homeSearchDraft}
                onChange={(e) => setHomeSearchDraft(e.target.value)}
                onFocus={() => setHomeSearchInputFocused(true)}
                onBlur={onSearchBlur}
                tabIndex={isHome ? 0 : -1}
                aria-label="ស្វែងរកសៀវភៅ អ្នកនិពន្ធ ឬស្លាក; ចុច Enter ដើម្បីមើលលទ្ធផល និងបិទក្ដារចុច"
              />
              {homeSearchDraft.length > 0 ? (
                <button
                  type="button"
                  className="tg-search-field__clear"
                  aria-label="សម្អាតការស្វែងរក"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearHomeSearch}
                  tabIndex={isHome ? 0 : -1}
                >
                  <X size={15} strokeWidth={2.25} aria-hidden />
                </button>
              ) : null}
            </form>
          </div>
        </div>

        <div
          className={[
            'tg-main-tab-toolbar__panel',
            'tg-main-tab-toolbar__panel--title',
            titleMeta ? 'tg-main-tab-toolbar__panel--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden={!titleMeta}
        >
          {titleMeta ? (
            <div className="tg-toolbar__tab-center">
              <h1
                className={`tg-toolbar__title tg-toolbar__title--tab m-0 ${titleMeta.className}`.trim()}
                lang={titleMeta.lang}
              >
                {titleMeta.title}
              </h1>
            </div>
          ) : null}
        </div>

        <div
          className={[
            'tg-main-tab-toolbar__panel',
            'tg-main-tab-toolbar__panel--title',
            'tg-main-tab-toolbar__panel--overlay',
            overlayMeta ? 'tg-main-tab-toolbar__panel--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden={!overlayMeta}
        >
          {overlayMeta ? (
            <div className="tg-toolbar__tab-center">
              <h1
                className={[
                  'tg-toolbar__title',
                  'tg-toolbar__title--tab',
                  'm-0',
                  overlayMeta.className,
                ]
                  .filter(Boolean)
                  .join(' ')}
                lang={overlayMeta.lang}
              >
                {overlayMeta.title}
              </h1>
            </div>
          ) : null}
        </div>
      </div>

      <div className="tg-toolbar__tab-end">
        {isNotifications ? (
          <button
            type="button"
            className="tg-notifications__mark-all"
            lang="km"
            onClick={callNotificationsMarkAll}
          >
            អានទាំងអស់
          </button>
        ) : (
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
        )}
      </div>
    </header>
  )
}
