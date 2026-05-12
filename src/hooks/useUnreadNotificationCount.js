import { useEffect, useMemo, useRef, useState } from 'react'
import { novels } from '../data/novels.js'
import { fetchNovelReplies, fetchNovelReviews, getPresenceMemberId } from '../lib/miniAppPresence.js'
import { formatTelegramDisplayName } from './useTelegramUser.js'

const NOTIFICATION_READ_STORAGE_KEY = 'tg_notification_read_ids_v1'
const NOTIFICATION_READ_CHANGED_EVENT = 'tg-notifications-read-changed'
const NOTIFICATION_BADGE_POLL_INTERVAL_MS = 1500
const SYSTEM_NOTIFICATION_STORAGE_KEY = 'tg_system_notifications_v1'

function resolveViewerId(tgUser) {
  if (tgUser?.id != null) return Number(tgUser.id)
  const presenceId = String(getPresenceMemberId() || '')
  const m = presenceId.match(/^tg_(\d+)$/)
  if (m) return Number(m[1])
  return null
}

function readReadMapByViewerId(viewerId) {
  if (viewerId == null) return {}
  try {
    const raw = localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const byUser = parsed?.[String(viewerId)]
    return byUser && typeof byUser === 'object' ? byUser : {}
  } catch {
    return {}
  }
}

function buildReplyNotificationId(novelId, commentId, rp) {
  const rid = String(rp?.id || '').trim()
  if (rid) return `reply-${novelId}-${rid}`
  const at = Number(rp?.at || 0)
  const name = String(rp?.userName || rp?.name || '').trim().slice(0, 40)
  const text = String(rp?.text || '').trim().slice(0, 80)
  return `reply-${novelId}-${commentId}-${at}-${name}-${text}`
}

function buildLikeNotificationId(novelId, commentId, likerUserId) {
  return `like-${String(novelId || '').trim()}-${String(commentId || '').trim()}-${String(likerUserId || '').trim()}`
}

function readSystemNotificationIds() {
  try {
    const raw = localStorage.getItem(SYSTEM_NOTIFICATION_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((it) => ({ id: String(it?.id || '').trim(), at: Number(it?.at || 0) }))
      .filter((it) => it.id)
  } catch {
    return []
  }
}

export function useUnreadNotificationCount(tgUser) {
  const viewerId = useMemo(() => resolveViewerId(tgUser), [tgUser])
  const [unreadCount, setUnreadCount] = useState(0)
  const latestRequestRef = useRef(0)

  useEffect(() => {
    let active = true
    let pollTimer = 0
    let inFlight = false
    if (viewerId == null) {
      setUnreadCount(0)
      return () => {
        active = false
      }
    }
    const load = async () => {
      if (inFlight) return
      inFlight = true
      const requestId = Date.now()
      latestRequestRef.current = requestId
      const readMap = readReadMapByViewerId(viewerId)
      const all = await Promise.all(
        novels.map(async (novel) => {
          const novelId = String(novel.id || '')
          if (!novelId) return []
          const [reviews, replies] = await Promise.all([
            fetchNovelReviews(novelId),
            fetchNovelReplies(novelId),
          ])
          const viewerNameCandidates = new Set([
            String(tgUser ? formatTelegramDisplayName(tgUser) : '').trim(),
            String(tgUser?.first_name || '').trim(),
            String(tgUser?.username || '').trim(),
            String(tgUser?.username ? `@${tgUser.username}` : '').trim(),
          ].filter(Boolean))
          const mine = Array.isArray(reviews)
            ? reviews.filter((r) => {
              const uid = Number(r?.userId)
              if (Number.isFinite(uid) && uid === viewerId) return true
              const reviewName = String(r?.userName || r?.name || '').trim()
              return !!reviewName && viewerNameCandidates.has(reviewName)
            })
            : []
          const out = []
          const myReplyRows = Array.isArray(replies)
            ? replies.filter((rp) => Number(rp?.userId) === viewerId)
            : []
          const myNames = new Set([
            ...mine.map((r) => String(r?.userName || r?.name || '').trim()),
            ...myReplyRows.map((r) => String(r?.userName || r?.name || '').trim()),
          ].filter(Boolean))
          for (const row of mine) {
            const commentId = String(row?.id || '')
            if (!commentId) continue
            const likeUsers = Array.isArray(row?.likeUsers) ? row.likeUsers : []
            for (const lu of likeUsers) {
              const likerUserId = String(lu?.userId || '').trim()
              if (!likerUserId) continue
              // 与通知页规则一致：自己给自己评论点赞不计入通知未读。
              if (likerUserId === `tg_${viewerId}` || likerUserId === String(viewerId)) continue
              out.push({
                id: buildLikeNotificationId(novelId, commentId, likerUserId),
                at: Number(lu?.at || row?.at || 0),
              })
            }
            const myReplies = Array.isArray(replies)
              ? replies.filter(
                (rp) =>
                  String(rp?.parentCommentId || '') === commentId
                  && Number(rp?.userId) !== viewerId,
              )
              : []
            for (const rp of myReplies) {
              out.push({
                id: buildReplyNotificationId(novelId, commentId, rp),
                at: Number(rp?.at || row?.at || 0),
              })
            }
          }
          for (const myReply of myReplyRows) {
            const myReplyId = String(myReply?.id || '').trim()
            if (!myReplyId) continue
            const myReplyName = String(myReply?.userName || myReply?.name || '').trim()
            const directReplies = replies.filter((rp) => {
              if (Number(rp?.userId) === viewerId) return false
              const parentReplyId = String(rp?.parentReplyId || '').trim()
              if (parentReplyId && parentReplyId === myReplyId) return true
              const replyToName = String(rp?.replyToName || '').trim()
              return !parentReplyId && !!replyToName && !!myReplyName && replyToName === myReplyName
            })
            for (const rp of directReplies) {
              const parentCommentId = String(rp?.parentCommentId || myReply?.parentCommentId || '')
              out.push({
                id: buildReplyNotificationId(novelId, parentCommentId, rp),
                at: Number(rp?.at || myReply?.at || 0),
              })
            }
          }
          const mentionRows = Array.isArray(replies)
            ? replies.filter((rp) => {
              if (Number(rp?.userId) === viewerId) return false
              const toUid = Number(rp?.replyToUserId)
              if (Number.isFinite(toUid) && toUid === viewerId) return true
              const toName = String(rp?.replyToName || '').trim()
              return !!toName && myNames.has(toName)
            })
            : []
          for (const rp of mentionRows) {
            const parentCommentId = String(rp?.parentCommentId || '')
            out.push({
              id: buildReplyNotificationId(novelId, parentCommentId, rp),
              at: Number(rp?.at || 0),
            })
          }
          return { items: out }
        }),
      )
      if (!active) return
      const ids = all.flatMap((it) => (Array.isArray(it?.items) ? it.items : []))
        .reduce((acc, it) => {
          const key = String(it?.id || '')
          if (!key) return acc
          const prev = acc.get(key)
          if (!prev || Number(it?.at || 0) > Number(prev?.at || 0)) {
            acc.set(key, it)
          }
          return acc
        }, new Map())
      for (const sys of readSystemNotificationIds()) {
        ids.set(sys.id, { id: sys.id, at: sys.at })
      }
      const idsList = [...ids.values()]
        .sort((a, b) => Number(b?.at || 0) - Number(a?.at || 0))
        .map((it) => String(it?.id || '').trim())
        .filter(Boolean)
      const unread = idsList.reduce((sum, id) => sum + (readMap[id] ? 0 : 1), 0)
      // 只接收最新一次请求结果，避免旧请求回包覆盖新数字。
      if (latestRequestRef.current === requestId) {
        setUnreadCount(unread)
      }
      inFlight = false
    }
    void load().catch(() => {
      inFlight = false
    })
    const onChanged = () => {
      void load()
    }
    pollTimer = window.setInterval(() => {
      void load().catch(() => {
        inFlight = false
      })
    }, NOTIFICATION_BADGE_POLL_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void load().catch(() => {
          inFlight = false
        })
      }
    }
    const onFocus = () => {
      void load().catch(() => {
        inFlight = false
      })
    }
    const onPageShow = () => {
      void load().catch(() => {
        inFlight = false
      })
    }
    const onOnline = () => {
      void load().catch(() => {
        inFlight = false
      })
    }
    window.addEventListener(NOTIFICATION_READ_CHANGED_EVENT, onChanged)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('online', onOnline)
    return () => {
      active = false
      if (pollTimer) window.clearInterval(pollTimer)
      window.removeEventListener(NOTIFICATION_READ_CHANGED_EVENT, onChanged)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('online', onOnline)
    }
  }, [viewerId, tgUser?.id, tgUser?.first_name, tgUser?.username])

  return unreadCount
}

