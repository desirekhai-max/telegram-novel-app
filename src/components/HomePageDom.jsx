/**
 * HomePage.jsx 页面骨架（DOM 与原首页一致）。
 */
export default function HomePageDom({ shellClassName = '', toolbar, children, afterMain = null }) {
  return (
    <div className={['tg-app', 'tg-app--home', shellClassName].filter(Boolean).join(' ')}>
      {toolbar}
      <div className="tg-home-main-rule" aria-hidden />
      <main className="tg-list-wrap tg-home-body-scroll flex min-h-0 flex-1 flex-col">
        {children}
        <div className="tg-home-body-scroll__dock-mask" aria-hidden />
      </main>
      {afterMain}
    </div>
  )
}
