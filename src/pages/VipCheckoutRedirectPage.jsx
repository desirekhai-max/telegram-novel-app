import { useLayoutEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import {
  clearPayWayCheckoutSession,
  loadPayWayCheckoutSession,
  submitPayWayCheckoutForm,
} from '../lib/paywayCheckout.js'

/**
 * PayWay POST 需在页面加载后立即提交（避免 async 点击后 WebView 拦截 form.submit）。
 */
export default function VipCheckoutRedirectPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')

  useLayoutEffect(() => {
    const session = loadPayWayCheckoutSession()
    clearPayWayCheckoutSession()
    if (!session?.checkoutUrl || !session?.formFields) {
      setStatus('missing')
      return
    }
    const result = submitPayWayCheckoutForm(session.checkoutUrl, session.formFields)
    if (result.ok) return
    setStatus('failed')
  }, [])

  return (
    <div className="tg-app tg-app--about">
      <BrandTabToolbar title="កំពុងបើកទំព័រទូទាត់" titleLang="km" titleClassName="text-[15px]" showDivider />
      <main className="tg-list-wrap tg-about-scroll flex flex-1 flex-col items-center justify-center gap-4 px-6 pt-12 pb-32 text-center">
        {status === 'loading' ? (
          <p className="text-[0.95rem] text-white/75" lang="km">
            កំពុងបើក ABA PayWay...
          </p>
        ) : null}
        {status === 'missing' || status === 'failed' ? (
          <>
            <p className="text-[0.95rem] leading-relaxed text-white/75" lang="km">
              {status === 'missing'
                ? 'មិនឃើញព័ត៌មានទូទាត់ សូមព្យាយាមទិញម្តងទៀត។'
                : 'មិនអាចបើកទំព័រទូទាត់ PayWay បាន សូមព្យាយាមម្តងទៀត។'}
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
