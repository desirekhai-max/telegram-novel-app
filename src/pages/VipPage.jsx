import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Check, ChevronRight, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AbaKhqrEntryRow from '../components/AbaKhqrEntryRow.jsx'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import VipPurchaseConsent from '../components/VipPurchaseConsent.jsx'
import { getVipPlansCatalogForRole, VIP_MEMBER_FOOTER_KM } from '../data/vipPlansCatalog.js'
import { useTelegramUser } from '../hooks/useTelegramUser.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'
import {
  savePayWayCheckoutSession,
  submitPayWayCheckoutForm,
} from '../lib/paywayCheckout.js'
import { buildAbaKhqrUiMockSession, isAbaKhqrUiMockFlowEnabled } from '../lib/abaKhqrUiMock.js'
import { saveVipAbaKhqrSession } from '../lib/vipAbaKhqrSession.js'
import {
  purchaseViewerVipPlan,
  startViewerVipAbaKhqr,
  startViewerVipPayWayCheckout,
} from '../lib/viewerProfileApi.js'

const VIP_PLAN_TIER_CLASS = {
  vip_entry: 'tg-vip-plan-card--entry',
  vip_standard: 'tg-vip-plan-card--standard',
  vip_premium: 'tg-vip-plan-card--premium',
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
  const scrollRef = useRef(null)
  const paymentSectionRef = useRef(null)
  const consentRef = useRef(null)
  const [consentShaking, setConsentShaking] = useState(false)

  const resetVipScrollTop = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = 0
  }, [])

  useLayoutEffect(() => {
    resetVipScrollTop()
  }, [location.pathname, resetVipScrollTop])
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

  const navigateToAbaKhqrPage = useCallback(
    (session, planId) => {
      const path = isAbaKhqrUiMockFlowEnabled() && session.uiMock
        ? `/vip/aba-khqr?ui_mock=1&tran_id=${encodeURIComponent(session.tranId)}&plan_id=${encodeURIComponent(planId)}`
        : `/vip/aba-khqr?tran_id=${encodeURIComponent(session.tranId)}&plan_id=${encodeURIComponent(planId)}`
      navigate(path)
    },
    [navigate],
  )

  const runAbaPaymentStart = useCallback(
    async () => {
      if (!termsAccepted) {
        setPurchaseError('សូមធីកយល់ព្រមលក្ខខណ្ឌមុនពេលទិញ')
        return
      }
      if (!tgUser?.id) {
        setPurchaseError('សូមបើកក្នុង Telegram Mini App')
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
          saveVipAbaKhqrSession(mockSession)
          navigateToAbaKhqrPage(mockSession, planId)
          return
        }

        const aba = await startViewerVipAbaKhqr(planId)
        if (aba?.ok && aba.session?.tranId) {
          saveVipAbaKhqrSession(aba.session)
          navigateToAbaKhqrPage(aba.session, planId)
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
      navigateToAbaKhqrPage,
      refreshViewerProfile,
      selectedPlanId,
      termsAccepted,
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

  const handlePlanCtaClick = useCallback(
    (planId) => {
      if (abaKhqrPending) return
      if (!termsAccepted) {
        nudgeTermsConsent()
        return
      }
      if (!tgUser?.id) {
        setPurchaseError('សូមបើកក្នុង Telegram Mini App')
        return
      }
      setPurchaseError('')
      const id = String(planId || '').trim()
      if (!id) return
      setSelectedPlanId(id)
    },
    [abaKhqrPending, nudgeTermsConsent, termsAccepted, tgUser?.id],
  )

  useEffect(() => {
    if (!selectedPlanId || !termsAccepted || !tgUser?.id) return undefined
    const t = window.setTimeout(() => {
      const root = scrollRef.current
      const target = paymentSectionRef.current
      if (!root || !target) return
      const rootRect = root.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      if (targetRect.top < rootRect.bottom - 48) return
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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

          {plans.map((plan) => {
            const isSelected = termsAccepted && selectedPlanId === plan.planId
            const ctaBlocked = abaKhqrPending
            const ctaNeedsTerms = !termsAccepted
            return (
              <article
                key={plan.planId}
                className={[
                  'tg-vip-plan-card shrink-0',
                  VIP_PLAN_TIER_CLASS[plan.planId] || '',
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
                  subtitle="បង់ប្រាក់តាម ABA KHQR"
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

          <footer className="mt-1 px-1 pb-2 text-center">
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
        </section>
      </main>
    </div>
  )
}
