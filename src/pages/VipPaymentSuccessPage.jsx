import { BookOpen, Calendar, Check, Clock, Tag } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { getVipPlanForPurchase, getVipPlanTierAccentColor, getVipPlanTierClass } from '../data/vipPlansCatalog.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'
import { formatVipExpireDateTimeKm } from '../lib/formatVipExpireKm.js'
import {
  isVipPaymentSuccessHeroCached,
  preloadVipPaymentSuccessAssets,
  resolveVipPaymentSuccessHeroSrc,
} from '../lib/vipPaymentSuccessAssets.js'
import {
  formatVipPaymentExpiresAt,
  formatVipPaymentPriceLabel,
  formatVipPlanHoursLabel,
  loadVipPaymentSuccessPayload,
} from '../lib/vipPaymentSuccessState.js'
import { VIP_PAYMENT_SUCCESS_SLIDE_STATE } from '../lib/vipPaymentSuccessNavigation.js'
function TitleOrnament({ mirrored = false }) {
  return (
    <svg
      className={[
        'tg-vip-payment-success-status__ornament',
        mirrored ? 'tg-vip-payment-success-status__ornament--mirrored' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      viewBox="0 0 56 14"
      width="56"
      height="14"
      aria-hidden
      focusable="false"
    >
      <path
        d="M0 7 H40 M40 7 L44 4 M40 7 L44 10"
        fill="none"
        stroke="#c9a03d"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PaymentSuccessCheck() {
  return (
    <div className="tg-vip-payment-success-status__check-wrap" role="img" aria-label="Payment successful">
      <span className="tg-vip-payment-success-status__spark tg-vip-payment-success-status__spark--a" aria-hidden>
        ✫
      </span>
      <span className="tg-vip-payment-success-status__spark tg-vip-payment-success-status__spark--b" aria-hidden>
        ✫
      </span>
      <span className="tg-vip-payment-success-status__spark tg-vip-payment-success-status__spark--c" aria-hidden>
        ✫
      </span>
      <div className="tg-vip-payment-success-status__check">
        <svg
          className="tg-vip-payment-success-status__draw"
          viewBox="0 0 64 64"
          aria-hidden
          focusable="false"
        >
          <circle
            className="tg-vip-payment-success-status__draw-path"
            cx="32"
            cy="32"
            r="29.6"
            pathLength="100"
            fill="none"
            transform="rotate(-90 32 32)"
          />
        </svg>
        <Check
          className="tg-vip-payment-success-status__check-icon"
          size={28}
          strokeWidth={3}
          aria-hidden
        />
      </div>
    </div>
  )
}

function buildPurchasedPlanRows(payload, catalogPlan, vipExpireAtMs = 0) {
  const durationHours = Number(payload?.durationHours || catalogPlan?.durationHours || 3)
  const purchasedAt = payload?.purchasedAt || new Date().toISOString()
  const priceLabel = formatVipPaymentPriceLabel(
    payload?.priceLabel || catalogPlan?.priceUsdLabel || '$1',
  )
  const expireValue = Number(vipExpireAtMs) > 0
    ? formatVipExpireDateTimeKm(vipExpireAtMs)
    : formatVipPaymentExpiresAt(purchasedAt, durationHours)

  const planLabel = String(payload?.planLabel || catalogPlan?.titleKm || '').trim()

  return [
    {
      key: 'plan',
      label: 'គម្រោង',
      value: planLabel || 'VIPកម្រិតដំបូង',
      labelLang: 'km',
      valueLang: 'km',
      Icon: BookOpen,
    },
    { key: 'price', label: 'តម្លៃ', value: priceLabel, labelLang: 'km', Icon: Tag },
    {
      key: 'duration',
      label: 'រយៈពេល',
      value: formatVipPlanHoursLabel(durationHours),
      labelLang: 'km',
      valueLang: 'km',
      Icon: Clock,
    },
    {
      key: 'expires',
      label: 'ផុតកំណត់',
      value: expireValue,
      labelLang: 'km',
      valueLang: 'km',
      Icon: Calendar,
    },
  ]
}

function PurchasedPlanCard({ rows, planTierClass, iconColor }) {
  return (
    <article
      className={['tg-vip-payment-success-plan', planTierClass].filter(Boolean).join(' ')}
      aria-label="ព័ត៌មានសមាជិកភាព"
      style={{ '--vip-payment-success-icon': iconColor }}
    >
      <div className="tg-vip-payment-success-plan__heading">
        <span className="tg-vip-payment-success-plan__heading-line" aria-hidden />
        <h2 className="tg-vip-payment-success-plan__title">
          ព័ត៌មានសមាជិកភាព
        </h2>
        <span
          className="tg-vip-payment-success-plan__heading-line tg-vip-payment-success-plan__heading-line--mirrored"
          aria-hidden
        />
      </div>
      <div className="tg-vip-payment-success-plan__rows">
        {rows.map((row, index) => (
          <div key={row.key} className="tg-vip-payment-success-plan__row">
            <div className="tg-vip-payment-success-plan__meta">
              <span className="tg-vip-payment-success-plan__icon" aria-hidden>
                <row.Icon size={19} strokeWidth={1.75} color={iconColor} />
              </span>
              <span className="tg-vip-payment-success-plan__label" lang={row.labelLang || 'km'}>
                {row.label}
              </span>
            </div>
            <span
              className={[
                'tg-vip-payment-success-plan__value',
                row.valueLang === 'km' ? 'tg-vip-payment-success-plan__value--km' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              lang={row.valueLang || 'en'}
            >
              {row.value}
            </span>
            {index < rows.length - 1 ? (
              <div className="tg-vip-payment-success-plan__divider" aria-hidden />
            ) : null}
          </div>
        ))}
      </div>
    </article>
  )
}

/** VIP 支付成功页 — 空白模板，后续可补 UI */
export default function VipPaymentSuccessPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const allowLeaveRef = useRef(false)
  const slideEnter = location.state?.enter === VIP_PAYMENT_SUCCESS_SLIDE_STATE.enter
  const { viewerProfile } = useViewerProfile()
  const payload = useMemo(() => loadVipPaymentSuccessPayload(), [])
  const resolvedPlanId = useMemo(
    () => String(payload?.planId || searchParams.get('plan_id') || 'vip_entry').trim(),
    [payload?.planId, searchParams],
  )
  const catalogPlan = getVipPlanForPurchase(resolvedPlanId, viewerProfile.role)
  const vipExpireAtMs = Number(viewerProfile.vipExpireAtMs) || 0
  const planRows = useMemo(
    () => buildPurchasedPlanRows(payload, catalogPlan, vipExpireAtMs),
    [payload, catalogPlan, vipExpireAtMs],
  )
  const planTierClass = useMemo(() => getVipPlanTierClass(resolvedPlanId), [resolvedPlanId])
  const iconColor = useMemo(() => getVipPlanTierAccentColor(resolvedPlanId), [resolvedPlanId])
  const heroSrc = useMemo(() => resolveVipPaymentSuccessHeroSrc(), [])
  const [heroReady, setHeroReady] = useState(() => isVipPaymentSuccessHeroCached())

  useLayoutEffect(() => {
    if (heroReady) return undefined
    let cancelled = false
    void preloadVipPaymentSuccessAssets().then(() => {
      if (!cancelled) setHeroReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [heroReady])

  useEffect(() => {
    const lockState = { ...(window.history.state || {}), vipPaymentSuccessLocked: true }
    window.history.replaceState(lockState, '', window.location.href)

    const onPopState = () => {
      if (allowLeaveRef.current) return
      window.history.pushState(lockState, '', window.location.href)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const allowLeaveSuccessPage = useCallback(() => {
    allowLeaveRef.current = true
  }, [])

  return (
    <div
      className={[
        'tg-app tg-vip-payment-success-page',
        slideEnter ? 'tg-vip-payment-success-page--slide-enter' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <main className="tg-vip-payment-success-page__main">
        <header
          className={[
            'tg-vip-payment-success-hero',
            heroReady ? 'tg-vip-payment-success-hero--loaded' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={heroReady ? { backgroundImage: `url("${heroSrc}")` } : undefined}
          aria-label="69KKH NOVEL"
        >
          <PaymentSuccessCheck />
        </header>

        <section className="tg-vip-payment-success-status" aria-label="Payment success">
          <div className="tg-vip-payment-success-status__title-row">
            <TitleOrnament />
            <h1 className="tg-vip-payment-success-status__title">
              ការបង់ប្រាក់បានជោគជ័យ!
            </h1>
            <TitleOrnament mirrored />
          </div>
          <p className="tg-vip-payment-success-status__message">
            <span className="tg-vip-payment-success-status__message-line">
              សូមអរគុណសម្រាប់ការជាវ 69KKH NOVEL
            </span>
            <span className="tg-vip-payment-success-status__message-line">
              សមាជិកភាពរបស់អ្នកត្រូវបានដំណើរការដោយជោគជ័យ
            </span>
          </p>
          <PurchasedPlanCard rows={planRows} planTierClass={planTierClass} iconColor={iconColor} />
          <Link to="/" className="tg-vip-payment-success-status__cta" lang="km" onClick={allowLeaveSuccessPage}>
            ចាប់ផ្តើមអានឥឡូវនេះ
          </Link>
        </section>
      </main>
    </div>
  )
}
