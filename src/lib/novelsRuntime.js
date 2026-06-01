import { apiUrl } from './apiBase.js'
import { novels as bundledNovels, getNovelById as getBundledNovelById } from '../data/novels.js'

let catalogNovels = null
let catalogPromise = null
const fullNovelCache = new Map()

function mapCatalogToHomeNovel(entry) {
  const bundled = getBundledNovelById(entry?.id)
  return {
    ...(bundled && typeof bundled === 'object' ? bundled : {}),
    ...entry,
    synopsis: entry.synopsisPreview || entry.synopsis || bundled?.synopsis || '',
    chapters: [],
    viewsWan: entry.viewsWan ?? bundled?.viewsWan,
    favoritesK: entry.favoritesK ?? bundled?.favoritesK,
    likeCount: entry.likeCount ?? bundled?.likeCount,
    viewCount: entry.viewCount ?? bundled?.viewCount,
    favoriteCount: entry.favoriteCount ?? bundled?.favoriteCount,
    listThemes: entry.listThemes ?? bundled?.listThemes,
    lastChapterMinutesAgo: entry.lastChapterMinutesAgo ?? bundled?.lastChapterMinutesAgo,
    updatedAtMs: entry.updatedAtMs ?? bundled?.updatedAtMs,
    wordCountWan: entry.wordCountWan ?? bundled?.wordCountWan,
  }
}

export async function loadCatalogNovels() {
  if (catalogNovels) return catalogNovels
  if (catalogPromise) return catalogPromise

  catalogPromise = (async () => {
    try {
      const res = await fetch(apiUrl('/api/novels-catalog'), { cache: 'no-store' })
      if (!res.ok) throw new Error(`catalog ${res.status}`)
      const data = await res.json()
      const list = Array.isArray(data?.novels) ? data.novels : []
      if (list.length) {
        catalogNovels = list.map(mapCatalogToHomeNovel)
        return catalogNovels
      }
    } catch {
      // fall through
    }
    catalogNovels = bundledNovels
    return catalogNovels
  })()

  return catalogPromise
}

export function getCatalogNovelsSync() {
  return catalogNovels || bundledNovels
}

export function invalidateNovelsRuntimeCache() {
  catalogNovels = null
  catalogPromise = null
  fullNovelCache.clear()
}

export async function fetchNovelFull(id) {
  const key = String(id || '').trim()
  if (!key) return null
  if (fullNovelCache.has(key)) return fullNovelCache.get(key)

  try {
    const res = await fetch(apiUrl(`/api/novels/${encodeURIComponent(key)}`), {
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.novel) {
        fullNovelCache.set(key, data.novel)
        return data.novel
      }
    }
  } catch {
    // fall through
  }

  const fallback = getBundledNovelById(key)
  if (fallback) fullNovelCache.set(key, fallback)
  return fallback || null
}

export function chapterRequiresVip(chapter, chapterIndex) {
  if (chapter?.isVip === true) return true
  if (chapter?.isVip === false) return false
  return Number(chapterIndex) > 0
}
