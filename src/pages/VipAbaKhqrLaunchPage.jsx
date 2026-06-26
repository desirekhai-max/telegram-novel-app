import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { buildAbaKhqrUiMockSession, isAbaKhqrUiMockFlowEnabled } from '../lib/abaKhqrUiMock.js'
import { preloadAbaKhqrPaymentAssets } from '../lib/abaKhqrAssets.js'
import { startAbaKhqrPaymentFlow } from '../lib/abaMobile.js'
import { isTelegramMiniApp } from '../lib/telegramWebApp.js'
import { startViewerVipAbaKhqr } from '../lib/viewerProfileApi.js'
import {
  clearVipAbaKhqrPendingPayment,
  loadVipAbaKhqrSession,
  markVipAbaKhqrBrowserFlowOpen,
  saveVipAbaKhqrPendingPayment,
  saveVipAbaKhqrSession,
} from '../lib/vipAbaKhqrSession.js'

const LAUNCH_INTENT_KEY = 'tg_vip_aba_khqr_launch_intent_v1'

function readLaunchIntent() {
  try {
    const raw = sessionStorage.getItem(LAUNCH_INTENT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveLaunchIntent(payload) {
  try {
    sessionStorage.setItem(LAUNCH_INTENT_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

function clearLaunchIntent() {
  try {
    sessionStorage.removeItem(LAUNCH_INTENT_KEY)
  } catch {
    /* ignore */
  }
}

function resolveLaunchContext(locationState) {
  const fromState = locationState && typeof locationState === 'object' ? locationState : {}
  const fromStore = readLaunchIntent() || {}
  const planId = String(fromState.planId || fromStore.planId || loadVipAbaKhqrSession()?.planId || '')
    .trim()
  const role = String(fromState.role || fromStore.role || 'normal').trim() === 'author' ? 'author' : 'normal'
  const mock = fromState.mock === true || fromStore.mock === true
  return { planId, role, mock }
}

function openBrowserFlow(session, planId) {
  const opened = startAbaKhqrPaymentFlow(session, planId)
  if (!opened.opened) return opened
  saveVipAbaKhqrPendingPayment(session, { expireAtMs: session.expireAtMs })
  markVipAbaKhqrBrowserFlowOpen(session)
  return opened
}

/**
 * 点击 ABA KHQR 后同步进入此页；Telegram 内必须再点一次按钮（真实手势）才能 openLink。
 */
export default function VipAbaKhqrLaunchPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const launchContext = resolveLaunchContext(location.state)
  const sessionRef = useRef(loadVipAbaKhqrSession())
  const sessionPromiseRef = useRef(null)
  const autoOpenAttemptedRef = useRef(false)
  const [phase, setPhase] = useState('boot') // boot | ready | opening | failed
  const [errorText, setErrorText] = useState('')
  const [manualBusy, setManualBusy] = useState(false)
  const requireManualTap = isTelegramMiniApp()

  const returnToVip = useCallback(() => {
    clearLaunchIntent()
    navigate('/vip', { replace: true })
  }, [navigate])

  const ensureSession = useCallback(async () => {
    if (sessionRef.current?.tranId) return sessionRef.current
    if (sessionPromiseRef.current) return sessionPromiseRef.current

    const { planId, role, mock } = launchContext
    if (!planId) return null

    sessionPromiseRef.current = (async () => {
      const existing = loadVipAbaKhqrSession()
      if (existing?.tranId && String(existing.planId || '') === planId) {
        sessionRef.current = existing
        return existing
      }

      if (mock || isAbaKhqrUiMockFlowEnabled()) {
        const mockSession = buildAbaKhqrUiMockSession(planId, role)
        saveVipAbaKhqrSession(mockSession)
        sessionRef.current = mockSession
        return mockSession
      }

      const aba = await startViewerVipAbaKhqr(planId)
      if (!aba?.ok || !aba.session?.tranId) {
        throw new Error(String(aba?.error || 'aba_khqr_failed'))
      }
      saveVipAbaKhqrSession(aba.session)
      sessionRef.current = aba.session
      return aba.session
    })()

    try {
      return await sessionPromiseRef.current
    } catch (err) {
      sessionPromiseRef.current = null
      throw err
    }
  }, [launchContext])

  const tryOpenBrowser = useCallback(
    (session, planId, { manual = false } = {}) => {
      const pid = String(planId || session?.planId || '').trim()
      if (!session?.tranId || !pid) {
        setPhase('failed')
        setErrorText('missing_session')
        return false
      }
      sessionRef.current = session
      saveVipAbaKhqrSession(session)

      const result = openBrowserFlow(session, pid)
      if (!result.opened) {
        if (manual || requireManualTap) {
          setPhase(requireManualTap ? 'ready' : 'failed')
          if (!requireManualTap) setErrorText(String(result.method || 'browser_open_failed'))
        }
        return false
      }

      setPhase('opening')
      setErrorText('')
      return true
    },
    [requireManualTap],
  )

  useLayoutEffect(() => {
    saveLaunchIntent({
      planId: launchContext.planId,
      role: launchContext.role,
      mock: launchContext.mock,
    })
  }, [launchContext.mock, launchContext.planId, launchContext.role])

  useLayoutEffect(() => {
    if (!launchContext.planId) {
      setPhase('failed')
      setErrorText('plan_required')
      return undefined
    }

    void preloadAbaKhqrPaymentAssets()

    if (requireManualTap) {
      setPhase('ready')
      void ensureSession().catch((err) => {
        setPhase('failed')
        setErrorText(err instanceof Error ? err.message : 'aba_khqr_failed')
      })
      return undefined
    }

    if (autoOpenAttemptedRef.current) return undefined
    autoOpenAttemptedRef.current = true

    void (async () => {
      try {
        const session = await ensureSession()
        if (tryOpenBrowser(session, launchContext.planId)) return
        setPhase('ready')
      } catch (err) {
        setPhase('failed')
        setErrorText(err instanceof Error ? err.message : 'aba_khqr_failed')
      }
    })()

    return undefined
  }, [ensureSession, launchContext.planId, requireManualTap, tryOpenBrowser])

  useEffect(() => {
    if (phase !== 'opening') return undefined

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearLaunchIntent()
        navigate('/vip', { replace: true })
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        setPhase('ready')
      }
    }, 2200)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearTimeout(timer)
    }
  }, [navigate, phase])

  const onManualOpen = () => {
    if (manualBusy) return
    setManualBusy(true)
    setErrorText('')

    void (async () => {
      try {
        const session = await ensureSession()
        const planId = launchContext.planId || session?.planId || ''
        if (!tryOpenBrowser(session, planId, { manual: true })) {
          clearVipAbaKhqrPendingPayment(session?.tranId)
        }
      } catch (err) {
        setPhase('failed')
        setErrorText(err instanceof Error ? err.message : 'aba_khqr_failed')
      } finally {
        setManualBusy(false)
      }
    })()
  }

  const showManual = phase === 'ready' || (phase === 'boot' && requireManualTap)
  const showLoading = phase === 'boot' || phase === 'opening' || manualBusy
  const showFailed = phase === 'failed'

  return (
    <div className="tg-app tg-app--about">
      <BrandTabToolbar title="ABA KHQR" titleLang="en" titleClassName="text-[15px]" showDivider />
      <main className="tg-list-wrap tg-about-scroll flex flex-1 flex-col items-center justify-center gap-4 px-6 pt-12 pb-32 text-center">
        {showLoading && !showManual ? (
          <p className="text-[0.95rem] text-white/75" lang="km">
            {phase === 'boot' ? 'កំពុងបង្កើត QR…' : 'កំពុងបើក Browser…'}
          </p>
        ) : null}

        {showManual ? (
          <>
            <p className="text-[0.95rem] leading-relaxed text-white/75" lang="km">
              {requireManualTap
                ? 'សូមចុចប៊ូតុងខាងក្រោមដើម្បីបើក Browser បង់ប្រាក់ ABA KHQR'
                : 'សូមចុចប៊ូតុងខាងក្រោមដើម្បីបើកទំព័របង់ប្រាក់'}
            </p>
            <button
              type="button"
              className="rounded-full border border-white/25 bg-[var(--tg-blue)] px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
              disabled={manualBusy}
              onClick={onManualOpen}
            >
              <span lang="km">{manualBusy ? 'កំពុងបើក…' : 'បើក Browser · ABA KHQR'}</span>
            </button>
          </>
        ) : null}

        {showFailed ? (
          <>
            <p className="text-[0.95rem] leading-relaxed text-white/75" lang="km">
              {errorText === 'plan_required' || errorText === 'missing_session'
                ? 'មិនឃើញព័ត៌មានទូទាត់ សូមព្យាយាមទិញម្តងទៀត។'
                : errorText === 'telegram initData verify failed'
                  ? 'សូមបើកក្នុង Telegram Mini App ហើយព្យាយាមម្តងទៀត'
                  : 'មិនអាចបើក Browser បាន សូមព្យាយាមម្តងទៀត។'}
            </p>
            {errorText && errorText !== 'browser_open_failed' && errorText !== 'plan_required' ? (
              <p className="text-[11px] text-white/45" lang="en">
                {errorText}
              </p>
            ) : null}
            <button
              type="button"
              className="rounded-full border border-white/25 bg-white/10 px-5 py-2 text-sm font-semibold text-white"
              onClick={returnToVip}
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
