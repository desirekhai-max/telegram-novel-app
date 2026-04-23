/**
 * 全页底色：与主界面 `--tg-app-surface` 同一实色，避免与 #root / body 叠出色差。
 */
export default function AmbientBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ background: 'var(--tg-app-surface)' }}
    />
  )
}
