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
export default function VipPurchaseConsent({
  accepted,
  onAcceptedChange,
  disabled = false,
  shake = false,
  sectionRef,
}) {
  return (
    <section
      ref={sectionRef}
      className={['tg-vip-consent shrink-0', shake ? 'tg-vip-consent--shake' : ''].filter(Boolean).join(' ')}
      aria-labelledby="tg-vip-consent-title"
    >
      <div className="tg-vip-consent__terms">
        <h2 id="tg-vip-consent-title" className="tg-vip-consent__title" lang="km">
          {VIP_PURCHASE_TERMS_TITLE_KM}
        </h2>
        <ul className="tg-vip-consent__list" lang="km">
          {VIP_PURCHASE_TERMS_ITEMS_KM.map((item) => (
            <li key={item.id} className="tg-vip-consent__item">
              <span className="tg-vip-consent__bullet" aria-hidden />
              <span className="tg-vip-consent__item-text">{item.text}</span>
            </li>
          ))}
        </ul>
        <p className="tg-vip-consent__links" lang="km">
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
          'tg-vip-consent__check',
          accepted ? 'tg-vip-consent__check--accepted' : '',
          disabled ? 'tg-vip-consent__check--disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <input
          type="checkbox"
          className="tg-vip-consent__checkbox mt-0.5 shrink-0"
          checked={accepted}
          disabled={disabled}
          onChange={(e) => onAcceptedChange(e.target.checked)}
        />
        <span className="tg-vip-consent__label-text" lang="km">
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
