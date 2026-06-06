/**
 * 详情页观看/点赞/收藏与首页卡片对齐：持久化 + 自定义事件，避免首页仅依赖 15s 轮询且与详情状态脱节。
 */

import {
  getCachedHomeFavoriteCounts,
  getCachedHomeLikeCounts,
  getCachedHomeStats,
} from './homeStatsCache.js'
import {
  getSeedFavoriteCount,
  getSeedLikeCount,
  getSeedViewCount,
  mergeDisplayedInteractionCount,
  mergeDisplayedViewCount,
} from './novelSeedStats.js'
import { getLocalViewMax } from './novelViewCountLocal.js'

export const NOVEL_DETAIL_STATS_EVENT = 'tg-novel-detail-stats'

const STORAGE_KEY = 'tg-novel-detail-stats-v1'

/**
 * 进入详情页首帧即用缓存/种子展示统计，避免先显示 0 再跳回。
 * @param {object|null|undefined} novel
 */
export function resolveInitialDetailDisplayStats(novel) {
  const empty = { viewCount: 0, likeCount: 0, favoriteCount: 0, ratingPoints: 0 }
  if (!novel?.id) return empty
  const id = String(novel.id)
  const snap = loadPersistedDetailStats()[id]
  const home = getCachedHomeStats()[id] ?? {}
  const cachedLikes = getCachedHomeLikeCounts()[id]
  const cachedFavs = getCachedHomeFavoriteCounts()[id]
  const seedV = getSeedViewCount(novel)
  const seedL = getSeedLikeCount(novel)
  const seedF = getSeedFavoriteCount(novel)
  const localView = getLocalViewMax(id)

  const viewCount = Math.max(
    localView,
    mergeDisplayedViewCount(
      seedV,
      Math.max(Number(snap?.viewCount) || 0, Number(home.viewCount) || 0),
    ),
  )
  const likeCount = mergeDisplayedInteractionCount(
    seedL,
    Math.max(Number(snap?.likeCount) || 0, Number(cachedLikes) || 0, Number(home.likeCount) || 0),
  )
  const favoriteCount = mergeDisplayedInteractionCount(
    seedF,
    Math.max(Number(snap?.favoriteCount) || 0, Number(cachedFavs) || 0, Number(home.favoriteCount) || 0),
  )
  const ratingPoints = Math.max(0, Math.floor(Number(home.ratingPoints) || 0))
  return { viewCount, likeCount, favoriteCount, ratingPoints }
}

export function loadPersistedDetailStats() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const o = raw ? JSON.parse(raw) : {}
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function persistDetailStatsMap(map) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota / privacy mode */
  }
}

/**
 * @param {string|number} novelId
 * @param {{ viewCount: number, likeCount: number, favoriteCount: number }} stats
 */
export function persistAndBroadcastDetailStats(novelId, stats) {
  const id = String(novelId || '').trim()
  if (!id) return
  const row = {
    viewCount: Math.max(0, Math.floor(Number(stats?.viewCount) || 0)),
    likeCount: Math.max(0, Math.floor(Number(stats?.likeCount) || 0)),
    favoriteCount: Math.max(0, Math.floor(Number(stats?.favoriteCount) || 0)),
  }
  try {
    const prev = loadPersistedDetailStats()
    prev[id] = row
    persistDetailStatsMap(prev)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(NOVEL_DETAIL_STATS_EVENT, {
      detail: { novelId: id, ...row },
    }),
  )
}
