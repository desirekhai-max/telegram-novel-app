import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * 右上角临时部署调试标识（无 DevTools 时验收用）。
 * @param {{ showBottomNav: boolean }} props
 */
export default function AppDeployDebugBadge({ showBottomNav }) {
  const location = useLocation()
  const [dockInDom, setDockInDom] = useState(false)

  useEffect(() => {
    const check = () => {
      setDockInDom(Boolean(document.querySelector('.tg-bottom-nav-dock')))
    }
    check()
    const id = window.requestAnimationFrame(check)
    return () => window.cancelAnimationFrame(id)
  }, [location.pathname, showBottomNav])

  return (
    <div className="tg-deploy-debug-badge" aria-live="polite">
      <div>COMMIT: {__BUILD_COMMIT__}</div>
      <div>PATH: {location.pathname}</div>
      <div>BOTTOMNAV: {showBottomNav ? '1' : '0'}</div>
      <div>DOCK_DOM: {dockInDom ? '1' : '0'}</div>
    </div>
  )
}
