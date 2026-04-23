/** 阅读进度与「上次打开的书」——存 localStorage，关闭 Mini App / 刷新后仍可恢复 */

const SCROLL_PREFIX = 'tg-reader-scroll:v1:'
const LAST_READ_KEY = 'tg-last-read:v1'

export function loadReaderScroll(bookId) {
  if (!bookId) return 0
  try {
    const v = localStorage.getItem(SCROLL_PREFIX + bookId)
    if (v == null) return 0
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

export function saveReaderScroll(bookId, y) {
  if (!bookId) return
  try {
    localStorage.setItem(SCROLL_PREFIX + bookId, String(Math.round(y)))
  } catch {
    /* 隐私模式或配额满 */
  }
}

/** @returns {{ id: string, title: string } | null} */
export function loadLastRead() {
  try {
    const raw = localStorage.getItem(LAST_READ_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o || typeof o.id !== 'string') return null
    return {
      id: o.id,
      title: typeof o.title === 'string' ? o.title : '继续阅读',
    }
  } catch {
    return null
  }
}

export function saveLastRead(book) {
  if (!book?.id) return
  try {
    localStorage.setItem(
      LAST_READ_KEY,
      JSON.stringify({
        id: book.id,
        title: typeof book.title === 'string' ? book.title : '',
        t: Date.now(),
      }),
    )
  } catch {
    /* ignore */
  }
}
