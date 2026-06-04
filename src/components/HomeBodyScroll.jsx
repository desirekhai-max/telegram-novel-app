/**
 * 首页正在使用的滚动容器（从 HomePage.jsx 原样抽出）。
 * @param {import('react').HTMLAttributes<HTMLElement>} props
 */
export default function HomeBodyScroll({ children, ...rest }) {
  return (
    <main className="tg-list-wrap tg-home-body-scroll flex min-h-0 flex-1 flex-col" {...rest}>
      {children}
    </main>
  )
}
