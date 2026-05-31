/**
 * 书本内置的演示/兜底计数（与 novels.js 注释一致），与服务端持久化统计合并展示。
 * - 浏览量：服务端存绝对总数，展示 = max(种子, 服务端总数)
 * - 点赞/收藏：服务端存真实互动人数（增量），展示 = 种子 + 服务端增量
 */

/** @param {object|null|undefined} novel */
export function getSeedViewCount(novel) {
  if (!novel || typeof novel !== 'object') return 0
  const explicit = Number(novel.viewCount)
  if (Number.isFinite(explicit) && explicit >= 0) return Math.floor(explicit)
  const wan = Number(novel.viewsWan)
  if (Number.isFinite(wan) && wan >= 0) return Math.max(0, Math.round(wan * 10000))
  return 0
}

/** @param {object|null|undefined} novel */
export function getSeedLikeCount(novel) {
  if (!novel || typeof novel !== 'object') return 0
  const v = Number(novel.likeCount)
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
}

/** @param {object|null|undefined} novel */
export function getSeedFavoriteCount(novel) {
  if (!novel || typeof novel !== 'object') return 0
  const explicit = Number(novel.favoriteCount)
  if (Number.isFinite(explicit) && explicit >= 0) return Math.floor(explicit)
  const k = Number(novel.favoritesK)
  if (Number.isFinite(k) && k >= 0) return Math.max(0, Math.round(k * 1000))
  return 0
}

/**
 * 浏览量：服务端为绝对总数，展示不低于书本种子。
 * @param {number} seed
 * @param {unknown} serverTotal
 */
export function mergeDisplayedViewCount(seed, serverTotal) {
  const s = Number.isFinite(Number(seed)) && Number(seed) >= 0 ? Math.floor(Number(seed)) : 0
  const v = Number.isFinite(Number(serverTotal)) && Number(serverTotal) >= 0 ? Math.floor(Number(serverTotal)) : 0
  return Math.max(s, v)
}

/**
 * 点赞/收藏：服务端为真实互动增量，展示 = 种子 + 增量。
 * @param {number} seed
 * @param {unknown} serverDelta
 */
export function mergeDisplayedInteractionCount(seed, serverDelta) {
  const s = Number.isFinite(Number(seed)) && Number(seed) >= 0 ? Math.floor(Number(seed)) : 0
  const d = Number.isFinite(Number(serverDelta)) && Number(serverDelta) >= 0 ? Math.floor(Number(serverDelta)) : 0
  return s + d
}

/** @deprecated 使用 mergeDisplayedViewCount 或 mergeDisplayedInteractionCount */
export function mergeDisplayedCount(seed, serverVal) {
  return mergeDisplayedViewCount(seed, serverVal)
}
