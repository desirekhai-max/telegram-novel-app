import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'

/**
 * About / Contact / Terms / Privacy / Refund 等静态政策页共用布局。
 * 为 fixed 底栏预留滚动留白，避免最后一段正文被 Home/VIP/账户 遮挡。
 *
 * @param {{
 *   title: string,
 *   titleLang?: string,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function StaticLegalPageLayout({ title, titleLang = 'km', children }) {
  const swipeHandlers = useEdgeSwipeBack()

  return (
    <div className="tg-app tg-static-legal-page">
      <BrandTabToolbar
        title={title}
        titleLang={titleLang}
        titleClassName="text-[16px]"
        showDivider
      />
      <main className="tg-list-wrap tg-static-legal-page__scroll flex flex-1 flex-col gap-5" {...swipeHandlers}>
        {children}
      </main>
    </div>
  )
}
