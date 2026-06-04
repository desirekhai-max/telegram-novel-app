import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'

/**
 * About / Contact / Terms / Privacy / Refund — 与首页相同的视口壳 + 内层滚动区。
 * 底栏占位由 .tg-app padding-bottom 承担（见 .tg-home-body-scroll 注释），不在滚动区叠 padding。
 */
export default function StaticLegalPageLayout({ title, titleLang = 'km', children }) {
  const swipeHandlers = useEdgeSwipeBack()

  return (
    <div className="tg-app tg-app--home">
      <BrandTabToolbar
        title={title}
        titleLang={titleLang}
        titleClassName="text-[16px]"
        showDivider
      />
      <div className="tg-home-main-rule" aria-hidden />
      <main
        className="tg-list-wrap tg-home-body-scroll flex min-h-0 flex-1 flex-col gap-5 px-6 pt-8"
        {...swipeHandlers}
      >
        {children}
      </main>
    </div>
  )
}
