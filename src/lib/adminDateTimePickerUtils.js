export const WEEK_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** 金边当日 00:00 对应的日历日 + 默认 09:00:00（与阅读记录筛选一致） */
export function getPhnomPenhTodayStartText() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Phnom_Penh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value || '1970'
  const m = parts.find((p) => p.type === 'month')?.value || '01'
  const d = parts.find((p) => p.type === 'day')?.value || '01'
  return `${y}-${m}-${d} 09:00:00`
}

export function getYearMonthFromText(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}` : ''
}

export function shiftYearMonth(value, delta) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})$/)
  if (!m) return value
  const year = Number(m[1])
  const month = Number(m[2])
  const next = new Date(year, month - 1 + delta, 1)
  const y = String(next.getFullYear())
  const mm = String(next.getMonth() + 1).padStart(2, '0')
  return `${y}-${mm}`
}

export function getMonthTitle(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})$/)
  if (!m) return 'April 2026'
  const year = Number(m[1])
  const month = Number(m[2])
  return `${MONTH_LABELS[month - 1]} ${year}`
}

export function buildCalendarCells(yearMonth) {
  const m = String(yearMonth || '').match(/^(\d{4})-(\d{2})$/)
  if (!m) return []
  const year = Number(m[1])
  const month = Number(m[2])
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate()
  const cells = []
  for (let i = 0; i < 42; i += 1) {
    if (i < firstDay) {
      const day = daysInPrevMonth - firstDay + i + 1
      const prev = new Date(year, month - 2, day)
      const y = String(prev.getFullYear())
      const mm = String(prev.getMonth() + 1).padStart(2, '0')
      const dd = String(prev.getDate()).padStart(2, '0')
      cells.push({ day, out: true, dateText: `${y}-${mm}-${dd}` })
    } else if (i < firstDay + daysInMonth) {
      const day = i - firstDay + 1
      const dd = String(day).padStart(2, '0')
      const mm = String(month).padStart(2, '0')
      const y = String(year)
      cells.push({ day, out: false, dateText: `${y}-${mm}-${dd}` })
    } else {
      const day = i - (firstDay + daysInMonth) + 1
      const next = new Date(year, month, day)
      const y = String(next.getFullYear())
      const mm = String(next.getMonth() + 1).padStart(2, '0')
      const dd = String(next.getDate()).padStart(2, '0')
      cells.push({ day, out: true, dateText: `${y}-${mm}-${dd}` })
    }
  }
  return cells
}

export function shiftTimePart(timeText, part, delta) {
  const m = String(timeText || '').match(/^(\d{2}):(\d{2}):(\d{2})$/)
  const h = m ? Number(m[1]) : 9
  const mi = m ? Number(m[2]) : 0
  const s = m ? Number(m[3]) : 0
  let nh = h
  let nmi = mi
  let ns = s
  if (part === 'hour') nh = (h + delta + 24) % 24
  if (part === 'minute') nmi = (mi + delta + 60) % 60
  if (part === 'second') ns = (s + delta + 60) % 60
  const hh = String(nh).padStart(2, '0')
  const mm = String(nmi).padStart(2, '0')
  const ss = String(ns).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function keepTimeOrDefault(value) {
  const m = String(value || '').match(/(\d{2}:\d{2}:\d{2})$/)
  return m ? m[1] : '09:00:00'
}

export function toDateOnly(value) {
  const m = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

/** 阅读记录「日期」列：金边时区，YYYY-MM-DD HH:mm:ss */
export function formatReadingRecordInstant(ms = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Phnom_Penh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms))
  const v = (t) => parts.find((p) => p.type === t)?.value || '00'
  return `${v('year')}-${v('month')}-${v('day')} ${v('hour')}:${v('minute')}:${v('second')}`
}
