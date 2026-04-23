import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initTelegramWebApp } from './lib/telegramWebApp.js'

initTelegramWebApp()

// 首屏渲染前先标记 admin 路由，避免 #root 先按手机宽度渲染导致闪屏
if (typeof window !== 'undefined') {
  const path = window.location.pathname
  const isAdminRoute = path === '/admin' || path === '/admin-login'
  document.body.classList.toggle('tg-desktop-admin', isAdminRoute)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
