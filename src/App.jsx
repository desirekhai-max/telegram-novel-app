import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AmbientBackdrop from './components/AmbientBackdrop.jsx'
import BannedUserGate from './components/BannedUserGate.jsx'
import AppBottomNavDock from './components/AppBottomNavDock.jsx'
import SharedMainChromeShell from './components/SharedMainChromeShell.jsx'
import { AppChromeProvider } from './contexts/AppChromeProvider.jsx'
import { ViewerProfileProvider } from './contexts/ViewerProfileProvider.jsx'
import { SwipeBackProvider, useSwipeBack } from './contexts/SwipeBackProvider.jsx'
import { useAppChrome } from './contexts/useAppChrome.js'
import { useVipAbaKhqrBankReturn } from './hooks/useVipAbaKhqrBankReturn.js'
import { isAdminAuthed, verifyAdminSession } from './lib/adminAuth.js'
import { registerPresencePing } from './lib/miniAppPresence.js'
import { syncPortraitLockRoute } from './lib/portraitOrientationLock.js'
import {
  isMainTabPath,
  isSharedMainChromePath,
  normalizeAppPathname,
  shouldMountSwipeBackUnderlay,
  shouldRenderAppBottomNavDock,
} from './lib/bottomNavRoutes.js'
import { loadCatalogNovels } from './lib/novelsRuntime.js'
import { loadVipPlansCatalog } from './lib/vipPlansRuntime.js'
import PageTransitionLayout from './layouts/PageTransitionLayout.jsx'
import AboutPage from './pages/AboutPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import AdminLoginPage from './pages/AdminLoginPage.jsx'
import ContactUsPage from './pages/ContactUsPage.jsx'
import HomePage from './pages/HomePage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import OrderHistoryPage from './pages/OrderHistoryPage.jsx'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.jsx'
import RefundPolicyPage from './pages/RefundPolicyPage.jsx'
import ReadingHistoryPage from './pages/ReadingHistoryPage.jsx'
import ReaderPage from './pages/ReaderPage.jsx'
import SavedPage from './pages/SavedPage.jsx'
import TermsOfServicePage from './pages/TermsOfServicePage.jsx'
import PaymentReturnPage from './pages/PaymentReturnPage.jsx'
import VipAbaKhqrPage from './pages/VipAbaKhqrPage.jsx'
import VipPaymentSuccessPage from './pages/VipPaymentSuccessPage.jsx'
import VipCheckoutRedirectPage from './pages/VipCheckoutRedirectPage.jsx'
import VipAbaKhqrLaunchPage from './pages/VipAbaKhqrLaunchPage.jsx'
import VipPage from './pages/VipPage.jsx'

function AdminGuard() {
  const hasToken = isAdminAuthed()
  const [status, setStatus] = useState(() => (hasToken ? 'checking' : 'denied'))

  useEffect(() => {
    let active = true
    if (!hasToken) return () => { active = false }
    void verifyAdminSession().then((ok) => {
      if (!active) return
      setStatus(ok ? 'allowed' : 'denied')
    })
    return () => {
      active = false
    }
  }, [hasToken])

  if (status === 'checking') return null
  return status === 'allowed' ? <AdminPage /> : <Navigate to="/admin-login?redirect=/admin" replace />
}

function AppRoutes({ routeLocation, includeMainTabs = true }) {
  return (
    <Routes location={routeLocation}>
      <Route element={<PageTransitionLayout />}>
        {includeMainTabs ? (
          <>
            <Route path="/" element={<HomePage />} />
            <Route path="/vip" element={<VipPage />} />
            <Route path="/account" element={<AccountPage />} />
          </>
        ) : null}
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/account/orders" element={<OrderHistoryPage />} />
        <Route path="/account/reading-history" element={<ReadingHistoryPage />} />
        <Route path="/account/saved" element={<SavedPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />
        <Route path="/contact-us" element={<ContactUsPage />} />
        <Route path="/vip/aba-khqr" element={<VipAbaKhqrPage />} />
        <Route path="/vip/payment-success" element={<VipPaymentSuccessPage />} />
        <Route path="/vip/checkout-redirect" element={<VipCheckoutRedirectPage />} />
        <Route path="/vip/aba-khqr-launch" element={<VipAbaKhqrLaunchPage />} />
        <Route path="/vip/payment-return" element={<PaymentReturnPage />} />
        <Route path="/admin" element={<AdminGuard />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/read/:id" element={<ReaderPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function AppShell() {
  const location = useLocation()
  useVipAbaKhqrBankReturn()
  const { gestureLive, gestureAnimating, registerForeground, resetGesture } = useSwipeBack()
  const {
    searchExploreOpen,
    setSearchExploreOpen,
    filterPanelOpen,
    setFilterPanelOpen,
    homeSearchInputFocused,
    setHomeSearchInputFocused,
    homeNovelDetailOpen,
  } = useAppChrome()

  const isReader = location.pathname.startsWith('/read/')
  const isAdminLogin = location.pathname === '/admin-login'
  const isAdminRoute = location.pathname === '/admin' || isAdminLogin
  const previousLocationRef = useRef(null)
  const currentLocationRef = useRef(location)
  const gesturePathnameRef = useRef(location.pathname)
  const portraitPathnameRef = useRef(location.pathname)
  const foregroundMainTab = isSharedMainChromePath(location.pathname)

  useLayoutEffect(() => {
    document.body.classList.toggle('tg-desktop-admin', isAdminRoute)
    const prevPortrait = normalizeAppPathname(portraitPathnameRef.current)
    const currPortrait = normalizeAppPathname(location.pathname)
    portraitPathnameRef.current = location.pathname
    if (!(isMainTabPath(prevPortrait) && isMainTabPath(currPortrait))) {
      syncPortraitLockRoute(location.pathname)
    }
    return () => document.body.classList.remove('tg-desktop-admin')
  }, [isAdminRoute, location.pathname])

  useEffect(() => {
    void loadCatalogNovels()
    void loadVipPlansCatalog({ force: true })
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadVipPlansCatalog({ force: true })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    previousLocationRef.current = currentLocationRef.current
    currentLocationRef.current = location
  }, [location])

  /** 路由切换时清零边缘返回位移；主 Tab 互切与主 Tab→子页跳过，避免顶栏/内容区闪动 */
  useEffect(() => {
    const prev = normalizeAppPathname(gesturePathnameRef.current)
    const curr = normalizeAppPathname(location.pathname)
    gesturePathnameRef.current = location.pathname
    if (isSharedMainChromePath(prev) && isSharedMainChromePath(curr)) return
    resetGesture()
  }, [location.pathname, resetGesture])

  /** 离开主 Tab 时再收起搜索/筛选，Tab 互切不重置（共用顶栏保持状态） */
  useEffect(() => {
    if (isSharedMainChromePath(location.pathname)) return
    setSearchExploreOpen(false)
    setFilterPanelOpen(false)
    setHomeSearchInputFocused(false)
  }, [location.pathname, setSearchExploreOpen, setFilterPanelOpen, setHomeSearchInputFocused])

  useEffect(() => {
    const adminOnline = location.pathname === '/admin' && isAdminAuthed()
    registerPresencePing(location.pathname, adminOnline)
    const timer = window.setInterval(() => {
      const online = location.pathname === '/admin' && isAdminAuthed()
      registerPresencePing(location.pathname, online)
    }, 5 * 1000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const online = location.pathname === '/admin' && isAdminAuthed()
        registerPresencePing(location.pathname, online)
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [location.pathname])

  const showBottomNav = shouldRenderAppBottomNavDock(location.pathname, {
    searchExploreOpen,
    filterPanelOpen,
    homeSearchInputFocused,
  })
  const bottomNavDetailHidden =
    homeNovelDetailOpen && normalizeAppPathname(location.pathname) === '/'

  const backLocation = previousLocationRef.current
  const hasSwipeBackUnderlay =
    backLocation &&
    shouldMountSwipeBackUnderlay(backLocation.pathname, location.pathname)
  const swipeGestureActive = gestureLive || gestureAnimating

  const foregroundContent = foregroundMainTab ? (
    <div className="tg-page-shell" style={{ minHeight: '100%' }}>
      <SharedMainChromeShell activePathname={location.pathname} />
    </div>
  ) : (
    <AppRoutes routeLocation={location} includeMainTabs={false} />
  )

  return (
    <>
      <AmbientBackdrop />
      <div className="tg-app-root">
        {hasSwipeBackUnderlay ? (
          <div className="tg-swipe-underlay" aria-hidden>
            <AppRoutes routeLocation={backLocation} includeMainTabs />
          </div>
        ) : null}
        <div
          ref={registerForeground}
          className={[
            'tg-swipe-foreground',
            swipeGestureActive ? 'tg-swipe-foreground--gesture' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {foregroundContent}
        </div>
        {showBottomNav ? <AppBottomNavDock detailHidden={bottomNavDetailHidden} /> : null}
      </div>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter unstable_useTransitions={false}>
      <AppChromeProvider>
        <ViewerProfileProvider>
          <BannedUserGate>
            <SwipeBackProvider>
              <AppShell />
            </SwipeBackProvider>
          </BannedUserGate>
        </ViewerProfileProvider>
      </AppChromeProvider>
    </BrowserRouter>
  )
}
