/**
 * 单金币线性图标（透明背景 SVG）。
 */
export function CoinLineIcon({ className = '', alt = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role={alt ? 'img' : 'presentation'}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={`inline-block shrink-0 align-middle ${className}`.trim()}
      fill="none"
    >
      <defs>
        <linearGradient id="coinStroke" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="7.2" stroke="url(#coinStroke)" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="4.4" stroke="url(#coinStroke)" strokeWidth="1.4" opacity="0.95" />
      <path d="M9.2 12h5.6" stroke="url(#coinStroke)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
