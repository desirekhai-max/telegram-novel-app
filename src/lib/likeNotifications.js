/** 评论点赞通知：从服务端 likeUsers / 投票数据推导，不单独存 notification 表 */

import { isCommentOwnedByViewer, normalizeTelegramUserId } from './replyNotifications.js'

/**
 * @param {unknown} a
 * @param {unknown} b
 */
export function isSameTelegramUser(a, b) {
  const na = normalizeTelegramUserId(a)
  const nb = normalizeTelegramUserId(b)
  if (na != null && nb != null) return na === nb
  const sa = String(a || '').trim()
  const sb = String(b || '').trim()
  if (!sa || !sb) return false
  if (sa === sb) return true
  const ma = sa.match(/^tg_(\d+)$/i)
  const mb = sb.match(/^tg_(\d+)$/i)
  if (ma && mb) return ma[1] === mb[1]
  if (ma && /^\d+$/.test(sb)) return ma[1] === sb
  if (mb && /^\d+$/.test(sa)) return mb[1] === sa
  return false
}

/**
 * @param {string} novelId
 * @param {string} commentId
 * @param {string} likerUserId
 */
export function buildLikeNotificationId(novelId, commentId, likerUserId) {
  const likerKey = String(likerUserId || '').trim()
  const likerNorm = normalizeTelegramUserId(likerKey)
  const likerPart = likerNorm != null ? `tg_${likerNorm}` : likerKey
  return `like-${String(novelId || '').trim()}-${String(commentId || '').trim()}-${likerPart}`
}

/**
 * 兼容旧版已读 key（纯数字 / 原始 liker 字符串 / 无 tg_ 前缀）。
 * @param {string} novelId
 * @param {string} commentId
 * @param {string} likerUserId
 */
export function likeNotificationReadAliases(novelId, commentId, likerUserId) {
  const novelPart = String(novelId || '').trim()
  const commentPart = String(commentId || '').trim()
  const likerKey = String(likerUserId || '').trim()
  const out = new Set([buildLikeNotificationId(novelId, commentId, likerUserId)])
  if (likerKey) out.add(`like-${novelPart}-${commentPart}-${likerKey}`)
  const norm = normalizeTelegramUserId(likerKey)
  if (norm != null) {
    out.add(`like-${novelPart}-${commentPart}-${norm}`)
    out.add(`like-${novelPart}-${commentPart}-tg_${norm}`)
  }
  return [...out]
}

/**
 * 兼容旧版 API：仅有 latestLike* 字段时仍生成一条点赞通知。
 * @param {object} row
 * @returns {object[]}
 */
export function resolveLikeUsersFromReviewRow(row) {
  const fromApi = Array.isArray(row?.likeUsers) ? row.likeUsers : []
  if (fromApi.length > 0) {
    return fromApi
      .map((lu) => ({
        userId: String(lu?.userId || '').trim(),
        name: String(lu?.name || '').trim(),
        avatar: String(lu?.avatar || '').trim(),
        at: Number(lu?.at || 0),
      }))
      .filter((lu) => lu.userId)
  }

  const latestId = String(row?.latestLikeUserId || '').trim()
  if (!latestId) return []

  return [
    {
      userId: latestId,
      name: String(row?.latestLikeUserName || '').trim(),
      avatar: String(row?.latestLikeUserAvatar || '').trim(),
      at: Number(row?.latestLikeAt || row?.at || 0),
    },
  ]
}

/**
 * @param {object[]} reviewRows
 * @param {object[]} replyRows
 */
export function buildProfileByTelegramId(reviewRows, replyRows) {
  /** @type {Map<string, { name: string, avatar: string }>} */
  const map = new Map()
  const push = (rawId, nameRaw, avatarRaw) => {
    const id = normalizeTelegramUserId(rawId)
    if (id == null) return
    const name = String(nameRaw || '').trim()
    const avatar = String(avatarRaw || '').trim()
    for (const key of [String(id), `tg_${id}`]) {
      const prev = map.get(key) || { name: '', avatar: '' }
      map.set(key, {
        name: name || prev.name,
        avatar: avatar || prev.avatar,
      })
    }
  }
  for (const r of reviewRows || []) {
    push(r?.userId, r?.userName || r?.name, r?.userAvatar || r?.avatar)
  }
  for (const rp of replyRows || []) {
    push(rp?.userId, rp?.userName || rp?.name, rp?.userAvatar || rp?.avatar)
  }
  return map
}

/**
 * @param {string} likerIdRaw
 * @param {Map<string, { name: string, avatar: string }>} profileByUserId
 * @param {object} likeUserRow
 */
function resolveLikerDisplay(likerIdRaw, profileByUserId, likeUserRow) {
  const likerId = String(likerIdRaw || '').trim()
  const fromLike = String(likeUserRow?.name || '').trim()
  const fromLikeAvatar = String(likeUserRow?.avatar || '').trim()
  if (!likerId) {
    return { actorName: 'មិត្តអ្នកអាន', actorAvatar: '' }
  }

  const id = normalizeTelegramUserId(likerId)
  const profile =
    (id != null ? profileByUserId.get(String(id)) || profileByUserId.get(`tg_${id}`) : null) ||
    profileByUserId.get(likerId) ||
    null

  const actorName =
    fromLike ||
    String(profile?.name || '').trim() ||
    (likerId.startsWith('tg_') ? likerId.slice(3) : likerId)
  const actorAvatar = fromLikeAvatar || String(profile?.avatar || '').trim()

  return { actorName, actorAvatar }
}

/**
 * @param {string} novelId
 * @param {object} novel
 * @param {object[]} reviewRows
 * @param {object[]} replyRows
 * @param {{ viewerId: number, viewerNames: Set<string> }} ctx
 */
export function collectLikeNotificationsForNovel(novelId, novel, reviewRows, replyRows, ctx) {
  const novelTitle = String(novel?.title || '').trim()
  const coverUrl = String(novel?.coverUrl || '').trim()
  const profileByUserId = buildProfileByTelegramId(reviewRows, replyRows)
  const out = []

  for (const row of reviewRows || []) {
    if (!isCommentOwnedByViewer(row, ctx.viewerId, ctx.viewerNames)) continue

    const commentId = String(row?.id || '').trim()
    if (!commentId) continue

    const commentText = String(row?.text || '').trim()
    const seenLikers = new Set()

    for (const lu of resolveLikeUsersFromReviewRow(row)) {
      const likerUserId = String(lu?.userId || '').trim()
      if (!likerUserId) continue
      if (isSameTelegramUser(likerUserId, ctx.viewerId)) continue

      const dedupeKey = normalizeTelegramUserId(likerUserId) ?? likerUserId
      if (seenLikers.has(dedupeKey)) continue
      seenLikers.add(dedupeKey)

      const { actorName, actorAvatar } = resolveLikerDisplay(likerUserId, profileByUserId, lu)
      out.push({
        id: buildLikeNotificationId(novelId, commentId, likerUserId),
        readAliases: likeNotificationReadAliases(novelId, commentId, likerUserId),
        type: 'like',
        novelId,
        novelTitle,
        commentId,
        replyId: '',
        actorName,
        actorAvatar,
        text: commentText,
        coverUrl,
        at: Number(lu?.at || row?.latestLikeAt || row?.at || 0),
      })
    }
  }

  return out
}

/**
 * @param {string} actorName
 */
export function formatLikeNotificationHeadline(actorName) {
  const actor = String(actorName || '').trim() || 'មិត្តអ្នកអាន'
  return `${actor} បានចូលចិត្តមតិរបស់អ្នក`
}
