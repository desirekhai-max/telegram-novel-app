/**
 * 首页卡片 / 列表对外目录载荷（不含章节正文，便于后台管理与接口传输）。
 * 阅读页全文仍由完整 novel（含 chapters）提供，可后续用 `GET /api/novels/:id` 等扩展。
 *
 * @typedef {object} NovelCatalogEntry
 * @property {string} id
 * @property {string} title
 * @property {string} author
 * @property {string} synopsisPreview 简介摘要（列表展示用）
 * @property {string} [accent]
 * @property {string} [genreId]
 * @property {string} [status]
 * @property {number} [wordCountWan]
 * @property {string} [source]
 * @property {string[]} [tags]
 * @property {string} [coverUrl]
 * @property {number} [updatedAtMs]
 * @property {number} [viewsWan]
 * @property {number} [favoritesK]
 * @property {number} [likeCount]
 * @property {number} [rating]
 * @property {number} [shelvedAtMs]
 * @property {string[]} [listThemes]
 * @property {number} [lastChapterMinutesAgo]
 * @property {number} [meatPercent]
 * @property {string} [meatCategory]
 * @property {number} chapterCount 章节数（无正文导出）
 */

const SYNOPSIS_PREVIEW_MAX = 320

/**
 * @param {unknown} novel
 * @returns {NovelCatalogEntry}
 */
export function stripNovelForCatalog(novel) {
  if (!novel || typeof novel !== 'object') {
    return {
      id: '',
      title: '',
      author: '',
      synopsisPreview: '',
      chapterCount: 0,
    }
  }
  const ch = Array.isArray(novel.chapters) ? novel.chapters : []
  const synopsis = typeof novel.synopsis === 'string' ? novel.synopsis : ''
  const preview =
    synopsis.length > SYNOPSIS_PREVIEW_MAX
      ? `${synopsis.slice(0, SYNOPSIS_PREVIEW_MAX - 1)}…`
      : synopsis

  return {
    id: String(novel.id ?? ''),
    title: String(novel.title ?? ''),
    author: String(novel.author ?? ''),
    synopsisPreview: preview,
    accent: novel.accent != null ? String(novel.accent) : undefined,
    genreId: novel.genreId != null ? String(novel.genreId) : undefined,
    status: novel.status != null ? String(novel.status) : undefined,
    wordCountWan: Number.isFinite(Number(novel.wordCountWan)) ? Number(novel.wordCountWan) : undefined,
    source: novel.source != null ? String(novel.source) : undefined,
    tags: Array.isArray(novel.tags) ? novel.tags.map((t) => String(t)) : undefined,
    coverUrl: novel.coverUrl != null ? String(novel.coverUrl) : undefined,
    updatedAtMs: Number.isFinite(Number(novel.updatedAtMs)) ? Number(novel.updatedAtMs) : undefined,
    viewsWan: Number.isFinite(Number(novel.viewsWan)) ? Number(novel.viewsWan) : undefined,
    favoritesK: Number.isFinite(Number(novel.favoritesK)) ? Number(novel.favoritesK) : undefined,
    likeCount: Number.isFinite(Number(novel.likeCount)) ? Number(novel.likeCount) : undefined,
    rating: Number.isFinite(Number(novel.rating)) ? Number(novel.rating) : undefined,
    shelvedAtMs: Number.isFinite(Number(novel.shelvedAtMs)) ? Number(novel.shelvedAtMs) : undefined,
    listThemes: Array.isArray(novel.listThemes) ? novel.listThemes.map((t) => String(t)) : undefined,
    lastChapterMinutesAgo: Number.isFinite(Number(novel.lastChapterMinutesAgo))
      ? Number(novel.lastChapterMinutesAgo)
      : undefined,
    meatPercent: Number.isFinite(Number(novel.meatPercent)) ? Number(novel.meatPercent) : undefined,
    meatCategory: novel.meatCategory != null ? String(novel.meatCategory) : undefined,
    chapterCount: ch.length,
  }
}

/**
 * @param {unknown[]} list
 * @returns {{ version: number, novels: NovelCatalogEntry[] }}
 */
export function buildNovelsCatalogPayload(list) {
  const novels = Array.isArray(list) ? list.map((n) => stripNovelForCatalog(n)) : []
  return {
    version: 1,
    novels,
  }
}
