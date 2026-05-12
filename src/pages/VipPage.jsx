import { useCallback, useMemo, useState } from 'react'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { getVipPlansCatalogForRole, VIP_MEMBER_FOOTER_KM } from '../data/vipPlansCatalog.js'
import { useTelegramUser } from '../hooks/useTelegramUser.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'
import { purchaseViewerVipPlan } from '../lib/viewerProfileApi.js'

export default function VipPage() {
  const tgUser = useTelegramUser()
  const { viewerProfile, refreshViewerProfile } = useViewerProfile(tgUser)
  const [purchasePendingPlanId, setPurchasePendingPlanId] = useState('')
  const plans = useMemo(
    () => [...getVipPlansCatalogForRole(viewerProfile.role)].sort((a, b) => a.sortOrder - b.sortOrder),
    [viewerProfile.role],
  )

  const onDemoPurchase = useCallback(
    async (planId) => {
      if (!tgUser?.id || !planId || purchasePendingPlanId) return
      setPurchasePendingPlanId(String(planId))
      const result = await purchaseViewerVipPlan(planId)
      if (result?.ok) await refreshViewerProfile()
      setPurchasePendingPlanId('')
    },
    [tgUser?.id, purchasePendingPlanId, refreshViewerProfile],
  )

  return (
    <div className="tg-app tg-app--account">
      <BrandTabToolbar title="សមាជិកVIP" titleLang="km" titleClassName="text-[16px]" />
      <main className="tg-list-wrap tg-account-scroll flex flex-1 px-3 py-5">
        <section className="mx-auto flex w-full max-w-[420px] flex-col gap-3">
          {plans.map((plan) => (
            <article
              key={plan.planId}
              className={[
                'tg-vip-plan-card',
                plan.featured ? 'tg-vip-plan-card--featured' : '',
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
                  <button
                    type="button"
                    lang="km"
                    disabled={!tgUser?.id || Boolean(purchasePendingPlanId)}
                    onClick={() => onDemoPurchase(plan.planId)}
                    className={[
                      'inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold backdrop-blur-sm transition active:scale-95',
                      !tgUser?.id || purchasePendingPlanId ? 'cursor-not-allowed opacity-45' : '',
                      plan.featured
                        ? 'border-amber-100 bg-amber-300 text-slate-900 shadow-[0_4px_14px_rgba(250,204,21,0.45)]'
                        : 'border-white/40 bg-white/20 text-white shadow-[0_4px_12px_rgba(0,0,0,0.25)]',
                    ].join(' ')}
                  >
                    {purchasePendingPlanId === plan.planId ? 'កំពុងដំណើរការ...' : plan.buyButtonKm}
                  </button>
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <p className="text-[24px] font-black leading-none tracking-tight text-amber-200">
                    {plan.priceUsdLabel}
                  </p>
                  <p className="pb-1 text-xs text-white/60" lang="km">
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
          ))}
        </section>
      </main>
    </div>
  )
}
