import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
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
import { openAbaMobileDeeplink } from '../lib/abaMobile.js'
import { buildAbaKhqrUiMockSession, isAbaKhqrUiMockFlowEnabled } from '../lib/abaKhqrUiMock.js'
import { saveVipAbaKhqrSession } from '../lib/vipAbaKhqrSession.js'
import {
  purchaseViewerVipPlan,
  startViewerVipAbaKhqr,
  startViewerVipPayWayCheckout,
} from '../lib/viewerProfileApi.js'

export default function VipPage() {
  const navigate = useNavigate()
  const tgUser = useTelegramUser()
  const { viewerProfile, refreshViewerProfile } = useViewerProfile()
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [abaKhqrPending, setAbaKhqrPending] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [purchaseNotice, setPurchaseNotice] = useState('')
  const [purchaseError, setPurchaseError] = useState('')
  const paymentSectionRef = useRef(null)
  const plans = useMemo(
    () => [...getVipPlansCatalogForRole(viewerProfile.role)].sort((a, b) => a.sortOrder - b.sortOrder),
    [viewerProfile.role],
  )

  const canSelectPlan = Boolean(tgUser?.id) && termsAccepted && !abaKhqrPending

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
    (session, planId, payMode) => {
      const base = isAbaKhqrUiMockFlowEnabled() && session.uiMock
        ? `/vip/aba-khqr?ui_mock=1&tran_id=${encodeURIComponent(session.tranId)}&plan_id=${encodeURIComponent(planId)}`
        : `/vip/aba-khqr?tran_id=${encodeURIComponent(session.tranId)}&plan_id=${encodeURIComponent(planId)}`
      const sep = base.includes('?') ? '&' : '?'
      navigate(`${base}${sep}pay_mode=${encodeURIComponent(payMode)}`)
    },
    [navigate],
  )

  const runAbaPaymentStart = useCallback(
    async (payMode) => {
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
          if (payMode === 'aba' && mockSession.abapayDeeplink) {
            openAbaMobileDeeplink(mockSession.abapayDeeplink, {
              playStore: mockSession.playStore,
              appStore: mockSession.appStore,
            })
          }
          navigateToAbaKhqrPage(mockSession, planId, payMode)
          return
        }

        const aba = await startViewerVipAbaKhqr(planId)
        if (aba?.ok && aba.session?.tranId) {
          saveVipAbaKhqrSession(aba.session)
          if (payMode === 'aba' && aba.session.abapayDeeplink) {
            openAbaMobileDeeplink(aba.session.abapayDeeplink, {
              playStore: aba.session.playStore,
              appStore: aba.session.appStore,
            })
          }
          navigateToAbaKhqrPage(aba.session, planId, payMode)
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

  const onKhqrScanPay = useCallback(() => {
    void runAbaPaymentStart('khqr')
  }, [runAbaPaymentStart])

  const onAbaMobilePay = useCallback(() => {
    /* ABA Mobile flow — reserved; no action yet */
  }, [])

  const selectPlan = useCallback(
    (planId) => {
      if (!canSelectPlan) return
      const id = String(planId || '').trim()
      if (!id) return
      setSelectedPlanId(id)
    },
    [canSelectPlan],
  )

  useEffect(() => {
    if (!selectedPlanId || !termsAccepted || !tgUser?.id) return undefined
    const t = window.setTimeout(() => {
      paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(t)
  }, [selectedPlanId, termsAccepted, tgUser?.id])

  return (
    <div className="tg-app tg-app--account">
      <BrandTabToolbar title="សមាជិកVIP" titleLang="km" titleClassName="text-[16px]" />
      <main className="tg-list-wrap tg-account-scroll flex flex-1 flex-col px-3 py-5">
        <section className="mx-auto flex w-full max-w-[420px] shrink-0 flex-col gap-3">
          <VipPurchaseConsent
            accepted={termsAccepted}
            onAcceptedChange={(next) => {
              setTermsAccepted(next)
              if (next) setPurchaseError('')
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
            const isSelected = selectedPlanId === plan.planId
            const selectDisabled = !canSelectPlan
            return (
              <article
                key={plan.planId}
                className={[
                  'tg-vip-plan-card shrink-0',
                  plan.featured ? 'tg-vip-plan-card--featured' : '',
                  !termsAccepted ? 'tg-vip-plan-card--locked' : '',
                  isSelected ? 'tg-vip-plan-card--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="tg-vip-plan-card__body">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0" lang="km">
                      <p className="truncate text-[14px] font-extrabold tracking-[0.01em] text-white/95">
                        {plan.titleKm}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/65">{plan.flagKm}</p>
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
                        disabled={selectDisabled}
                        aria-disabled={selectDisabled}
                        title={
                          !termsAccepted
                            ? 'សូមធីកយល់ព្រមលក្ខខណ្ឌមុនពេលទិញ'
                            : !tgUser?.id
                              ? 'សូមចូលគណនី Telegram'
                              : ''
                        }
                        onClick={() => selectPlan(plan.planId)}
                        className={[
                          'inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold backdrop-blur-sm transition',
                          selectDisabled
                            ? 'cursor-not-allowed border-white/12 bg-white/10 text-white/35 shadow-none'
                            : 'active:scale-95',
                          !selectDisabled && plan.featured
                            ? 'border-amber-100 bg-amber-300 text-slate-900 shadow-[0_4px_14px_rgba(250,204,21,0.45)]'
                            : '',
                          !selectDisabled && !plan.featured
                            ? 'border-white/40 bg-white/20 text-white shadow-[0_4px_12px_rgba(0,0,0,0.25)]'
                            : '',
                        ].join(' ')}
                      >
                        {termsAccepted ? 'ជ្រើសរើសកញ្ចប់' : 'ទិញប្រើឥឡូវនេះ'}
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex items-end gap-2">
                    <p className="text-[24px] font-black leading-none tracking-tight text-amber-200">
                      {plan.priceUsdLabel}
                    </p>
                    <p className="shrink-0 whitespace-nowrap pb-1 text-xs text-white/60" lang="km">
                      {plan.priceHintKm}
                    </p>
                  </div>
                  <p className="mt-2 text-[16px] font-semibold text-white/95" lang="km">
                    {plan.durationKm}
                  </p>
                  <p className="mt-1 text-xs text-white/70" lang="km">
                    {VIP_MEMBER_FOOTER_KM}
                  </p>
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
                  decor="khqr"
                  title="ស្កេន KHQR"
                  subtitle="ស្កេន KHQR ដើម្បីបង់ប្រាក់ភ្លាមៗ"
                  pending={abaKhqrPending}
                  disabled={!selectedPlanId}
                  onSelect={onKhqrScanPay}
                />
                <AbaKhqrEntryRow
                  decor="aba-mobile"
                  title="បង់ប្រាក់តាម ABA Mobile"
                  subtitle="បើកកម្មវិធី ABA Mobile ដើម្បីបង់ប្រាក់ដោយផ្ទាល់"
                  pending={abaKhqrPending}
                  disabled={!selectedPlanId}
                  onSelect={onAbaMobilePay}
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
