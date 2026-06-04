import { ChevronRight } from 'lucide-react'

const ABA_MOBILE_LOGO_SRC = `${import.meta.env.BASE_URL}aba-mobile-logo.png`

/**
 * VIP 支付入口行 — ABA Mobile 官方图标 + 自定义标题。
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
          src={ABA_MOBILE_LOGO_SRC}
          alt=""
          className="tg-aba-khqr-entry__logo"
          width={56}
          height={56}
          decoding="async"
          draggable={false}
        />
      </span>
      <span className="tg-aba-khqr-entry__text">
        <span className="tg-aba-khqr-entry__title" lang="km">
          {title}
        </span>
        {subtitle ? (
          <span className="tg-aba-khqr-entry__subtitle" lang="km">
            {subtitle}
          </span>
        ) : null}
      </span>
      <ChevronRight size={20} className="tg-aba-khqr-entry__chev" aria-hidden />
    </button>
  )
}
