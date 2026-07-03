import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { BookOpen, Check, ChevronRight, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AbaKhqrEntryRow from '../components/AbaKhqrEntryRow.jsx'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { useMainTabShell } from '../hooks/useMainTabShell.js'
import VipPurchaseConsent from '../components/VipPurchaseConsent.jsx'
import { getVipPlansCatalogForRole, getVipPlanTierClass, VIP_MEMBER_FOOTER_KM } from '../data/vipPlansCatalog.js'
import { VIP_LOGIN_GATE_DESC_KM, VIP_LOGIN_GATE_TITLE_KM } from '../lib/errorMessagesKm.js'
import { buildAbaKhqrUiMockSession, isAbaKhqrUiMockFlowEnabled } from '../lib/abaKhqrUiMock.js'
import { startAbaKhqrPaymentFlow, markAbaMobileKnownInstalled } from '../lib/abaMobile.js'
import { useTelegramUser } from '../hooks/useTelegramUser.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'
import { preloadVipPaymentSuccessAssets } from '../lib/vipPaymentSuccessAssets.js'
import { getVipPlanForPurchase } from '../data/vipPlansCatalog.js'
import { useVipAbaKhqrPaymentConfirm } from '../hooks/useVipAbaKhqrPaymentConfirm.js'
import {
  clearVipAbaKhqrPendingPayment,
  getActiveVipAbaKhqrPendingExpiry,
  hasActiveVipAbaKhqrBrowserFlow,
  loadActiveVipAbaKhqrPending,
  loadVipAbaKhqrSession,
  markVipAbaKhqrBrowserFlowBackgrounded,
  markVipAbaKhqrBrowserFlowOpen,
  markVipAbaKhqrBrowserFlowReturned,
  markVipAbaKhqrBankSummoned,
  consumeVipMiniAppColdStart,
  resetVipPurchaseFlowOnMiniAppColdStart,
  resolveVipAbaKhqrAwaitingUiState,
  saveVipAbaKhqrPendingPayment,
  saveVipAbaKhqrSession,
  shouldShowVipAbaKhqrConfirmingUi,
} from '../lib/vipAbaKhqrSession.js'
import { scheduleVipPaymentSuccessNavigation } from '../lib/vipPaymentSuccessNavigation.js'
import { startViewerVipAbaKhqr } from '../lib/viewerProfileApi.js'
import { canAccessVipPurchase } from '../lib/devVipPurchase.js'
import { formatKhqrPendingCountdown } from '../lib/vipAbaKhqrCountdown.js'
import { isTelegramMiniApp } from '../lib/telegramWebApp.js'

function bootstrapVipPageSession() {
  const coldStart = isTelegramMiniApp() && consumeVipMiniAppColdStart()
  if (coldStart) resetVipPurchaseFlowOnMiniAppColdStart()
  const abaUi = coldStart
    ? { awaiting: false, confirming: false, pending: null }
    : resolveVipAbaKhqrAwaitingUiState()
  return { coldStart, abaUi }
}

const vipPageSession =
  typeof window !== 'undefined'
    ? bootstrapVipPageSession()
    : { coldStart: false, abaUi: { awaiting: false, confirming: false, pending: null } }

function readAbaKhqrSessionForPlan(planId) {
  const pid = String(planId || '').trim()
  if (!pid) return null
  const stored = loadVipAbaKhqrSession()
  if (!stored?.tranId || String(stored.planId || '') !== pid) return null
  return stored
}

function readVipScrollBottomInset(extra = 28) {
  if (typeof window === 'undefined') return 96
  const rootStyle = getComputedStyle(document.documentElement)
  const raw = rootStyle.getPropertyValue('--tg-bottom-nav-bar-stack').trim()
  const navStack = raw ? parseFloat(raw) : 72
  return (Number.isFinite(navStack) ? navStack : 72) + extra
}

/** Keep target fully inside VIP scroll main (Android / iOS / desktop Telegram). */
function scrollWithinVipMain(root, target, options = {}) {
  if (!root || !target) return false

  const topInset = Number(options.topInset) >= 0 ? Number(options.topInset) : 12
  const bottomInset = readVipScrollBottomInset(options.bottomExtra ?? 28)
  const behavior = options.behavior || 'smooth'
  const rootRect = root.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  let delta = 0

  if (targetRect.top < rootRect.top + topInset) {
    delta = targetRect.top - rootRect.top - topInset
  } else if (targetRect.bottom > rootRect.bottom - bottomInset) {
    delta = targetRect.bottom - (rootRect.bottom - bottomInset)
  }

  if (Math.abs(delta) < 1) return false
  root.scrollBy({ top: delta, behavior })
  return true
}

function scrollWithinVipMainAfterLayout(root, target, options = {}) {
  const settleMs = Number(options.settleMs) > 0 ? Number(options.settleMs) : 420
  const run = (behavior) => scrollWithinVipMain(root, target, { ...options, behavior })

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      run('smooth')
      window.setTimeout(() => run('auto'), settleMs)
    })
  })
}

function readInitialVipAbaKhqrUiState() {
  return vipPageSession.abaUi
}

export default function VipPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const usesSharedToolbar = useMainTabShell()
  const tgUser = useTelegramUser()
  const { viewerProfile, refreshViewerProfile } = useViewerProfile()
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [abaKhqrPending, setAbaKhqrPending] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [purchaseNotice, setPurchaseNotice] = useState('')
  const [purchaseError, setPurchaseError] = useState('')
  const initialAbaUiState = useMemo(() => readInitialVipAbaKhqrUiState(), [])
  const [abaKhqrAwaitingReturn, setAbaKhqrAwaitingReturn] = useState(initialAbaUiState.awaiting)
  const [confirmingPaymentReturn, setConfirmingPaymentReturn] = useState(initialAbaUiState.confirming)
  const [confirmingSlideOut, setConfirmingSlideOut] = useState(false)
  const [pendingCountdownMs, setPendingCountdownMs] = useState(0)
  const paymentWasBackgroundedRef = useRef(false)
  const successNavPendingRef = useRef(false)
  const scrollRef = useRef(null)
  const plansSectionRef = useRef(null)
  const paymentSectionRef = useRef(null)
  const abaKhqrEntryRef = useRef(null)
  const refundFooterRef = useRef(null)
  const consentRef = useRef(null)
  const prevTermsAcceptedRef = useRef(false)
  const abaSessionPrefetchRef = useRef({ planId: '', promise: null })
  const [consentShaking, setConsentShaking] = useState(false)
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const vipPurchaseReady = canAccessVipPurchase(tgUser)

  const openLoginPrompt = useCallback(() => {
    setPurchaseError('')
    setLoginPromptOpen(true)
  }, [])

  const onCloseLoginPrompt = useCallback(() => setLoginPromptOpen(false), [])

  const onEnterLoginFromVipPage = useCallback(() => {
    setLoginPromptOpen(false)
    navigate('/account')
  }, [navigate])

  const resetVipScrollTop = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = 0
  }, [])

  useLayoutEffect(() => {
    if (location.pathname !== '/vip') return
    resetVipScrollTop()
  }, [location.pathname, resetVipScrollTop])

  useEffect(() => {
    void preloadVipPaymentSuccessAssets()
  }, [])

  const syncAbaKhqrAwaitingUiState = useCallback(() => {
    const { awaiting, confirming, pending } = resolveVipAbaKhqrAwaitingUiState()
    setAbaKhqrAwaitingReturn(awaiting)
    setConfirmingPaymentReturn(confirming)
    if (confirming) setPurchaseNotice('')
    if (pending?.planId && !vipPageSession.coldStart) {
      setSelectedPlanId((current) => current || pending.planId)
    }
  }, [])

  useEffect(() => {
    if (location.pathname !== '/vip') return
    syncAbaKhqrAwaitingUiState()
  }, [location.pathname, syncAbaKhqrAwaitingUiState])

  const plans = useMemo(
    () => [...getVipPlansCatalogForRole(viewerProfile.role)].sort((a, b) => a.sortOrder - b.sortOrder),
    [viewerProfile.role],
  )


  const openAbaKhqrBrowser = useCallback(async (session, planId) => {
    const pid = String(planId || session?.planId || '').trim()
    if (!session?.tranId || !pid) return false
    saveVipAbaKhqrSession(session)
    saveVipAbaKhqrPendingPayment(session, { expireAtMs: session.expireAtMs })
    markVipAbaKhqrBrowserFlowOpen(session)
    const result = await startAbaKhqrPaymentFlow(session, pid)
    if (!result.opened) return false

    if (result.showQrInMiniApp && result.miniAppQrPath) {
      setAbaKhqrAwaitingReturn(true)
      setPurchaseNotice('')
      navigate(result.miniAppQrPath)
      return true
    }

    setAbaKhqrAwaitingReturn(true)
    setPurchaseNotice('')
    if (result.launchedInMiniApp) {
      markAbaMobileKnownInstalled()
      markVipAbaKhqrBankSummoned(session.tranId)
      setConfirmingPaymentReturn(true)
    }
    return true
  }, [navigate])

  const createAbaKhqrSession = useCallback(
    async (planId) => {
      const pid = String(planId || '').trim()
      if (!pid) throw new Error('plan_required')

      if (isAbaKhqrUiMockFlowEnabled()) {
        const mockSession = buildAbaKhqrUiMockSession(pid, viewerProfile.role)
        saveVipAbaKhqrSession(mockSession)
        return mockSession
      }

      const aba = await startViewerVipAbaKhqr(pid)
      if (!aba?.ok || !aba.session?.tranId) {
        throw new Error(String(aba?.error || 'aba_khqr_failed'))
      }
      saveVipAbaKhqrSession(aba.session)
      return aba.session
    },
    [viewerProfile.role],
  )

  const resolveAbaKhqrSession = useCallback(
    async (planId) => {
      const cached = readAbaKhqrSessionForPlan(planId)
      if (cached?.tranId) return cached

      const prefetch = abaSessionPrefetchRef.current
      if (prefetch.planId === planId && prefetch.promise) {
        return prefetch.promise
      }

      return createAbaKhqrSession(planId)
    },
    [createAbaKhqrSession],
  )

  const prefetchAbaKhqrSession = useCallback(
    (planId) => {
      const pid = String(planId || '').trim()
      if (!pid || !vipPurchaseReady) return
      if (readAbaKhqrSessionForPlan(pid)) return
      if (abaSessionPrefetchRef.current.planId === pid && abaSessionPrefetchRef.current.promise) return

      abaSessionPrefetchRef.current = {
        planId: pid,
        promise: createAbaKhqrSession(pid).catch((err) => {
          if (abaSessionPrefetchRef.current.planId === pid) {
            abaSessionPrefetchRef.current = { planId: '', promise: null }
          }
          throw err
        }),
      }
    },
    [createAbaKhqrSession, vipPurchaseReady],
  )

  useEffect(() => {
    if (!selectedPlanId || !termsAccepted || !vipPurchaseReady) return undefined
    prefetchAbaKhqrSession(selectedPlanId)
    return undefined
  }, [prefetchAbaKhqrSession, selectedPlanId, termsAccepted, vipPurchaseReady])

  const pendingAbaPayment = useMemo(() => loadActiveVipAbaKhqrPending(), [abaKhqrAwaitingReturn])

  const showConfirmingUi = useMemo(() => {
    if (confirmingPaymentReturn || confirmingSlideOut) return true
    const tid = String(pendingAbaPayment?.tranId || '').trim()
    if (!abaKhqrAwaitingReturn || !tid) return false
    return shouldShowVipAbaKhqrConfirmingUi(tid)
  }, [
    abaKhqrAwaitingReturn,
    confirmingPaymentReturn,
    confirmingSlideOut,
    pendingAbaPayment?.tranId,
  ])

  const onAbaKhqrPaymentConfirmed = useCallback(() => {
    if (successNavPendingRef.current) return
    successNavPendingRef.current = true

    const pending = loadActiveVipAbaKhqrPending()
    const planId = String(pending?.planId || selectedPlanId || '').trim()
    const durationHours = Number(getVipPlanForPurchase(planId, viewerProfile.role)?.durationHours) || 0
    const successPayload = {
      planId,
      priceLabel: String(pending?.amountLabel || '').trim(),
      durationHours,
      purchasedAt: new Date().toISOString(),
    }

    scheduleVipPaymentSuccessNavigation(
      navigate,
      successPayload,
      () => setConfirmingSlideOut(true),
      {
        replace: true,
        onBeforeNavigate: () => {
          setAbaKhqrAwaitingReturn(false)
          setConfirmingPaymentReturn(false)
          setPurchaseNotice('')
          void refreshViewerProfile()
        },
      },
    )
  }, [navigate, refreshViewerProfile, selectedPlanId, viewerProfile.role])

  const onAbaKhqrPaymentExpired = useCallback(() => {
    const tid = String(pendingAbaPayment?.tranId || '').trim()
    clearVipAbaKhqrPendingPayment(tid)
    setAbaKhqrAwaitingReturn(false)
    setConfirmingPaymentReturn(false)
    setPendingCountdownMs(0)
    setPurchaseNotice('ការបង់ប្រាក់ផុតកំណត់ហើយ (5 នាទី) សូមចុច ABA KHQR ម្តងទៀត')
  }, [pendingAbaPayment?.tranId])

  useVipAbaKhqrPaymentConfirm({
    enabled: abaKhqrAwaitingReturn && Boolean(pendingAbaPayment?.tranId),
    tranId: pendingAbaPayment?.tranId || '',
    planId: pendingAbaPayment?.planId || '',
    onSuccess: onAbaKhqrPaymentConfirmed,
    onExpired: onAbaKhqrPaymentExpired,
  })

  useEffect(() => {
    if (!showConfirmingUi) {
      setPendingCountdownMs(0)
      return undefined
    }

    const tid = String(pendingAbaPayment?.tranId || '').trim()
    if (!tid) return undefined

    const tick = () => {
      const expiry = getActiveVipAbaKhqrPendingExpiry(tid)
      if (!expiry || expiry.remainingMs <= 0) {
        onAbaKhqrPaymentExpired()
        return
      }
      setPendingCountdownMs(expiry.remainingMs)
    }

    tick()
    const timerId = window.setInterval(tick, 1000)
    return () => window.clearInterval(timerId)
  }, [showConfirmingUi, onAbaKhqrPaymentExpired, pendingAbaPayment?.tranId])

  useLayoutEffect(() => {
    if (!abaKhqrAwaitingReturn) {
      paymentWasBackgroundedRef.current = false
      return undefined
    }

    const onVisibility = () => {
      const tid = String(loadActiveVipAbaKhqrPending()?.tranId || '').trim()
      if (document.visibilityState === 'hidden') {
        if (tid && hasActiveVipAbaKhqrBrowserFlow(tid)) {
          markAbaMobileKnownInstalled()
          markVipAbaKhqrBankSummoned(tid)
          markVipAbaKhqrBrowserFlowBackgrounded(tid)
          paymentWasBackgroundedRef.current = true
          flushSync(() => {
            setConfirmingPaymentReturn(true)
            setPurchaseNotice('')
          })
        }
        return
      }
      if (document.visibilityState !== 'visible') return
      if (!tid || !hasActiveVipAbaKhqrBrowserFlow(tid)) return
      if (!paymentWasBackgroundedRef.current && !shouldShowVipAbaKhqrConfirmingUi(tid)) return
      markVipAbaKhqrBrowserFlowReturned(tid)
      flushSync(() => {
        setConfirmingPaymentReturn(true)
        setPurchaseNotice('')
      })
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [abaKhqrAwaitingReturn])

  const runAbaPaymentStart = useCallback(
    () => {
      if (!termsAccepted) {
        setPurchaseError('សូមធីកយល់ព្រមលក្ខខណ្ឌមុនពេលទិញ')
        return
      }
      if (!vipPurchaseReady) {
        openLoginPrompt()
        return
      }
      const planId = String(selectedPlanId || '').trim()
      if (!planId || abaKhqrPending) return

      setPurchaseError('')

      const readySession = readAbaKhqrSessionForPlan(planId)
      if (readySession?.tranId) {
        setPurchaseNotice('')
        void openAbaKhqrBrowser(readySession, planId).then((opened) => {
          if (!opened) setPurchaseError('មិនអាចបើក Browser សូមព្យាយាមម្តងទៀត')
        })
        return
      }

      setAbaKhqrPending(true)
      setPurchaseNotice('កំពុងបង្កើត QR…')

      void (async () => {
        try {
          const session = await resolveAbaKhqrSession(planId)
          const opened = await openAbaKhqrBrowser(session, planId)
          if (opened) return
          setPurchaseNotice('')
          setPurchaseError('មិនអាចបើក Browser សូមព្យាយាមម្តងទៀត')
        } catch (err) {
          setPurchaseNotice('')
          setPurchaseError(
            err instanceof Error && err.message
              ? `មិនអាចបើក ABA KHQR: ${err.message}`
              : 'មិនអាចទិញបាន សូមព្យាយាមម្តងទៀត',
          )
        } finally {
          setAbaKhqrPending(false)
        }
      })()
    },
    [
      abaKhqrPending,
      openAbaKhqrBrowser,
      resolveAbaKhqrSession,
      selectedPlanId,
      termsAccepted,
      openLoginPrompt,
      vipPurchaseReady,
    ],
  )

  const onAbaKhqrPay = useCallback(() => {
    void runAbaPaymentStart()
  }, [runAbaPaymentStart])

  const nudgeTermsConsent = useCallback(() => {
    setPurchaseError('សូមធីកយល់ព្រមលក្ខខណ្ឌមុនពេលទិញ')
    setConsentShaking(false)
    window.requestAnimationFrame(() => {
      setConsentShaking(true)
    })
    consentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  useEffect(() => {
    if (!consentShaking) return undefined
    const t = window.setTimeout(() => setConsentShaking(false), 560)
    return () => window.clearTimeout(t)
  }, [consentShaking])

  const scrollToRevealPlans = useCallback(() => {
    const root = scrollRef.current
    const plans = plansSectionRef.current
    if (!root || !plans) return

    const lastPlan = plans.lastElementChild
    const target = lastPlan instanceof HTMLElement ? lastPlan : plans
    scrollWithinVipMainAfterLayout(root, target, { topInset: 12, bottomExtra: 32, settleMs: 480 })
  }, [])

  useEffect(() => {
    const wasAccepted = prevTermsAcceptedRef.current
    prevTermsAcceptedRef.current = termsAccepted
    if (!termsAccepted || wasAccepted) return undefined

    const t = window.setTimeout(scrollToRevealPlans, 180)
    return () => window.clearTimeout(t)
  }, [scrollToRevealPlans, termsAccepted])

  const handlePlanCtaClick = useCallback(
    (planId) => {
      if (abaKhqrPending) return
      if (!termsAccepted) {
        nudgeTermsConsent()
        return
      }
      if (!vipPurchaseReady) {
        openLoginPrompt()
        return
      }
      setPurchaseError('')
      const id = String(planId || '').trim()
      if (!id) return
      setSelectedPlanId(id)
    },
    [abaKhqrPending, nudgeTermsConsent, openLoginPrompt, termsAccepted, vipPurchaseReady],
  )

  useEffect(() => {
    if (!selectedPlanId || !termsAccepted || !vipPurchaseReady) return undefined
    const t = window.setTimeout(() => {
      const root = scrollRef.current
      const target = abaKhqrEntryRef.current || paymentSectionRef.current
      if (!root || !target) return
      scrollWithinVipMainAfterLayout(root, target, { topInset: 8, bottomExtra: 32, settleMs: 520 })
    }, 200)
    return () => window.clearTimeout(t)
  }, [selectedPlanId, termsAccepted, vipPurchaseReady])

  return (
    <div className="tg-app tg-app--account tg-app--vip">
      {usesSharedToolbar ? null : (
        <BrandTabToolbar title="សមាជិកVIP" titleLang="km" titleClassName="text-[16px]" />
      )}
      <main
        ref={scrollRef}
        className="tg-list-wrap tg-account-scroll tg-account-scroll--vip flex min-h-0 flex-1 flex-col px-3 py-5"
      >
        <section className="tg-vip-page__stack mx-auto flex w-full max-w-[420px] shrink-0 flex-col gap-3">
          {showConfirmingUi ? (
            <section
              className={[
                'tg-vip-page__confirming flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 py-10 text-center',
                confirmingSlideOut ? 'tg-vip-page__confirming--slide-out' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-live="polite"
              aria-busy={!confirmingSlideOut}
            >
              <span className="tg-vip-page__confirming-spinner" aria-hidden />
              <p className="tg-vip-page__confirming-title" lang="km">
                កំពុងបញ្ជាក់ការទូទាត់…
              </p>
              <p className="tg-vip-page__confirming-desc" lang="km">
                សូមរង់ចាំបន្តិច ប្រព័ន្ធកំពុងពិនិត្យ ABA KHQR
              </p>
              <p className="tg-vip-page__confirming-expiry" lang="km">
                QR នេះមានសុពលភាព ៥ នាទី
                {pendingCountdownMs > 0
                  ? ` · នៅសល់ ${formatKhqrPendingCountdown(pendingCountdownMs)}`
                  : ''}
                {' '}
                — បើហួសពេល សូមបង្កើត QR ថ្មី
              </p>
            </section>
          ) : (
            <>
          <VipPurchaseConsent
            sectionRef={consentRef}
            shake={consentShaking}
            accepted={termsAccepted}
            onAcceptedChange={(next) => {
              setTermsAccepted(next)
              if (next) {
                setPurchaseError('')
                setConsentShaking(false)
              } else {
                setSelectedPlanId('')
              }
            }}
            disabled={false}
          />

          {purchaseNotice ? (
            <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-center text-[11px] text-emerald-100/95" lang="km">
              {purchaseNotice}
            </p>
          ) : null}
          {purchaseError ? (
            <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-center text-[11px] text-red-100/95" lang="km">
              {purchaseError}
            </p>
          ) : null}

          <div ref={plansSectionRef} className="tg-vip-page__plans flex flex-col gap-3">
            {plans.map((plan) => {
              const isSelected = termsAccepted && selectedPlanId === plan.planId
              const ctaBlocked = abaKhqrPending
              const ctaNeedsTerms = !termsAccepted
              return (
                <article
                  key={plan.planId}
                  className={[
                    'tg-vip-plan-card shrink-0',
                    getVipPlanTierClass(plan.planId),
                    plan.featured ? 'tg-vip-plan-card--featured' : '',
                    !termsAccepted ? 'tg-vip-plan-card--locked' : '',
                    isSelected ? 'tg-vip-plan-card--selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="tg-vip-plan-card__glow" aria-hidden />
                  <div className="tg-vip-plan-card__lamplight" aria-hidden />
                  <div className="tg-vip-plan-card__body tg-vip-plan-card__body--text-only">
                    <div className="tg-vip-plan-card__main">
                      <div className="tg-vip-plan-card__top">
                        <div className="tg-vip-plan-card__titles min-w-0" lang="km">
                          <p className="tg-vip-plan-card__title">{plan.titleKm}</p>
                          <p className="tg-vip-plan-card__flag">{plan.flagKm}</p>
                        </div>
                        {isSelected ? (
                          <span className="tg-vip-plan-selected-badge" lang="km" aria-label="បានជ្រើស">
                            <Check size={13} strokeWidth={2.5} className="tg-vip-plan-selected-badge__icon" aria-hidden />
                            <span>បានជ្រើស</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            lang="km"
                            disabled={ctaBlocked}
                            aria-disabled={ctaBlocked}
                            title={
                              !termsAccepted
                                ? 'សូមធីកយល់ព្រមលក្ខខណ្ឌមុនពេលទិញ'
                                : !vipPurchaseReady
                                  ? 'សូមចូលគណនី Telegram'
                                  : ''
                            }
                            onClick={() => handlePlanCtaClick(plan.planId)}
                            className={[
                              'tg-vip-plan-card__cta',
                              ctaNeedsTerms ? 'tg-vip-plan-card__cta--needs-consent' : '',
                              ctaBlocked ? 'tg-vip-plan-card__cta--disabled' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <BookOpen size={11} strokeWidth={2.2} className="tg-vip-plan-card__cta-icon" aria-hidden />
                            <span className="tg-vip-plan-card__cta-label">
                              {termsAccepted ? 'ជ្រើសរើសកញ្ចប់' : plan.buyButtonKm || 'ទិញកម្រិតនេះ'}
                            </span>
                            <ChevronRight size={14} strokeWidth={2.5} className="tg-vip-plan-card__cta-chevron" aria-hidden />
                          </button>
                        )}
                      </div>
                      <div className="tg-vip-plan-card__price-row">
                        <span className="tg-vip-plan-card__price">{plan.priceUsdLabel}</span>
                        <span className="tg-vip-plan-card__price-hint" lang="km">
                          {plan.priceHintKm}
                        </span>
                      </div>
                      <p className="tg-vip-plan-card__duration" lang="km">
                        {plan.durationKm}
                      </p>
                      <p className="tg-vip-plan-card__footer" lang="km">
                        {VIP_MEMBER_FOOTER_KM}
                      </p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {selectedPlanId && termsAccepted && vipPurchaseReady ? (
            <section
              ref={paymentSectionRef}
              className="tg-vip-payment-section"
              aria-labelledby="tg-vip-payment-heading"
            >
              <header className="tg-vip-payment-section__intro">
                <h2 id="tg-vip-payment-heading" className="tg-vip-payment-section__title" lang="km">
                  ជ្រើសរើសវិធីបង់ប្រាក់
                </h2>
                <p className="tg-vip-payment-section__desc" lang="km">
                  សូមជ្រើសរើសវិធីបង់ប្រាក់ដែលអ្នកពេញចិត្ត
                </p>
              </header>
              <div ref={abaKhqrEntryRef} className="tg-vip-payment-section__cards">
                <AbaKhqrEntryRow
                  title="ABA KHQR"
                  subtitle="Scan to pay with any banking app"
                  pending={abaKhqrPending}
                  disabled={!selectedPlanId}
                  onSelect={onAbaKhqrPay}
                />
              </div>
            </section>
          ) : null}

          {!termsAccepted ? (
            <p className="px-1 text-center text-[10px] leading-snug text-white/45" lang="km">
              សូមអានលក្ខខណ្ឌ និងធីកយល់ព្រម មុនពេលទិញសមាជិក VIP
            </p>
          ) : null}
          {termsAccepted && !vipPurchaseReady ? (
            <p className="px-1 text-center text-[10px] leading-snug text-amber-200/80" lang="km">
              សូមបើកក្នុង Telegram Mini App ដើម្បីទិញ VIP
            </p>
          ) : null}
          {termsAccepted && vipPurchaseReady && !selectedPlanId ? (
            <p className="px-1 text-center text-[10px] leading-snug text-white/45" lang="km">
              សូមជ្រើសគម្រោង VIP មួយ រួចចុច ABA KHQR
            </p>
          ) : null}

          <footer ref={refundFooterRef} className="tg-vip-page__footer mt-1 px-1 pb-2 text-center">
            <Link
              to="/refund-policy"
              className="inline-flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-[11px] font-medium leading-snug text-white/65 underline-offset-2 transition active:scale-[0.98] hover:border-white/22 hover:bg-white/[0.09] hover:text-white/85"
            >
              <ShieldCheck size={15} className="shrink-0 text-white/65" strokeWidth={2} aria-hidden />
              <span lang="km">គោលការណ៍សងប្រាក់វិញ</span>
              <span className="text-white/35" aria-hidden>
                ·
              </span>
              <span lang="en">Refund Policy</span>
            </Link>
          </footer>
            </>
          )}
        </section>
      </main>

      {loginPromptOpen ? (
        <div className="tg-reader-start-page" role="dialog" aria-modal="true" aria-labelledby="tg-vip-login-gate-title">
          <button
            type="button"
            className="tg-reader-start-page__backdrop"
            aria-label="បិទ"
            onClick={onCloseLoginPrompt}
          />
          <div className="tg-reader-start-page__panel">
            <h3 id="tg-vip-login-gate-title" className="tg-reader-start-page__title" lang="km">
              {VIP_LOGIN_GATE_TITLE_KM}
            </h3>
            <p className="tg-reader-start-page__desc" lang="km">
              {VIP_LOGIN_GATE_DESC_KM}
            </p>
            <div className="tg-reader-start-page__actions">
              <button
                type="button"
                className="tg-reader-start-page__btn tg-reader-start-page__btn--ghost"
                onClick={onCloseLoginPrompt}
                lang="km"
              >
                ចាំពេលក្រោយ
              </button>
              <button
                type="button"
                className="tg-reader-start-page__btn tg-reader-start-page__btn--primary"
                onClick={onEnterLoginFromVipPage}
                lang="km"
              >
                ចូលប្រើឥឡូវនេះ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
