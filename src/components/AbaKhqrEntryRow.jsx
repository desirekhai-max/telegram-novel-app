import { ChevronRight } from 'lucide-react'
import { ABA_KHQR_LOGO_SRC } from '../lib/abaKhqrAssets.js'

/**
 * VIP 支付入口行 — ABA KHQR 官方标识 + 自定义标题。
 * @param {{ disabled?: boolean, pending?: boolean, onSelect: () => void, title: string, subtitle?: string }} props
 */
export default function AbaKhqrEntryRow({
  disabled = false,
  pending = false,
  onSelect,
  title,
  subtitle,
}) {
  return (
    <button
      type="button"
      className={[
        'tg-aba-khqr-entry',
        'tg-aba-khqr-entry--khqr',
        disabled ? 'tg-aba-khqr-entry--disabled' : '',
        pending ? 'tg-aba-khqr-entry--pending' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || pending}
      onClick={onSelect}
    >
      <span className="tg-aba-khqr-entry__logo-wrap" aria-hidden>
        <img
          src={ABA_KHQR_LOGO_SRC}
          alt=""
          className="tg-aba-khqr-entry__logo"
          width={48}
          height={48}
          decoding="async"
          draggable={false}
        />
      </span>
      <span className="tg-aba-khqr-entry__text">
        <span className="tg-aba-khqr-entry__title" lang="en">
          {title}
        </span>
        {subtitle ? (
          <span className="tg-aba-khqr-entry__subtitle" lang="en">
            {subtitle}
          </span>
        ) : null}
      </span>
      <span className="tg-aba-khqr-entry__chev-wrap" aria-hidden>
        <ChevronRight size={18} strokeWidth={2.25} className="tg-aba-khqr-entry__chev" />
      </span>
    </button>
  )
}
