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
 * @returns {{ shelfTitle: string, readChapter: string, readAt: string, ts: number, novelId?: string, chapterIndex?: number }[]}
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
        ...(Number.isFinite(Number(it.chapterIndex)) && Number(it.chapterIndex) >= 0
          ? { chapterIndex: Math.floor(Number(it.chapterIndex)) }
          : {}),
      }))
      .filter((it) => it.ts > 0)
  } catch {
    return []
  }
}

/**
 * @param {{ shelfTitle?: string, readChapter?: string, readAt?: string, ts?: number, novelId?: string, chapterIndex?: number }} entry
 */
export function appendReadingHistoryLocal(entry) {
  const shelfTitle = String(entry?.shelfTitle || '').trim()
  const readChapter = String(entry?.readChapter || '').trim()
  const novelId = entry?.novelId != null ? String(entry.novelId).trim() : ''
  const chapterIndex = Number.isFinite(Number(entry?.chapterIndex)) ? Math.floor(Number(entry.chapterIndex)) : null
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
      ...(chapterIndex != null && chapterIndex >= 0 ? { chapterIndex } : {}),
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
      ...(Number.isFinite(Number(it.chapterIndex)) && Number(it.chapterIndex) >= 0
        ? { chapterIndex: Math.floor(Number(it.chapterIndex)) }
        : {}),
    }
    if (!prev || ts > Number(prev.ts)) map.set(k, row)
  }
  for (const it of serverItems || []) ingest(it)
  for (const it of localItems || []) ingest(it)
  return [...map.values()].sort((a, b) => b.ts - a.ts)
}

/**
 * 账户阅读历史：只保留仍在架的书，按 novelId 去重（每本保留最新一条）。
 * @param {object[]} items
 * @param {{ resolveListedId: (item: object) => string, getListedSummary?: (id: string) => object|null, catalogReady?: boolean }} helpers
 */
export function buildListedReadingHistory(items, helpers = {}) {
  const resolveListedId = helpers.resolveListedId
  const getListedSummary = helpers.getListedSummary
  const catalogReady = helpers.catalogReady !== false
  if (!catalogReady || typeof resolveListedId !== 'function') return []

  const byNovelId = new Map()
  for (const it of items || []) {
    if (!it || typeof it !== 'object') continue
    const novelId = String(resolveListedId(it) || '').trim()
    if (!novelId) continue
    const ts = Number(it.ts)
    if (!Number.isFinite(ts) || ts <= 0) continue
    const readChapter = String(it.readChapter || '').trim()
    if (!readChapter) continue
    const listed = typeof getListedSummary === 'function' ? getListedSummary(novelId) : null
    const shelfTitle = String(listed?.title || it.shelfTitle || '').trim()
    if (!shelfTitle) continue
    const row = {
      novelId,
      shelfTitle,
      readChapter,
      readAt: typeof it.readAt === 'string' ? it.readAt : '',
      ts,
      ...(Number.isFinite(Number(it.chapterIndex)) && Number(it.chapterIndex) >= 0
        ? { chapterIndex: Math.floor(Number(it.chapterIndex)) }
        : {}),
    }
    const prev = byNovelId.get(novelId)
    if (!prev || ts > Number(prev.ts)) byNovelId.set(novelId, row)
  }
  return [...byNovelId.values()].sort((a, b) => b.ts - a.ts)
}

/** 将本地阅读历史同步为仅含在架书本（与展示列表一致） */
export function syncReadingHistoryLocalListed(items) {
  try {
    const rows = Array.isArray(items) ? items : []
    localStorage.setItem(READING_HISTORY_KEY, JSON.stringify(rows.slice(0, READING_HISTORY_MAX)))
  } catch {
    /* ignore */
  }
}

/**
 * 删除已下架书本对应的本地阅读记录。
 * @param {(item: object) => string} resolveListedId 解析仍在架的书 id，无则返回空串
 */
export function pruneReadingHistoryNotListed(resolveListedId) {
  if (typeof resolveListedId !== 'function') return
  try {
    const list = loadReadingHistoryLocal()
    const next = list.filter((it) => Boolean(resolveListedId(it)))
    if (next.length === list.length) return
    localStorage.setItem(READING_HISTORY_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
