import { useState } from 'react'
import {
  WEEK_LABELS,
  buildCalendarCells,
  getMonthTitle,
  keepTimeOrDefault,
  shiftTimePart,
} from '../lib/adminDateTimePickerUtils.js'

function clampTimeInt(n, lo, hi) {
  if (!Number.isFinite(n)) return lo
  return Math.max(lo, Math.min(hi, n))
}

/** 时间面板：箭头 + 可手输的时/分/秒 */
export function AdminRecordsTimePanel({ timeText, onPickTime }) {
  const canonical = keepTimeOrDefault(timeText)
  const [hh, mm, ss] = canonical.split(':')
  const [focus, setFocus] = useState(null)
  const [draft, setDraft] = useState('')

  const commitPart = (part, raw) => {
    const [h0, m0, s0] = keepTimeOrDefault(timeText).split(':')
    let h = parseInt(h0, 10)
    let mi = parseInt(m0, 10)
    let sec = parseInt(s0, 10)
    const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 2)
    let n
    if (digits === '') {
      n = part === 'h' ? h : part === 'm' ? mi : sec
    } else {
      n = parseInt(digits, 10)
      if (part === 'h') n = clampTimeInt(n, 0, 23)
      else n = clampTimeInt(n, 0, 59)
    }
    if (part === 'h') h = n
    else if (part === 'm') mi = n
    else sec = n
    onPickTime(`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(sec).padStart(2, '0')}`)
  }

  const startEdit = (part, inputEl) => {
    setFocus(part)
    const [h, m, s] = keepTimeOrDefault(timeText).split(':')
    setDraft(part === 'h' ? h : part === 'm' ? m : s)
    if (inputEl) {
      requestAnimationFrame(() => inputEl.select())
    }
  }

  const endEdit = (part) => {
    if (focus !== part) return
    commitPart(part, draft)
    setFocus(null)
    setDraft('')
  }

  const segmentValue = (part, padded) => (focus === part ? draft : padded)

  const onDigitChange = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 2)
    setDraft(v)
  }

  const onSegmentKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  return (
    <div className="tg-admin-records-filter__time-panel">
      <div className="tg-admin-records-filter__time-col">
        <button
          type="button"
          className="tg-admin-records-filter__time-arrow"
          onClick={() => onPickTime(shiftTimePart(canonical, 'hour', 1))}
        >
          ⌃
        </button>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          aria-label="时（0–23）"
          className="tg-admin-records-filter__time-input"
          value={segmentValue('h', hh)}
          onFocus={(e) => startEdit('h', e.target)}
          onBlur={() => endEdit('h')}
          onChange={onDigitChange}
          onKeyDown={onSegmentKeyDown}
        />
        <button
          type="button"
          className="tg-admin-records-filter__time-arrow"
          onClick={() => onPickTime(shiftTimePart(canonical, 'hour', -1))}
        >
          ⌄
        </button>
      </div>
      <span className="tg-admin-records-filter__time-sep">:</span>
      <div className="tg-admin-records-filter__time-col">
        <button
          type="button"
          className="tg-admin-records-filter__time-arrow"
          onClick={() => onPickTime(shiftTimePart(canonical, 'minute', 1))}
        >
          ⌃
        </button>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          aria-label="分（0–59）"
          className="tg-admin-records-filter__time-input"
          value={segmentValue('m', mm)}
          onFocus={(e) => startEdit('m', e.target)}
          onBlur={() => endEdit('m')}
          onChange={onDigitChange}
          onKeyDown={onSegmentKeyDown}
        />
        <button
          type="button"
          className="tg-admin-records-filter__time-arrow"
          onClick={() => onPickTime(shiftTimePart(canonical, 'minute', -1))}
        >
          ⌄
        </button>
      </div>
      <span className="tg-admin-records-filter__time-sep">:</span>
      <div className="tg-admin-records-filter__time-col">
        <button
          type="button"
          className="tg-admin-records-filter__time-arrow"
          onClick={() => onPickTime(shiftTimePart(canonical, 'second', 1))}
        >
          ⌃
        </button>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          aria-label="秒（0–59）"
          className="tg-admin-records-filter__time-input"
          value={segmentValue('s', ss)}
          onFocus={(e) => startEdit('s', e.target)}
          onBlur={() => endEdit('s')}
          onChange={onDigitChange}
          onKeyDown={onSegmentKeyDown}
        />
        <button
          type="button"
          className="tg-admin-records-filter__time-arrow"
          onClick={() => onPickTime(shiftTimePart(canonical, 'second', -1))}
        >
          ⌄
        </button>
      </div>
    </div>
  )
}

/** 日历 + 时间切换 + 底部图标（与阅读记录管理弹层一致） */
export function AdminRecordsDateTimeMenu({
  yearMonth,
  onPrevMonth,
  onNextMonth,
  onPickDate,
  timePanelOpen,
  setTimePanelOpen,
  currentDateTime,
  onPickTime,
}) {
  const cells = buildCalendarCells(yearMonth)
  const timeText = keepTimeOrDefault(currentDateTime)
  return (
    <div className="tg-admin-records-filter__date-menu">
      <div className="tg-admin-records-filter__date-menu-head">
        <button
          type="button"
          className="tg-admin-records-filter__date-menu-arrow-btn"
          onClick={onPrevMonth}
          aria-label="上个月"
        >
          <span className="tg-admin-records-filter__date-menu-arrow" aria-hidden>
            ‹
          </span>
        </button>
        <span className="tg-admin-records-filter__date-menu-month">{getMonthTitle(yearMonth)}</span>
        <button
          type="button"
          className="tg-admin-records-filter__date-menu-arrow-btn"
          onClick={onNextMonth}
          aria-label="下个月"
        >
          <span className="tg-admin-records-filter__date-menu-arrow" aria-hidden>
            ›
          </span>
        </button>
      </div>
      <div
        className={
          timePanelOpen
            ? 'tg-admin-records-filter__date-menu-main tg-admin-records-filter__date-menu-main--time'
            : 'tg-admin-records-filter__date-menu-main'
        }
      >
        {!timePanelOpen ? (
          <>
            <div className="tg-admin-records-filter__date-menu-week">
              {WEEK_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="tg-admin-records-filter__date-menu-grid">
              {cells.map((cell) => (
                <button
                  key={cell.dateText}
                  type="button"
                  className={
                    cell.out
                      ? 'tg-admin-records-filter__date-cell tg-admin-records-filter__date-menu-out'
                      : 'tg-admin-records-filter__date-cell'
                  }
                  onClick={() => onPickDate(cell.dateText)}
                >
                  {cell.day}
                </button>
              ))}
            </div>
          </>
        ) : (
          <AdminRecordsTimePanel timeText={timeText} onPickTime={onPickTime} />
        )}
      </div>
      <button
        type="button"
        className="tg-admin-records-filter__date-menu-bottom-box"
        onClick={() => setTimePanelOpen((v) => !v)}
      >
        <span className="tg-admin-records-filter__date-menu-bottom-icon">{timePanelOpen ? '📅' : '🕒'}</span>
      </button>
    </div>
  )
}
