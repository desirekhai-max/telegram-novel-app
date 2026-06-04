/**
 * 首页卡片统计缓存：避免 VIP/账户 ↔ 首页切换时 HomePage 重挂载导致评分/互动数先归零再跳回。
 */

const STORAGE_KEY = 'tg-home-stats-cache-v1'

/** @type {Record<string, object>} */
let memoryStats = {}

/** @type {Record<string, number>} */
let memoryLikeCounts = {}

/** @type {Record<string, number>} */
let memoryFavoriteCounts = {}

/** @type {{ sortKey: string | null, sortDesc: boolean, ids: string[] }} */
let memoryListOrder = { sortKey: null, sortDesc: true, ids: [] }

function readStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const o = raw ? JSON.parse(raw) : null
    if (!o || typeof o !== 'object') return
    if (o.stats && typeof o.stats === 'object') memoryStats = o.stats
    if (o.likes && typeof o.likes === 'object') memoryLikeCounts = o.likes
    if (o.favorites && typeof o.favorites === 'object') memoryFavoriteCounts = o.favorites
    if (o.listOrder && typeof o.listOrder === 'object') {
      memoryListOrder = {
        sortKey: o.listOrder.sortKey ?? null,
        sortDesc: Boolean(o.listOrder.sortDesc),
        ids: Array.isArray(o.listOrder.ids) ? o.listOrder.ids.map(String) : [],
      }
    }
  } catch {
    /* ignore */
  }
}

function writeStorage() {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stats: memoryStats,
        likes: memoryLikeCounts,
        favorites: memoryFavoriteCounts,
        listOrder: memoryListOrder,
      }),
    )
  } catch {
    /* ignore */
  }
}

readStorage()

export function getCachedHomeStats() {
  return memoryStats
}

export function getCachedHomeLikeCounts() {
  return memoryLikeCounts
}

export function getCachedHomeFavoriteCounts() {
  return memoryFavoriteCounts
}

/** @param {Record<string, object>} items */
export function commitHomeStats(items) {
  if (!items || typeof items !== 'object' || Object.keys(items).length === 0) return
  memoryStats = items
  writeStorage()
}

/** @param {Record<string, number>} map */
export function commitHomeLikeCounts(map) {
  if (!map || typeof map !== 'object' || Object.keys(map).length === 0) return
  memoryLikeCounts = map
  writeStorage()
}

/** @param {Record<string, number>} map */
export function commitHomeFavoriteCounts(map) {
  if (!map || typeof map !== 'object' || Object.keys(map).length === 0) return
  memoryFavoriteCounts = map
  writeStorage()
}

function normalizeSortKey(sortKey) {
  return sortKey ?? null
}

/** @param {string | null | undefined} sortKey @param {boolean} sortDesc @param {string[]} ids */
function commitHomeListOrder(sortKey, sortDesc, ids) {
  if (!ids.length) return
  memoryListOrder = {
    sortKey: normalizeSortKey(sortKey),
    sortDesc: Boolean(sortDesc),
    ids: [...ids],
  }
  writeStorage()
}

/**
 * 同排序条件下保持卡片顺序，避免 tab 切回首页时第 2 张起短暂错位。
 * @template {{ id: string | number }} T
 * @param {T[]} ordered
 * @param {string | null | undefined} sortKey
 * @param {boolean} sortDesc
 * @returns {T[]}
 */
export function applyStableHomeListOrder(ordered, sortKey, sortDesc) {
  if (!ordered?.length) return []
  const key = normalizeSortKey(sortKey)
  const desc = Boolean(sortDesc)
  const cached = memoryListOrder

  if (cached.ids.length && cached.sortKey === key && cached.sortDesc === desc) {
    const byId = new Map(ordered.map((n) => [String(n.id), n]))
    const next = []
    for (const id of cached.ids) {
      const row = byId.get(id)
      if (row) {
        next.push(row)
        byId.delete(id)
      }
    }
    for (const row of byId.values()) next.push(row)
    commitHomeListOrder(key, desc, next.map((n) => String(n.id)))
    return next
  }

  commitHomeListOrder(
    key,
    desc,
    ordered.map((n) => String(n.id)),
  )
  return ordered
}
