import { useEffect, useState } from 'react'
import AppMainTabToolbar from './AppMainTabToolbar.jsx'
import AccountPage from '../pages/AccountPage.jsx'
import HomePage from '../pages/HomePage.jsx'
import VipPage from '../pages/VipPage.jsx'
import { MainTabShellContext } from '../contexts/mainTabShellContext.js'
import { isMainTabPath, normalizeAppPathname } from '../lib/bottomNavRoutes.js'

const MAIN_TAB_PAGES = {
  '/': HomePage,
  '/vip': VipPage,
  '/account': AccountPage,
}

/**
 * 底栏三 Tab：共用固定顶栏 + 页面保活，切换时只换中间标题/内容区。
 */
export default function MainTabPagesHost({ activePathname, hideToolbar = false, underlayRevealed = false }) {
  const activePath = normalizeAppPathname(activePathname)
  const [mountedPaths, setMountedPaths] = useState(() => new Set([activePath]))

  useEffect(() => {
    if (!isMainTabPath(activePath)) return
    setMountedPaths((prev) => {
      if (prev.has(activePath)) return prev
      const next = new Set(prev)
      next.add(activePath)
      return next
    })
  }, [activePath])

  const panes = Array.from(mountedPaths).map((path) => {
    const Page = MAIN_TAB_PAGES[path]
    if (!Page) return null
    const isActive = path === activePath
    return (
      <div
        key={path}
        className={[
          'tg-main-tab-host__pane',
          isActive ? 'tg-main-tab-host__pane--active' : '',
          isActive && underlayRevealed ? 'tg-main-tab-host__pane--underlay' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        hidden={!isActive}
        aria-hidden={!isActive}
      >
        <Page />
      </div>
    )
  })

  if (hideToolbar) {
    return <>{panes}</>
  }

  return (
    <MainTabShellContext.Provider value={true}>
      <div className="tg-main-tab-shell">
        <AppMainTabToolbar activePathname={activePathname} />
        <div className="tg-main-tab-host">{panes}</div>
      </div>
    </MainTabShellContext.Provider>
  )
}
