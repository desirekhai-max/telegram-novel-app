import { useEffect, useLayoutEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AmbientBackdrop from './components/AmbientBackdrop.jsx'
import BottomNav from './components/BottomNav.jsx'
import { AppChromeProvider } from './contexts/AppChromeProvider.jsx'
import { useAppChrome } from './contexts/useAppChrome.js'
import { isAdminAuthed, verifyAdminSession } from './lib/adminAuth.js'
import { registerPresencePing } from './lib/miniAppPresence.js'
import PageTransitionLayout from './layouts/PageTransitionLayout.jsx'
import AboutPage from './pages/AboutPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import AdminLoginPage from './pages/AdminLoginPage.jsx'
import HomePage from './pages/HomePage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import ReaderPage from './pages/ReaderPage.jsx'
import TasksPage from './pages/TasksPage.jsx'
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

function AppShell() {
  const location = useLocation()
  const { searchExploreOpen, filterPanelOpen, homeSearchInputFocused } = useAppChrome()

  const isReader = location.pathname.startsWith('/read/')
  const isAbout = location.pathname === '/about'
  const isAdminLogin = location.pathname === '/admin-login'
  const isAdminRoute = location.pathname === '/admin' || isAdminLogin
  useLayoutEffect(() => {
    document.body.classList.toggle('tg-desktop-admin', isAdminRoute)
    return () => document.body.classList.remove('tg-desktop-admin')
  }, [isAdminRoute])

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

  const bottomNavHidden =
    isReader || searchExploreOpen || filterPanelOpen || isAbout || isAdminRoute || homeSearchInputFocused

  return (
    <>
      <AmbientBackdrop />
      <div className="tg-app-root">
        <Routes>
          <Route element={<PageTransitionLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/vip" element={<VipPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/admin" element={<AdminGuard />} />
            <Route path="/admin-login" element={<AdminLoginPage />} />
            <Route path="/read/:id" element={<ReaderPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <div
          className={
            bottomNavHidden
              ? 'tg-bottom-nav-dock tg-bottom-nav-dock--hidden'
              : 'tg-bottom-nav-dock'
          }
          inert={bottomNavHidden}
        >
          <BottomNav />
        </div>
      </div>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter unstable_useTransitions={false}>
      <AppChromeProvider>
        <AppShell />
      </AppChromeProvider>
    </BrowserRouter>
  )
}
