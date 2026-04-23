import { AlertCircle, Bell, ChevronDown, ChevronUp, Eye, Heart, ListOrdered, MessageCircle, Search, SendHorizontal, Star, ThumbsDown, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import HomePage from './HomePage.jsx'
import { getNovelById } from '../data/novels'
import { formatTelegramDisplayName, useTelegramUser } from '../hooks/useTelegramUser.js'
import {
  commentPointsToStars,
  formatChapterRelativeTime,
  formatWordCountFooter,
  getDisplayWordCountWan,
  getMeatCategoryByWordCount,
} from '../lib/novelDisplay.js'
import { CommentMemberBadges } from '../components/CommentMemberBadges.jsx'
import { usePremiumPreview } from '../hooks/usePremiumPreview.js'
import {
  computeMemberTier,
  normalizeStoredMemberTier,
  parseCoinBalance,
  parseVipExpireAtMs,
} from '../lib/memberTier.js'
import { refreshAppFromLogo } from '../lib/refreshAppFromLogo.js'
import { formatReadingRecordInstant } from '../lib/adminDateTimePickerUtils.js'
import {
  appendNovelReplyVerbose,
  appendReadingRecord,
  appendNovelReviewVerbose,
  fetchNovelReplies,
  fetchNovelReviews,
  fetchNovelViewCount,
  getPresenceMemberId,
  incrementNovelViewCount,
  reportMetricEvent,
  voteNovelReviewVerbose,
} from '../lib/miniAppPresence.js'
import { buildOrderNo } from '../lib/orderNo.js'
import { saveLastRead } from '../lib/readerStorage.js'

function chapterAccessLabel(idx, memberTier) {
  if (idx === 0) return 'ឥតគិតថ្លៃ'
  const isVipTier = memberTier === 'vip' || memberTier === 'vip_gold'
  return isVipTier ? 'សមាជិកVIP' : 'ចុះឈ្មោះសមាជិក'
}

const CATALOG_MIN_COUNT = 15
const DETAIL_LIKE_STORAGE_KEY = 'tg_novel_detail_likes_v1'
const COMMENT_VOTES_STORAGE_KEY = 'tg_novel_comment_votes_v1'
const COMMENT_SUBMIT_RETRY_MS = 450

function chapterHasReadableBody(novel, chapterIndex) {
  if (!novel || !Number.isFinite(chapterIndex) || chapterIndex < 0) return false
  const ch = (novel.chapters ?? [])[chapterIndex]
  const body = ch?.body
  if (!Array.isArray(body) || body.length === 0) return false
  return body.some((p) => String(p ?? '').trim().length > 0)
}

function displayMemberIdForRecord(tgUser) {
  if (tgUser?.id != null) return String(tgUser.id)
  const raw = getPresenceMemberId()
  if (raw.startsWith('tg_')) return raw.slice(3)
  return raw.length > 24 ? `${raw.slice(0, 20)}…` : raw
}

function reportReadOnChapterOpen(novel, chapterIndex, tgUser, memberTier) {
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
    memberLevel: chapterAccessLabel(chapterIndex, memberTier),
    memberOrder,
    shelfTitle: String(novel?.title || ''),
    readChapter,
    readAt,
    ts,
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

function resolveCommentRowMemberTier({ row }) {
  const stored = normalizeStoredMemberTier(row.memberTier)
  if (stored) return stored
  return 'normal'
}

export default function ReaderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const premiumPreview = usePremiumPreview()
  const tgUser = useTelegramUser()
  const userForTier = useMemo(() => {
    if (!tgUser) return null
    if (!premiumPreview) return tgUser
    return { ...tgUser, is_premium: true }
  }, [tgUser, premiumPreview])
  const vipExpireAtMs = useMemo(() => parseVipExpireAtMs(searchParams.get('vip_expire')), [searchParams])
  const coinBalance = useMemo(() => parseCoinBalance(searchParams.get('ucoin')), [searchParams])
  const viewerMemberTier = useMemo(
    () =>
      computeMemberTier({
        user: userForTier,
        memberTierQuery: String(searchParams.get('member_tier') || ''),
        vipExpireAtMs,
        coinBalance,
      }),
    [coinBalance, searchParams, userForTier, vipExpireAtMs],
  )
  const isVipTier = viewerMemberTier === 'vip' || viewerMemberTier === 'vip_gold'
  const novel = getNovelById(id)
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
  const [likedDetail, setLikedDetail] = useState(false)
  const [detailLikeHydrated, setDetailLikeHydrated] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [viewCount, setViewCount] = useState(0)
  const [likeBump, setLikeBump] = useState(false)
  const [commentVotesHydrated, setCommentVotesHydrated] = useState(false)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const [reviewItems, setReviewItems] = useState([])
  const [startReadPageOpen, setStartReadPageOpen] = useState(false)
  const [readingChapterIndex, setReadingChapterIndex] = useState(null)
  const [articleHeaderCompact, setArticleHeaderCompact] = useState(false)
  const swipeRef = useRef({ startX: 0, startY: 0, tracking: false, axis: null })
  const swipeDxRef = useRef(0)
  const swipeResetTimerRef = useRef(0)
  const swipeSheetRef = useRef(null)
  const articleSwipeRef = useRef({ startX: 0, startY: 0, tracking: false, axis: null })
  const articleSwipeDxRef = useRef(0)
  const articleSwipeResetTimerRef = useRef(0)
  const articleLayerRef = useRef(null)
  const [vipJumpingChapterIndex, setVipJumpingChapterIndex] = useState(null)
  const vipJumpTimerRef = useRef(0)
  const catalogSectionRef = useRef(null)
  const isMiniAppLoggedIn = Boolean(tgUser)

  const onOpenStartReadPage = () => {
    // Telegram Mini App 能读取到当前用户信息 => 视为已登录，直接进入目录。
    if (isMiniAppLoggedIn) {
      catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    // 普通网页环境读取不到 tgUser => 视为未登录，弹登录提示页。
    setStartReadPageOpen(true)
  }
  const ensureMiniAppLoggedIn = () => {
    if (isMiniAppLoggedIn) return true
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

  useEffect(() => {
    if (!novel) return
    saveLastRead({ id: novel.id, title: novel.title })
  }, [novel])

  useEffect(() => {
    setArticleHeaderCompact(false)
  }, [readingChapterIndex])
  useEffect(() => {
    if (!novel) return
    setDetailLikeHydrated(false)
    setCommentVotesHydrated(false)
    const baseViewCount = Number(novel.viewCount ?? Math.round((novel.viewsWan ?? 0) * 10000))
    const safeBaseViewCount = Number.isFinite(baseViewCount) && baseViewCount > 0 ? baseViewCount : 0
    setViewCount(safeBaseViewCount)
    void fetchNovelViewCount(novel.id, safeBaseViewCount).then((count) => {
      setViewCount(count)
    })
    const baseLikeCount = Number(novel.likeCount ?? 0)
    try {
      const raw = localStorage.getItem(DETAIL_LIKE_STORAGE_KEY)
      const all = raw ? JSON.parse(raw) : {}
      const liked = Boolean(all?.[String(novel.id)])
      setLikedDetail(liked)
      setLikeCount(Math.max(0, baseLikeCount + (liked ? 1 : 0)))
    } catch {
      setLikedDetail(false)
      setLikeCount(baseLikeCount)
    } finally {
      setDetailLikeHydrated(true)
    }
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
  }, [novel])
  useEffect(() => {
    if (!novel || !detailLikeHydrated) return
    let all = {}
    try {
      const raw = localStorage.getItem(DETAIL_LIKE_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      all = parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      all = {}
    }
    try {
      const next = { ...all, [String(novel.id)]: likedDetail }
      localStorage.setItem(DETAIL_LIKE_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore storage errors */
    }
  }, [likedDetail, novel, detailLikeHydrated])
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
          memberTier: row?.memberTier,
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
    return () => {
      cancelled = true
    }
  }, [novel, tgUser?.first_name, tgUser?.photo_url])

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
      if (swipeResetTimerRef.current) {
        window.clearTimeout(swipeResetTimerRef.current)
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
  const applySwipeSheetTransform = (dx, animate) => {
    const el = swipeSheetRef.current
    if (!el) {
      swipeDxRef.current = dx
      return
    }
    el.style.transition = animate ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
    el.style.transform = `translate3d(${dx}px, 0, 0)`
    el.style.boxShadow = dx > 0 ? '-14px 0 28px rgba(0, 0, 0, 0.42)' : 'none'
    swipeDxRef.current = dx
  }

  const chapterRows = useMemo(() => {
    if (!novel) return []
    const source = novel.chapters ?? []
    const total = Math.max(source.length, CATALOG_MIN_COUNT)
    return Array.from({ length: total }, (_, idx) => {
      const ch = source[idx]
      return {
        id: `${novel.id}-${idx + 1}`,
        chapterIndex: idx,
        title: `ភាគទី${idx + 1}`,
        access: chapterAccessLabel(idx, viewerMemberTier),
        rawTitle: ch?.title ?? `ភាគទី${idx + 1}`,
      }
    })
  }, [novel, viewerMemberTier])
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
  const totalCommentCount = commentFeed.length + extraReplyCount
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

  const onOpenReplyModal = (targetId, targetName) => {
    if (!ensureMiniAppLoggedIn()) return
    setReplyTarget({ id: targetId, name: targetName, mode: 'reply' })
    setReplyDraft('')
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
        memberTier: viewerMemberTier,
      })
      if (!saved) {
        const retryItems = await fetchNovelReviews(novel.id)
        const hasSameText = retryItems.some((it) => String(it?.text || '').trim() === text)
        if (hasSameText) {
          setReviewItems(retryItems)
          setReplySubmitPending(false)
          setCommentSort('latest')
          onCloseReplyModal()
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
          return
        }
        setReplySubmitPending(false)
        const details = submitError ? `（${submitError}）` : ''
        setReplySubmitError(`提交失败，请检查网络或稍后重试${details}\n接口：${submitEndpoint}`)
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
      onCloseReplyModal()
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
        memberTier: viewerMemberTier,
      },
    )
    if (!savedReply) {
      setReplySubmitPending(false)
      const details = replyError ? `（${replyError}）` : ''
      setReplySubmitError(`提交失败，请检查网络或稍后重试${details}\n接口：${replyEndpoint}`)
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
        memberTier: row?.memberTier,
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
    setReplySubmitPending(false)
    onCloseReplyModal()
  }
  const onToggleDetailLike = () => {
    if (!ensureMiniAppLoggedIn()) return
    const next = !likedDetail
    setLikedDetail(next)
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)))
    setLikeBump(true)
    window.setTimeout(() => setLikeBump(false), 220)
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
    const resp = await voteNovelReviewVerbose(novel.id, commentId, voterId, action)
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
    if (!ensureMiniAppLoggedIn()) return
    if (chapterIndex > 0 && !isVipTier) {
      if (vipJumpTimerRef.current) {
        window.clearTimeout(vipJumpTimerRef.current)
      }
      setVipJumpingChapterIndex(chapterIndex)
      vipJumpTimerRef.current = window.setTimeout(() => {
        setVipJumpingChapterIndex(null)
        navigate('/vip')
      }, 220)
      return
    }
    if (!chapterHasReadableBody(novel, chapterIndex)) return
    reportReadOnChapterOpen(novel, chapterIndex, tgUser, viewerMemberTier)
    const baseViewCount = Number(novel.viewCount ?? Math.round((novel.viewsWan ?? 0) * 10000))
    const safeBaseViewCount = Number.isFinite(baseViewCount) && baseViewCount > 0 ? baseViewCount : 0
    const optimisticNext = viewCount + 1
    setViewCount(optimisticNext)
    void incrementNovelViewCount(novel.id, 1, safeBaseViewCount).then((serverCount) => {
      if (serverCount != null) setViewCount(serverCount)
    })
    if (articleSwipeResetTimerRef.current) {
      window.clearTimeout(articleSwipeResetTimerRef.current)
      articleSwipeResetTimerRef.current = 0
    }
    articleSwipeDxRef.current = 0
    setReadingChapterIndex(chapterIndex)
  }

  if (!novel) {
    return (
      <div className="tg-app tg-app--reader">
        <header className="tg-toolbar tg-toolbar--reader">
          <Link to="/" className="tg-back" aria-label="返回">
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
          <span className="tg-toolbar__title tg-toolbar__title--muted">
            未找到
          </span>
        </header>
        <div className="tg-empty">
          <p>这本书不存在或已下架。</p>
          <Link to="/" className="tg-link">
            返回列表
          </Link>
        </div>
      </div>
    )
  }

  const isReadingChapter = Number.isInteger(readingChapterIndex) && readingChapterIndex >= 0
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
      ? readingChapter.body.filter((p) => String(p ?? '').trim().length > 0)
      : []
    : []
  const readingChapterWordCount = readingBody.reduce((sum, p) => sum + [...String(p)].length, 0)
  const readingMetaLine = `作者：${novel.author || '未知'}    字数：${readingChapterWordCount.toLocaleString('en-US')}字`

  const rel = formatChapterRelativeTime(novel.lastChapterMinutesAgo ?? 0)
  const latestChapter = (novel.chapters ?? [])[Math.max(0, (novel.chapters ?? []).length - 1)]
  const readingChapterCount = (novel.chapters ?? []).length
  const onReturnToBookCatalog = () => {
    applyArticleLayerTransform(0, false)
    setReadingChapterIndex(null)
  }

  return (
    <div
      className="tg-app tg-app--reader"
      onTouchStart={(e) => {
        if (isReadingChapter) return
        const t = e.touches?.[0]
        if (!t) return
        swipeRef.current = {
          startX: t.clientX,
          startY: t.clientY,
          tracking: t.clientX <= 36,
          axis: null,
        }
        if (swipeResetTimerRef.current) {
          window.clearTimeout(swipeResetTimerRef.current)
          swipeResetTimerRef.current = 0
        }
        applySwipeSheetTransform(swipeDxRef.current, false)
      }}
      onTouchMove={(e) => {
        if (isReadingChapter) return
        const t = e.touches?.[0]
        const s = swipeRef.current
        if (!t || !s.tracking) return
        const dx = t.clientX - s.startX
        const dy = t.clientY - s.startY
        if (!s.axis) {
          const absDx = Math.abs(dx)
          const absDy = Math.abs(dy)
          if (absDx < 6 && absDy < 6) return
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
          applySwipeSheetTransform(0, false)
          return
        }
        applySwipeSheetTransform(Math.min(dx, window.innerWidth * 0.92), false)
      }}
      onTouchEnd={() => {
        if (isReadingChapter) return
        const s = swipeRef.current
        if (!s.tracking) return
        const shouldBack = swipeDxRef.current > window.innerWidth * 0.28
        swipeRef.current = { startX: 0, startY: 0, tracking: false, axis: null }
        if (shouldBack) {
          applySwipeSheetTransform(0, false)
          navigate('/')
          return
        }
        applySwipeSheetTransform(0, true)
        swipeResetTimerRef.current = window.setTimeout(() => {
          applySwipeSheetTransform(0, false)
          swipeResetTimerRef.current = 0
        }, 230)
      }}
      onTouchCancel={() => {
        if (isReadingChapter) return
        swipeRef.current = { startX: 0, startY: 0, tracking: false, axis: null }
        applySwipeSheetTransform(0, true)
        swipeResetTimerRef.current = window.setTimeout(() => {
          applySwipeSheetTransform(0, false)
          swipeResetTimerRef.current = 0
        }, 230)
      }}
    >
      <div
        className="tg-reader-swipe-underlay"
        aria-hidden
      >
        <div
          className="tg-reader-swipe-underlay__sheet"
        >
        <div className="tg-reader-swipe-underlay__home">
          <HomePage />
          <div className="tg-reader-swipe-underlay__bottom" aria-hidden>
            <BottomNav />
          </div>
        </div>
        </div>
      </div>
      <div className="tg-reader-swipe-sheet" ref={swipeSheetRef}>
      <header className="tg-toolbar tg-toolbar--large tg-toolbar--home tg-toolbar--reader-home-fixed">
        <button
          type="button"
          className="tg-toolbar__logo m-0 shrink-0 cursor-pointer leading-none"
          aria-label="刷新界面"
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
              type="text"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="搜索小说、作者…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              aria-label="搜索小说、作者或ស្លាក"
            />
            {searchDraft.length > 0 ? (
              <button
                type="button"
                className="tg-search-field__clear"
                aria-label="清空搜索"
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
          aria-label="通知"
        >
          <Bell size={20} strokeWidth={2} aria-hidden />
        </NavLink>
      </header>
      <main className="tg-reader-detail" lang="zh-Hans">
        <section className="tg-reader-detail__head">
          <div className={`tg-reader-detail__cover-wrap tg-reader-detail__cover-wrap--${novel.accent}`}>
            {novel.coverUrl ? (
              <img src={novel.coverUrl} alt="" className="tg-reader-detail__cover" />
            ) : (
              <div className="tg-reader-detail__cover-ph">{novel.title.slice(0, 1)}</div>
            )}
          </div>
          <div className="tg-reader-detail__meta">
            <h1 className="tg-reader-detail__title">{novel.title}</h1>
            <p className="tg-reader-detail__line"><span>ស្ថានភាព：</span>{novel.status === 'completed' ? 'ចប់ហើយ' : 'កំពុងចេញ'}</p>
            <p className="tg-reader-detail__line"><span>ថ្មីបំផុត：</span>{latestChapter ? `ភាគទី${(novel.chapters ?? []).length}` : '暂无章节'}{rel ? `（${rel}）` : ''}</p>
            <p className="tg-reader-detail__line"><span>អ្នកនិពន្ធ：</span>{novel.author}</p>
            <p className="tg-reader-detail__line"><span>ប្រភេទ：</span>{(novel.listThemes ?? []).join('、') || '未分类'}</p>
            <p className="tg-reader-detail__line"><span>ប្រភព：</span>{novel.source === 'original' ? 'ស្នាដៃដើម' : 'ស្នាដៃសមាជិក'}</p>
            <p className="tg-reader-detail__line tg-reader-detail__rating">
              <span>ពិន្ទុ：</span>
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
            <span className="tg-reader-detail__intro-label">សេចក្តីសង្ខេប：</span>
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
            aria-label={introExpanded ? '收起简介' : '展示简介'}
            onClick={() => setIntroExpanded((v) => !v)}
          >
            {introExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
        {introExpanded ? <p className="tg-reader-detail__intro-full">{novel.synopsis}</p> : null}

        <p className="tg-reader-detail__tags">
          <span className="tg-reader-detail__tags-label">ស្លាក：</span>
          {(novel.tags ?? []).map((t) => (
            <span key={t} className="tg-reader-detail__tag-item"><em>#</em>{t}</span>
          ))}
        </p>

        <div className="tg-reader-detail__stats">
          <span className="tg-reader-detail__stat-item">（{getMeatCategoryByWordCount(novel)}）</span>
          <span className="tg-reader-detail__stat-item">{formatWordCountFooter(getDisplayWordCountWan(novel))}</span>
          <span className="tg-reader-detail__stat-item">
            <Eye size={13} strokeWidth={1.9} className="tg-reader-detail__stat-icon" />
            {viewCount.toLocaleString('en-US')}
          </span>
          <span className={['tg-reader-detail__stat-item', likeBump ? 'tg-reader-detail__stat-item--bump' : ''].filter(Boolean).join(' ')}>
            <Heart size={13} strokeWidth={1.9} className="tg-reader-detail__stat-icon" />
            {likeCount}
          </span>
        </div>

        <div className="tg-reader-detail__actions" role="toolbar" aria-label="小说操作">
          <button type="button" className={likedDetail ? 'is-active' : ''} onClick={onToggleDetailLike}><Heart size={16} />ចូលចិត្ត</button>
          <button type="button" onClick={onOpenCommentModal}><MessageCircle size={16} />មតិ</button>
          <button type="button"><SendHorizontal size={16} />ចែករំលែក</button>
          <button type="button"><Star size={16} />រក្សាទុក</button>
          <button type="button"><AlertCircle size={16} />រាយការណ៍</button>
        </div>

        <section ref={catalogSectionRef} className="tg-reader-detail__catalog">
          <div className="tg-reader-detail__catalog-head">
            <h2>មាតិកា：សរុប {chapterRows.length} ភាគ</h2>
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
              const clickable = hasReadableBody || (!isVipTier && row.chapterIndex > 0)
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
          <div className="tg-reader-detail__comment-feed-head">
            <span className="tg-reader-detail__comment-feed-title">មតិទាំងអស់【សរុប{totalCommentCount}】</span>
            <div className="tg-reader-detail__comment-feed-sort" role="tablist" aria-label="មតិ排序">
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
              <p className="tg-reader-detail__comment-empty">暂无មតិ，来抢沙发吧。</p>
            ) : displayedCommentFeed.map((it) => (
              <article key={it.id} className="tg-reader-detail__comment-item">
                {it.avatar ? (
                  <img src={it.avatar} alt="" className="tg-reader-detail__comment-item-avatar" loading="lazy" decoding="async" />
                ) : (
                  <div className="tg-reader-detail__comment-item-avatar tg-reader-detail__comment-item-avatar--ph" aria-hidden>
                    {(it.name?.[0] ?? 'A').toUpperCase()}
                  </div>
                )}
                <div className="tg-reader-detail__comment-item-main">
                  <p className="tg-reader-detail__comment-item-name inline-flex max-w-full min-w-0 items-center gap-1">
                    <span className="min-w-0 truncate">{it.name}</span>
                    <CommentMemberBadges
                      tier={resolveCommentRowMemberTier({ row: it })}
                    />
                  </p>
                  <p className="tg-reader-detail__comment-item-text">{it.text}</p>
                  <div className="tg-reader-detail__comment-item-meta">
                    <button
                      type="button"
                      className="tg-reader-detail__comment-reply-link"
                      onClick={() => onOpenReplyModal(it.id, it.name)}
                    >
                      Reply
                    </button>
                    <span>{formatCommentTimeAgo(it.at, nowTs)}</span>
                  </div>
                  {it.reply ? (
                    <div className="tg-reader-detail__comment-reply">
                      {it.reply.avatar ? (
                        <img
                          src={it.reply.avatar}
                          alt=""
                          className="tg-reader-detail__comment-item-avatar tg-reader-detail__comment-item-avatar--reply"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="tg-reader-detail__comment-item-avatar tg-reader-detail__comment-item-avatar--ph tg-reader-detail__comment-item-avatar--reply" aria-hidden>
                          {(it.reply.name?.[0] ?? 'A').toUpperCase()}
                        </div>
                      )}
                      <div className="tg-reader-detail__comment-reply-main">
                        <p className="tg-reader-detail__comment-item-name inline-flex max-w-full min-w-0 items-center gap-1">
                          <span className="min-w-0 truncate">{it.reply.name}</span>
                          <CommentMemberBadges
                            tier={resolveCommentRowMemberTier({ row: it.reply })}
                          />
                        </p>
                        <p className="tg-reader-detail__comment-item-text">{it.reply.text}</p>
                        <div className="tg-reader-detail__comment-item-meta">
                          <button
                            type="button"
                            className="tg-reader-detail__comment-reply-link"
                            onClick={() => onOpenReplyModal(it.id, it.reply.name)}
                          >
                            Reply
                          </button>
                          <span>{formatCommentTimeAgo(it.reply.at ?? it.at, nowTs)}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {(extraReplies[it.id] ?? []).map((r) => (
                    <div key={r.id} className="tg-reader-detail__comment-reply">
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
                        <p className="tg-reader-detail__comment-item-name inline-flex max-w-full min-w-0 items-center gap-1">
                          <span className="min-w-0 truncate">{r.name}</span>
                          <CommentMemberBadges
                            tier={resolveCommentRowMemberTier({ row: r })}
                          />
                        </p>
                        <p className="tg-reader-detail__comment-item-text">{r.text}</p>
                        <div className="tg-reader-detail__comment-item-meta">
                          <button
                            type="button"
                            className="tg-reader-detail__comment-reply-link"
                            onClick={() => onOpenReplyModal(it.id, r.name)}
                          >
                            Reply
                          </button>
                          <span>{formatCommentTimeAgo(r.at, nowTs)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="tg-reader-detail__comment-item-actions">
                  {(() => {
                    const vote = commentVotes[it.id]
                    const baseUp = Number(it.likes ?? 0)
                    const baseDown = Number(it.dislikes ?? 0)
                    const upCount = baseUp
                    const downCount = baseDown
                    return (
                      <>
                  <button
                    type="button"
                    aria-label="ចូលចិត្តមតិ"
                    className={commentVotes[it.id] === 'up' ? 'is-active' : ''}
                    onClick={() => {
                      void onVoteComment(it.id, vote, 'up')
                    }}
                  >
                    {(upCount > 0) ? (
                      <span>
                        {upCount}
                      </span>
                    ) : null}
                    <Heart size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label="点踩មតិ"
                    className={commentVotes[it.id] === 'down' ? 'is-active' : ''}
                    onClick={() => {
                      void onVoteComment(it.id, vote, 'down')
                    }}
                  >
                    {downCount > 0 ? <span>{downCount}</span> : null}
                    <ThumbsDown size={18} />
                  </button>
                      </>
                    )
                  })()}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      {isReadingChapter ? (
        <div
          className="tg-reader-article-overlay"
          onScroll={(e) => {
            const top = e.currentTarget.scrollTop || 0
            setArticleHeaderCompact(top > 8)
          }}
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
              if ((e.currentTarget.scrollTop || 0) <= 0 && dy > 0) {
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
          <main className="tg-reader-article" ref={articleLayerRef}>
            <button
              type="button"
              className="tg-reader-article__back"
              aria-label="ទៅទំព័រដើម"
              onClick={() => {
                applyArticleLayerTransform(0, false)
                setReadingChapterIndex(null)
              }}
            >
              {'< ទៅទំព័រដើម'}
              {articleHeaderCompact ? (
                <>
                  <span className="tg-reader-article__back-center">{readingChapterName}</span>
                  <span className="tg-reader-article__back-right">{readingChapterNoLabel}</span>
                </>
              ) : null}
            </button>
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
                <p className="tg-reader-article__p">暂无正文</p>
              )}
            </section>
            <nav className="tg-reader-article__chapter-nav" aria-label="章节导航">
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
            aria-label="关闭开始阅读页面"
            onClick={onCloseStartReadPage}
          />
          <div className="tg-reader-start-page__panel">
            <h3 id="tg-reader-start-page-title" className="tg-reader-start-page__title">
              系统提示
            </h3>
            <p className="tg-reader-start-page__desc">
              已为你打开阅读入口，进入章节目录开始阅读之前必须先登录。
            </p>
            <div className="tg-reader-start-page__actions">
              <button type="button" className="tg-reader-start-page__btn tg-reader-start-page__btn--ghost" onClick={onCloseStartReadPage}>
                稍后再读
              </button>
              <button type="button" className="tg-reader-start-page__btn tg-reader-start-page__btn--primary" onClick={onEnterLoginFromStartReadPage}>
                进入登录
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {replyTarget ? (
        <div className="tg-reply-modal" role="dialog" aria-modal="true" aria-label="回复មតិ">
          <button type="button" className="tg-reply-modal__backdrop" onClick={onCloseReplyModal} aria-label="关闭弹窗" />
          <div className="tg-reply-modal__panel">
            <div className="tg-reply-modal__head">
              <h3 className="tg-reply-modal__title">
                {replyTarget.mode === 'comment' ? `给作品：${replyTarget.name}` : `回复：${replyTarget.name}`}
              </h3>
              <button type="button" className="tg-reply-modal__close" onClick={onCloseReplyModal} aria-label="关闭">
                <X size={24} />
              </button>
            </div>
            <div className="tg-reply-modal__body">
              <textarea
                className="tg-reply-modal__textarea"
                maxLength={500}
                placeholder="请输入回复内容"
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
              />
              <span className="tg-reply-modal__counter">{replyDraft.length}/500</span>
            </div>
            {replySubmitError ? <p className="tg-reply-modal__error">{replySubmitError}</p> : null}
            <button
              type="button"
              className="tg-reply-modal__submit"
              onClick={onSubmitReply}
              disabled={replySubmitPending}
            >
              {replySubmitPending ? '提交中...' : '提交មតិ'}
            </button>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  )
}
