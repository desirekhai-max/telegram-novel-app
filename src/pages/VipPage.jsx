import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Check, ChevronRight, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AbaKhqrEntryRow from '../components/AbaKhqrEntryRow.jsx'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import VipPurchaseConsent from '../components/VipPurchaseConsent.jsx'
import { getVipPlansCatalogForRole, getVipPlanTierClass, VIP_MEMBER_FOOTER_KM } from '../data/vipPlansCatalog.js'
import { VIP_LOGIN_GATE_DESC_KM, VIP_LOGIN_GATE_TITLE_KM } from '../lib/errorMessagesKm.js'
import { useTelegramUser } from '../hooks/useTelegramUser.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'
import {
  savePayWayCheckoutSession,
  submitPayWayCheckoutForm,
} from '../lib/paywayCheckout.js'
import { buildAbaKhqrUiMockSession, isAbaKhqrUiMockFlowEnabled } from '../lib/abaKhqrUiMock.js'
import { preloadAbaKhqrPaymentAssets } from '../lib/abaKhqrAssets.js'
import { startAbaKhqrPaymentFlow } from '../lib/abaMobile.js'
import { preloadVipPaymentSuccessAssets } from '../lib/vipPaymentSuccessAssets.js'
import { getVipPlanForPurchase } from '../data/vipPlansCatalog.js'
import { useVipAbaKhqrPaymentConfirm } from '../hooks/useVipAbaKhqrPaymentConfirm.js'
import {
  clearVipAbaKhqrPendingPayment,
  getActiveVipAbaKhqrPendingExpiry,
  hasActiveVipAbaKhqrBrowserFlow,
  loadActiveVipAbaKhqrPending,
  markVipAbaKhqrBrowserFlowOpen,
  saveVipAbaKhqrPendingPayment,
  saveVipAbaKhqrSession,
} from '../lib/vipAbaKhqrSession.js'
import { navigateToVipPaymentSuccess } from '../lib/vipPaymentSuccessNavigation.js'
import {
  purchaseViewerVipPlan,
  startViewerVipAbaKhqr,
  startViewerVipPayWayCheckout,
} from '../lib/viewerProfileApi.js'

function formatKhqrPendingCountdown(remainingMs) {
  const totalSec = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000))
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export default function VipPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const tgUser = useTelegramUser()
  const { viewerProfile, refreshViewerProfile } = useViewerProfile()
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [abaKhqrPending, setAbaKhqrPending] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [purchaseNotice, setPurchaseNotice] = useState('')
  const [purchaseError, setPurchaseError] = useState('')
  const [abaKhqrAwaitingReturn, setAbaKhqrAwaitingReturn] = useState(false)
  const [confirmingPaymentReturn, setConfirmingPaymentReturn] = useState(false)
  const [pendingCountdownMs, setPendingCountdownMs] = useState(0)
  const paymentWasBackgroundedRef = useRef(false)
  const scrollRef = useRef(null)
  const plansSectionRef = useRef(null)
  const paymentSectionRef = useRef(null)
  const refundFooterRef = useRef(null)
  const consentRef = useRef(null)
  const prevTermsAcceptedRef = useRef(false)
  const [consentShaking, setConsentShaking] = useState(false)
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)

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
    resetVipScrollTop()
  }, [location.pathname, resetVipScrollTop])

  useEffect(() => {
    void preloadVipPaymentSuccessAssets()
  }, [])

  useEffect(() => {
    const pending = loadActiveVipAbaKhqrPending()
    if (pending?.tranId) {
      setAbaKhqrAwaitingReturn(true)
      return
    }
    setAbaKhqrAwaitingReturn(false)
    setConfirmingPaymentReturn(false)
  }, [])

  const plans = useMemo(
    () => [...getVipPlansCatalogForRole(viewerProfile.role)].sort((a, b) => a.sortOrder - b.sortOrder),
    [viewerProfile.role],
  )


  const fallbackHostedCheckout = useCallback(
    async (planId) => {
      const checkout = await startViewerVipPayWayCheckout(planId)
      if (checkout?.ok && checkout.checkout?.checkoutUrl && checkout.checkout?.formFields) {
        const direct = submitPayWayCheckoutForm(
          checkout.checkout.checkoutUrl,
          checkout.checkout.formFields,
        )
        if (direct.ok) return true
        const saved = savePayWayCheckoutSession({
          checkoutUrl: checkout.checkout.checkoutUrl,
          formFields: checkout.checkout.formFields,
        })
        if (saved) {
          navigate('/vip/checkout-redirect')
          return true
        }
      }
      return false
    },
    [navigate],
  )

  const openAbaKhqrBrowserFlow = useCallback(
    async (session, planId) => {
      await preloadAbaKhqrPaymentAssets()
      saveVipAbaKhqrSession(session)

      const opened = startAbaKhqrPaymentFlow(session, planId)
      if (opened.opened) {
        saveVipAbaKhqrPendingPayment(session, { expireAtMs: session.expireAtMs })
        markVipAbaKhqrBrowserFlowOpen(session)
        setAbaKhqrAwaitingReturn(true)
        setConfirmingPaymentReturn(false)
        paymentWasBackgroundedRef.current = false
        setPurchaseNotice(
          'សូមបង់ប្រាក់ក្នុង Browser ។ បញ្ចប់ហើយត្រឡប់មក Telegram ដើម្បីបញ្ជាក់ VIP',
        )
        return true
      }

      clearVipAbaKhqrPendingPayment(session?.tranId)
      setPurchaseError('មិនអាចបើក Browser បាន សូមព្យាយាមម្តងទៀត')
      return false
    },
    [],
  )

  const pendingAbaPayment = useMemo(() => loadActiveVipAbaKhqrPending(), [abaKhqrAwaitingReturn])

  const onAbaKhqrPaymentConfirmed = useCallback(() => {
    const pending = loadActiveVipAbaKhqrPending()
    const planId = String(pending?.planId || selectedPlanId || '').trim()
    const durationHours = Number(getVipPlanForPurchase(planId, viewerProfile.role)?.durationHours) || 0
    setAbaKhqrAwaitingReturn(false)
    setConfirmingPaymentReturn(false)
    setPurchaseNotice('')
    void refreshViewerProfile()
    navigateToVipPaymentSuccess(
      navigate,
      {
        planId,
        priceLabel: String(pending?.amountLabel || '').trim(),
        durationHours,
        purchasedAt: new Date().toISOString(),
      },
      { replace: true, slideEnter: true },
    )
  }, [navigate, refreshViewerProfile, selectedPlanId, viewerProfile.role])

  const onReleasePaymentConfirming = useCallback(() => {
    setConfirmingPaymentReturn(false)
    setPurchaseNotice('')
  }, [])

  const onAbaKhqrPaymentExpired = useCallback(() => {
    const tid = String(pendingAbaPayment?.tranId || '').trim()
    clearVipAbaKhqrPendingPayment(tid)
    setAbaKhqrAwaitingReturn(false)
    setConfirmingPaymentReturn(false)
    setPendingCountdownMs(0)
    setPurchaseNotice('ការបង់ប្រាក់ផុតកំណត់แล้ว (២ នាទី) សូមចុច ABA KHQR ម្តងទៀត')
  }, [pendingAbaPayment?.tranId])

  useVipAbaKhqrPaymentConfirm({
    enabled: abaKhqrAwaitingReturn && Boolean(pendingAbaPayment?.tranId),
    confirmingUiActive: confirmingPaymentReturn,
    tranId: pendingAbaPayment?.tranId || '',
    planId: pendingAbaPayment?.planId || '',
    onSuccess: onAbaKhqrPaymentConfirmed,
    onReleaseConfirming: onReleasePaymentConfirming,
    onExpired: onAbaKhqrPaymentExpired,
    releaseAfterFailedPolls: 3,
  })

  useEffect(() => {
    if (!confirmingPaymentReturn) {
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
  }, [confirmingPaymentReturn, onAbaKhqrPaymentExpired, pendingAbaPayment?.tranId])

  useEffect(() => {
    if (!abaKhqrAwaitingReturn) {
      paymentWasBackgroundedRef.current = false
      return undefined
    }

    const onVisibility = () => {
      const tid = String(loadActiveVipAbaKhqrPending()?.tranId || '').trim()
      if (document.visibilityState === 'hidden') {
        if (tid && hasActiveVipAbaKhqrBrowserFlow(tid)) {
          paymentWasBackgroundedRef.current = true
        }
        return
      }
      if (document.visibilityState !== 'visible') return
      if (!paymentWasBackgroundedRef.current) return
      if (!tid || !hasActiveVipAbaKhqrBrowserFlow(tid)) return
      setConfirmingPaymentReturn(true)
      setPurchaseNotice('')
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [abaKhqrAwaitingReturn])

  const runAbaPaymentStart = useCallback(
    async () => {
      if (!termsAccepted) {
        setPurchaseError('សូមធីកយល់ព្រមលក្ខខណ្ឌមុនពេលទិញ')
        return
      }
      if (!tgUser?.id) {
        openLoginPrompt()
        return
      }
      const planId = String(selectedPlanId || '').trim()
      if (!planId || abaKhqrPending) return

      setPurchaseError('')
      setPurchaseNotice('')
      setAbaKhqrPending(true)

      try {
        if (isAbaKhqrUiMockFlowEnabled()) {
          const mockSession = buildAbaKhqrUiMockSession(planId, viewerProfile.role)
          await openAbaKhqrBrowserFlow(mockSession, planId)
          return
        }

        const aba = await startViewerVipAbaKhqr(planId)
        if (aba?.ok && aba.session?.tranId) {
          await openAbaKhqrBrowserFlow(aba.session, planId)
          return
        }

        const hostedOk = await fallbackHostedCheckout(planId)
        if (hostedOk) return

        if (aba?.error === 'payway_not_configured' || !aba?.paywayConfigured) {
          const demo = await purchaseViewerVipPlan(planId)
          if (demo?.ok) {
            await refreshViewerProfile()
            setPurchaseNotice('VIP បានបើករួចហើយ')
            return
          }
        }

        setPurchaseError(
          aba?.error
            ? `មិនអាចបើក ABA KHQR: ${aba.error}`
            : 'មិនអាចទិញបាន សូមព្យាយាមម្តងទៀត',
        )
      } catch (err) {
        setPurchaseError(err instanceof Error ? err.message : 'មិនអាចទិញបាន')
      } finally {
        setAbaKhqrPending(false)
      }
    },
    [
      abaKhqrPending,
      fallbackHostedCheckout,
      openAbaKhqrBrowserFlow,
      refreshViewerProfile,
      selectedPlanId,
      termsAccepted,
      openLoginPrompt,
      tgUser?.id,
      viewerProfile.role,
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

    window.requestAnimationFrame(() => {
      const rootRect = root.getBoundingClientRect()
      const plansRect = plans.getBoundingClientRect()
      const bottomInset = 16
      const overflow = plansRect.bottom - (rootRect.bottom - bottomInset)

      if (overflow > 0) {
        root.scrollBy({ top: overflow, behavior: 'smooth' })
        return
      }

      if (plansRect.top < rootRect.top + 12) {
        plans.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }, [])

  useEffect(() => {
    const wasAccepted = prevTermsAcceptedRef.current
    prevTermsAcceptedRef.current = termsAccepted
    if (!termsAccepted || wasAccepted) return undefined

    const t = window.setTimeout(scrollToRevealPlans, 100)
    return () => window.clearTimeout(t)
  }, [scrollToRevealPlans, termsAccepted])

  const handlePlanCtaClick = useCallback(
    (planId) => {
      if (abaKhqrPending) return
      if (!termsAccepted) {
        nudgeTermsConsent()
        return
      }
      if (!tgUser?.id) {
        openLoginPrompt()
        return
      }
      setPurchaseError('')
      const id = String(planId || '').trim()
      if (!id) return
      setSelectedPlanId(id)
    },
    [abaKhqrPending, nudgeTermsConsent, openLoginPrompt, termsAccepted, tgUser?.id],
  )

  useEffect(() => {
    if (!selectedPlanId || !termsAccepted || !tgUser?.id) return undefined
    const t = window.setTimeout(() => {
      const root = scrollRef.current
      const payment = paymentSectionRef.current
      const footer = refundFooterRef.current
      if (!root || !payment || !footer) return

      window.requestAnimationFrame(() => {
        const rootRect = root.getBoundingClientRect()
        const footerRect = footer.getBoundingClientRect()
        const paymentRect = payment.getBoundingClientRect()
        const bottomInset = 20

        const footerOverflow = footerRect.bottom - (rootRect.bottom - bottomInset)
        if (footerOverflow > 0) {
          root.scrollBy({ top: footerOverflow, behavior: 'smooth' })
          return
        }

        if (paymentRect.top > rootRect.top + 12 && paymentRect.top > rootRect.bottom * 0.45) {
          payment.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    }, 120)
    return () => window.clearTimeout(t)
  }, [selectedPlanId, termsAccepted, tgUser?.id])

  return (
    <div className="tg-app tg-app--account tg-app--vip">
      <BrandTabToolbar title="សមាជិកVIP" titleLang="km" titleClassName="text-[16px]" />
      <main
        ref={scrollRef}
        className="tg-list-wrap tg-account-scroll tg-account-scroll--vip flex min-h-0 flex-1 flex-col px-3 py-5"
      >
        <section className="tg-vip-page__stack mx-auto flex w-full max-w-[420px] shrink-0 flex-col gap-3">
          {confirmingPaymentReturn ? (
            <section
              className="tg-vip-page__confirming flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 py-10 text-center"
              aria-live="polite"
              aria-busy="true"
            >
              <span className="tg-vip-page__confirming-spinner" aria-hidden />
              <p className="tg-vip-page__confirming-title" lang="km">
                កំពុងបញ្ជាក់ការទូទាត់…
              </p>
              <p className="tg-vip-page__confirming-desc" lang="km">
                សូមរង់ចាំបន្តិច ប្រព័ន្ធកំពុងពិនិត្យ ABA KHQR
              </p>
              <p className="tg-vip-page__confirming-expiry" lang="km">
                QR នេះមានសុពលភាព ២ នាទី
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
                                : !tgUser?.id
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

          {selectedPlanId && termsAccepted && tgUser?.id ? (
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
              <div className="tg-vip-payment-section__cards">
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
          {termsAccepted && !tgUser?.id ? (
            <p className="px-1 text-center text-[10px] leading-snug text-amber-200/80" lang="km">
              សូមបើកក្នុង Telegram Mini App ដើម្បីទិញ VIP
            </p>
          ) : null}
          {termsAccepted && tgUser?.id && !selectedPlanId ? (
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
