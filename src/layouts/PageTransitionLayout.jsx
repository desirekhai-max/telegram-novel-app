import { Outlet } from 'react-router-dom'

/** 路由外壳：无任何 Tab/3D/过渡，仅渲染子路由。 */
export default function PageTransitionLayout() {
  return (
    <div className="tg-page-shell" style={{ minHeight: '100%' }}>
      <Outlet />
    </div>
  )
}
