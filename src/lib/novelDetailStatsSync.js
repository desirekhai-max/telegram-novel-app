/**
 * 详情页观看/点赞/收藏与首页卡片对齐：持久化 + 自定义事件，避免首页仅依赖 15s 轮询且与详情状态脱节。
 */

export const NOVEL_DETAIL_STATS_EVENT = 'tg-novel-detail-stats'

const STORAGE_KEY = 'tg-novel-detail-stats-v1'

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
