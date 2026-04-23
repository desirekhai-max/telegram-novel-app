import { ExternalLink } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GENRE_OPTIONS,
  LENGTH_OPTIONS,
  MAX_SELECTED_FILTER_TAGS,
  SOURCE_OPTIONS,
  STATUS_OPTIONS,
  TAG_CHIPS,
} from '../data/homeFilters.js'

/**
 * 临时开关：合作方验收期间隐藏筛选里的具体题材/标签（如「都市」「1v1」等）。
 * 仅保留「全部题材 / 全部标签」入口，便于后续快速恢复展示。
 */
const HIDE_SPECIFIC_GENRE_AND_TAG_FILTERS = true

/**
 * 受控筛选层：每次点击题材/状态/篇幅/来源/标签都会同步到首页。
 * 点击上述任一选项后会收起全屏层（含「全部」、再次点同一项），便于立刻看到首页已选条。
 * 「收起」仅关闭面板。
 */
export default function HomeFilterPanelOverlay({ criteria, onCriteriaChange, onClose }) {
  const panelRef = useRef(null)
  const [exiting, setExiting] = useState(false)
  const exitingGuardRef = useRef(false)
  const closeDoneRef = useRef(false)

  const { genre, status, lengthId, source, tags } = criteria
  const tagList = tags ?? []
  const tagSet = new Set(tagList)
  const genreOptions = HIDE_SPECIFIC_GENRE_AND_TAG_FILTERS
    ? GENRE_OPTIONS.filter((o) => o.id === 'all')
    : GENRE_OPTIONS
  const tagChips = HIDE_SPECIFIC_GENRE_AND_TAG_FILTERS ? [] : TAG_CHIPS
  const effectiveGenre = HIDE_SPECIFIC_GENRE_AND_TAG_FILTERS ? 'all' : genre

  const patch = useCallback(
    (partial) => {
      const nextTags =
        partial.tags !== undefined ? partial.tags : [...(criteria.tags ?? [])]
      onCriteriaChange({
        ...criteria,
        ...partial,
        tags: nextTags,
      })
    },
    [criteria, onCriteriaChange],
  )

  const finishCloseAfterAnimation = useCallback(() => {
    if (closeDoneRef.current) return
    closeDoneRef.current = true
    exitingGuardRef.current = false
    onClose()
  }, [onClose])

  const beginClose = useCallback(() => {
    if (exitingGuardRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    exitingGuardRef.current = true
    setExiting(true)
  }, [onClose])

  useEffect(() => {
    if (!exiting || !panelRef.current) return
    const el = panelRef.current
    const onEnd = (e) => {
      if (e.target !== el || e.propertyName !== 'transform') return
      el.removeEventListener('transitionend', onEnd)
      finishCloseAfterAnimation()
    }
    el.addEventListener('transitionend', onEnd)
    const t = window.setTimeout(() => {
      el.removeEventListener('transitionend', onEnd)
      finishCloseAfterAnimation()
    }, 420)
    return () => {
      el.removeEventListener('transitionend', onEnd)
      window.clearTimeout(t)
    }
  }, [exiting, finishCloseAfterAnimation])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') beginClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [beginClose])

  /** 应用局部条件并收起全屏层，便于立刻看到首页已选标签与列表 */
  const narrowAndClose = useCallback(
    (partial) => {
      patch(partial)
      beginClose()
    },
    [patch, beginClose],
  )

  const toggleTag = (label) => {
    const arr = [...tagList]
    const i = arr.indexOf(label)
    if (i >= 0) {
      arr.splice(i, 1)
    } else {
      arr.push(label)
      while (arr.length > MAX_SELECTED_FILTER_TAGS) {
        arr.shift()
      }
    }
    narrowAndClose({ tags: arr })
  }

  const tagsAllActive = tagList.length === 0

  const clearTags = () => narrowAndClose({ tags: [] })

  return (
    <div
      className={exiting ? 'tg-filter-panel tg-filter-panel--exiting' : 'tg-filter-panel'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tg-filter-panel-title"
    >
      <button
        type="button"
        className="tg-filter-panel__backdrop"
        aria-label="关闭ចម្រោះ"
        onClick={beginClose}
      />
      <div ref={panelRef} className="tg-filter-panel__sheet">
        <header className="tg-filter-panel__head">
          <h2 id="tg-filter-panel-title" className="tg-filter-panel__title">
            ចម្រោះ
          </h2>
        </header>

        <div className="tg-filter-panel__body">
          <section className="tg-filter-section" aria-labelledby="filter-genre">
            <h3 id="filter-genre" className="tg-filter-section__name">
            ប្រភេទ
            </h3>
            <div className="tg-filter-section__chips">
              {genreOptions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={[
                    'tg-filter-chip',
                    o.id === 'all' ? 'tg-filter-chip--pill' : '',
                    effectiveGenre === o.id ? 'tg-filter-chip--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={effectiveGenre === o.id}
                  onClick={() => narrowAndClose({ genre: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          <section className="tg-filter-section" aria-labelledby="filter-status">
            <h3 id="filter-status" className="tg-filter-section__name">
            ស្ថានភាព
            </h3>
            <div className="tg-filter-section__chips">
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={[
                    'tg-filter-chip',
                    o.id === 'all' ? 'tg-filter-chip--pill' : '',
                    status === o.id ? 'tg-filter-chip--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={status === o.id}
                  onClick={() => narrowAndClose({ status: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          <section className="tg-filter-section" aria-labelledby="filter-source">
            <h3 id="filter-source" className="tg-filter-section__name">
            ប្រភព
            </h3>
            <div className="tg-filter-section__chips">
              {SOURCE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={[
                    'tg-filter-chip',
                    o.id === 'all' ? 'tg-filter-chip--pill' : '',
                    source === o.id ? 'tg-filter-chip--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={source === o.id}
                  onClick={() => narrowAndClose({ source: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          <section className="tg-filter-section" aria-labelledby="filter-tags">
            <h3 id="filter-tags" className="tg-filter-section__name">
            ស្លាក
            </h3>
            <div className="tg-filter-section__hint-line">
              <button type="button" className="tg-filter-section__hint-btn">
              ការណែនាំ
              </button>
            </div>
            <div className="tg-filter-section__chips">
              <button
                id="filter-tags-all"
                type="button"
                className={[
                  'tg-filter-chip',
                  'tg-filter-chip--pill',
                  tagsAllActive ? 'tg-filter-chip--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={tagsAllActive}
                onClick={clearTags}
              >
                ស្លាកទាំងអស់
              </button>
              {tagChips.map((label) => {
                const on = tagSet.has(label)
                return (
                  <button
                    key={label}
                    type="button"
                    className={['tg-filter-chip', on ? 'tg-filter-chip--active' : '']
                      .filter(Boolean)
                      .join(' ')}
                    aria-pressed={on}
                    onClick={() => toggleTag(label)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="tg-filter-section" aria-labelledby="filter-length">
            <h3 id="filter-length" className="tg-filter-section__name">
            កម្រិត
            </h3>
            <div className="tg-filter-section__chips">
              {LENGTH_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={[
                    'tg-filter-chip',
                    o.id === 'all' ? 'tg-filter-chip--pill' : '',
                    lengthId === o.id ? 'tg-filter-chip--active' : '',
                    o.id !== 'all' ? 'tg-filter-chip--long' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={lengthId === o.id}
                  onClick={() => narrowAndClose({ lengthId: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          <section className="tg-filter-section tg-filter-section--row">
            <span className="tg-filter-section__row-label">រើសបានច្រើន</span>
            <button type="button" className="tg-filter-section__icon-btn" aria-label="编辑多选ស្លាក">
              <ExternalLink size={18} strokeWidth={2} aria-hidden />
            </button>
          </section>

          <section className="tg-filter-section tg-filter-section--row">
            <span className="tg-filter-section__row-label">លាក់ស្លាក</span>
            <button type="button" className="tg-filter-section__icon-btn" aria-label="编辑屏蔽ស្លាក">
              <ExternalLink size={18} strokeWidth={2} aria-hidden />
            </button>
          </section>
        </div>

        <footer className="tg-filter-panel__foot">
          <button type="button" className="tg-filter-panel__collapse" onClick={beginClose}>
          បិទ
          </button>
        </footer>
      </div>
    </div>
  )
}
