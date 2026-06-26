import { useLayoutEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { startAbaKhqrPaymentFlow } from '../lib/abaMobile.js'
import {
  clearVipAbaKhqrPendingPayment,
  loadVipAbaKhqrSession,
  markVipAbaKhqrBrowserFlowOpen,
  saveVipAbaKhqrPendingPayment,
} from '../lib/vipAbaKhqrSession.js'

/**
 * ABA KHQR 外链须在页面首帧同步 openLink（async 点击后再开会被 Telegram WebView 拦截）。
 */
export default function VipAbaKhqrLaunchPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')

  useLayoutEffect(() => {
    const session = loadVipAbaKhqrSession()
    const planId = String(session?.planId || '').trim()
    if (!session?.tranId) {
      setStatus('missing')
      return undefined
    }

    const opened = startAbaKhqrPaymentFlow(session, planId)
    if (!opened.opened) {
      clearVipAbaKhqrPendingPayment(session.tranId)
      setStatus('failed')
      return undefined
    }

    saveVipAbaKhqrPendingPayment(session, { expireAtMs: session.expireAtMs })
    markVipAbaKhqrBrowserFlowOpen(session)
    navigate('/vip', { replace: true })
    return undefined
  }, [navigate])

  return (
    <div className="tg-app tg-app--about">
      <BrandTabToolbar title="កំពុងបើក ABA KHQR" titleLang="km" titleClassName="text-[15px]" showDivider />
      <main className="tg-list-wrap tg-about-scroll flex flex-1 flex-col items-center justify-center gap-4 px-6 pt-12 pb-32 text-center">
        {status === 'loading' ? (
          <p className="text-[0.95rem] text-white/75" lang="km">
            កំពុងបើក Browser សម្រាប់ ABA KHQR…
          </p>
        ) : null}
        {status === 'missing' || status === 'failed' ? (
          <>
            <p className="text-[0.95rem] leading-relaxed text-white/75" lang="km">
              {status === 'missing'
                ? 'មិនឃើញព័ត៌មានទូទាត់ សូមព្យាយាមទិញម្តងទៀត។'
                : 'មិនអាចបើក Browser បាន សូមព្យាយាមម្តងទៀត។'}
            </p>
            <button
              type="button"
              className="rounded-full border border-white/25 bg-white/10 px-5 py-2 text-sm font-semibold text-white"
              onClick={() => navigate('/vip', { replace: true })}
            >
              <span lang="km">ត្រឡប់ទៅ VIP</span>
            </button>
            <Link to="/contact-us" className="text-sm text-[var(--tg-blue)] hover:underline">
              Contact support
            </Link>
          </>
        ) : null}
      </main>
    </div>
  )
}
