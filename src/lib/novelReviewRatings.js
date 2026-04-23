import { normalizeStoredMemberTier } from './memberTier.js'

const STORAGE_KEY = 'tg_novel_review_ratings_v2'
const REPLY_STORAGE_KEY = 'tg_novel_reply_threads_v1'

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw)
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}

/**
 * 为旧评论补齐缺失的 memberTier（一次性快照化），避免后续随账号身份变化。
 * @param {string|number} novelId
 * @param {(item: any) => ''|'normal'|'gold'|'vip'|'vip_gold'} resolveTier
 * @returns {boolean} 是否发生写入
 */
export function snapshotMissingReviewMemberTiers(novelId, resolveTier) {
  const id = String(novelId)
  const all = loadAll()
  const row = all[id]
  const items = row?.items
  if (!Array.isArray(items) || items.length === 0) return false
  let changed = false
  const nextItems = items.map((it) => {
    const stored = normalizeStoredMemberTier(it?.memberTier)
    if (stored) return it
    const tier = normalizeStoredMemberTier(resolveTier(it))
    if (!tier) return it
    changed = true
    return { ...it, memberTier: tier }
  })
  if (!changed) return false
  all[id] = { ...(row ?? {}), items: nextItems }
  saveAll(all)
  return true
}

function loadAllReplies() {
  try {
    const raw = localStorage.getItem(REPLY_STORAGE_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw)
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function countRepliesForNovel(novelId) {
  const byNovel = loadAllReplies()[String(novelId)]
  if (!byNovel || typeof byNovel !== 'object') return 0
  return Object.values(byNovel).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0,
  )
}

function clampScore(s) {
  const n = Number(s)
  if (!Number.isFinite(n)) return 0
  return Math.min(10, Math.max(0, n))
}

function normalizeAt(value, fallbackAt) {
  const n = Number(value)
  if (Number.isFinite(n) && n > 0) return n
  return fallbackAt
}

/** @returns {{ score: number, text: string, at: number }[]} */
export function getNovelReviewItems(novelId) {
  const id = String(novelId)
  const row = loadAll()[id]
  const items = row?.items
  if (!Array.isArray(items)) return []
  const now = Date.now()
  return items.map((it, idx) => {
    const baseAt = now - Math.max(0, items.length - idx) * 1000
    const at = normalizeAt(it?.at ?? it?.createdAt ?? it?.time, baseAt)
    const rid = String(it?.id ?? `rv-${id}-${at}-${idx}`)
    return { ...it, id: rid, at }
  })
}

/** 评论积分：**每条评论记 1 分**（与单条 `score` 数值无关，只数条数）。 */
export function getReviewCommentPoints(novelId) {
  const total = getNovelReviewItems(novelId).length + countRepliesForNovel(novelId)
  return Math.min(100, total)
}

/** 评论人数：用于展示真实人数（不封顶）。 */
export function getReviewCommentCount(novelId) {
  return getNovelReviewItems(novelId).length + countRepliesForNovel(novelId)
}

/**
 * 卡片与排序用：返回**评论条数**（积分）。`seedRating` 保留参数以兼容旧调用，已不再参与计算。
 */
export function getReviewAggregatedRating(novelId, _seedRating = 0) {
  return getReviewCommentPoints(novelId)
}

/** 是否已有至少一条评论 */
export function hasUserReviewScores(novelId) {
  return getNovelReviewItems(novelId).length > 0
}

/**
 * @param {{ score: number, text?: string }} entry score 建议 1–10（与星级一致）
 */
export function appendNovelReviewEntry(novelId, entry) {
  const id = String(novelId)
  const score = clampScore(entry.score)
  if (score <= 0) return
  const text = String(entry.text ?? '').trim().slice(0, 500)
  const now = Date.now()
  const all = loadAll()
  const cur = all[id] ?? { items: [] }
  const items = [...(cur.items ?? [])]
  const storedTier = normalizeStoredMemberTier(entry.memberTier)
  items.push({
    id: `rv-${id}-${now}-${Math.floor(Math.random() * 100000)}`,
    score,
    text,
    at: now,
    userName: String(entry.userName ?? '').trim() || 'A',
    userAvatar: entry.userAvatar ?? null,
    userId: Number.isFinite(Number(entry.userId)) ? Number(entry.userId) : undefined,
    memberTier: storedTier || undefined,
  })
  all[id] = { items }
  saveAll(all)
  window.dispatchEvent(new CustomEvent('tg-novel-ratings-changed'))
}
