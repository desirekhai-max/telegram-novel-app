import { useEffect, useMemo, useRef, useState } from 'react'
import { novels } from '../data/novels.js'
import { fetchNovelReplies, fetchNovelReviews } from '../lib/miniAppPresence.js'
import { collectLikeNotificationsForNovel } from '../lib/likeNotifications.js'
import { buildViewerNameSet, collectReplyNotificationsForNovel } from '../lib/replyNotifications.js'
import {
  countUnreadNotifications,
  NOTIFICATION_READ_CHANGED_EVENT,
  readByViewer,
  readReadMap,
  resolveNotificationViewerId,
} from '../lib/notificationReadStorage.js'
import { formatTelegramDisplayName } from './useTelegramUser.js'

const NOTIFICATION_BADGE_POLL_INTERVAL_MS = 1500
const SYSTEM_NOTIFICATION_STORAGE_KEY = 'tg_system_notifications_v1'

function readSystemNotificationIds() {
  try {
    const raw = localStorage.getItem(SYSTEM_NOTIFICATION_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((it) => ({
        id: String(it?.id || '').trim(),
        at: Number(it?.at || 0),
        readAliases: [String(it?.id || '').trim()].filter(Boolean),
      }))
      .filter((it) => it.id)
  } catch {
    return []
  }
}

export function useUnreadNotificationCount(tgUser) {
  const viewerId = useMemo(() => resolveNotificationViewerId(tgUser), [tgUser])
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
      const readMap = readByViewer(readReadMap(), viewerId)
      const all = await Promise.all(
        novels.map(async (novel) => {
          const novelId = String(novel.id || '')
          if (!novelId) return []
          const [reviews, replies] = await Promise.all([
            fetchNovelReviews(novelId),
            fetchNovelReplies(novelId),
          ])
          const viewerNameCandidates = buildViewerNameSet(tgUser, formatTelegramDisplayName)
          const reviewRows = Array.isArray(reviews) ? reviews : []
          const replyRows = Array.isArray(replies) ? replies : []
          const out = []
          for (const row of collectLikeNotificationsForNovel(novelId, novel, reviewRows, replyRows, {
            viewerId,
            viewerNames: viewerNameCandidates,
          })) {
            out.push({
              id: row.id,
              at: Number(row.at || 0),
              readAliases: row.readAliases,
            })
          }
          for (const row of collectReplyNotificationsForNovel(novelId, novel, reviewRows, replyRows, {
            viewerId,
            viewerNames: viewerNameCandidates,
            replyRows,
          })) {
            out.push({
              id: row.id,
              at: Number(row.at || 0),
              readAliases: row.readAliases,
            })
          }
          return { items: out }
        }),
      )
      if (!active) return
      const notifications = all.flatMap((it) => (Array.isArray(it?.items) ? it.items : []))
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
        notifications.set(sys.id, sys)
      }
      const notificationList = [...notifications.values()]
      const unread = countUnreadNotifications(notificationList, readMap)
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
