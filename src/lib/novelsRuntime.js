import { apiUrl } from './apiBase.js'
import { novels as bundledNovels, getNovelById as getBundledNovelById } from '../data/novels.js'
import { logApiRequestDuration } from './novelLoadPerf.js'

let catalogNovels = null
let catalogPromise = null

/** staleTime: 5 分钟内视为新鲜，直接返回缓存 */
export const NOVEL_STALE_TIME_MS = 5 * 60 * 1000
/** cacheTime: 30 分钟内保留缓存（过期后删除） */
export const NOVEL_CACHE_TIME_MS = 30 * 60 * 1000

/** @type {Map<string, { data: object, fetchedAt: number }>} */
const fullNovelCache = new Map()
/** @type {Map<string, Promise<object|null>>} */
const inflightFull = new Map()

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

function findCatalogNovel(id) {
  const key = String(id || '').trim()
  if (!key) return null
  const list = getCatalogNovelsSync()
  return list.find((n) => String(n.id) === key) ?? null
}

function getCacheEntry(key) {
  const entry = fullNovelCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > NOVEL_CACHE_TIME_MS) {
    fullNovelCache.delete(key)
    return null
  }
  return entry
}

function setCacheEntry(key, data) {
  if (!data || typeof data !== 'object') return
  fullNovelCache.set(key, { data, fetchedAt: Date.now() })
}

export function novelHasFullContent(novel) {
  if (!novel || typeof novel !== 'object') return false
  const chapters = novel.chapters
  if (Array.isArray(chapters) && chapters.length > 0) return true
  const count = Number(novel.chapterCount)
  if (Number.isFinite(count) && count > 0) return false
  return true
}

export function getNovelFullSync(id) {
  const key = String(id || '').trim()
  if (!key) return null
  const cached = getCacheEntry(key)?.data
  if (cached) return cached
  const bundled = getBundledNovelById(key)
  if (bundled) return bundled
  return findCatalogNovel(key)
}

/**
 * @returns {{ novel: object|null, loadStatus: 'loading'|'ready'|'notFound' }}
 */
export function resolveInitialNovel(id) {
  const key = String(id || '').trim()
  if (!key) return { novel: null, loadStatus: 'notFound' }

  const cached = getNovelFullSync(key)
  if (cached && novelHasFullContent(cached)) {
    return { novel: cached, loadStatus: 'ready' }
  }
  if (cached) {
    return { novel: cached, loadStatus: 'loading' }
  }
  return { novel: null, loadStatus: 'loading' }
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
  inflightFull.clear()
}

export function prefetchNovelFull(id) {
  return fetchNovelFull(id)
}

export async function fetchNovelFull(id, options = {}) {
  const key = String(id || '').trim()
  if (!key) return null

  const { force = false, background = false } = options
  const cachedEntry = getCacheEntry(key)

  if (cachedEntry && !force) {
    const age = Date.now() - cachedEntry.fetchedAt
    if (age <= NOVEL_STALE_TIME_MS) {
      logApiRequestDuration(key, 0, 'cache-fresh')
      return cachedEntry.data
    }
    if (age <= NOVEL_CACHE_TIME_MS) {
      logApiRequestDuration(key, 0, 'cache-stale')
      if (!inflightFull.has(key)) {
        void fetchNovelFull(key, { force: true, background: true })
      }
      return cachedEntry.data
    }
  }

  if (inflightFull.has(key)) return inflightFull.get(key)

  const startedAt = performance.now()
  const promise = (async () => {
    try {
      const res = await fetch(apiUrl(`/api/novels/${encodeURIComponent(key)}`), {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.novel) {
          setCacheEntry(key, data.novel)
          logApiRequestDuration(key, performance.now() - startedAt, background ? 'network-bg' : 'network')
          return data.novel
        }
      }
    } catch {
      // fall through
    }

    const fallback = getBundledNovelById(key)
    if (fallback) {
      setCacheEntry(key, fallback)
      logApiRequestDuration(key, performance.now() - startedAt, 'bundled-fallback')
      return fallback
    }

    if (cachedEntry && Date.now() - cachedEntry.fetchedAt <= NOVEL_CACHE_TIME_MS) {
      return cachedEntry.data
    }

    logApiRequestDuration(key, performance.now() - startedAt, 'miss')
    return null
  })().finally(() => {
    inflightFull.delete(key)
  })

  inflightFull.set(key, promise)
  return promise
}

export function chapterRequiresVip(chapter, chapterIndex) {
  if (chapter?.isVip === true) return true
  if (chapter?.isVip === false) return false
  return Number(chapterIndex) > 0
}
