import { getCatalogNovelsSync, getNovelSummaryById } from './novelsRuntime.js'

/** 从阅读记录解析小说 ID（优先 novelId；否则按书名匹配目录/内置） */
export function resolveNovelIdFromHistoryItem(item) {
  const nid = String(item?.novelId || '').trim()
  if (nid) return nid
  const title = String(item?.shelfTitle || '').trim()
  if (!title) return ''
  const pool = getCatalogNovelsSync()
  const exact = pool.find((n) => String(n?.title || '').trim() === title)
  if (exact?.id) return String(exact.id)
  const loose = pool.find((n) => {
    const t = String(n?.title || '').trim()
    return t && (title.includes(t) || t.includes(title))
  })
  return loose?.id ? String(loose.id) : ''
}

/**
 * 根据记录中的章节文案匹配章节下标；优先 chapterIndex 字段，其次标题/章号解析。
 * @returns {number} 0-based chapter index，无法解析时返回 0
 */
export function resolveChapterIndexFromHistoryItem(novel, item) {
  const stored = item?.chapterIndex
  if (Number.isFinite(Number(stored)) && Number(stored) >= 0) {
    const max = Math.max(0, (novel?.chapters ?? []).length - 1)
    return Math.min(Math.floor(Number(stored)), max)
  }
  const text = String(item?.readChapter || '').trim()
  const chapters = novel?.chapters ?? []
  if (!text || chapters.length === 0) return 0

  for (let i = 0; i < chapters.length; i += 1) {
    const t = String(chapters[i]?.title || '').trim()
    if (!t) continue
    if (text === t || text.includes(t) || t.includes(text)) return i
  }

  let m = text.match(/ភាគទី\s*(\d+)/u)
  if (m) return Math.max(0, parseInt(m[1], 10) - 1)

  m = text.match(/第\s*(\d+)\s*章/u)
  if (m) return Math.max(0, parseInt(m[1], 10) - 1)

  return 0
}

/**
 * @returns {{ pathname: string, state: { from: string, openChapterIndex: number } } | null}
 */
export function buildReadingHistoryNavigateTarget(item) {
  const novelId = resolveNovelIdFromHistoryItem(item)
  if (!novelId) return null
  const novel = getNovelSummaryById(novelId)
  const openChapterIndex = novel
    ? resolveChapterIndexFromHistoryItem(novel, item)
    : Number.isFinite(Number(item?.chapterIndex)) && Number(item.chapterIndex) >= 0
      ? Math.floor(Number(item.chapterIndex))
      : 0
  return {
    pathname: `/read/${encodeURIComponent(novelId)}`,
    state: { from: 'reading-history', openChapterIndex },
  }
}
