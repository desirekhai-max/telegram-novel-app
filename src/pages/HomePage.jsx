import { Bell, ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import HomeFilterPanelOverlay from '../components/HomeFilterPanelOverlay.jsx'
import HomeNovelCard from '../components/HomeNovelCard.jsx'
import { MAX_SELECTED_FILTER_TAGS } from '../data/homeFilters.js'
import { novels } from '../data/novels.js'
import { useAppChrome } from '../contexts/useAppChrome.js'
import {
  applyThemeLabelToCriteria,
  criteriaToAppliedState,
  mergeAppendTag,
  mergeSourceOriginal,
} from '../lib/applyCardFilterPick.js'
import {
  EMPTY_HOME_FILTER_CRITERIA,
  filterNovelsByHomeCriteria,
  isDefaultHomeFilterCriteria,
} from '../lib/filterNovels.js'
import { getAppliedFilterChips, removeCriterionFromCriteria } from '../lib/homeFilterChips.js'
import { buildHomeOrderedNovels } from '../lib/homeListOrder.js'
import { fetchHomeStats } from '../lib/miniAppPresence.js'
import { novelMatchesInlineSearch } from '../lib/novelInlineSearch.js'
import { refreshAppFromLogo } from '../lib/refreshAppFromLogo.js'

const SORT_OPTIONS = [
  { id: 'update', label: '​ថ្មីៗ'},
  { id: 'views', label: 'អ្នកមើល'},
  { id: 'favorites', label: 'រក្សាទុក'},
  { id: 'rating', label: 'ពិន្ទុ'},
  { id: 'meat', label: 'ទំហំ'},
]
const HOME_PAGE_SIZE = 43

/** 当前选中项的 title：sortDesc 为 true 对应 ﹀（降序），false 对应 ︿（升序） */
const SORT_ACTIVE_TITLE = {
  update: {
    desc: '更新：按最新一章距现在多久，越新越上（与「2 分钟前」一致）',
    asc: '更新：按最新一章距现在多久，越久越上',
  },
  views: {
    desc: '观看：从最多阅读到最少',
    asc: '观看：从最少到最多阅读',
  },
  favorites: {
    desc: '收藏：从最多收藏到最少',
    asc: '收藏：从最少到最多收藏',
  },
  rating: {
    desc: '评分：从高分到低分',
    asc: '评分：从低分到高分',
  },
  meat: {
    desc: '肉量：按正文字符数，从多到少',
    asc: '肉量：按正文字符数，从少到多',
  },
}

function buildPageButtonItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const arr = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) arr.push('ellipsis-left')
  for (let i = start; i <= end; i += 1) arr.push(i)
  if (end < total - 1) arr.push('ellipsis-right')
  arr.push(total)
  return arr
}

export default function HomePage() {
  /** 顶栏搜索框文案（可随时编辑） */
  const [searchDraft, setSearchDraft] = useState('')
  /** 仅按回车后用于列表筛选；与草稿不一致时视为未提交，不展示搜索卡片 */
  const [committedQuery, setCommittedQuery] = useState('')
  const searchInputRef = useRef(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [appliedCriteria, setAppliedCriteria] = useState(null)
  /** 点作者名：只收窄列表，不出现在「已选」标签里 */
  const [authorShelfFilter, setAuthorShelfFilter] = useState(null)
  /** null：未点选任何排序项，列表仍按「更新」规则排，但顶栏不高亮 */
  const [sortKey, setSortKey] = useState(null)
  const [sortDesc, setSortDesc] = useState(true)
  const {
    setSearchExploreOpen,
    setFilterPanelOpen,
    setHomeSearchInputFocused,
    homeSearchInputFocused,
  } = useAppChrome()

  const searchTrim = committedQuery.trim()
  const isSearchMode = searchTrim.length > 0

  useEffect(() => {
    if (searchDraft.trim() === committedQuery.trim()) return
    setCommittedQuery('')
  }, [searchDraft, committedQuery])

  useEffect(() => {
    if (isSearchMode) setFilterOpen(false)
  }, [isSearchMode])

  useEffect(() => {
    return () => setHomeSearchInputFocused(false)
  }, [setHomeSearchInputFocused])

  /** 阅读页提交评论分后刷新卡片与「评分」排序 */
  const [reviewRatingTick, setReviewRatingTick] = useState(0)
  const [homeStats, setHomeStats] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  useEffect(() => {
    const fn = () => setReviewRatingTick((t) => t + 1)
    window.addEventListener('tg-novel-ratings-changed', fn)
    return () => window.removeEventListener('tg-novel-ratings-changed', fn)
  }, [])
  useEffect(() => {
    let cancelled = false
    const pull = async () => {
      const items = await fetchHomeStats()
      if (cancelled) return
      setHomeStats(items)
    }
    pull()
    return () => {
      cancelled = true
    }
  }, [])

  /** 仅关键词命中（未套首页筛选），用于空态区分「无命中」与「有命中但被筛选掉」 */
  const searchKeywordHits = useMemo(() => {
    if (!isSearchMode) return null
    return novels.filter((n) => novelMatchesInlineSearch(n, searchTrim))
  }, [isSearchMode, searchTrim])

  const displayedNovels = useMemo(() => {
    const withStats = (list) =>
      list.map((n) => {
        const s = homeStats?.[String(n.id)] ?? {}
        return {
          ...n,
          cardViewCount: Number(s?.viewCount) >= 0 ? Number(s.viewCount) : 0,
          cardFavoriteCount: Number(s?.favoriteCount) >= 0 ? Number(s.favoriteCount) : 0,
          cardRatingPoints: Number(s?.ratingPoints) >= 0 ? Number(s.ratingPoints) : 0,
        }
      })
    if (isSearchMode) {
      const hit = searchKeywordHits ?? []
      const filtered = filterNovelsByHomeCriteria(hit, appliedCriteria)
      return buildHomeOrderedNovels(withStats(filtered), sortKey, sortDesc)
    }
    const pool = authorShelfFilter ? novels.filter((n) => n.author === authorShelfFilter) : novels
    const filtered = filterNovelsByHomeCriteria(pool, appliedCriteria)
    return buildHomeOrderedNovels(withStats(filtered), sortKey, sortDesc)
  }, [appliedCriteria, authorShelfFilter, homeStats, isSearchMode, reviewRatingTick, searchKeywordHits, sortDesc, sortKey])

  const filterHadNoResults = useMemo(() => {
    if (!appliedCriteria || isDefaultHomeFilterCriteria(appliedCriteria)) return false
    return displayedNovels.length === 0
  }, [appliedCriteria, displayedNovels.length])

  const resultCountLabel = useMemo(
    () => displayedNovels.length.toLocaleString('zh-CN'),
    [displayedNovels.length],
  )
  const totalPages = Math.max(1, Math.ceil(displayedNovels.length / HOME_PAGE_SIZE))
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTrim, appliedCriteria, authorShelfFilter, sortKey, sortDesc])
  useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])
  const pagedNovels = useMemo(() => {
    const start = (currentPage - 1) * HOME_PAGE_SIZE
    return displayedNovels.slice(start, start + HOME_PAGE_SIZE)
  }, [currentPage, displayedNovels])
  const pageButtonItems = useMemo(
    () => buildPageButtonItems(currentPage, totalPages),
    [currentPage, totalPages],
  )

  const appliedFilterChips = useMemo(
    () => getAppliedFilterChips(appliedCriteria),
    [appliedCriteria],
  )

  const onRemoveAppliedChip = useCallback((removeKey) => {
    setAppliedCriteria((prev) => removeCriterionFromCriteria(prev, removeKey))
  }, [])

  const onPickOriginalFromCard = useCallback(() => {
    setAppliedCriteria((prev) => criteriaToAppliedState(mergeSourceOriginal(prev)))
  }, [])

  const onPickThemeFromCard = useCallback((label) => {
    setAppliedCriteria((prev) => criteriaToAppliedState(applyThemeLabelToCriteria(label, prev)))
  }, [])

  const onPickTagFromCard = useCallback((tag) => {
    setAppliedCriteria((prev) => criteriaToAppliedState(mergeAppendTag(prev, tag)))
  }, [])

  const onPickAuthorFromCard = useCallback((name) => {
    setAuthorShelfFilter(name)
    /** 从搜索列表点作者：退出搜索，直接看该作者全部作品（不出现在「已选」里） */
    setSearchDraft('')
    setCommittedQuery('')
  }, [])

  const panelCriteria = appliedCriteria ?? EMPTY_HOME_FILTER_CRITERIA

  const onFilterCriteriaChange = useCallback((next) => {
    let n = next
    if (n?.tags?.length > MAX_SELECTED_FILTER_TAGS) {
      n = { ...n, tags: n.tags.slice(-MAX_SELECTED_FILTER_TAGS) }
    }
    setAppliedCriteria(isDefaultHomeFilterCriteria(n) ? null : n)
  }, [])

  const onSortClick = (id) => {
    if (sortKey != null && id === sortKey) {
      setSortDesc((d) => !d)
      return
    }
    setSortKey(id)
    setSortDesc(true)
  }

  useEffect(() => {
    setSearchExploreOpen(false)
    return () => setSearchExploreOpen(false)
  }, [setSearchExploreOpen])

  useEffect(() => {
    setFilterPanelOpen(filterOpen)
    return () => {
      setFilterPanelOpen(false)
    }
  }, [filterOpen, setFilterPanelOpen])

  return (
    <div
      className={['tg-app', 'tg-app--home', homeSearchInputFocused ? 'tg-app--home-search-focus' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <header className="tg-toolbar tg-toolbar--large tg-toolbar--home">
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
              ref={searchInputRef}
              className="tg-search-field__input"
              type="text"
              enterKeyHint="search"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="ស្វែងរកសៀវភៅ ឬអ្នកនិពន្ធ..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onFocus={() => setHomeSearchInputFocused(true)}
              onBlur={() => {
                window.setTimeout(() => setHomeSearchInputFocused(false), 120)
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                setAuthorShelfFilter(null)
                setCommittedQuery(searchDraft.trim())
                searchInputRef.current?.blur()
              }}
              aria-label="搜索小说、作者或ស្លាក；回车查看结果并收起键盘"
            />
            {searchDraft.length > 0 ? (
              <button
                type="button"
                className="tg-search-field__clear"
                aria-label="清空搜索"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAuthorShelfFilter(null)
                  setSearchDraft('')
                  setCommittedQuery('')
                }}
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

      <div className="tg-home-main-rule" aria-hidden />

      <main className="tg-list-wrap tg-home-body-scroll flex min-h-0 flex-1 flex-col">
        <div className="tg-home-filter-bar">
          <div className="tg-home-filter-bar__picked-row">
            <span className="tg-home-filter-bar__picked-label" lang="zh-Hans">
              បានជ្រើសរើស：
            </span>
            <div className="tg-home-filter-bar__picked-tags">
              {appliedFilterChips.map((chip) => (
                <span key={chip.removeKey} className="tg-home-filter-bar__tag-chip">
                  <span className="tg-home-filter-bar__tag-chip-label">{chip.label}</span>
                  <button
                    type="button"
                    className="tg-home-filter-bar__tag-chip-remove"
                    aria-label={`移除「${chip.label}」`}
                    onClick={() => onRemoveAppliedChip(chip.removeKey)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          {authorShelfFilter ? (
            <div className="tg-home-filter-bar__author-scope" lang="zh-Hans">
              <span className="tg-home-filter-bar__author-scope-text">
                正在浏览「{authorShelfFilter}」的作品
              </span>
              <button
                type="button"
                className="tg-home-filter-bar__author-scope-clear"
                onClick={() => setAuthorShelfFilter(null)}
              >
                清除
              </button>
            </div>
          ) : null}
          <div className="tg-home-filter-bar__actions">
            <button
              type="button"
              className="tg-home-filter-bar__filter"
              aria-label="ចម្រោះ书目"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen(true)}
            >
              <span className="tg-home-filter-bar__filter-icon-wrap" aria-hidden>
                <Filter size={16} strokeWidth={2} />
              </span>
              <span>
              ជ្រើសរើស
                <span className="tg-home-filter-bar__filter-count">（{resultCountLabel}）</span>
              </span>
            </button>
            <div className="tg-home-filter-bar__sort" role="toolbar" aria-label="排序">
              {SORT_OPTIONS.map(({ id, label }) => {
                const active = sortKey != null && id === sortKey
                const dirTitles = SORT_ACTIVE_TITLE[id]
                return (
                  <button
                    key={id}
                    type="button"
                    className={[
                      'tg-home-filter-bar__sort-btn',
                      active ? 'tg-home-filter-bar__sort-btn--active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-pressed={active}
                    aria-sort={active ? (sortDesc ? 'descending' : 'ascending') : undefined}
                    title={active && dirTitles ? (sortDesc ? dirTitles.desc : dirTitles.asc) : undefined}
                    onClick={() => onSortClick(id)}
                  >
                    {label}
                    {active ? (
                      <span className="tg-home-filter-bar__sort-chevron" aria-hidden>
                        {sortDesc ? (
                          <ChevronDown size={14} strokeWidth={2.25} />
                        ) : (
                          <ChevronUp size={14} strokeWidth={2.25} />
                        )}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {isSearchMode ? (
          displayedNovels.length === 0 ? (
            <p className="tg-home-novel-list__empty" lang="zh-Hans">
              {(searchKeywordHits?.length ?? 0) === 0
                ? `未找到与「${searchTrim}」相关的小说（标题、作者或ស្លាក）。`
                : `在「${searchTrim}」的搜索结果中，没有符合当前筛选条件的小说，请放宽或移除「បានជ្រើសរើស」条件后再试。`}
            </p>
          ) : (
            <ul className="tg-list tg-home-novel-list">
              {pagedNovels.map((n) => (
                <li key={n.id} className="tg-list__item tg-list__item--novel-card">
                  <HomeNovelCard
                    novel={n}
                    meatCohort={displayedNovels}
                    onPickOriginal={onPickOriginalFromCard}
                    onPickTheme={onPickThemeFromCard}
                    onPickTag={onPickTagFromCard}
                    onPickAuthor={onPickAuthorFromCard}
                  />
                </li>
              ))}
            </ul>
          )
        ) : filterHadNoResults ? (
          <p className="tg-home-novel-list__empty">没有符合当前筛选条件的小说，请放宽条件后再试。</p>
        ) : (
          <ul className="tg-list tg-home-novel-list">
            {pagedNovels.map((n) => (
              <li key={n.id} className="tg-list__item tg-list__item--novel-card">
                <HomeNovelCard
                  novel={n}
                  meatCohort={displayedNovels}
                  onPickOriginal={onPickOriginalFromCard}
                  onPickTheme={onPickThemeFromCard}
                  onPickTag={onPickTagFromCard}
                  onPickAuthor={onPickAuthorFromCard}
                />
              </li>
            ))}
          </ul>
        )}
        {displayedNovels.length > 0 && totalPages > 1 ? (
          <nav className="tg-home-pagination" aria-label="首页分页">
            <button
              type="button"
              className="tg-home-pagination__btn"
              aria-label="上一页"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              {'<'}
            </button>
            {pageButtonItems.map((item) =>
              typeof item === 'number' ? (
                <button
                  key={item}
                  type="button"
                  className={[
                    'tg-home-pagination__btn',
                    item === currentPage ? 'tg-home-pagination__btn--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-current={item === currentPage ? 'page' : undefined}
                  onClick={() => setCurrentPage(item)}
                >
                  {item}
                </button>
              ) : (
                <span key={item} className="tg-home-pagination__ellipsis" aria-hidden>
                  ...
                </span>
              ),
            )}
            <button
              type="button"
              className="tg-home-pagination__btn"
              aria-label="下一页"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              {'>'}
            </button>
          </nav>
        ) : null}
      </main>

      {filterOpen ? (
        <HomeFilterPanelOverlay
          criteria={panelCriteria}
          onCriteriaChange={onFilterCriteriaChange}
          onClose={() => setFilterOpen(false)}
        />
      ) : null}
    </div>
  )
}
