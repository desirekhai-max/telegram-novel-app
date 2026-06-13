import { apiUrl } from './apiBase.js'
import { novels as bundledNovels, getNovelById as getBundledNovelById } from '../data/novels.js'
import { logApiRequestDuration } from './novelLoadPerf.js'

let catalogNovels = null
let catalogPromise = null
/** API 目录已成功拉取（含空列表）时为 true；仅网络失败时才回退内置演示书 */
let catalogLoadedFromApi = false

/** staleTime: 5 分钟内视为新鲜，直接返回缓存 */
export const NOVEL_STALE_TIME_MS = 5 * 60 * 1000
/** cacheTime: 30 分钟内保留缓存（过期后删除） */
export const NOVEL_CACHE_TIME_MS = 30 * 60 * 1000

/** @type {Map<string, { data: object, fetchedAt: number }>} */
const fullNovelCache = new Map()
/** @type {Map<string, Promise<object|null>>} */
const inflightFull = new Map()

function mapCatalogToHomeNovel(entry) {
  return {
    ...entry,
    synopsis: entry.synopsisPreview || entry.synopsis || '',
    chapters: [],
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

export async function loadCatalogNovels(options = {}) {
  const force = Boolean(options?.force)
  if (force) {
    catalogNovels = null
    catalogPromise = null
    catalogLoadedFromApi = false
  }
  if (catalogNovels && !force) return catalogNovels
  if (catalogPromise && !force) return catalogPromise

  catalogPromise = (async () => {
    try {
      const res = await fetch(apiUrl('/api/novels-catalog'), { cache: 'no-store' })
      if (!res.ok) throw new Error(`catalog ${res.status}`)
      const data = await res.json()
      const list = Array.isArray(data?.novels) ? data.novels : []
      catalogLoadedFromApi = true
      catalogNovels = list.map(mapCatalogToHomeNovel)
      return catalogNovels
    } catch {
      catalogLoadedFromApi = false
      catalogNovels = import.meta.env.DEV ? bundledNovels : []
      return catalogNovels
    }
  })()

  return catalogPromise
}

/** 账户阅读历史等场景：强制拉最新目录，避免删书后仍用内存缓存 */
export async function refreshCatalogNovels() {
  return loadCatalogNovels({ force: true })
}

export function getCatalogNovelsSync() {
  if (catalogLoadedFromApi) return catalogNovels ?? []
  if (catalogNovels) return catalogNovels
  return import.meta.env.DEV ? bundledNovels : []
}

export function isCatalogLoadedFromApi() {
  return catalogLoadedFromApi
}

/** 账户页收藏/阅读历史：仅认后台目录中的书，不含内置演示兜底 */
export function isNovelListedInCatalog(id) {
  if (!catalogLoadedFromApi) return false
  const key = String(id || '').trim()
  if (!key) return false
  return (catalogNovels || []).some((n) => String(n?.id) === key)
}

export function getListedNovelSummaryById(id) {
  const key = String(id || '').trim()
  if (!key || !isNovelListedInCatalog(key)) return null
  return (catalogNovels || []).find((n) => String(n?.id) === key) ?? null
}

/** 阅读记录：优先 novelId，否则按书名匹配仍在架的书 */
export function resolveListedNovelIdFromHistoryItem(item) {
  const nid = String(item?.novelId || '').trim()
  if (nid && isNovelListedInCatalog(nid)) return nid
  if (!catalogLoadedFromApi) return ''
  const title = String(item?.shelfTitle || '').trim()
  if (!title) return ''
  const hit = (catalogNovels || []).find((n) => String(n?.title || '').trim() === title)
  return hit?.id ? String(hit.id) : ''
}

/** 列表/收藏/阅读历史用：目录 + 缓存 + 内置书，按 id 解析摘要（可无 chapters 正文） */
export function getNovelSummaryById(id) {
  const key = String(id || '').trim()
  if (!key) return null
  const full = getNovelFullSync(key)
  if (full) return full
  const fromCatalog = findCatalogNovel(key)
  if (fromCatalog) return fromCatalog
  return getBundledNovelById(key) ?? null
}

export function invalidateNovelsRuntimeCache() {
  catalogNovels = null
  catalogPromise = null
  catalogLoadedFromApi = false
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

/** 章节是否需 VIP：完全由后台 `chapter.isVip` 决定；未标注时视为免费。 */
export function chapterRequiresVip(chapter) {
  return chapter?.isVip === true
}
