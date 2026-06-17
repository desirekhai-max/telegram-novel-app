import {
  AlertCircle,
  Bell,
  ChevronDown,
  ChevronUp,
  Eye,
  Heart,
  ListOrdered,
  MessageCircle,
  Search,
  SendHorizontal,
  Star,
  X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getNovelById } from '../data/novels.js'
import {
  fetchNovelFull,
  chapterRequiresVip,
  novelHasFullContent,
  resolveInitialNovel,
  NOVELS_BUNDLED_UPDATED_EVENT,
} from '../lib/novelsRuntime.js'
import { canDevGuestReadNovel } from '../lib/devGuestRead.js'
import { resolveNovelCoverUrl } from '../lib/resolveNovelCoverUrl.js'
import ReaderDetailSkeleton from '../components/ReaderDetailSkeleton.jsx'
import ReaderArticleSkeleton from '../components/ReaderArticleSkeleton.jsx'
import {
  logDetailPageReady,
  logPageFirstRender,
  logReaderPageReady,
} from '../lib/novelLoadPerf.js'
import { formatTelegramDisplayName, useTelegramUser } from '../hooks/useTelegramUser.js'
import { useViewerProfile } from '../hooks/useViewerProfile.js'
import {
  commentPointsToStars,
  formatLatestChapterRelativeLabel,
  formatWordCountFooter,
  getDisplayWordCountWan,
  getMeatCategoryByWordCount,
  getNovelCardListThemes,
} from '../lib/novelDisplay.js'
import { CommentMemberBadges } from '../components/CommentMemberBadges.jsx'
import ReaderWatermarkOverlay from '../components/ReaderWatermarkOverlay.jsx'
import { useReadingContentProtection } from '../hooks/useReadingContentProtection.js'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount.js'
import { normalizeStoredMemberTier } from '../lib/memberTier.js'
import { refreshAppFromLogo } from '../lib/refreshAppFromLogo.js'
import { tryOpenTelegramMeLink } from '../lib/telegramWebApp.js'
import { formatReadingRecordInstant } from '../lib/adminDateTimePickerUtils.js'
import {
  appendNovelReplyVerbose,
  appendNovelReportVerbose,
  appendReadingRecord,
  appendNovelReviewVerbose,
  fetchNovelFavoriteState,
  fetchNovelLikeState,
  fetchNovelReplies,
  fetchNovelReviews,
  fetchNovelViewCount,
  getPresenceMemberId,
  incrementNovelViewCount,
  reportMetricEvent,
  toggleNovelFavoriteVerbose,
  toggleNovelLikeVerbose,
  voteNovelReviewVerbose,
} from '../lib/miniAppPresence.js'
import { buildOrderNo } from '../lib/orderNo.js'
import {
  formatReaderSubmitErrorKm,
  READER_ARTICLE_AUTHOR_LABEL_KM,
  READER_ARTICLE_AUTHOR_UNKNOWN_KM,
  READER_ARTICLE_WORD_COUNT_LABEL_KM,
  READER_ARTICLE_WORD_UNIT_KM,
  READER_BACK_TO_LIST_KM,
  READER_NOVEL_NOT_FOUND_DESC_KM,
  READER_NOVEL_NOT_FOUND_TITLE_KM,
  READER_NO_BODY_KM,
  READER_NO_CHAPTER_YET_KM,
  READER_SHARE_DETAIL_FALLBACK_KM,
  READER_THEME_UNCATEGORIZED_KM,
  READER_VIP_CHAPTER_GATE_DESC_KM,
  READER_VIP_CHAPTER_GATE_TITLE_KM,
} from '../lib/errorMessagesKm.js'
import {
  persistAndBroadcastDetailStats,
  resolveInitialDetailDisplayStats,
} from '../lib/novelDetailStatsSync.js'
import { mergeDisplayedViewCount, mergeDisplayedInteractionCount, getSeedFavoriteCount, getSeedLikeCount, getSeedViewCount } from '../lib/novelSeedStats.js'
import { bumpLocalViewMax } from '../lib/novelViewCountLocal.js'
import { appendReadingHistoryLocal, saveLastRead } from '../lib/readerStorage.js'

function chapterAccessLabel(chapter, isVipReader) {
  if (chapterRequiresVip(chapter)) {
    return isVipReader ? 'VIP' : 'សមាជិកVIP'
  }
  return 'ឥតគិតថ្លៃ'
}

const COMMENT_VOTES_STORAGE_KEY = 'tg_novel_comment_votes_v1'
const COMMENT_SUBMIT_RETRY_MS = 450
const DETAIL_INTERACTIONS_STORAGE_KEY = 'tg_novel_detail_interactions_v1'

function readDetailInteractions() {
  try {
    const raw = localStorage.getItem(DETAIL_INTERACTIONS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeDetailInteractions(next) {
  try {
    localStorage.setItem(DETAIL_INTERACTIONS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore storage errors */
  }
}

function resolveInteractionByNovelId(all, novelId) {
  const row = all?.[String(novelId)]
  if (!row || typeof row !== 'object') return null
  const out = {}
  if (typeof row.liked === 'boolean') out.liked = row.liked
  if (typeof row.favorited === 'boolean') out.favorited = row.favorited
  return Object.keys(out).length ? out : null
}

function mergeCountByLocalPreference(serverCount, serverState, localState) {
  const base = Math.max(0, Number(serverCount) || 0)
  if (typeof localState !== 'boolean') return { count: base, state: Boolean(serverState) }
  if (localState === Boolean(serverState)) return { count: base, state: localState }
  if (localState) return { count: base + 1, state: true }
  return { count: Math.max(0, base - 1), state: false }
}

function chapterHasReadableBody(novel, chapterIndex) {
  if (!novel || !Number.isFinite(chapterIndex) || chapterIndex < 0) return false
  const ch = (novel.chapters ?? [])[chapterIndex]
  const body = ch?.body
  if (!Array.isArray(body) || body.length === 0) return false
  return body.some((p) => String(p ?? '').trim().length > 0)
}

function findFirstReadableChapterIndex(novel) {
  const chapters = novel?.chapters ?? []
  for (let i = 0; i < chapters.length; i += 1) {
    if (chapterHasReadableBody(novel, i)) return i
  }
  return -1
}

function displayMemberIdForRecord(tgUser) {
  if (tgUser?.id != null) return String(tgUser.id)
  const raw = getPresenceMemberId()
  if (raw.startsWith('tg_')) return raw.slice(3)
  return raw.length > 24 ? `${raw.slice(0, 20)}…` : raw
}

function reportReadOnChapterOpen(novel, chapterIndex, tgUser, isVipReader) {
  if (!chapterHasReadableBody(novel, chapterIndex)) return
  void reportMetricEvent('read')
  const readAt = formatReadingRecordInstant()
  const ts = Date.now()
  const seq = Math.floor(Math.random() * 100)
  const memberOrder = buildOrderNo(new Date(ts), seq)
  const ch = novel.chapters?.[chapterIndex]
  const readChapter =
    ch?.title && String(ch.title).trim()
      ? String(ch.title).trim()
      : `ភាគទី${chapterIndex + 1}`
  void appendReadingRecord({
    memberName: tgUser ? formatTelegramDisplayName(tgUser) : 'ភ្ញៀវ',
    memberId: displayMemberIdForRecord(tgUser),
    memberAccount: tgUser?.username ? `@${tgUser.username}` : '',
    memberLevel: chapterAccessLabel(novel.chapters?.[chapterIndex], isVipReader),
    memberOrder,
    novelId: String(novel?.id || ''),
    shelfTitle: String(novel?.title || ''),
    readChapter,
    readAt,
    ts,
    chapterIndex,
  })
  appendReadingHistoryLocal({
    novelId: String(novel?.id || ''),
    shelfTitle: String(novel?.title || ''),
    readChapter,
    readAt,
    ts,
    chapterIndex,
  })
}

function formatCommentTimeAgo(ts, nowMs = Date.now()) {
  const t = Number(ts)
  if (!Number.isFinite(t) || t <= 0) return '1 វិនាទីមុន'
  const d = Math.max(0, nowMs - t)
  const sec = Math.floor(d / 1000)
  if (sec < 60) return `${Math.max(1, sec)} វិនាទីមុន`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${Math.max(1, min)} នាទីមុន`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${Math.max(1, hour)} ម៉ោងមុន`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${Math.max(1, day)} ថ្ងៃមុន`
  const month = Math.floor(day / 30)
  if (month < 12) return `${Math.max(1, month)} ខែមុន`
  const year = Math.floor(day / 365)
  return `${Math.max(1, year)} ឆ្នាំមុន`
}

function normalizeStoredRole(row) {
  return String(row?.memberRole || '').toLowerCase().trim() === 'author' ? 'author' : ''
}

function buildCommentBadgeProps(row) {
  return {
    tier: normalizeStoredMemberTier(row?.memberTier) || 'normal',
    role: normalizeStoredRole(row),
    vipActive: Boolean(row?.vipActive),
  }
}

function buildReplyThreadTree(replies) {
  const list = Array.isArray(replies) ? replies : []
  const ordered = [...list].sort((a, b) => Number(a?.at || 0) - Number(b?.at || 0))
  const byId = new Map()
  ordered.forEach((r) => {
    byId.set(String(r?.id || ''), { ...r, children: [] })
  })
  const roots = []
  ordered.forEach((r, idx) => {
    const node = byId.get(String(r?.id || ''))
    if (!node) return
    const pid = String(r?.parentReplyId || '').trim()
    if (pid && byId.has(pid)) {
      const parentNode = byId.get(pid)
      if (!node.replyToName) {
        node.replyToName = String(parentNode?.name || '').trim()
      }
      parentNode.children.push(node)
      return
    }
    // 兼容旧数据：如果没有 parentReplyId，但有 replyToName，则尽量挂到被回复人的最近一条回复下。
    const replyToName = String(r?.replyToName || '').trim()
    if (replyToName) {
      for (let i = idx - 1; i >= 0; i -= 1) {
        const prev = ordered[i]
        if (String(prev?.name || '').trim() !== replyToName) continue
        const prevId = String(prev?.id || '')
        if (!prevId || !byId.has(prevId)) continue
        byId.get(prevId).children.push(node)
        return
      }
      // 已带「回复给谁」但未匹配到同名节点（常见：回复主评论作者）：顶层展示，勿挂到上一条以免 ▶ 显示成自己
      roots.push(node)
      return
    }
    // 再兜底：如果没有明确指向，就接到上一条回复下面，避免“互相回复”丢层级。
    if (idx > 0) {
      const prev = ordered[idx - 1]
      const prevId = String(prev?.id || '')
      if (prevId && byId.has(prevId)) {
        const parentNode = byId.get(prevId)
        if (!node.replyToName) {
          node.replyToName = String(parentNode?.name || '').trim()
        }
        parentNode.children.push(node)
        return
      }
    }
    roots.push(node)
  })
  const sortNodes = (arr) => {
    arr.sort((a, b) => Number(a?.at || 0) - Number(b?.at || 0))
    arr.forEach((n) => sortNodes(n.children))
  }
  sortNodes(roots)
  return roots
}

export default function ReaderPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  /** 跟手露出 AppShell 真实上一页；勿 instantBack，避免松手先弹回再跳转晃动 */
  const edgeSwipeHandlers = useEdgeSwipeBack({ triggerRatio: 0.1 })
  const tgUser = useTelegramUser()
  const { viewerProfile } = useViewerProfile()
  const unreadNotificationCount = useUnreadNotificationCount(tgUser)
  const [novel, setNovel] = useState(() => resolveInitialNovel(id).novel)
  const [loadStatus, setLoadStatus] = useState(() => resolveInitialNovel(id).loadStatus)
  const pageMountAtRef = useRef(0)
  const detailReadyLoggedRef = useRef(false)
  const readerReadyLoggedRef = useRef('')
  const [introExpanded, setIntroExpanded] = useState(false)
  const [catalogDesc, setCatalogDesc] = useState(false)
  const [commentSort, setCommentSort] = useState('latest')
  const [searchDraft, setSearchDraft] = useState('')
  const [commentVotes, setCommentVotes] = useState({})
  const [extraReplies, setExtraReplies] = useState({})
  const [replyTarget, setReplyTarget] = useState(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [replySubmitPending, setReplySubmitPending] = useState(false)
  const [replySubmitError, setReplySubmitError] = useState('')
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportDraft, setReportDraft] = useState('')
  const [reportSubmitPending, setReportSubmitPending] = useState(false)
  const [reportSubmitError, setReportSubmitError] = useState('')
  const [likedDetail, setLikedDetail] = useState(false)
  const [detailLikeHydrated, setDetailLikeHydrated] = useState(false)
  const initialDetailStats = resolveInitialDetailDisplayStats(resolveInitialNovel(id).novel)
  const [likeCount, setLikeCount] = useState(initialDetailStats.likeCount)
  const [favoritedDetail, setFavoritedDetail] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(initialDetailStats.favoriteCount)
  const [viewCount, setViewCount] = useState(initialDetailStats.viewCount)
  const [ratingPointsFloor, setRatingPointsFloor] = useState(initialDetailStats.ratingPoints)
  const [likeBump, setLikeBump] = useState(false)
  const [commentVotesHydrated, setCommentVotesHydrated] = useState(false)
  const [nowTs, setNowTs] = useState(() => Date.now())
  /** 章节门控：每章 `isVip` 由后台配置；免费章人人可读，VIP 章仅已激活 VIP 可读。 */
  const isVipReader = Boolean(viewerProfile.vipActive)
  const [reviewItems, setReviewItems] = useState([])
  const [startReadPageOpen, setStartReadPageOpen] = useState(false)
  const [chapterVipGateOpen, setChapterVipGateOpen] = useState(false)
  const [readingChapterIndex, setReadingChapterIndex] = useState(null)
  const [articleHeaderCompact, setArticleHeaderCompact] = useState(false)
  const articleSwipeRef = useRef({ startX: 0, startY: 0, tracking: false, axis: null })
  const articleSwipeDxRef = useRef(0)
  const articleSwipeResetTimerRef = useRef(0)
  const articleOverlayRef = useRef(null)
  const articleScrollRef = useRef(null)
  const articleLayerRef = useRef(null)
  const readerDetailScrollRef = useRef(null)
  const [vipJumpingChapterIndex, setVipJumpingChapterIndex] = useState(null)
  const vipJumpTimerRef = useRef(0)
  const catalogSectionRef = useRef(null)
  const commentFeedSectionRef = useRef(null)
  const lastFocusedCommentRef = useRef('')
  const highlightTimerRef = useRef(0)
  const [highlightTargetId, setHighlightTargetId] = useState('')
  const [expandedReplyMap, setExpandedReplyMap] = useState({})
  const isMiniAppLoggedIn = Boolean(tgUser)
  const devGuestRead = canDevGuestReadNovel(id)
  const effectiveVipReader = isVipReader || devGuestRead

  useEffect(() => {
    const t0 = performance.now()
    pageMountAtRef.current = t0
    requestAnimationFrame(() => {
      logPageFirstRender('Detail', performance.now() - t0)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    pageMountAtRef.current = performance.now()
    const initial = resolveInitialNovel(id)
    setNovel(initial.novel)
    setLoadStatus(initial.loadStatus)
    detailReadyLoggedRef.current = false
    readerReadyLoggedRef.current = ''
    pageMountAtRef.current = performance.now()

    if (initial.loadStatus === 'ready') {
      detailReadyLoggedRef.current = true
      logDetailPageReady(performance.now() - pageMountAtRef.current, id)
    }

    const bundled = getNovelById(id)
    void fetchNovelFull(id)
      .then((loaded) => {
        if (cancelled) return
        if (loaded) {
          setNovel(loaded)
          setLoadStatus('ready')
          if (!detailReadyLoggedRef.current) {
            detailReadyLoggedRef.current = true
            logDetailPageReady(performance.now() - pageMountAtRef.current, id)
          }
          return
        }
        if (!bundled && !initial.novel) {
          setLoadStatus('notFound')
        }
      })
      .catch(() => {
        if (cancelled) return
        if (!bundled && !initial.novel) {
          setLoadStatus('notFound')
        }
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    const onBundledUpdated = () => {
      void fetchNovelFull(id, { force: true }).then((loaded) => {
        if (!loaded) return
        setNovel(loaded)
        setLoadStatus('ready')
      })
    }
    window.addEventListener(NOVELS_BUNDLED_UPDATED_EVENT, onBundledUpdated)
    return () => window.removeEventListener(NOVELS_BUNDLED_UPDATED_EVENT, onBundledUpdated)
  }, [id])

  const ensureMiniAppLoggedIn = () => {
    if (isMiniAppLoggedIn) return true
    setStartReadPageOpen(true)
    return false
  }
  const ensureCanOpenChapter = () => {
    if (isMiniAppLoggedIn || devGuestRead) return true
    setStartReadPageOpen(true)
    return false
  }
  const onCloseStartReadPage = () => setStartReadPageOpen(false)
  const onEnterCatalogFromStartReadPage = () => {
    setStartReadPageOpen(false)
    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const onEnterLoginFromStartReadPage = () => {
    setStartReadPageOpen(false)
    navigate('/account')
  }
  const onCloseChapterVipGate = () => setChapterVipGateOpen(false)
  const onGoVipFromChapterGate = () => {
    setChapterVipGateOpen(false)
    navigate('/vip')
  }

  const scrollReadingArticleToTop = () => {
    const el = articleScrollRef.current
    if (!el) return
    el.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToCommentFeedSection = () => {
    const el = commentFeedSectionRef.current
    if (!el) return
    const wrap = readerDetailScrollRef.current
    if (wrap) {
      window.requestAnimationFrame(() => {
        const top = el.offsetTop - 10
        wrap.scrollTop = Math.max(0, top)
      })
      return
    }
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'auto', block: 'start' })
    })
  }

  const scrollToTargetElement = (elementId) => {
    const idText = String(elementId || '').trim()
    if (!idText) return false
    const target = document.getElementById(idText)
    if (!target) return false
    const wrap = readerDetailScrollRef.current
    if (wrap) {
      const targetTop = target.offsetTop
      const centeredTop = Math.max(0, targetTop - (wrap.clientHeight - target.clientHeight) / 2)
      window.requestAnimationFrame(() => {
        wrap.scrollTop = centeredTop
      })
    } else {
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'auto', block: 'center' })
      })
    }
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = 0
    }
    setHighlightTargetId(idText)
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightTargetId('')
      highlightTimerRef.current = 0
    }, 1700)
    return true
  }

  const scrollToTargetComment = (commentId, replyId) => {
    const rid = String(replyId || '').trim()
    if (rid) return scrollToTargetElement(`tg-reply-${rid}`)
    const cid = String(commentId || '').trim()
    if (!cid) return false
    return scrollToTargetElement(`tg-comment-${cid}`)
  }

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!novel || loadStatus !== 'ready') return
    saveLastRead({ id: novel.id, title: novel.title })
  }, [novel, loadStatus, tgUser?.id])

  useEffect(() => {
    const focusCommentId = String(location.state?.focusCommentId || '').trim()
    const focusReplyId = String(location.state?.focusReplyId || '').trim()
    if (!focusCommentId && !focusReplyId) return
    const token = `${location.key || ''}:${focusCommentId}:${focusReplyId}`
    if (lastFocusedCommentRef.current === token) return
    setCommentSort('latest')
    setSearchDraft('')
    if (focusCommentId) {
      setExpandedReplyMap((prev) => ({ ...prev, [focusCommentId]: true }))
    }
    if (focusReplyId) {
      // 通知目标可能在折叠区：先展开所有评论线程，确保目标 reply DOM 一定会渲染出来。
      setExpandedReplyMap((prev) => {
        const next = { ...prev }
        for (const it of reviewItems) {
          const id = String(it?.id || '').trim()
          if (id) next[id] = true
        }
        if (focusCommentId) next[focusCommentId] = true
        return next
      })
    }
    let tries = 0
    const maxTries = 120
    const timer = window.setInterval(() => {
      tries += 1
      const located = scrollToTargetComment(focusCommentId, focusReplyId)
      if (located || tries >= maxTries) {
        if (located) lastFocusedCommentRef.current = token
        window.clearInterval(timer)
      }
    }, 80)
    return () => window.clearInterval(timer)
  }, [location.key, location.state?.focusCommentId, location.state?.focusReplyId, reviewItems, extraReplies])

  useEffect(() => {
    setArticleHeaderCompact(false)
  }, [readingChapterIndex])
  useLayoutEffect(() => {
    if (!novel?.id) return
    const stats = resolveInitialDetailDisplayStats(novel)
    setViewCount(stats.viewCount)
    setLikeCount(stats.likeCount)
    setFavoriteCount(stats.favoriteCount)
    setRatingPointsFloor(stats.ratingPoints)
    setReviewItems([])
    setExtraReplies({})
  }, [novel?.id])
  useEffect(() => {
    if (!novel) return
    setDetailLikeHydrated(false)
    setCommentVotesHydrated(false)
    const stats = resolveInitialDetailDisplayStats(novel)
    const safeBaseViewCount = getSeedViewCount(novel)
    setViewCount((prev) => Math.max(prev, stats.viewCount))
    void fetchNovelViewCount(novel.id, safeBaseViewCount).then((count) => {
      setViewCount((prev) => Math.max(prev, mergeDisplayedViewCount(safeBaseViewCount, count)))
    })
    const baseLikeCount = getSeedLikeCount(novel)
    const baseFavoriteCount = getSeedFavoriteCount(novel)
    const likerId = tgUser?.id != null ? `tg_${tgUser.id}` : getPresenceMemberId()
    const localInteractions = resolveInteractionByNovelId(readDetailInteractions(), novel.id)
    setLikeCount((prev) => Math.max(prev, stats.likeCount, baseLikeCount))
    setFavoriteCount((prev) => Math.max(prev, stats.favoriteCount, baseFavoriteCount))
    setFavoritedDetail(false)
    void Promise.all([
      fetchNovelLikeState(novel.id, likerId, baseLikeCount),
      fetchNovelFavoriteState(novel.id, likerId, baseFavoriteCount),
    ]).then(([likeState, favoriteState]) => {
      const mergedLike = mergeCountByLocalPreference(
        mergeDisplayedInteractionCount(baseLikeCount, Number(likeState?.count) || 0),
        Boolean(likeState?.liked),
        localInteractions?.liked,
      )
      const mergedFavorite = mergeCountByLocalPreference(
        mergeDisplayedInteractionCount(baseFavoriteCount, Number(favoriteState?.count) || 0),
        Boolean(favoriteState?.favorited),
        localInteractions?.favorited,
      )
      setLikedDetail(mergedLike.state)
      setLikeCount(mergedLike.count)
      setFavoritedDetail(mergedFavorite.state)
      setFavoriteCount(mergedFavorite.count)
      setDetailLikeHydrated(true)
    })
    try {
      const rawVotes = localStorage.getItem(COMMENT_VOTES_STORAGE_KEY)
      const allVotes = rawVotes ? JSON.parse(rawVotes) : {}
      const votesByNovel = allVotes?.[String(novel.id)]
      setCommentVotes(votesByNovel && typeof votesByNovel === 'object' ? votesByNovel : {})
    } catch {
      setCommentVotes({})
    } finally {
      setCommentVotesHydrated(true)
    }
    setLikeBump(false)
  }, [novel, tgUser?.id])
  useEffect(() => {
    if (!novel || !commentVotesHydrated) return
    let all = {}
    try {
      const raw = localStorage.getItem(COMMENT_VOTES_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      all = parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      all = {}
    }
    try {
      const next = { ...all, [String(novel.id)]: commentVotes }
      localStorage.setItem(COMMENT_VOTES_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore storage errors */
    }
  }, [commentVotes, novel, commentVotesHydrated])
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!novel) return
    let cancelled = false
    const pull = async () => {
      const [items, replies] = await Promise.all([
        fetchNovelReviews(novel.id),
        fetchNovelReplies(novel.id),
      ])
      if (cancelled) return
      setReviewItems(items)
      const groupedReplies = replies.reduce((acc, row) => {
        const key = String(row?.parentCommentId || '')
        if (!key) return acc
        const mapped = {
          id: String(row?.id || `${key}-${row?.at || Date.now()}`),
          name: String(row?.userName ?? row?.name ?? tgUser?.first_name ?? 'A'),
          userId: row?.userId,
          replyToUserId: row?.replyToUserId,
          memberTier: row?.memberTier,
          memberRole: row?.memberRole,
          vipActive: row?.vipActive,
          parentReplyId: String(row?.parentReplyId || '').trim(),
          replyToName: String(row?.replyToName || '').trim(),
          avatar: row?.userAvatar ?? row?.avatar ?? tgUser?.photo_url ?? null,
          text: String(row?.text || '').trim(),
          at: Number(row?.at || Date.now()),
        }
        if (!mapped.text) return acc
        const list = acc[key] ?? []
        list.push(mapped)
        acc[key] = list
        return acc
      }, {})
      setExtraReplies(groupedReplies)
    }
    pull()
    const timer = window.setInterval(pull, 15000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [novel, tgUser?.first_name, tgUser?.photo_url])

  useEffect(() => {
    if (!novel) return
    let cancelled = false
    const sync = async () => {
      const likerId = tgUser?.id != null ? `tg_${tgUser.id}` : getPresenceMemberId()
      const localInteractions = resolveInteractionByNovelId(readDetailInteractions(), novel.id)
      const seedV = getSeedViewCount(novel)
      const seedL = getSeedLikeCount(novel)
      const seedF = getSeedFavoriteCount(novel)
      const floor = resolveInitialDetailDisplayStats(novel)
      const [latestViewCount, latestLikeState, latestFavoriteState] = await Promise.all([
        fetchNovelViewCount(novel.id, seedV),
        fetchNovelLikeState(novel.id, likerId, seedL),
        fetchNovelFavoriteState(novel.id, likerId, seedF),
      ])
      if (cancelled) return
      setViewCount((prev) =>
        Math.max(prev, floor.viewCount, mergeDisplayedViewCount(seedV, latestViewCount)),
      )
      const mergedLike = mergeCountByLocalPreference(
        mergeDisplayedInteractionCount(seedL, Number(latestLikeState?.count) || 0),
        Boolean(latestLikeState?.liked),
        localInteractions?.liked,
      )
      const mergedFavorite = mergeCountByLocalPreference(
        mergeDisplayedInteractionCount(seedF, Number(latestFavoriteState?.count) || 0),
        Boolean(latestFavoriteState?.favorited),
        localInteractions?.favorited,
      )
      setLikedDetail(mergedLike.state)
      setLikeCount((prev) => Math.max(prev, floor.likeCount, mergedLike.count))
      setFavoritedDetail(mergedFavorite.state)
      setFavoriteCount((prev) => Math.max(prev, floor.favoriteCount, mergedFavorite.count))
    }
    void sync()
    const timer = window.setInterval(sync, 15000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [novel, tgUser?.id])

  /** 将详情当前展示的三项统计同步给首页卡片（sessionStorage + 事件），与详情数字一致 */
  useEffect(() => {
    if (!novel?.id) return undefined
    const id = String(novel.id)
    let raf1 = 0
    let raf2 = 0
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        persistAndBroadcastDetailStats(id, {
          viewCount,
          likeCount,
          favoriteCount,
        })
      })
    })
    return () => {
      window.cancelAnimationFrame(raf1)
      window.cancelAnimationFrame(raf2)
    }
  }, [novel?.id, viewCount, likeCount, favoriteCount])

  useEffect(() => {
    if (!startReadPageOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseStartReadPage()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [startReadPageOpen, isMiniAppLoggedIn])
  useEffect(
    () => () => {
      if (vipJumpTimerRef.current) {
        window.clearTimeout(vipJumpTimerRef.current)
      }
      if (articleSwipeResetTimerRef.current) {
        window.clearTimeout(articleSwipeResetTimerRef.current)
      }
    },
    [],
  )
  const applyArticleLayerTransform = (dx, animate) => {
    const el = articleLayerRef.current
    if (!el) {
      articleSwipeDxRef.current = dx
      return
    }
    el.style.transition = animate ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
    el.style.transform = `translate3d(${dx}px, 0, 0)`
    articleSwipeDxRef.current = dx
  }
  const chapterRows = useMemo(() => {
    if (!novel) return []
    const source = novel.chapters ?? []
    const total = source.length
    return Array.from({ length: total }, (_, idx) => {
      const ch = source[idx]
      return {
        id: `${novel.id}-${idx + 1}`,
        chapterIndex: idx,
        title: `ភាគទី${idx + 1}`,
        access: chapterAccessLabel(ch, isVipReader),
        requiresVip: chapterRequiresVip(ch),
        rawTitle: ch?.title ?? `ភាគទី${idx + 1}`,
      }
    })
  }, [novel, isVipReader])
  const displayedChapterRows = useMemo(
    () => (catalogDesc ? [...chapterRows].reverse() : chapterRows),
    [catalogDesc, chapterRows],
  )
  const commentFeed = useMemo(() => {
    if (reviewItems.length > 0) {
      return [...reviewItems]
        .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
        .map((it, idx) => ({
          id: String(it.id ?? `rv-${it.at ?? 0}-${idx}`),
          at: Number(it.at ?? 0),
          name: String(it.userName ?? it.name ?? tgUser?.first_name ?? `Reader_${idx + 1}`),
          userId: it.userId,
          memberTier: it.memberTier,
          memberRole: it.memberRole,
          vipActive: it.vipActive,
          avatar: it.userAvatar ?? it.avatar ?? tgUser?.photo_url ?? null,
          text: it.text || '…',
          ago: formatCommentTimeAgo(it.at, nowTs),
          likes: Number(it.likes ?? 0),
          dislikes: Number(it.dislikes ?? 0),
          showReplyFold: idx === 2,
        }))
    }
    return []
  }, [nowTs, reviewItems, tgUser?.first_name, tgUser?.photo_url])
  const extraReplyCount = useMemo(
    () =>
      Object.values(extraReplies).reduce(
        (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
        0,
      ),
    [extraReplies],
  )
  const liveCommentCount = commentFeed.length + extraReplyCount
  const totalCommentCount = Math.max(ratingPointsFloor, liveCommentCount)
  const commentPoints = Math.min(100, totalCommentCount)
  const commentStarValue = commentPointsToStars(commentPoints)
  const displayedCommentFeed = useMemo(() => {
    const list = [...commentFeed]
    if (commentSort === 'latest') {
      return list.sort((a, b) => {
        const ta = Number(a.at ?? 0)
        const tb = Number(b.at ?? 0)
        return tb - ta
      })
    }
    return list.sort((a, b) => {
      const ta = Number(a.at ?? 0)
      const tb = Number(b.at ?? 0)
      return ta - tb
    })
  }, [commentFeed, commentSort])

  const onOpenReplyModal = (targetId, targetName, replyToName = '', parentReplyId = '', replyToUserId = null) => {
    if (!ensureMiniAppLoggedIn()) return
    setReplyTarget({
      id: targetId,
      name: targetName,
      mode: 'reply',
      replyToName: String(replyToName || '').trim(),
      parentReplyId: String(parentReplyId || '').trim(),
      replyToUserId: Number.isFinite(Number(replyToUserId)) ? Number(replyToUserId) : null,
    })
    setReplyDraft((prev) => {
      const trimmed = String(prev || '').trim()
      if (trimmed) return prev
      return ''
    })
    setReplySubmitError('')
  }
  const onOpenCommentModal = () => {
    if (!ensureMiniAppLoggedIn()) return
    setReplyTarget({ id: `novel-${novel.id}`, name: novel.title, mode: 'comment' })
    setReplyDraft('')
    setReplySubmitError('')
  }
  const onCloseReplyModal = () => {
    setReplyTarget(null)
    setReplyDraft('')
    setReplySubmitPending(false)
    setReplySubmitError('')
  }
  const onOpenReportModal = () => {
    if (!ensureMiniAppLoggedIn()) return
    setReportModalOpen(true)
    setReportDraft('')
    setReportSubmitError('')
  }
  const onCloseReportModal = () => {
    setReportModalOpen(false)
    setReportDraft('')
    setReportSubmitPending(false)
    setReportSubmitError('')
  }
  const onSubmitReport = async () => {
    if (!ensureMiniAppLoggedIn()) return
    if (reportSubmitPending) return
    const text = reportDraft.trim()
    if (!text) return
    setReportSubmitPending(true)
    setReportSubmitError('')
    const { item, error, endpoint } = await appendNovelReportVerbose(novel.id, {
      text,
      novelTitle: novel.title,
      userName: tgUser ? formatTelegramDisplayName(tgUser) : 'A',
      userAvatar: tgUser?.photo_url ?? null,
      userId: tgUser?.id,
    })
    if (!item) {
      setReportSubmitPending(false)
      setReportSubmitError(formatReaderSubmitErrorKm(error ?? '', endpoint ?? ''))
      return
    }
    onCloseReportModal()
  }
  const onSubmitReply = async () => {
    if (!ensureMiniAppLoggedIn()) return
    if (replySubmitPending) return
    const text = replyDraft.trim()
    if (!text || !replyTarget?.id) return
    if (replyTarget.mode === 'comment') {
      setReplySubmitPending(true)
      setReplySubmitError('')
      const { item: saved, error: submitError, endpoint: submitEndpoint } = await appendNovelReviewVerbose(novel.id, {
        score: 1,
        text,
        userName: tgUser ? formatTelegramDisplayName(tgUser) : 'A',
        userAvatar: tgUser?.photo_url ?? null,
        userId: tgUser?.id,
      })
      if (!saved) {
        const retryItems = await fetchNovelReviews(novel.id)
        const hasSameText = retryItems.some((it) => String(it?.text || '').trim() === text)
        if (hasSameText) {
          setReviewItems(retryItems)
          setReplySubmitPending(false)
          setCommentSort('latest')
          onCloseReplyModal()
          scrollToCommentFeedSection()
          return
        }
        await new Promise((r) => window.setTimeout(r, COMMENT_SUBMIT_RETRY_MS))
        const retryItems2 = await fetchNovelReviews(novel.id)
        const hasSameText2 = retryItems2.some((it) => String(it?.text || '').trim() === text)
        if (hasSameText2) {
          setReviewItems(retryItems2)
          setReplySubmitPending(false)
          setCommentSort('latest')
          onCloseReplyModal()
          scrollToCommentFeedSection()
          return
        }
        setReplySubmitPending(false)
        setReplySubmitError(formatReaderSubmitErrorKm(submitError ?? '', submitEndpoint ?? ''))
        return
      }
      const items = await fetchNovelReviews(novel.id)
      if (Array.isArray(items) && items.length > 0) {
        setReviewItems(items)
      } else {
        setReviewItems((prev) => [saved, ...prev])
      }
      setReplySubmitPending(false)
      setCommentSort('latest')
      setReplyDraft('')
      setReplySubmitPending(false)
      setReplySubmitError('')
      setReplyTarget(null)
      scrollToCommentFeedSection()
      return
    }
    setReplySubmitPending(true)
    setReplySubmitError('')
    const { item: savedReply, error: replyError, endpoint: replyEndpoint } = await appendNovelReplyVerbose(
      novel.id,
      replyTarget.id,
      {
        text,
        userName: tgUser ? formatTelegramDisplayName(tgUser) : 'A',
        userAvatar: tgUser?.photo_url ?? null,
        userId: tgUser?.id,
        replyToName: String(replyTarget?.replyToName || '').trim(),
        parentReplyId: String(replyTarget?.parentReplyId || '').trim(),
        replyToUserId: Number.isFinite(Number(replyTarget?.replyToUserId))
          ? Number(replyTarget.replyToUserId)
          : undefined,
      },
    )
    if (!savedReply) {
      setReplySubmitPending(false)
      setReplySubmitError(formatReaderSubmitErrorKm(replyError ?? '', replyEndpoint ?? ''))
      return
    }
    const replies = await fetchNovelReplies(novel.id)
    const groupedReplies = replies.reduce((acc, row) => {
      const key = String(row?.parentCommentId || '')
      if (!key) return acc
      const mapped = {
        id: String(row?.id || `${key}-${row?.at || Date.now()}`),
        name: String(row?.userName ?? row?.name ?? tgUser?.first_name ?? 'A'),
        userId: row?.userId,
        replyToUserId: row?.replyToUserId,
        memberTier: row?.memberTier,
        memberRole: row?.memberRole,
        vipActive: row?.vipActive,
        parentReplyId: String(row?.parentReplyId || '').trim(),
        replyToName: String(row?.replyToName || '').trim(),
        avatar: row?.userAvatar ?? row?.avatar ?? tgUser?.photo_url ?? null,
        text: String(row?.text || '').trim(),
        at: Number(row?.at || Date.now()),
      }
      if (!mapped.text) return acc
      const list = acc[key] ?? []
      list.push(mapped)
      acc[key] = list
      return acc
    }, {})
    setExtraReplies(groupedReplies)
    const expandCommentId = replyTarget?.id != null ? String(replyTarget.id) : ''
    if (expandCommentId) {
      setExpandedReplyMap((prev) => ({ ...prev, [expandCommentId]: true }))
    }
    setReplySubmitPending(false)
    setReplySubmitError('')
    setReplyDraft('')
    setReplyTarget(null)
  }
  const onToggleDetailLike = () => {
    if (!ensureMiniAppLoggedIn()) return
    if (!novel?.id) return
    const next = !likedDetail
    setLikedDetail(next)
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)))
    const all = readDetailInteractions()
    const prev = resolveInteractionByNovelId(all, novel.id) ?? {}
    writeDetailInteractions({
      ...all,
      [String(novel.id)]: { ...prev, liked: next },
    })
    setLikeBump(true)
    window.setTimeout(() => setLikeBump(false), 220)
    const likerId = tgUser?.id != null ? `tg_${tgUser.id}` : getPresenceMemberId()
    void toggleNovelLikeVerbose(novel.id, likerId, next).then((resp) => {
      if (!resp.ok) return
      setLikedDetail(Boolean(resp.liked))
      if (Number.isFinite(resp.count)) {
        setLikeCount(mergeDisplayedInteractionCount(getSeedLikeCount(novel), resp.count))
      }
    })
  }
  const onToggleDetailFavorite = () => {
    if (!ensureMiniAppLoggedIn()) return
    if (!novel?.id) return
    const next = !favoritedDetail
    setFavoritedDetail(next)
    setFavoriteCount((c) => Math.max(0, c + (next ? 1 : -1)))
    const all = readDetailInteractions()
    const prev = resolveInteractionByNovelId(all, novel.id) ?? {}
    writeDetailInteractions({
      ...all,
      [String(novel.id)]: {
        ...prev,
        favorited: next,
        favoritedAtMs: next ? Date.now() : null,
        ...(next
          ? {
              title: String(novel.title || ''),
              author: String(novel.author || ''),
              coverUrl: String(novel.coverUrl || ''),
              accent: String(novel.accent || 'violet'),
              tags: Array.isArray(novel.tags) ? novel.tags : [],
              genreId: String(novel.genreId || ''),
            }
          : {}),
      },
    })
    const userId = tgUser?.id != null ? `tg_${tgUser.id}` : getPresenceMemberId()
    void toggleNovelFavoriteVerbose(novel.id, userId, next).then((resp) => {
      if (!resp.ok) return
      setFavoritedDetail(Boolean(resp.favorited))
      if (Number.isFinite(resp.count)) {
        setFavoriteCount(mergeDisplayedInteractionCount(getSeedFavoriteCount(novel), resp.count))
      }
      const serverAt = Number(resp.favoritedAtMs)
      if (next && Number.isFinite(serverAt) && serverAt > 0) {
        const synced = readDetailInteractions()
        const cur = resolveInteractionByNovelId(synced, novel.id) ?? {}
        writeDetailInteractions({
          ...synced,
          [String(novel.id)]: {
            ...cur,
            favorited: true,
            favoritedAtMs: serverAt,
          },
        })
      }
    })
  }
  const onShareToTelegramFriend = () => {
    const novelId = String(novel?.id || '').trim()
    if (!novelId) return
    let detailUrl = `/read/${encodeURIComponent(novelId)}`
    try {
      detailUrl = new URL(detailUrl, window.location.origin).toString()
    } catch {
      // Keep relative path fallback.
    }
    const shareTitle = `«${novel?.title || READER_SHARE_DETAIL_FALLBACK_KM}»`
    const authorLine = `${READER_ARTICLE_AUTHOR_LABEL_KM}: ${String(novel?.author || '').trim() || '—'}`
    // 只展示一条「小说详情」链接（url）；正文不含链接。封面由预览爬虫请求 /read/:id 时 Vite 中间件返回 og:image（开发/preview）。
    const shareText = `${shareTitle}\n${authorLine}`
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(detailUrl)}&text=${encodeURIComponent(shareText)}`
    if (tryOpenTelegramMeLink(tgShareUrl)) return
    window.open(tgShareUrl, '_blank', 'noopener,noreferrer')
  }
  const onVoteComment = async (commentId, currentVote, targetVote) => {
    if (!ensureMiniAppLoggedIn()) return
    if (!novel?.id || !commentId) return
    const nextVote = currentVote === targetVote ? null : targetVote
    const voterId = tgUser?.id != null ? `tg_${tgUser.id}` : getPresenceMemberId()
    const action = nextVote === 'up' ? 'up' : nextVote === 'down' ? 'down' : 'clear'
    // Optimistically update the local UI so tap feedback is immediate.
    setCommentVotes((prev) => ({ ...prev, [commentId]: nextVote }))
    setReviewItems((prev) =>
      prev.map((it) => {
        if (String(it?.id) !== String(commentId)) return it
        const baseLikes = Number(it?.likes ?? 0)
        const baseDislikes = Number(it?.dislikes ?? 0)
        let likes = baseLikes
        let dislikes = baseDislikes
        if (currentVote === 'up') likes = Math.max(0, likes - 1)
        if (currentVote === 'down') dislikes = Math.max(0, dislikes - 1)
        if (nextVote === 'up') likes += 1
        if (nextVote === 'down') dislikes += 1
        return { ...it, likes, dislikes }
      }),
    )
    const resp = await voteNovelReviewVerbose(
      novel.id,
      commentId,
      voterId,
      action,
      {
        name: String(tgUser ? formatTelegramDisplayName(tgUser) : '').trim(),
        avatar: String(tgUser?.photo_url || '').trim(),
      },
    )
    if (resp.ok) {
      setReviewItems((prev) =>
        prev.map((it) =>
          String(it?.id) === String(commentId)
            ? {
                ...it,
                likes: Number.isFinite(resp.likes) ? Math.max(0, Math.floor(resp.likes)) : Number(it?.likes ?? 0),
                dislikes: Number.isFinite(resp.dislikes) ? Math.max(0, Math.floor(resp.dislikes)) : Number(it?.dislikes ?? 0),
              }
            : it,
        ),
      )
    }
    // Always refresh from server to keep multi-account totals consistent.
    const refreshed = await fetchNovelReviews(novel.id)
    if (Array.isArray(refreshed) && refreshed.length > 0) {
      setReviewItems(refreshed)
    }
  }
  const onOpenChapter = (chapterIndex) => {
    if (!ensureCanOpenChapter()) return
    const chapter = novel?.chapters?.[chapterIndex]
    if (!effectiveVipReader && chapterRequiresVip(chapter)) {
      setChapterVipGateOpen(true)
      return
    }
    if (!chapterHasReadableBody(novel, chapterIndex)) return
    reportReadOnChapterOpen(novel, chapterIndex, tgUser, effectiveVipReader)
    const safeBaseViewCount = getSeedViewCount(novel)
    const optimisticNext = viewCount + 1
    setViewCount(optimisticNext)
    bumpLocalViewMax(novel.id, optimisticNext)
    void incrementNovelViewCount(novel.id, 1, safeBaseViewCount).then((serverCount) => {
      if (serverCount != null) setViewCount(mergeDisplayedViewCount(safeBaseViewCount, serverCount))
    })
    if (articleSwipeResetTimerRef.current) {
      window.clearTimeout(articleSwipeResetTimerRef.current)
      articleSwipeResetTimerRef.current = 0
    }
    articleSwipeDxRef.current = 0
    setReadingChapterIndex(chapterIndex)
    setArticleHeaderCompact(false)
    scrollReadingArticleToTop()
  }

  const historyChapterOpenedRef = useRef(false)
  useEffect(() => {
    historyChapterOpenedRef.current = false
  }, [id])
  useEffect(() => {
    if (!novel || historyChapterOpenedRef.current) return
    const raw = location.state?.openChapterIndex
    if (raw == null || !Number.isFinite(Number(raw))) return
    historyChapterOpenedRef.current = true
    onOpenChapter(Math.max(0, Math.floor(Number(raw))))
  }, [novel, location.state?.openChapterIndex])

  const onOpenStartReadPage = () => {
    if (isMiniAppLoggedIn || devGuestRead) {
      const firstReadableChapterIndex = findFirstReadableChapterIndex(novel)
      if (firstReadableChapterIndex >= 0) {
        onOpenChapter(firstReadableChapterIndex)
        return
      }
      catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    // 普通网页环境读取不到 tgUser => 视为未登录，弹登录提示页。
    setStartReadPageOpen(true)
  }

  const isReadingChapter = Boolean(
    novel && Number.isInteger(readingChapterIndex) && readingChapterIndex >= 0,
  )
  useReadingContentProtection(articleLayerRef, isReadingChapter)

  useEffect(() => {
    if (!isReadingChapter || !novel) return
    const token = `${novel.id}:${readingChapterIndex}`
    if (readerReadyLoggedRef.current === token) return
    readerReadyLoggedRef.current = token
    logReaderPageReady(performance.now() - pageMountAtRef.current, novel.id, readingChapterIndex)
  }, [isReadingChapter, novel, readingChapterIndex])

  if (loadStatus === 'notFound') {
    return (
      <div className="tg-app tg-app--reader">
        <header className="tg-toolbar tg-toolbar--reader">
          <Link to="/" className="tg-back" aria-label="ត្រឡប់">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M14 6L8 12l6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <span className="tg-toolbar__title tg-toolbar__title--muted" lang="km">
            {READER_NOVEL_NOT_FOUND_TITLE_KM}
          </span>
        </header>
        <div className="tg-empty">
          <p lang="km">{READER_NOVEL_NOT_FOUND_DESC_KM}</p>
          <Link to="/" className="tg-link">
            {READER_BACK_TO_LIST_KM}
          </Link>
        </div>
      </div>
    )
  }

  const isDetailLoading = loadStatus !== 'ready' || !novelHasFullContent(novel)

  const readerHomeHeader = !isReadingChapter ? (
    <header className="tg-toolbar tg-toolbar--large tg-toolbar--home tg-toolbar--reader-home-fixed">
      <button
        type="button"
        className="tg-toolbar__logo m-0 shrink-0 cursor-pointer leading-none"
        aria-label="ធ្វើទំព័រឡើងវិញ"
        onClick={() => refreshAppFromLogo()}
      >
        <img
          src="/logo.png"
          alt=""
          className="tg-toolbar__logo-img tg-toolbar__logo-img--tab"
          width="120"
          height="32"
          decoding="async"
          fetchPriority="high"
          loading="eager"
        />
      </button>
      <div className="tg-toolbar__search-slot min-w-0" role="search">
        <div className="tg-search-field">
          <span className="tg-search-field__icon" aria-hidden="true">
            <Search size={17} strokeWidth={2} />
          </span>
          <input
            className="tg-search-field__input"
            type="search"
            enterKeyHint="search"
            inputMode="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ស្វែងរកសៀវភៅ ឬអ្នកនិពន្ធ..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              const nextQuery = searchDraft.trim()
              if (!nextQuery) return
              navigate('/', { state: { homeSearchQuery: nextQuery } })
            }}
            aria-label="ស្វែងរកសៀវភៅ អ្នកនិពន្ធ ឬស្លាក"
          />
          {searchDraft.length > 0 ? (
            <button
              type="button"
              className="tg-search-field__clear"
              aria-label="សម្អាតការស្វែងរក"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSearchDraft('')}
            >
              <X size={15} strokeWidth={2.25} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <NavLink
        to="/notifications"
        className={({ isActive }) =>
          ['tg-toolbar-notify', isActive ? 'tg-toolbar-notify--active' : ''].filter(Boolean).join(' ')
        }
        aria-label="ការជូនដំណឹង"
      >
        <Bell size={20} strokeWidth={2} aria-hidden />
        {unreadNotificationCount > 0 ? (
          <span className="tg-toolbar-notify__badge" aria-label={`មិនទាន់អាន ${unreadNotificationCount}`}>
            {unreadNotificationCount > 99 ? '99+' : String(unreadNotificationCount)}
          </span>
        ) : null}
      </NavLink>
    </header>
  ) : null

  if (!novel) {
    return (
      <div className="tg-app tg-app--reader" {...edgeSwipeHandlers}>
        <div className="tg-reader-swipe-sheet">
          {readerHomeHeader}
          <ReaderDetailSkeleton />
        </div>
      </div>
    )
  }

  const readingChapter = isReadingChapter ? (novel.chapters ?? [])[readingChapterIndex] : null
  const readingTitle = isReadingChapter
    ? readingChapter?.title && String(readingChapter.title).trim()
      ? String(readingChapter.title).trim()
      : `ភាគទី${readingChapterIndex + 1}`
    : ''
  const readingChapterName = isReadingChapter
    ? readingTitle.replace(/^第[一二三四五六七八九十百千万0-9]+章[\s\u3000:：.-]*/u, '').trim() || readingTitle
    : ''
  const readingChapterNoLabel = isReadingChapter ? `ភាគទី${readingChapterIndex + 1}` : ''
  const readingChapterSubtitle = isReadingChapter ? `${readingChapterNoLabel} ${readingChapterName}` : ''
  const readingBody = isReadingChapter
    ? Array.isArray(readingChapter?.body)
      ? readingChapter.body.map((p) => String(p ?? ''))
      : []
    : []
  const readingChapterWordCount = readingBody.reduce((sum, p) => sum + [...String(p)].length, 0)
  const readingMetaLine = `${READER_ARTICLE_AUTHOR_LABEL_KM}: ${novel.author || READER_ARTICLE_AUTHOR_UNKNOWN_KM}    ${READER_ARTICLE_WORD_COUNT_LABEL_KM}: ${readingChapterWordCount.toLocaleString('en-US')} ${READER_ARTICLE_WORD_UNIT_KM}`

  const rel = formatLatestChapterRelativeLabel(novel)
  const latestChapter = (novel.chapters ?? [])[Math.max(0, (novel.chapters ?? []).length - 1)]
  const readingChapterCount = (novel.chapters ?? []).length
  const readingContentLoading = isReadingChapter && readingBody.length === 0 && isDetailLoading
  const readerSwipeHandlers = isReadingChapter ? {} : edgeSwipeHandlers
  const onReturnToBookCatalog = () => {
    applyArticleLayerTransform(0, false)
    setReadingChapterIndex(null)
    setArticleHeaderCompact(false)
    window.requestAnimationFrame(() => {
      catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div
      className="tg-app tg-app--reader"
      {...readerSwipeHandlers}
    >
      <div
        className={['tg-reader-swipe-sheet', isReadingChapter ? 'tg-reader-swipe-sheet--article-open' : '']
          .filter(Boolean)
          .join(' ')}
      >
      {readerHomeHeader}
      {isDetailLoading && !isReadingChapter ? (
        <ReaderDetailSkeleton partialNovel={novel} />
      ) : (
      <main ref={readerDetailScrollRef} className="tg-reader-detail" lang="km">
        <section className="tg-reader-detail__head">
          <div className={`tg-reader-detail__cover-wrap tg-reader-detail__cover-wrap--${novel.accent}`}>
            {novel.coverUrl ? (
              <img src={resolveNovelCoverUrl(novel.coverUrl)} alt="" className="tg-reader-detail__cover" />
            ) : (
              <div className="tg-reader-detail__cover-ph">{novel.title.slice(0, 1)}</div>
            )}
          </div>
          <div className="tg-reader-detail__meta">
            <h1 className="tg-reader-detail__title">{novel.title}</h1>
            <p className="tg-reader-detail__line"><span>ស្ថានភាព:</span>{novel.status === 'completed' ? 'ចប់ហើយ' : 'កំពុងចេញ'}</p>
            <p className="tg-reader-detail__line"><span>ថ្មីបំផុត:</span>{latestChapter ? `ភាគទី${(novel.chapters ?? []).length}` : READER_NO_CHAPTER_YET_KM}{rel ? ` (${rel})` : ''}</p>
            <p className="tg-reader-detail__line"><span>អ្នកនិពន្ធ:</span>{novel.author}</p>
            <p className="tg-reader-detail__line"><span>ប្រភេទ:</span>{getNovelCardListThemes(novel).join(' · ') || READER_THEME_UNCATEGORIZED_KM}</p>
            <p className="tg-reader-detail__line"><span>ប្រភព:</span>{novel.source === 'original' ? 'ស្នាដៃដើម' : 'ស្នាដៃសមាជិក'}</p>
            <p className="tg-reader-detail__line tg-reader-detail__rating">
              <span>ពិន្ទុ:</span>
              <span className="tabular-nums">{commentPoints > 0 ? Math.floor(commentPoints) : 0}</span>
              <span className="tg-reader-detail__stars" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={[
                      'tg-novel-card__star',
                      commentStarValue >= i + 1
                        ? 'tg-novel-card__star--on'
                        : commentStarValue >= i + 0.5
                          ? 'tg-novel-card__star--half'
                          : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    ★
                  </span>
                ))}
              </span>
              <em>{totalCommentCount}មតិយោបល់</em>
            </p>
          </div>
        </section>

        <button
          type="button"
          className="tg-reader-detail__read-btn"
          onClick={onOpenStartReadPage}
        >
          អានឥឡូវនេះ
        </button>

        <div className="tg-reader-detail__intro-head">
          <p className="tg-reader-detail__intro-summary">
            <span className="tg-reader-detail__intro-label">សេចក្តីសង្ខេប:</span>
            <span
              className={[
                'tg-reader-detail__intro-text',
                introExpanded ? 'tg-reader-detail__intro-text--dimmed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {novel.synopsis}
            </span>
          </p>
          <button
            type="button"
            className="tg-reader-detail__intro-chevron"
            aria-label={introExpanded ? 'បិទសេចក្តីសង្ខេប' : 'បង្ហាញសេចក្តីសង្ខេប'}
            onClick={() => setIntroExpanded((v) => !v)}
          >
            {introExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
        {introExpanded ? <p className="tg-reader-detail__intro-full">{novel.synopsis}</p> : null}

        <p className="tg-reader-detail__tags">
          <span className="tg-reader-detail__tags-label">ស្លាក:</span>
          {(novel.tags ?? []).map((t) => (
            <span key={t} className="tg-reader-detail__tag-item"><em>#</em>{t}</span>
          ))}
        </p>

        <div className="tg-reader-detail__stats">
          <span className="tg-reader-detail__stat-item">({getMeatCategoryByWordCount(novel)})</span>
          <span className="tg-reader-detail__stat-item">{formatWordCountFooter(getDisplayWordCountWan(novel))}</span>
          <span className="tg-reader-detail__stat-item">
            <Eye size={13} strokeWidth={1.9} className="tg-reader-detail__stat-icon" />
            {viewCount.toLocaleString('en-US')}
          </span>
          <span className={['tg-reader-detail__stat-item', likeBump ? 'tg-reader-detail__stat-item--bump' : ''].filter(Boolean).join(' ')}>
            <Heart size={13} strokeWidth={1.9} className="tg-reader-detail__stat-icon" />
            {likeCount}
          </span>
          <span className="tg-reader-detail__stat-item">
            <Star size={13} strokeWidth={1.9} className="tg-reader-detail__stat-icon" />
            {favoriteCount}
          </span>
        </div>

        <div className="tg-reader-detail__actions" role="toolbar" aria-label="ប្រតិបត្តិការរឿង">
          <button type="button" className={likedDetail ? 'is-active' : ''} onClick={onToggleDetailLike}><Heart size={16} />ចូលចិត្ត</button>
          <button type="button" onClick={onOpenCommentModal}><MessageCircle size={16} />មតិ</button>
          <button type="button" onClick={onShareToTelegramFriend}><SendHorizontal size={16} />ចែករំលែក</button>
          <button type="button" className={favoritedDetail ? 'is-active' : ''} onClick={onToggleDetailFavorite}><Star size={16} />រក្សាទុក</button>
          <button type="button" onClick={onOpenReportModal}><AlertCircle size={16} />រាយការណ៍</button>
        </div>

        <section ref={catalogSectionRef} className="tg-reader-detail__catalog">
          <div className="tg-reader-detail__catalog-head">
            <h2>មាតិកា: សរុប {chapterRows.length} ភាគ</h2>
            <button
              type="button"
              className="tg-reader-detail__order-label"
              onClick={() => setCatalogDesc((v) => !v)}
            >
              <ListOrdered size={18} />
              {catalogDesc ? 'លំដាប់បញ្ច្រាស' : 'តាមលំដាប់'}
            </button>
          </div>
          <ul className="tg-reader-detail__chapter-list">
            {displayedChapterRows.map((row) => {
              const hasReadableBody = chapterHasReadableBody(novel, row.chapterIndex)
              const canReadNow = hasReadableBody && (effectiveVipReader || !row.requiresVip)
              const clickable = canReadNow || (!effectiveVipReader && row.requiresVip)
              return (
                <li
                  key={row.id}
                  className={[
                    'tg-reader-detail__chapter-item',
                    clickable ? 'tg-reader-detail__chapter-item--clickable' : '',
                    vipJumpingChapterIndex === row.chapterIndex
                      ? 'tg-reader-detail__chapter-item--vip-jump'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  {...(clickable
                    ? {
                        role: 'button',
                        tabIndex: 0,
                        onClick: () => onOpenChapter(row.chapterIndex),
                        onKeyDown: (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onOpenChapter(row.chapterIndex)
                          }
                        },
                      }
                    : {})}
                >
                  <span>{row.title}</span>
                  <em>{row.access}</em>
                </li>
              )
            })}
          </ul>
          <div ref={commentFeedSectionRef} className="tg-reader-detail__comment-feed-head">
            <span className="tg-reader-detail__comment-feed-title">មតិទាំងអស់ (សរុប {totalCommentCount})</span>
            <div className="tg-reader-detail__comment-feed-sort" role="tablist" aria-label="តម្រៀបមតិ">
              <button
                type="button"
                className={['tg-reader-detail__comment-sort-btn', commentSort === 'latest' ? 'is-active' : ''].filter(Boolean).join(' ')}
                onClick={() => setCommentSort('latest')}
              >
                មតិថ្មី
              </button>
              <button
                type="button"
                className={['tg-reader-detail__comment-sort-btn', commentSort === 'oldest' ? 'is-active' : ''].filter(Boolean).join(' ')}
                onClick={() => setCommentSort('oldest')}
              >
                មតិចាស់
              </button>
            </div>
          </div>
          <div className="tg-reader-detail__comment-feed">
            {displayedCommentFeed.length === 0 ? (
              <p className="tg-reader-detail__comment-empty">មិនទាន់មានមតិយោបល់ទេ សូមចូលរួមមតិមុនគេ។</p>
            ) : displayedCommentFeed.map((it) => (
              <article
                id={`tg-comment-${it.id}`}
                key={it.id}
                className="tg-reader-detail__comment-item"
              >
                {it.avatar ? (
                  <img src={it.avatar} alt="" className="tg-reader-detail__comment-item-avatar" loading="lazy" decoding="async" />
                ) : (
                  <div className="tg-reader-detail__comment-item-avatar tg-reader-detail__comment-item-avatar--ph" aria-hidden>
                    {(it.name?.[0] ?? 'A').toUpperCase()}
                  </div>
                )}
                <div className="tg-reader-detail__comment-item-main">
                  <div className="tg-reader-detail__comment-bubble">
                    <p className="tg-reader-detail__comment-item-name inline-flex max-w-full min-w-0 flex-wrap items-center gap-1">
                      <span className="min-w-0 truncate">{it.name}</span>
                      <CommentMemberBadges {...buildCommentBadgeProps(it)} />
                      <span className="text-white/45">·</span>
                      <span className="shrink-0 text-[11px] text-white/45">{formatCommentTimeAgo(it.at, nowTs)}</span>
                    </p>
                    <p className="tg-reader-detail__comment-item-text">{it.text}</p>
                  </div>
                  <div className="tg-reader-detail__comment-item-meta">
                    <button
                      type="button"
                      className={[
                        'tg-reader-detail__comment-reply-link',
                        commentVotes[it.id] === 'up' ? 'is-active' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => {
                        const currentVote = commentVotes[it.id]
                        const nextVote = currentVote === 'up' ? 'clear' : 'up'
                        void onVoteComment(it.id, currentVote, nextVote)
                      }}
                    >
                      ចូលចិត្ត
                    </button>
                    <button
                      type="button"
                      className="tg-reader-detail__comment-reply-link"
                      onClick={() => onOpenReplyModal(it.id, it.name, it.name, '', it.userId)}
                    >
                      ឆ្លើយតប
                    </button>
                    {Number(it.likes ?? 0) > 0 ? <span>{Number(it.likes ?? 0)} ដងចូលចិត្ត</span> : null}
                  </div>
                  {(() => {
                    const threadReplies = [
                      ...(it.reply ? [it.reply] : []),
                      ...(extraReplies[it.id] ?? []),
                    ]
                    if (threadReplies.length === 0) return null
                    const expanded = Boolean(expandedReplyMap[it.id])
                    const visibleReplies = expanded ? threadReplies : threadReplies.slice(0, 1)
                    const replyTree = buildReplyThreadTree(visibleReplies)
                    const singleReplyToMainName = threadReplies.length === 1 ? String(it.name || '').trim() : ''
                    const resolveReplyRecipient = (replyToNm) => {
                      const t = String(replyToNm || '').trim()
                      if (!t) return null
                      if (String(it.name || '').trim() === t) return it
                      for (const row of threadReplies) {
                        if (String(row?.name || '').trim() === t) return row
                      }
                      return null
                    }
                    const renderReplyNode = (r, depth = 0, parentName = '') => {
                      const displayReplyToName = String(r.replyToName || parentName || '').trim()
                      const recipientBadgeSource = displayReplyToName ? resolveReplyRecipient(displayReplyToName) : null
                      return (
                        <div key={`${r.id || `${it.id}-${depth}`}-${depth}`}>
                          <div
                            id={`tg-reply-${r.id || `${it.id}-${depth}`}`}
                            className={[
                              'tg-reader-detail__comment-reply',
                              displayReplyToName ? 'tg-reader-detail__comment-reply--to-reply' : '',
                              depth > 0 ? 'tg-reader-detail__comment-reply--nested' : '',
                            ].filter(Boolean).join(' ')}
                          >
                            {r.avatar ? (
                              <img
                                src={r.avatar}
                                alt=""
                                className="tg-reader-detail__comment-item-avatar tg-reader-detail__comment-item-avatar--reply"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="tg-reader-detail__comment-item-avatar tg-reader-detail__comment-item-avatar--ph tg-reader-detail__comment-item-avatar--reply" aria-hidden>
                                {(r.name?.[0] ?? 'A').toUpperCase()}
                              </div>
                            )}
                            <div className="tg-reader-detail__comment-reply-main">
                              <div className="tg-reader-detail__comment-bubble tg-reader-detail__comment-bubble--reply">
                                <p className="tg-reader-detail__comment-item-name tg-reader-detail__comment-reply-head">
                                  <span
                                    className={[
                                      'tg-reader-detail__comment-reply-head__party',
                                      'tg-reader-detail__comment-reply-head__party--actor',
                                      !displayReplyToName ? 'tg-reader-detail__comment-reply-head__party--solo' : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                  >
                                    <span className="tg-reader-detail__comment-reply-head__name">{r.name}</span>
                                    <CommentMemberBadges {...buildCommentBadgeProps(r)} />
                                  </span>
                                  {displayReplyToName ? (
                                    <>
                                      <span className="tg-reader-detail__comment-reply-head__arrow" aria-hidden>
                                        ▶
                                      </span>
                                      <span className="tg-reader-detail__comment-reply-head__party tg-reader-detail__comment-reply-head__party--target">
                                        <span className="tg-reader-detail__comment-reply-head__name tg-reader-detail__reply-to-name">
                                          {displayReplyToName}
                                        </span>
                                        {recipientBadgeSource != null ? (
                                          <CommentMemberBadges {...buildCommentBadgeProps(recipientBadgeSource)} />
                                        ) : null}
                                      </span>
                                    </>
                                  ) : null}
                                  <span className="tg-reader-detail__comment-reply-head__sep" aria-hidden>
                                    ·
                                  </span>
                                  <span className="tg-reader-detail__comment-reply-head__time">
                                    {formatCommentTimeAgo(r.at, nowTs)}
                                  </span>
                                </p>
                                <p
                                  className={[
                                    'tg-reader-detail__comment-item-text',
                                    highlightTargetId === `tg-reply-${r.id}` ? 'tg-reader-focus-target--reply' : '',
                                  ].filter(Boolean).join(' ')}
                                >
                                  {r.text}
                                </p>
                              </div>
                              <div className="tg-reader-detail__comment-item-meta">
                                <button
                                  type="button"
                                  className="tg-reader-detail__comment-reply-link"
                                  onClick={() => onOpenReplyModal(it.id, r.name, r.name, r.id, r.userId)}
                                >
                                  ឆ្លើយតប
                                </button>
                              </div>
                              {replyTarget?.mode === 'reply' && replyTarget.id === it.id && replyTarget.parentReplyId === String(r.id || '') ? (
                                <div className="tg-reader-inline-reply">
                                  <textarea
                                    className="tg-reader-inline-reply__textarea"
                                    value={replyDraft}
                                    maxLength={500}
                                    placeholder={`ឆ្លើយតបទៅ ${replyTarget.name}...`}
                                    onChange={(e) => setReplyDraft(e.target.value)}
                                  />
                                  <div className="tg-reader-inline-reply__actions">
                                    <button type="button" onClick={onCloseReplyModal}>បោះបង់</button>
                                    <button type="button" disabled={replySubmitPending || replyDraft.trim().length === 0} onClick={onSubmitReply}>
                                      {replySubmitPending ? 'កំពុងផ្ញើ...' : 'ផ្ញើ'}
                                    </button>
                                  </div>
                                  {replySubmitError ? <p className="tg-reader-inline-reply__error" lang="km">{replySubmitError}</p> : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          {(r.children ?? []).map((child) => renderReplyNode(child, depth + 1, r.name))}
                        </div>
                      )
                    }
                    return (
                      <>
                        {threadReplies.length > 1 ? (
                          <button
                            type="button"
                            className="tg-reader-detail__replies-toggle"
                            onClick={() =>
                              setExpandedReplyMap((prev) => ({ ...prev, [it.id]: !expanded }))
                            }
                          >
                            {expanded
                              ? 'លាក់ការឆ្លើយតប'
                              : `មើលការឆ្លើយតប ${threadReplies.length} ទាំងអស់`}
                          </button>
                        ) : null}
                        {replyTree.map((r) => renderReplyNode(r, 0, singleReplyToMainName))}
                      </>
                    )
                  })()}
                  {replyTarget?.mode === 'reply' && replyTarget.id === it.id && !replyTarget.parentReplyId ? (
                    <div className="tg-reader-inline-reply">
                      <textarea
                        className="tg-reader-inline-reply__textarea"
                        value={replyDraft}
                        maxLength={500}
                        placeholder={`ឆ្លើយតបទៅ ${replyTarget.name}...`}
                        onChange={(e) => setReplyDraft(e.target.value)}
                      />
                      <div className="tg-reader-inline-reply__actions">
                        <button type="button" onClick={onCloseReplyModal}>បោះបង់</button>
                        <button type="button" disabled={replySubmitPending || replyDraft.trim().length === 0} onClick={onSubmitReply}>
                          {replySubmitPending ? 'កំពុងផ្ញើ...' : 'ផ្ញើ'}
                        </button>
                      </div>
                      {replySubmitError ? <p className="tg-reader-inline-reply__error" lang="km">{replySubmitError}</p> : null}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      )}
      {isReadingChapter ? (
        <div
          ref={articleOverlayRef}
          className="tg-reader-article-overlay"
          onTouchStart={(e) => {
            const t = e.touches?.[0]
            if (!t) return
            articleSwipeRef.current = {
              startX: t.clientX,
              startY: t.clientY,
              tracking: t.clientX <= 36,
              axis: null,
            }
            if (articleSwipeResetTimerRef.current) {
              window.clearTimeout(articleSwipeResetTimerRef.current)
              articleSwipeResetTimerRef.current = 0
            }
            applyArticleLayerTransform(articleSwipeDxRef.current, false)
          }}
          onTouchMove={(e) => {
            const t = e.touches?.[0]
            const s = articleSwipeRef.current
            if (!t) return
            // 顶部继续下拉时阻止 iOS/部分 WebView 回弹，避免出现上方大空白。
            if (!s.tracking) {
              const dy = t.clientY - s.startY
              const scrollTop = articleScrollRef.current?.scrollTop ?? 0
              if (scrollTop <= 0 && dy > 0) {
                if (e.cancelable) e.preventDefault()
              }
              return
            }
            const dx = t.clientX - s.startX
            const dy = t.clientY - s.startY
            if (!s.axis) {
              const absDx = Math.abs(dx)
              const absDy = Math.abs(dy)
              if (absDx < 6 && absDy < 6) return
              // 给横向手势更高优先级：只要明显向右滑，就锁定为返回手势，避免上下微抖引发底层乱动。
              if (dx > 0 && absDx >= absDy * 0.75) {
                s.axis = 'x'
              } else {
                s.axis = 'y'
                s.tracking = false
                return
              }
            }
            if (s.axis !== 'x') return
            e.preventDefault()
            e.stopPropagation()
            if (dx <= 0) {
              applyArticleLayerTransform(0, false)
              return
            }
            applyArticleLayerTransform(Math.min(dx, window.innerWidth * 0.92), false)
          }}
          onTouchEnd={() => {
            const s = articleSwipeRef.current
            if (!s.tracking) return
            const shouldBack = articleSwipeDxRef.current > window.innerWidth * 0.28
            articleSwipeRef.current = { startX: 0, startY: 0, tracking: false, axis: null }
            if (shouldBack) {
              applyArticleLayerTransform(0, false)
              setReadingChapterIndex(null)
              return
            }
            applyArticleLayerTransform(0, true)
            articleSwipeResetTimerRef.current = window.setTimeout(() => {
              applyArticleLayerTransform(0, false)
              articleSwipeResetTimerRef.current = 0
            }, 230)
          }}
          onTouchCancel={() => {
            articleSwipeRef.current = { startX: 0, startY: 0, tracking: false, axis: null }
            applyArticleLayerTransform(0, true)
            articleSwipeResetTimerRef.current = window.setTimeout(() => {
              applyArticleLayerTransform(0, false)
              articleSwipeResetTimerRef.current = 0
            }, 230)
          }}
        >
          <ReaderWatermarkOverlay tgUser={tgUser} nowTs={nowTs} />
          <main className="tg-reader-article tg-reader-article--protected" ref={articleLayerRef} lang="km">
            <div className="tg-reader-article__header">
              <div className="tg-reader-article__header-inner">
                <div className="tg-reader-article__header-bar">
                  <button
                    type="button"
                    className="tg-reader-article__chapter-nav-btn tg-reader-article__chapter-nav-btn--emph tg-reader-article__chapter-nav-btn--compact"
                    aria-label="ទៅទំព័រដើម"
                    onClick={() => {
                      applyArticleLayerTransform(0, false)
                      setReadingChapterIndex(null)
                    }}
                  >
                    {'< ទៅទំព័រដើម'}
                  </button>
                  {articleHeaderCompact ? (
                    <>
                      <span className="tg-reader-article__header-chip tg-reader-article__header-chip--title">
                        {readingChapterName}
                      </span>
                      <span className="tg-reader-article__header-chip tg-reader-article__header-chip--part">
                        {readingChapterNoLabel}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            <div
              ref={articleScrollRef}
              className="tg-reader-article__scroll"
              onScroll={(e) => {
                const top = e.currentTarget.scrollTop || 0
                // 至少滚过顶部栏的大致高度后再切换，避免“未触顶先消失”。
                setArticleHeaderCompact(top > 96)
              }}
            >
              {readingContentLoading ? (
                <ReaderArticleSkeleton />
              ) : (
                <>
                  <h1 className="tg-reader-article__title">{novel.title}</h1>
                  <p className="tg-reader-article__chapter-line">{readingChapterSubtitle}</p>
                  <p className="tg-reader-article__meta-line">{readingMetaLine}</p>
                  <section className="tg-reader-article__body">
                    {readingBody.length > 0 ? (
                      readingBody.map((p, idx) => (
                        <p key={`${readingChapterIndex}-${idx}`} className="tg-reader-article__p">
                          {p}
                        </p>
                      ))
                    ) : (
                      <p className="tg-reader-article__p" lang="km">{READER_NO_BODY_KM}</p>
                    )}
                  </section>
                </>
              )}
            </div>
            <nav className="tg-reader-article__chapter-nav" aria-label="រុករកភាគ">
              <div className="tg-reader-article__chapter-nav-cell tg-reader-article__chapter-nav-cell--left">
                {readingChapterIndex === 0 ? (
                  <span className="tg-reader-article__chapter-nav-muted">ភាគដំបូង</span>
                ) : (
                  <button type="button" className="tg-reader-article__chapter-nav-btn" onClick={() => onOpenChapter(readingChapterIndex - 1)}>
                    {'〈\u2009ភាគមុខ'}
                  </button>
                )}
              </div>
              <div className="tg-reader-article__chapter-nav-cell tg-reader-article__chapter-nav-cell--center">
                <button type="button" className="tg-reader-article__chapter-nav-btn tg-reader-article__chapter-nav-btn--emph" onClick={onReturnToBookCatalog}>
                  ត្រឡប់ទៅមាតិកា
                </button>
              </div>
              <div className="tg-reader-article__chapter-nav-cell tg-reader-article__chapter-nav-cell--right">
                {readingChapterIndex >= readingChapterCount - 1 ? (
                  <span className="tg-reader-article__chapter-nav-muted">ភាគចុងក្រោយ</span>
                ) : (
                  <button type="button" className="tg-reader-article__chapter-nav-btn" onClick={() => onOpenChapter(readingChapterIndex + 1)}>
                    {'ភាគបន្ទាប់\u2009〉'}
                  </button>
                )}
              </div>
            </nav>
          </main>
        </div>
      ) : null}

      {startReadPageOpen ? (
        <div className="tg-reader-start-page" role="dialog" aria-modal="true" aria-labelledby="tg-reader-start-page-title">
          <button
            type="button"
            className="tg-reader-start-page__backdrop"
            aria-label="បិទទំព័រចាប់ផ្តើមអាន"
            onClick={onCloseStartReadPage}
          />
          <div className="tg-reader-start-page__panel">
            <h3 id="tg-reader-start-page-title" className="tg-reader-start-page__title" lang="km">
              ការជូនដំណឹង
            </h3>
            <p className="tg-reader-start-page__desc" lang="km">
              ច្រកចូលអានត្រូវបានបើកហើយ។ សូមចូលគណនីមុននឹងចូលទៅកាន់មាតិកាជំពូកដើម្បីចាប់ផ្តើមអាន។
            </p>
            <div className="tg-reader-start-page__actions">
              <button type="button" className="tg-reader-start-page__btn tg-reader-start-page__btn--ghost" onClick={onCloseStartReadPage} lang="km">
                ចាំពេលក្រោយ
              </button>
              <button type="button" className="tg-reader-start-page__btn tg-reader-start-page__btn--primary" onClick={onEnterLoginFromStartReadPage} lang="km">
                ចូលប្រើឥឡូវនេះ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {chapterVipGateOpen ? (
        <div className="tg-reader-start-page" role="dialog" aria-modal="true" aria-labelledby="tg-reader-vip-gate-title">
          <button
            type="button"
            className="tg-reader-start-page__backdrop"
            aria-label="បិទ"
            onClick={onCloseChapterVipGate}
          />
          <div className="tg-reader-start-page__panel">
            <h3 id="tg-reader-vip-gate-title" className="tg-reader-start-page__title" lang="km">
              {READER_VIP_CHAPTER_GATE_TITLE_KM}
            </h3>
            <p className="tg-reader-start-page__desc" lang="km">
              {READER_VIP_CHAPTER_GATE_DESC_KM}
            </p>
            <div className="tg-reader-start-page__actions">
              <button type="button" className="tg-reader-start-page__btn tg-reader-start-page__btn--ghost" onClick={onCloseChapterVipGate} lang="km">
                ចាំពេលក្រោយ
              </button>
              <button type="button" className="tg-reader-start-page__btn tg-reader-start-page__btn--primary" onClick={onGoVipFromChapterGate} lang="km">
                ទិញ VIP
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {replyTarget?.mode === 'comment' ? (
        <div className="tg-reply-modal" role="dialog" aria-modal="true" aria-label="ឆ្លើយតបមតិ">
          <button type="button" className="tg-reply-modal__backdrop" onClick={onCloseReplyModal} aria-label="បិទប្រអប់" />
          <div className="tg-reply-modal__panel">
            <div className="tg-reply-modal__head">
              <h3 className="tg-reply-modal__title">
                {replyTarget.mode === 'comment' ? `ដាក់មតិឱ្យអ្នកនិពន្ធ: ${replyTarget.name}` : `ឆ្លើយតប: ${replyTarget.name}`}
              </h3>
              <button type="button" className="tg-reply-modal__close" onClick={onCloseReplyModal} aria-label="បិទ">
                <X size={24} />
              </button>
            </div>
            <div className="tg-reply-modal__body">
              <textarea
                className="tg-reply-modal__textarea"
                maxLength={500}
                placeholder="សូមបញ្ចូលមតិរបស់អ្នក..."
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
              />
              <span className="tg-reply-modal__counter">{replyDraft.length}/500</span>
            </div>
            {replySubmitError ? <p className="tg-reply-modal__error" lang="km">{replySubmitError}</p> : null}
            <button
              type="button"
              className="tg-reply-modal__submit"
              onClick={onSubmitReply}
              disabled={replySubmitPending}
            >
              {replySubmitPending ? 'កំពុងបញ្ជូន...' : 'ផ្ញើមតិ'}
            </button>
          </div>
        </div>
      ) : null}
      {reportModalOpen ? (
        <div className="tg-reply-modal" role="dialog" aria-modal="true" aria-label="ផ្ញើរបាយការណ៍">
          <button type="button" className="tg-reply-modal__backdrop" onClick={onCloseReportModal} aria-label="បិទប្រអប់" />
          <div className="tg-reply-modal__panel">
            <div className="tg-reply-modal__head">
              <h3 className="tg-reply-modal__title">រាយការណ៍: {novel.title}</h3>
              <button type="button" className="tg-reply-modal__close" onClick={onCloseReportModal} aria-label="បិទ">
                <X size={24} />
              </button>
            </div>
            <div className="tg-reply-modal__body">
              <textarea
                className="tg-reply-modal__textarea"
                maxLength={500}
                placeholder="សូមបញ្ចូលមូលហេតុរាយការណ៍..."
                value={reportDraft}
                onChange={(e) => setReportDraft(e.target.value)}
              />
              <span className="tg-reply-modal__counter">{reportDraft.length}/500</span>
            </div>
            {reportSubmitError ? <p className="tg-reply-modal__error" lang="km">{reportSubmitError}</p> : null}
            <button
              type="button"
              className="tg-reply-modal__submit"
              onClick={onSubmitReport}
              disabled={reportSubmitPending}
            >
              {reportSubmitPending ? 'កំពុងបញ្ជូន...' : 'ផ្ញើរបាយការណ៍'}
            </button>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  )
}
