import { getNovelMeatCharCount } from './novelDisplay.js'

function num(n, fallback = 0) {
  const v = Number(n)
  return Number.isFinite(v) ? v : fallback
}

/**
 * 「更新」排序用：与卡片「最新：第×章 …（N 分钟/天前）」一致，**不是**上架日。
 * 优先 `lastChapterMinutesAgo` 推算为伪时间戳（距现在越近 → 数值越大，越靠前在 ﹀ 序）；
 * 无该字段时再用 `updatedAtMs`（纯 API 时间戳场景）。
 */
function getLastContentUpdateMs(n, nowMs = Date.now()) {
  const serverUpdatedAt = num(n.cardUpdatedAtMs, 0)
  if (serverUpdatedAt > 0) return serverUpdatedAt
  const mins = Number(n.lastChapterMinutesAgo)
  if (Number.isFinite(mins) && mins >= 0) {
    return nowMs - mins * 60_000
  }
  const u = num(n.updatedAtMs, 0)
  if (u > 0) return u
  return Number(n.id) * 1e10
}

/**
 * 按顶栏排序（演示字段在 novels 上；接 API 后替换字段来源即可）
 *
 * 与 UI 对应：`sortDesc === true` 为 ﹀（ChevronDown），`false` 为 ︿（ChevronUp）。
 *
 * - 更新 ﹀：按**距最新一章多久**（与列表「X 分钟/天前」同源），新 → 旧；更新 ︿：旧 → 新。
 * - 观看 ﹀：阅读多到少（viewsWan 降序）；观看 ︿：少到多（升序）。
 * - 收藏 ﹀：收藏多到少（favoritesK 降序）；收藏 ︿：少到多（升序）。
 * - 评分 ﹀：评论积分高到低（每条评论 1 分，见 getReviewAggregatedRating）；评分 ︿：低到高（升序）。
 * - 肉量 ﹀：字符多到少（正文等字符总数）；肉量 ︿：少到多。有 totalChars 时优先用该字段。
 */
/** @param {string | null | undefined} sortKey 为 null/undefined 时按「更新」字段排序（与首项默认一致） */
export function sortNovelsForHome(list, sortKey, sortDesc) {
  /** true：﹀，指标从大到小 / 时间从新到旧；false：︿，反过来 */
  const dir = sortDesc ? -1 : 1

  const getters = {
    update: (n) => getLastContentUpdateMs(n),
    views: (n) => num(n.cardViewCount),
    favorites: (n) => num(n.cardFavoriteCount),
    rating: (n) => num(n.cardRatingPoints),
    meat: (n) => getNovelMeatCharCount(n),
  }

  const get = getters[sortKey] ?? getters.update
  const arr = [...list]
  arr.sort((a, b) => {
    const va = get(a)
    const vb = get(b)
    if (va !== vb) return dir * (va - vb)
    return Number(a.id) - Number(b.id)
  })
  return arr
}

/**
 * 对当前结果集（全部卡片）仅按顶栏选项排序；不再单独置顶「新书区」、不做 12 小时轮换。
 */
export function buildHomeOrderedNovels(list, sortKey, sortDesc) {
  if (!list?.length) return []
  return sortNovelsForHome(list, sortKey, sortDesc)
}
