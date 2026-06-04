import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AmbientBackdrop from './components/AmbientBackdrop.jsx'
import AppBottomNavDock from './components/AppBottomNavDock.jsx'
import { AppChromeProvider } from './contexts/AppChromeProvider.jsx'
import { ViewerProfileProvider } from './contexts/ViewerProfileProvider.jsx'
import { SwipeBackProvider, useSwipeBack } from './contexts/SwipeBackProvider.jsx'
import { useAppChrome } from './contexts/useAppChrome.js'
import { isAdminAuthed, verifyAdminSession } from './lib/adminAuth.js'
import { registerPresencePing } from './lib/miniAppPresence.js'
import { isPathWithoutBottomNav } from './lib/pathsWithoutBottomNav.js'
import { loadCatalogNovels } from './lib/novelsRuntime.js'
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
import VipCheckoutRedirectPage from './pages/VipCheckoutRedirectPage.jsx'
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

function AppRoutes({ routeLocation }) {
  return (
    <Routes location={routeLocation}>
      <Route element={<PageTransitionLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/account/orders" element={<OrderHistoryPage />} />
        <Route path="/account/reading-history" element={<ReadingHistoryPage />} />
        <Route path="/account/saved" element={<SavedPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />
        <Route path="/contact-us" element={<ContactUsPage />} />
        <Route path="/vip" element={<VipPage />} />
        <Route path="/vip/aba-khqr" element={<VipAbaKhqrPage />} />
        <Route path="/vip/checkout-redirect" element={<VipCheckoutRedirectPage />} />
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
  const { swipe, setSwipe } = useSwipeBack()
  const { searchExploreOpen, filterPanelOpen, homeSearchInputFocused } = useAppChrome()

  const isReader = location.pathname.startsWith('/read/')
  const isAdminLogin = location.pathname === '/admin-login'
  const isAdminRoute = location.pathname === '/admin' || isAdminLogin
  const previousLocationRef = useRef(null)
  const currentLocationRef = useRef(location)

  useLayoutEffect(() => {
    document.body.classList.toggle('tg-desktop-admin', isAdminRoute)
    return () => document.body.classList.remove('tg-desktop-admin')
  }, [isAdminRoute])

  useEffect(() => {
    void loadCatalogNovels()
  }, [])

  useEffect(() => {
    previousLocationRef.current = currentLocationRef.current
    currentLocationRef.current = location
  }, [location])

  /** 路由切换时清零边缘返回位移，避免整页仍被 translate 到屏外（表现为点卡片后全白） */
  useEffect(() => {
    setSwipe({ active: false, dx: 0, animating: false })
  }, [location.pathname, setSwipe])

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

  const showBottomNav =
    !isReader &&
    !isAdminRoute &&
    !isPathWithoutBottomNav(location.pathname) &&
    !searchExploreOpen &&
    !filterPanelOpen &&
    !homeSearchInputFocused
  const showSwipeUnderlay = swipe.active && previousLocationRef.current

  return (
    <>
      <AmbientBackdrop />
      <div className="tg-app-root">
        {showSwipeUnderlay ? (
          <div className="tg-swipe-underlay" aria-hidden>
            <AppRoutes routeLocation={previousLocationRef.current} />
          </div>
        ) : null}
        <div
          className={[
            'tg-swipe-foreground',
            swipe.active || swipe.animating ? 'tg-swipe-foreground--gesture' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            transform: swipe.active && swipe.dx > 0 ? `translateX(${swipe.dx}px)` : undefined,
            transition: swipe.animating ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }}
        >
          <AppRoutes routeLocation={location} />
        </div>
        {showBottomNav ? <AppBottomNavDock /> : null}
      </div>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter unstable_useTransitions={false}>
      <AppChromeProvider>
        <ViewerProfileProvider>
          <SwipeBackProvider>
            <AppShell />
          </SwipeBackProvider>
        </ViewerProfileProvider>
      </AppChromeProvider>
    </BrowserRouter>
  )
}
