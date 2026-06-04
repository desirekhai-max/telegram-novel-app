/**
 * 首页 / 政策页共用页面骨架。
 * @param {{ withBottomNav?: boolean }} props
 */
export default function HomePageDom({
  shellClassName = '',
  toolbar,
  children,
  afterMain = null,
  withBottomNav = true,
}) {
  return (
    <div
      className={[
        'tg-app',
        'tg-app--home',
        withBottomNav ? '' : 'tg-app--no-bottom-nav',
        shellClassName,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {toolbar}
      <div className="tg-home-main-rule" aria-hidden />
      <main
        className={[
          'tg-list-wrap',
          'tg-home-body-scroll',
          'flex min-h-0 flex-1 flex-col',
          withBottomNav ? '' : 'tg-home-body-scroll--no-bottom-nav',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
        {withBottomNav ? <div className="tg-home-body-scroll__dock-mask" aria-hidden /> : null}
      </main>
      {afterMain}
    </div>
  )
}
