import { useEffect, useMemo, useState } from 'react'
import { Bell, Heart, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { novels } from '../data/novels.js'
import { formatTelegramDisplayName, useTelegramUser } from '../hooks/useTelegramUser.js'
import { fetchNovelReplies, fetchNovelReviews, getPresenceMemberId } from '../lib/miniAppPresence.js'

const NOTIFICATION_READ_STORAGE_KEY = 'tg_notification_read_ids_v1'
const NOTIFICATION_READ_CHANGED_EVENT = 'tg-notifications-read-changed'
const NOTIFICATION_POLL_INTERVAL_MS = 1500
const SYSTEM_NOTIFICATION_STORAGE_KEY = 'tg_system_notifications_v1'

function resolveViewerId(tgUser) {
  if (tgUser?.id != null) return Number(tgUser.id)
  const raw = String(getPresenceMemberId() || '')
  const m = raw.match(/^tg_(\d+)$/)
  if (m) return Number(m[1])
  return null
}

function formatAgo(ts) {
  const t = Number(ts || 0)
  if (!Number.isFinite(t) || t <= 0) return ''
  const diffSec = Math.max(1, Math.floor((Date.now() - t) / 1000))
  if (diffSec < 60) return `${diffSec} វិនាទីមុន`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} នាទីមុន`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} ម៉ោងមុន`
  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay} ថ្ងៃមុន`
}

function buildReplyId(novelId, parentCommentId, rp) {
  const rid = String(rp?.id || '').trim()
  if (rid) return `reply-${novelId}-${rid}`
  return `reply-${novelId}-${String(parentCommentId || '')}-${Number(rp?.at || 0)}`
}

function buildLikeId(novelId, commentId, likerId) {
  return `like-${String(novelId || '')}-${String(commentId || '')}-${String(likerId || '')}`
}

function readReadMap() {
  try {
    const raw = localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeReadMap(next) {
  try {
    localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore storage failure */
  }
}

function readByViewer(all, viewerId) {
  const src = all && typeof all === 'object' ? all : {}
  const byUser = src[String(viewerId)]
  if (byUser && typeof byUser === 'object') return byUser
  // 兼容旧的“平铺结构”
  return src
}

function readSystemNotifications() {
  try {
    const raw = localStorage.getItem(SYSTEM_NOTIFICATION_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function pruneReadStateByVisibleItems(allReadMap, viewerId, items) {
  const all = allReadMap && typeof allReadMap === 'object' ? allReadMap : {}
  const current = readByViewer(all, viewerId)
  const visibleIds = new Set(
    (Array.isArray(items) ? items : [])
      .map((it) => String(it?.id || '').trim())
      .filter(Boolean),
  )
  const next = {}
  for (const [id, ts] of Object.entries(current)) {
    if (visibleIds.has(String(id))) next[String(id)] = ts
  }
  all[String(viewerId)] = next
  return { all, next }
}

export default function NotificationsPage() {
  const tgUser = useTelegramUser()
  const viewerId = useMemo(() => resolveViewerId(tgUser), [tgUser])
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [readMetaMap, setReadMetaMap] = useState({})

  useEffect(() => {
    if (viewerId == null) {
      setReadMetaMap({})
      return
    }
    const all = readReadMap()
    setReadMetaMap(readByViewer(all, viewerId))
  }, [viewerId])

  const markAsRead = (id) => {
    const key = String(id || '').trim()
    if (!key || viewerId == null) return
    const all = readReadMap()
    const current = readByViewer(all, viewerId)
    if (current[key]) return
    const next = { ...current, [key]: Date.now() }
    all[String(viewerId)] = next
    writeReadMap(all)
    setReadMetaMap(next)
    window.dispatchEvent(new CustomEvent(NOTIFICATION_READ_CHANGED_EVENT))
  }

  const markAllAsRead = () => {
    if (viewerId == null || items.length === 0) return
    const all = readReadMap()
    const current = readByViewer(all, viewerId)
    const nowAt = Date.now()
    const next = { ...current }
    for (const it of items) {
      const id = String(it?.id || '').trim()
      if (!id) continue
      next[id] = nowAt
    }
    all[String(viewerId)] = next
    writeReadMap(all)
    setReadMetaMap(next)
    window.dispatchEvent(new CustomEvent(NOTIFICATION_READ_CHANGED_EVENT))
  }

  useEffect(() => {
    let active = true
    let pollTimer = 0

    const loadNotifications = async () => {
      if (!active || viewerId == null) return
      const viewerNames = new Set([
        String(tgUser ? formatTelegramDisplayName(tgUser) : '').trim(),
        String(tgUser?.first_name || '').trim(),
        String(tgUser?.username || '').trim(),
        String(tgUser?.username ? `@${tgUser.username}` : '').trim(),
      ].filter(Boolean))
      const allRows = await Promise.all(
        novels.map(async (novel) => {
          const novelId = String(novel?.id || '').trim()
          if (!novelId) return []
          const [reviews, replies] = await Promise.all([
            fetchNovelReviews(novelId),
            fetchNovelReplies(novelId),
          ])
          const reviewRows = Array.isArray(reviews) ? reviews : []
          const replyRows = Array.isArray(replies) ? replies : []
          const profileByUserId = new Map()
          const pushProfile = (uidRaw, nameRaw, avatarRaw) => {
            const uid = Number(uidRaw)
            if (!Number.isFinite(uid)) return
            const key = String(uid)
            const prev = profileByUserId.get(key) || { name: '', avatar: '' }
            const name = String(nameRaw || '').trim()
            const avatar = String(avatarRaw || '').trim()
            profileByUserId.set(key, {
              name: name || prev.name,
              avatar: avatar || prev.avatar,
            })
          }
          for (const r of reviewRows) {
            pushProfile(r?.userId, r?.userName || r?.name || '', r?.userAvatar || r?.avatar || '')
          }
          for (const rp of replyRows) {
            pushProfile(rp?.userId, rp?.userName || rp?.name || '', rp?.userAvatar || rp?.avatar || '')
          }
          const resolveProfile = (likerIdRaw) => {
            const likerId = String(likerIdRaw || '').trim()
            if (!likerId) return null
            const direct = profileByUserId.get(likerId)
            if (direct) return direct
            const m = likerId.match(/^tg_(\d+)$/)
            if (m) return profileByUserId.get(String(m[1])) || null
            return null
          }
          const mineComments = reviewRows.filter((row) => {
            const uid = Number(row?.userId)
            if (Number.isFinite(uid) && uid === viewerId) return true
            const name = String(row?.userName || row?.name || '').trim()
            return !!name && viewerNames.has(name)
          })
          const mineCommentIds = new Set(mineComments.map((row) => String(row?.id || '').trim()).filter(Boolean))
          const myReplyIds = new Set(
            replyRows
              .filter((rp) => Number(rp?.userId) === viewerId)
              .map((rp) => String(rp?.id || '').trim())
              .filter(Boolean),
          )
          const out = []

          for (const row of mineComments) {
            const commentId = String(row?.id || '').trim()
            if (!commentId) continue
            const likeUsers = Array.isArray(row?.likeUsers) ? row.likeUsers : []
            for (const lu of likeUsers) {
              const likerId = String(lu?.userId || '').trim()
              if (!likerId || likerId === `tg_${viewerId}` || likerId === String(viewerId)) continue
              const profile = resolveProfile(likerId)
              const rawActorName = String(lu?.name || profile?.name || '').trim()
              const actorName = rawActorName || (likerId.startsWith('tg_') ? likerId.slice(3) : likerId)
              const actorAvatar = String(lu?.avatar || profile?.avatar || '').trim()
              out.push({
                id: buildLikeId(novelId, commentId, likerId),
                type: 'like',
                novelId,
                commentId,
                replyId: '',
                actorName,
                actorAvatar,
                text: String(row?.text || '').trim(),
                coverUrl: String(novel?.coverUrl || '').trim(),
                at: Number(lu?.at || row?.latestLikeAt || row?.at || 0),
              })
            }
          }

          for (const rp of replyRows) {
            const uid = Number(rp?.userId)
            if (Number.isFinite(uid) && uid === viewerId) continue
            const parentCommentId = String(rp?.parentCommentId || '').trim()
            const parentReplyId = String(rp?.parentReplyId || '').trim()
            const hitMineComment = parentCommentId && mineCommentIds.has(parentCommentId)
            const hitMineReply = parentReplyId && myReplyIds.has(parentReplyId)
            const mentionMe = Number(rp?.replyToUserId) === viewerId
            if (!hitMineComment && !hitMineReply && !mentionMe) continue
            out.push({
              id: buildReplyId(novelId, parentCommentId, rp),
              type: 'reply',
              novelId,
              commentId: parentCommentId,
              replyId: String(rp?.id || '').trim(),
              actorName: String(rp?.userName || rp?.name || '').trim() || 'មិត្តអ្នកអាន',
              actorAvatar: String(rp?.userAvatar || rp?.avatar || '').trim(),
              text: String(rp?.text || '').trim(),
              coverUrl: String(novel?.coverUrl || '').trim(),
              at: Number(rp?.at || 0),
            })
          }

          return out
        }),
      )
      if (!active) return
      const merged = allRows
        .flat()
        .reduce((acc, it) => {
          const key = String(it?.id || '').trim()
          if (!key) return acc
          const prev = acc.get(key)
          if (!prev || Number(it?.at || 0) > Number(prev?.at || 0)) acc.set(key, it)
          return acc
        }, new Map())
      const systemItems = readSystemNotifications()
        .map((it) => ({
          id: String(it?.id || '').trim(),
          type: 'system',
          novelId: '',
          commentId: '',
          replyId: '',
          actorName: 'ប្រព័ន្ធ',
          actorAvatar: '',
          text: String(it?.text || '').trim(),
          coverUrl: '',
          at: Number(it?.at || 0),
        }))
        .filter((it) => it.id && it.text)
      const nextItems = [...systemItems, ...[...merged.values()]]
        .sort((a, b) => Number(b?.at || 0) - Number(a?.at || 0))
      setItems(nextItems)
      const allRead = readReadMap()
      const { all, next } = pruneReadStateByVisibleItems(allRead, viewerId, nextItems)
      writeReadMap(all)
      setReadMetaMap(next)
      setLoading(false)
    }

    if (viewerId == null) {
      setItems([])
      setLoading(false)
      return () => {
        active = false
      }
    }
    setLoading(true)
    void loadNotifications().catch(() => {
      if (!active) return
      setItems([])
      setLoading(false)
    })
    pollTimer = window.setInterval(() => {
      void loadNotifications().catch(() => {})
    }, NOTIFICATION_POLL_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadNotifications().catch(() => {})
      }
    }
    const onFocus = () => {
      void loadNotifications().catch(() => {})
    }
    const onPageShow = () => {
      void loadNotifications().catch(() => {})
    }
    const onOnline = () => {
      void loadNotifications().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('online', onOnline)
    return () => {
      active = false
      if (pollTimer) window.clearInterval(pollTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('online', onOnline)
    }
  }, [viewerId, tgUser?.id, tgUser?.first_name, tgUser?.username])

  const notificationsMainCentered = loading || items.length === 0

  return (
    <div className="tg-app tg-app--account tg-notifications">
      <header className="tg-toolbar tg-toolbar--large tg-notifications__toolbar">
        <h1 className="tg-toolbar__title" lang="km">
          ការជូនដំណឹង
        </h1>
        <button
          type="button"
          className="tg-notifications__mark-all"
          lang="km"
          onClick={markAllAsRead}
        >
          អានទាំងអស់
        </button>
      </header>
      <main
        className={[
          'tg-list-wrap tg-account-scroll tg-notifications__main flex flex-1 flex-col px-4 py-4',
          notificationsMainCentered ? 'tg-notifications__main--center' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {loading ? (
          <p className="tg-notifications__status tg-notifications__status--loading" lang="km">
            កំពុងផ្ទុកការជូនដំណឹង...
          </p>
        ) : items.length === 0 ? (
          <p className="tg-notifications__status tg-notifications__status--empty" lang="km">
            មិនទាន់មានការជូនដំណឹងនៅឡើយទេ
          </p>
        ) : (
          <div className="mx-auto flex w-full max-w-md flex-col gap-2.5">
            {items.map((it) => {
              const cardClass = [
                'rounded-2xl border px-3 py-2.5 text-left',
                readMetaMap[it.id]
                  ? 'border-white/10 bg-white/[0.03]'
                  : 'border-blue-300/40 bg-blue-500/[0.12]',
              ].join(' ')
              const body = (
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[13px] font-medium text-white/90">
                      {it.actorAvatar ? (
                        <img src={it.actorAvatar} alt="" className="h-5 w-5 rounded-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15">
                          {it.type === 'like'
                            ? <Heart size={12} className="fill-rose-400 text-rose-400" />
                            : it.type === 'system'
                              ? <Bell size={12} className="fill-white text-white" />
                              : <MessageCircle size={12} />}
                        </span>
                      )}
                      <span className="min-w-0 truncate">
                        {it.type === 'like'
                          ? `${it.actorName} បានចូលចិត្តមតិរបស់អ្នក`
                          : it.type === 'system'
                            ? 'សារ​ជូនដំណឹង​ពីប្រព័ន្ធ'
                            : `${it.actorName} បានឆ្លើយតបមតិរបស់អ្នក`}
                      </span>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-white/75">
                      {it.type === 'like' ? (
                        <Heart size={12} className="shrink-0 fill-rose-400 text-rose-400" />
                      ) : it.type === 'system' ? (
                        <Bell size={12} className="shrink-0 fill-white text-white" />
                      ) : (
                        <MessageCircle size={12} className="shrink-0 fill-white text-white" />
                      )}
                      <span className="line-clamp-1 min-w-0">{it.text || '—'}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-white/45">
                      {readMetaMap[it.id] ? 'បានអាន' : 'មិនទាន់អាន'} · {formatAgo(it.at)}
                    </p>
                  </div>
                  {it.type === 'system' ? (
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/5">
                      <img src="/logo.png" alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    </div>
                  ) : (
                    <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md border border-white/15 bg-white/5">
                      {it.coverUrl ? (
                        <img src={it.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                      ) : null}
                    </div>
                  )}
                </div>
              )
              if (!it.novelId) {
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={cardClass}
                    lang="km"
                    onClick={() => markAsRead(it.id)}
                  >
                    {body}
                  </button>
                )
              }
              return (
                <Link
                  key={it.id}
                  to={`/read/${it.novelId}`}
                  state={{ from: 'notifications', focusCommentId: it.commentId, focusReplyId: it.replyId || '' }}
                  className={cardClass}
                  lang="km"
                  onClick={() => markAsRead(it.id)}
                >
                  {body}
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
