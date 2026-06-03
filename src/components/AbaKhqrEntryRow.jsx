import { ChevronRight } from 'lucide-react'

const ABA_MOBILE_LOGO_SRC = `${import.meta.env.BASE_URL}aba-mobile-logo.png`

/**
 * Figma: ABA KHQR selectable row — official ABA Mobile app icon + copy.
 * @param {{ disabled?: boolean, pending?: boolean, onSelect: () => void }} props
 */
export default function AbaKhqrEntryRow({ disabled = false, pending = false, onSelect }) {
  return (
    <button
      type="button"
      className={[
        'tg-aba-khqr-entry',
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
        <span className="tg-aba-khqr-entry__title">ABA KHQR</span>
        <span className="tg-aba-khqr-entry__subtitle">Scan to pay with any banking app</span>
      </span>
      <ChevronRight size={20} className="tg-aba-khqr-entry__chev" aria-hidden />
    </button>
  )
}
