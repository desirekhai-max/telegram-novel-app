const WATERMARK_TILE_KEYS = Array.from({ length: 18 }, (_, i) => `wm-${i}`)

/** 投资人要求：水印底部展示中性 App 名（非书名） */
const READER_WATERMARK_APP_NAME = '69KKH NOVEL'

function pad2(n) {
  return String(Math.trunc(Number(n) || 0)).padStart(2, '0')
}

function formatWatermarkDateTime(nowTs) {
  const d = new Date(Number(nowTs) || Date.now())
  const y = d.getFullYear()
  const mo = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const h = pad2(d.getHours())
  const mi = pad2(d.getMinutes())
  const s = pad2(d.getSeconds())
  return `${y}-${mo}-${day} ${h}:${mi}:${s}`
}

export default function ReaderWatermarkOverlay({ tgUser, nowTs }) {
  const username = tgUser?.username ? `@${String(tgUser.username).trim()}` : '@telegram-user'
  const userId = Number.isFinite(Number(tgUser?.id)) && Number(tgUser?.id) > 0
    ? `ID ${String(tgUser.id)}`
    : 'ID --'
  const timeLabel = formatWatermarkDateTime(nowTs)

  return (
    <div className="tg-reader-watermark" aria-hidden="true">
      <div className="tg-reader-watermark__grid">
        {WATERMARK_TILE_KEYS.map((key) => (
          <div key={key} className="tg-reader-watermark__tile">
            <p className="tg-reader-watermark__line">{username}</p>
            <p className="tg-reader-watermark__line">{userId}</p>
            <p className="tg-reader-watermark__line">{timeLabel}</p>
            <p className="tg-reader-watermark__line tg-reader-watermark__line--brand">{READER_WATERMARK_APP_NAME}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
