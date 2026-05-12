/** 阅读进度与「上次打开的书」——存 localStorage，关闭 Mini App / 刷新后仍可恢复 */

const SCROLL_PREFIX = 'tg-reader-scroll:v1:'
const LAST_READ_KEY = 'tg-last-read:v1'
const READING_HISTORY_KEY = 'tg-reading-history:v1'
const READING_HISTORY_MAX = 100

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

/**
 * 本地阅读历史（与 `/account/reading-history` 展示字段对齐）；服务端不可用时仍可显示。
 * @returns {{ shelfTitle: string, readChapter: string, readAt: string, ts: number, novelId?: string }[]}
 */
export function loadReadingHistoryLocal() {
  try {
    const raw = localStorage.getItem(READING_HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((it) => it && typeof it === 'object' && typeof it.shelfTitle === 'string' && typeof it.readChapter === 'string')
      .map((it) => ({
        shelfTitle: it.shelfTitle,
        readChapter: it.readChapter,
        readAt: typeof it.readAt === 'string' ? it.readAt : '',
        ts: Number.isFinite(Number(it.ts)) ? Number(it.ts) : 0,
        ...(typeof it.novelId === 'string' && it.novelId ? { novelId: it.novelId } : {}),
      }))
      .filter((it) => it.ts > 0)
  } catch {
    return []
  }
}

/**
 * @param {{ shelfTitle?: string, readChapter?: string, readAt?: string, ts?: number, novelId?: string }} entry
 */
export function appendReadingHistoryLocal(entry) {
  const shelfTitle = String(entry?.shelfTitle || '').trim()
  const readChapter = String(entry?.readChapter || '').trim()
  const novelId = entry?.novelId != null ? String(entry.novelId).trim() : ''
  if (!shelfTitle || !readChapter) return
  const ts = Number.isFinite(Number(entry?.ts)) ? Number(entry.ts) : Date.now()
  const readAt = typeof entry?.readAt === 'string' ? entry.readAt : ''
  try {
    let list = loadReadingHistoryLocal()
    const row = {
      shelfTitle,
      readChapter,
      readAt,
      ts,
      ...(novelId ? { novelId } : {}),
    }
    if (novelId) {
      list = list.filter((it) => String(it.novelId || '') !== novelId)
    }
    list.unshift(row)
    list.sort((a, b) => b.ts - a.ts)
    localStorage.setItem(READING_HISTORY_KEY, JSON.stringify(list.slice(0, READING_HISTORY_MAX)))
  } catch {
    /* ignore */
  }
}

/**
 * 合并服务端与本地记录：同一本书（novelId 或 书名+章节键）只保留最新一条。
 */
export function mergeReadingHistoryLists(serverItems, localItems) {
  const map = new Map()
  const takeKey = (it) => {
    const nid = String(it?.novelId || '').trim()
    if (nid) return `id:${nid}`
    return `leg:${String(it?.shelfTitle || '')}::${String(it?.readChapter || '')}`
  }
  const ingest = (it) => {
    if (!it || typeof it !== 'object') return
    const ts = Number(it.ts)
    if (!Number.isFinite(ts) || ts <= 0) return
    const shelfTitle = String(it.shelfTitle || '').trim()
    const readChapter = String(it.readChapter || '').trim()
    if (!shelfTitle || !readChapter) return
    const k = takeKey(it)
    const prev = map.get(k)
    const row = {
      shelfTitle,
      readChapter,
      readAt: typeof it.readAt === 'string' ? it.readAt : '',
      ts,
      ...(String(it.novelId || '').trim() ? { novelId: String(it.novelId).trim() } : {}),
    }
    if (!prev || ts > Number(prev.ts)) map.set(k, row)
  }
  for (const it of serverItems || []) ingest(it)
  for (const it of localItems || []) ingest(it)
  return [...map.values()].sort((a, b) => b.ts - a.ts)
}
