import { useRef } from 'react'
import AppMainTabToolbar from './AppMainTabToolbar.jsx'
import MainTabPagesHost from './MainTabPagesHost.jsx'
import SharedMainChromeOverlayPane from './SharedMainChromeOverlayPane.jsx'
import AboutPage from '../pages/AboutPage.jsx'
import ContactUsPage from '../pages/ContactUsPage.jsx'
import NotificationsPage from '../pages/NotificationsPage.jsx'
import OrderHistoryPage from '../pages/OrderHistoryPage.jsx'
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage.jsx'
import ReadingHistoryPage from '../pages/ReadingHistoryPage.jsx'
import SavedPage from '../pages/SavedPage.jsx'
import TermsOfServicePage from '../pages/TermsOfServicePage.jsx'
import { MainTabShellContext } from '../contexts/mainTabShellContext.js'
import { isMainTabPath, normalizeAppPathname } from '../lib/bottomNavRoutes.js'
import { isSharedOverlayPath } from '../lib/sharedMainChromeOverlays.js'

const SHARED_OVERLAY_PAGES = {
  '/notifications': NotificationsPage,
  '/account/orders': OrderHistoryPage,
  '/account/reading-history': ReadingHistoryPage,
  '/account/saved': SavedPage,
  '/contact-us': ContactUsPage,
  '/about': AboutPage,
  '/terms-of-service': TermsOfServicePage,
  '/privacy-policy': PrivacyPolicyPage,
}

/**
 * 底栏主流程壳：三 Tab + 叠层子页共用同一 AppMainTabToolbar，切换时 logo/通知不重挂。
 */
export default function SharedMainChromeShell({ activePathname }) {
  const path = normalizeAppPathname(activePathname)
  const OverlayPage = isSharedOverlayPath(path) ? SHARED_OVERLAY_PAGES[path] : null
  const lastMainTabRef = useRef('/account')
  if (isMainTabPath(path)) lastMainTabRef.current = path
  const mainTabPath = isMainTabPath(path) ? path : lastMainTabRef.current
  const overlayOpen = Boolean(OverlayPage)

  return (
    <MainTabShellContext.Provider value={true}>
      <div className="tg-main-tab-shell">
        <AppMainTabToolbar activePathname={path} />
        <div
          className={[
            'tg-main-tab-host',
            overlayOpen ? 'tg-main-tab-host--overlay-open' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <MainTabPagesHost activePathname={mainTabPath} hideToolbar underlayRevealed={overlayOpen} />
          {OverlayPage ? (
            <SharedMainChromeOverlayPane>
              <OverlayPage />
            </SharedMainChromeOverlayPane>
          ) : null}
        </div>
      </div>
    </MainTabShellContext.Provider>
  )
}
