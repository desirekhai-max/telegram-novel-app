import HomeBodyScroll from './HomeBodyScroll.jsx'

/**
 * 首页正在使用的页面壳（tg-app--home + 分隔线 + HomeBodyScroll）。
 * @param {{
 *   toolbar: import('react').ReactNode,
 *   shellClassName?: string,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function HomePageViewport({ toolbar, shellClassName = '', children }) {
  return (
    <div className={['tg-app', 'tg-app--home', shellClassName].filter(Boolean).join(' ')}>
      {toolbar}
      <div className="tg-home-main-rule" aria-hidden />
      <HomeBodyScroll>{children}</HomeBodyScroll>
    </div>
  )
}
