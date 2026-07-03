import { useEffect, useMemo, useState } from 'react'
import { Bell, Heart, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppChrome } from '../contexts/useAppChrome.js'
import { bindNovelNavPrefetchHandlers, prefetchNovelNav } from '../lib/prefetchNovelOnNav.js'
import { resolveNovelCoverUrl } from '../lib/resolveNovelCoverUrl.js'
import { novels } from '../data/novels.js'
import { formatTelegramDisplayName, useTelegramUser } from '../hooks/useTelegramUser.js'
import { fetchNovelReplies, fetchNovelReviews } from '../lib/miniAppPresence.js'
import {
  collectLikeNotificationsForNovel,
  formatLikeNotificationHeadline,
} from '../lib/likeNotifications.js'
import {
  buildViewerNameSet,
  collectReplyNotificationsForNovel,
  formatReplyNotificationHeadline,
  isCommentOwnedByViewer,
} from '../lib/replyNotifications.js'
import {
  dispatchNotificationReadChanged,
  isNotificationRead,
  markNotificationReadInMap,
  readByViewer,
  readReadMap,
  resolveNotificationViewerId,
  syncReadMapWithNotifications,
  writeReadMap,
} from '../lib/notificationReadStorage.js'

const NOTIFICATION_POLL_INTERVAL_MS = 1500
const SYSTEM_NOTIFICATION_STORAGE_KEY = 'tg_system_notifications_v1'

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

function readSystemNotifications() {
  try {
    const raw = localStorage.getItem(SYSTEM_NOTIFICATION_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function NotificationsPage() {
  const { registerNotificationsMarkAll } = useAppChrome()
  const tgUser = useTelegramUser()
  const viewerId = useMemo(() => resolveNotificationViewerId(tgUser), [tgUser])
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

  const markAsRead = (notification) => {
    if (viewerId == null) return
    const target = typeof notification === 'string'
      ? items.find((it) => it.id === notification) || { id: notification, readAliases: [notification] }
      : notification
    const all = readReadMap()
    const current = readByViewer(all, viewerId)
    if (isNotificationRead(current, target)) return
    const { next } = markNotificationReadInMap(current, target)
    all[String(viewerId)] = next
    writeReadMap(all)
    setReadMetaMap(next)
    dispatchNotificationReadChanged()
  }

  const markAllAsRead = () => {
    if (viewerId == null || items.length === 0) return
    const all = readReadMap()
    let current = readByViewer(all, viewerId)
    const nowAt = Date.now()
    for (const it of items) {
      const { next } = markNotificationReadInMap(current, it, nowAt)
      current = next
    }
    all[String(viewerId)] = current
    writeReadMap(all)
    setReadMetaMap(current)
    dispatchNotificationReadChanged()
  }

  useEffect(() => {
    registerNotificationsMarkAll(markAllAsRead)
    return () => registerNotificationsMarkAll(null)
  }, [markAllAsRead, registerNotificationsMarkAll])

  useEffect(() => {
    let active = true
    let pollTimer = 0

    const loadNotifications = async () => {
      if (!active || viewerId == null) return
      const viewerNames = buildViewerNameSet(tgUser, formatTelegramDisplayName)
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
          const ownedComments = reviewRows.filter((row) =>
            isCommentOwnedByViewer(row, viewerId, viewerNames),
          )

          return [
            ...collectLikeNotificationsForNovel(novelId, novel, reviewRows, replyRows, {
              viewerId,
              viewerNames,
            }),
            ...collectReplyNotificationsForNovel(novelId, novel, reviewRows, replyRows, {
              viewerId,
              viewerNames,
              mineComments: ownedComments,
              replyRows,
            }),
          ]
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
          readAliases: [String(it?.id || '').trim()].filter(Boolean),
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
      const { all, next, changed } = syncReadMapWithNotifications(allRead, viewerId, nextItems)
      if (changed) writeReadMap(all)
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
                readMetaMap[it.id] || isNotificationRead(readMetaMap, it)
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
                          ? formatLikeNotificationHeadline(it.actorName)
                          : it.type === 'system'
                            ? 'សារ​ជូនដំណឹង​ពីប្រព័ន្ធ'
                            : formatReplyNotificationHeadline(it.actorName, it.replyToViewerName)}
                      </span>
                    </p>
                    {it.novelTitle ? (
                      <p className="mt-1 truncate text-[11px] font-medium text-cyan-200/85">{it.novelTitle}</p>
                    ) : null}
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
                      {isNotificationRead(readMetaMap, it) ? 'បានអាន' : 'មិនទាន់អាន'} · {formatAgo(it.at)}
                    </p>
                  </div>
                  {it.type === 'system' ? (
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/5">
                      <img src="/logo.png" alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    </div>
                  ) : (
                    <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md border border-white/15 bg-white/5">
                      {it.coverUrl ? (
                        <img src={resolveNovelCoverUrl(it.coverUrl)} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
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
                    onClick={() => markAsRead(it)}
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
                  {...bindNovelNavPrefetchHandlers(it.novelId)}
                  onClick={() => {
                    markAsRead(it)
                    prefetchNovelNav(it.novelId)
                  }}
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
