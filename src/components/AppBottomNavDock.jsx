import BottomNav from './BottomNav.jsx'

/** App.jsx 内 tg-bottom-nav-dock 原样抽出（与首页共用同一底栏挂载）。 */
export default function AppBottomNavDock({ hidden }) {
  return (
    <div
      className={hidden ? 'tg-bottom-nav-dock tg-bottom-nav-dock--hidden' : 'tg-bottom-nav-dock'}
      inert={hidden}
    >
      <BottomNav />
    </div>
  )
}
