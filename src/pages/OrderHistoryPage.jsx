import { useEffect, useState } from 'react'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'
import { useTelegramUser } from '../hooks/useTelegramUser.js'
import { fetchViewerVipOrders } from '../lib/viewerProfileApi.js'

export default function OrderHistoryPage() {
  const swipeHandlers = useEdgeSwipeBack()
  const tgUser = useTelegramUser()
  const [ordersNewestFirst, setOrdersNewestFirst] = useState([])

  useEffect(() => {
    let cancelled = false
    if (!tgUser?.id) {
      setOrdersNewestFirst([])
      return () => {}
    }
    const controller = new AbortController()
    ;(async () => {
      const items = await fetchViewerVipOrders({ signal: controller.signal })
      if (!cancelled) setOrdersNewestFirst(items)
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [tgUser?.id])

  return (
    <div className="tg-app tg-app--account">
      <BrandTabToolbar title="ប្រវត្តិបញ្ជាទិញ" titleLang="km" showDivider />
      <main
        className="tg-list-wrap tg-account-scroll flex flex-1 flex-col px-6 py-8"
        {...swipeHandlers}
      >
        {!ordersNewestFirst.length ? (
          <div className="flex flex-1 items-center justify-center text-center text-white/50" lang="km">
            មិនទាន់មានប្រវត្តិបញ្ជាទិញ
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-md flex-col gap-4">
            {ordersNewestFirst.map((order) => (
              <article key={order.id} className="tg-order-card">
                <div className="flex items-start justify-between gap-3">
                  <p className="tg-order-card__product truncate" lang="km">
                    {order.product}
                  </p>
                  <span
                    lang="km"
                    className={[
                      'tg-order-card__status',
                      order.status === 'success' ? 'tg-order-card__status--success' : 'tg-order-card__status--failed',
                    ].join(' ')}
                  >
                    {order.statusLabel}
                  </span>
                </div>
                <p className="tg-order-card__id">{order.id}</p>
                <div className="tg-order-card__row">
                  <span className="tg-order-card__amount">{order.amount}</span>
                  <span className="tg-order-card__time">{order.time}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
