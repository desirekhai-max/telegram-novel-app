/**
 * 书本内置的演示/兜底计数（与 novels.js 注释一致），与服务端持久化统计合并展示。
 * 服务端若暂无记录或曾用错误基数初始化，首页/详情仍不低于书本配置。
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
 * @param {number} seed
 * @param {unknown} serverVal
 */
export function mergeDisplayedCount(seed, serverVal) {
  const s = Number.isFinite(Number(seed)) && Number(seed) >= 0 ? Math.floor(Number(seed)) : 0
  const v = Number.isFinite(Number(serverVal)) && Number(serverVal) >= 0 ? Math.floor(Number(serverVal)) : 0
  return Math.max(s, v)
}
