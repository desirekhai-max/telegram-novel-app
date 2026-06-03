import { ChevronRight } from 'lucide-react'

/**
 * Figma: ABA KHQR selectable row — "Scan to pay with any banking app".
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
      <span className="tg-aba-khqr-entry__icon" aria-hidden>
        <span className="tg-aba-khqr-entry__aba-mark">ABA</span>
        <span className="tg-aba-khqr-entry__khqr-mark">KHQR</span>
      </span>
      <span className="tg-aba-khqr-entry__text">
        <span className="tg-aba-khqr-entry__title">ABA KHQR</span>
        <span className="tg-aba-khqr-entry__subtitle">Scan to pay with any banking app</span>
      </span>
      <ChevronRight size={18} className="tg-aba-khqr-entry__chev" aria-hidden />
    </button>
  )
}
