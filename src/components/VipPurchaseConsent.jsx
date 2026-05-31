import { Link } from 'react-router-dom'
import {
  VIP_PURCHASE_CONSENT_LABEL_KM,
  VIP_PURCHASE_CONSENT_REFUND_LINK_KM,
  VIP_PURCHASE_CONSENT_TERMS_LINK_KM,
  VIP_PURCHASE_TERMS_ITEMS_KM,
  VIP_PURCHASE_TERMS_TITLE_KM,
} from '../data/vipPurchaseTermsKm.js'

/**
 * VIP 购买前条款摘要 + 确认勾选（投资人要求：未勾选不可付款）。
 */
export default function VipPurchaseConsent({ accepted, onAcceptedChange, disabled = false }) {
  return (
    <section className="tg-vip-consent shrink-0" aria-labelledby="tg-vip-consent-title">
      <div className="tg-vip-consent__terms rounded-[18px] border border-white/12 bg-white/[0.05] px-3.5 py-3.5 backdrop-blur-sm">
        <h2
          id="tg-vip-consent-title"
          className="text-[13px] font-bold tracking-[0.02em] text-amber-100/95"
          lang="km"
        >
          {VIP_PURCHASE_TERMS_TITLE_KM}
        </h2>
        <ul className="mt-2.5 space-y-2 text-[11px] leading-[1.55] text-white/72" lang="km">
          {VIP_PURCHASE_TERMS_ITEMS_KM.map((item) => (
            <li key={item.id} className="flex gap-2">
              <span className="mt-[0.35em] h-1 w-1 shrink-0 rounded-full bg-amber-200/80" aria-hidden />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] leading-snug text-white/45" lang="km">
          <Link to="/terms-of-service" className="text-amber-200/90 underline-offset-2 hover:underline">
            {VIP_PURCHASE_CONSENT_TERMS_LINK_KM}
          </Link>
          {' · '}
          <Link to="/refund-policy" className="text-amber-200/90 underline-offset-2 hover:underline">
            {VIP_PURCHASE_CONSENT_REFUND_LINK_KM}
          </Link>
        </p>
      </div>

      <label
        className={[
          'tg-vip-consent__check mt-3 flex cursor-pointer items-start gap-2.5 rounded-[16px] border px-3 py-3 transition',
          accepted ? 'border-amber-200/35 bg-amber-500/[0.08]' : 'border-white/12 bg-white/[0.04]',
          disabled ? 'cursor-not-allowed opacity-55' : 'active:scale-[0.99]',
        ].join(' ')}
      >
        <input
          type="checkbox"
          className="tg-vip-consent__checkbox mt-0.5 shrink-0"
          checked={accepted}
          disabled={disabled}
          onChange={(e) => onAcceptedChange(e.target.checked)}
        />
        <span className="min-w-0 text-[11px] leading-[1.55] text-white/80" lang="km">
          {VIP_PURCHASE_CONSENT_LABEL_KM}{' '}
          <Link
            to="/terms-of-service"
            className="font-semibold text-amber-200 underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {VIP_PURCHASE_CONSENT_TERMS_LINK_KM}
          </Link>
          {' និង '}
          <Link
            to="/refund-policy"
            className="font-semibold text-amber-200 underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {VIP_PURCHASE_CONSENT_REFUND_LINK_KM}
          </Link>
        </span>
      </label>
    </section>
  )
}
