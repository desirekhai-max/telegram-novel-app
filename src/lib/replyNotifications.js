/** 评论/回复通知：收件人解析（与阅读页 replyToUserId / parentReplyId 对齐） */

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
export function normalizeTelegramUserId(raw) {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) return Math.floor(n)
  const s = String(raw).trim()
  const m = s.match(/^tg_(\d+)$/i)
  if (m) {
    const id = Number(m[1])
    return Number.isFinite(id) && id > 0 ? Math.floor(id) : null
  }
  if (/^\d+$/.test(s)) {
    const id = Number(s)
    return Number.isFinite(id) && id > 0 ? Math.floor(id) : null
  }
  return null
}

/**
 * @param {import('../hooks/useTelegramUser.js').TelegramWebAppUser | null | undefined} tgUser
 * @param {(user: import('../hooks/useTelegramUser.js').TelegramWebAppUser) => string} [formatDisplayName]
 * @returns {Set<string>}
 */
export function buildViewerNameSet(tgUser, formatDisplayName) {
  const names = new Set()
  const push = (v) => {
    const s = String(v || '').trim()
    if (s) names.add(s)
  }
  if (tgUser) {
    if (typeof formatDisplayName === 'function') {
      push(formatDisplayName(tgUser))
    }
    const first = String(tgUser.first_name || '').trim()
    const last = String(tgUser.last_name || '').trim()
    push([first, last].filter(Boolean).join(' '))
    push(first)
    push(tgUser.username)
    push(tgUser.username ? `@${tgUser.username}` : '')
  }
  return names
}

/**
 * @param {object} row
 * @param {string} field
 */
function pickName(row, field = 'userName') {
  return String(row?.[field] ?? row?.name ?? '').trim()
}

/**
 * 当前用户是否为主评论作者（userId 优先，姓名兜底）。
 * @param {object} row
 * @param {number} viewerId
 * @param {Set<string>} viewerNames
 */
export function isCommentOwnedByViewer(row, viewerId, viewerNames) {
  const uid = normalizeTelegramUserId(row?.userId)
  if (uid != null && uid === viewerId) return true
  const name = pickName(row, 'userName')
  return !!name && viewerNames.has(name)
}

/**
 * @typedef {{
 *   viewerId: number,
 *   viewerNames: Set<string>,
 *   mineComments: object[],
 *   replyRows: object[],
 * }} ReplyNotificationContext
 */

/**
 * @param {ReplyNotificationContext} ctx
 * @returns {Set<string>}
 */
function buildMyReplyIdSet(ctx) {
  const out = new Set()
  for (const rp of ctx.replyRows || []) {
    if (normalizeTelegramUserId(rp?.userId) !== ctx.viewerId) continue
    const id = String(rp?.id || '').trim()
    if (id) out.add(id)
  }
  return out
}

/**
 * @param {ReplyNotificationContext} ctx
 * @returns {Set<string>}
 */
function buildMineCommentIdSet(ctx) {
  return new Set(
    (ctx.mineComments || [])
      .map((row) => String(row?.id || '').trim())
      .filter(Boolean),
  )
}

/**
 * 判断某条回复是否应通知当前用户（不通知自己）。
 * @param {object} rp
 * @param {ReplyNotificationContext} ctx
 * @param {{ myReplyIds?: Set<string>, mineCommentIds?: Set<string> }} caches
 */
export function shouldNotifyViewerForReply(rp, ctx, caches = {}) {
  const viewerId = ctx.viewerId
  const senderId = normalizeTelegramUserId(rp?.userId)
  if (senderId != null && senderId === viewerId) return false

  const myReplyIds = caches.myReplyIds ?? buildMyReplyIdSet(ctx)
  const mineCommentIds = caches.mineCommentIds ?? buildMineCommentIdSet(ctx)

  const parentCommentId = String(rp?.parentCommentId || '').trim()
  const parentReplyId = String(rp?.parentReplyId || '').trim()
  const replyToUserId = normalizeTelegramUserId(rp?.replyToUserId)
  const replyToName = pickName(rp, 'replyToName') || String(rp?.replyToName || '').trim()

  if (replyToUserId != null && replyToUserId === viewerId) return true
  if (parentReplyId && myReplyIds.has(parentReplyId)) return true
  if (replyToName && ctx.viewerNames.has(replyToName)) return true

  if (!parentCommentId || !mineCommentIds.has(parentCommentId)) return false

  // 仅当直接回复主评论（无嵌套 parentReplyId）或明确 @ 主评论作者姓名时，通知楼主
  if (!parentReplyId) return true

  const mineComment = (ctx.mineComments || []).find((c) => String(c?.id || '') === parentCommentId)
  const ownerName = pickName(mineComment, 'userName')
  if (ownerName && replyToName && replyToName === ownerName) return true

  return false
}

/**
 * @param {object} rp
 * @param {ReplyNotificationContext} ctx
 */
export function resolveReplyNotificationTargetLabel(rp, ctx) {
  const replyToUserId = normalizeTelegramUserId(rp?.replyToUserId)
  if (replyToUserId != null && replyToUserId === ctx.viewerId) {
    const fromName = pickName(rp, 'replyToName')
    if (fromName && ctx.viewerNames.has(fromName)) return ''
    return pickName(rp, 'userName') || 'អ្នក'
  }

  const replyToName = pickName(rp, 'replyToName')
  if (replyToName && ctx.viewerNames.has(replyToName)) {
    return replyToName
  }

  const parentReplyId = String(rp?.parentReplyId || '').trim()
  if (parentReplyId) {
    const parent = (ctx.replyRows || []).find((row) => String(row?.id || '') === parentReplyId)
    if (parent && normalizeTelegramUserId(parent?.userId) === ctx.viewerId) {
      return pickName(parent, 'userName') || 'អ្នក'
    }
  }

  return ''
}

export function buildReplyNotificationId(novelId, parentCommentId, rp) {
  const rid = String(rp?.id || '').trim()
  if (rid) return `reply-${novelId}-${rid}`
  const at = Number(rp?.at || 0)
  const name = pickName(rp, 'userName').slice(0, 40)
  const text = String(rp?.text || '').trim().slice(0, 80)
  return `reply-${novelId}-${parentCommentId}-${at}-${name}-${text}`
}

/**
 * 兼容旧版已读 key（仅 parentCommentId+at / 含 name+text 变体）。
 * @param {string} novelId
 * @param {string} parentCommentId
 * @param {object} rp
 */
export function replyNotificationReadAliases(novelId, parentCommentId, rp) {
  const novelPart = String(novelId || '').trim()
  const parentPart = String(parentCommentId || '').trim()
  const rid = String(rp?.id || '').trim()
  const at = Number(rp?.at || 0)
  const name = pickName(rp, 'userName').slice(0, 40)
  const text = String(rp?.text || '').trim().slice(0, 80)
  const out = new Set([buildReplyNotificationId(novelId, parentCommentId, rp)])
  if (rid) out.add(`reply-${novelPart}-${rid}`)
  if (parentPart && at > 0) {
    out.add(`reply-${novelPart}-${parentPart}-${at}`)
    out.add(`reply-${novelPart}-${parentPart}-${at}-${name}-${text}`)
  }
  return [...out]
}

/**
 * @param {string} novelId
 * @param {object} novel
 * @param {object[]} reviewRows
 * @param {object[]} replyRows
 * @param {ReplyNotificationContext} ctx
 * @returns {object[]}
 */
export function collectReplyNotificationsForNovel(novelId, novel, reviewRows, replyRows, ctx) {
  const localCtx = {
    ...ctx,
    mineComments: reviewRows.filter((row) =>
      isCommentOwnedByViewer(row, ctx.viewerId, ctx.viewerNames),
    ),
    replyRows,
  }

  const caches = {
    myReplyIds: buildMyReplyIdSet(localCtx),
    mineCommentIds: buildMineCommentIdSet(localCtx),
  }

  const novelTitle = String(novel?.title || '').trim()
  const coverUrl = String(novel?.coverUrl || '').trim()
  const out = []

  for (const rp of replyRows || []) {
    if (!shouldNotifyViewerForReply(rp, localCtx, caches)) continue
    const parentCommentId = String(rp?.parentCommentId || '').trim()
    const replyToViewerName = resolveReplyNotificationTargetLabel(rp, localCtx)
    out.push({
      id: buildReplyNotificationId(novelId, parentCommentId, rp),
      readAliases: replyNotificationReadAliases(novelId, parentCommentId, rp),
      type: 'reply',
      novelId,
      novelTitle,
      commentId: parentCommentId,
      replyId: String(rp?.id || '').trim(),
      actorName: pickName(rp, 'userName') || 'មិត្តអ្នកអាន',
      actorAvatar: String(rp?.userAvatar || rp?.avatar || '').trim(),
      text: String(rp?.text || '').trim(),
      replyToViewerName,
      coverUrl,
      at: Number(rp?.at || 0),
    })
  }

  return out
}

/**
 * @param {string} actorName
 * @param {string} replyToViewerName
 */
export function formatReplyNotificationHeadline(actorName, replyToViewerName) {
  const actor = String(actorName || '').trim() || 'មិត្តអ្នកអាន'
  const target = String(replyToViewerName || '').trim()
  if (target) {
    return `${actor} បានឆ្លើយតបទៅ ${target}`
  }
  return `${actor} បានឆ្លើយតបមតិរបស់អ្នក`
}
