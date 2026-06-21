import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_HOME_FILTER_PANEL_CONFIG } from '../lib/homeFilterPanelConfig.js'


/**
 * 受控筛选层：每次点击题材/状态/篇幅/来源/标签都会同步到首页。
 * 面板分组与词条文案由 `panelConfig` 驱动（可由后台 JSON 下发）。
 */
export default function HomeFilterPanelOverlay({ criteria, onCriteriaChange, onClose, panelConfig }) {
  const resolvedConfig = panelConfig ?? DEFAULT_HOME_FILTER_PANEL_CONFIG
  const effectiveConfig = useMemo(() => resolvedConfig, [resolvedConfig])
  const maxSelectedTags = effectiveConfig.maxSelectedTags ?? 3

  const panelRef = useRef(null)
  const [exiting, setExiting] = useState(false)
  const exitingGuardRef = useRef(false)
  const closeDoneRef = useRef(false)

  const { genre, status, lengthId, source, audience, tags } = criteria
  const tagList = tags ?? []
  const tagSet = new Set(tagList)

  const criteriaSingleValue = useCallback(
    (key) => {
      if (key === 'genre') return genre
      if (key === 'status') return status
      if (key === 'lengthId') return lengthId
      if (key === 'source') return source
      if (key === 'audience') return audience
      return undefined
    },
    [genre, status, lengthId, source, audience],
  )

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

  const narrowAndClose = useCallback(
    (partial) => {
      patch(partial)
      beginClose()
    },
    [patch, beginClose],
  )

  const toggleTag = (value) => {
    const v = String(value ?? '').trim()
    if (!v) return
    const arr = [...tagList]
    const i = arr.indexOf(v)
    if (i >= 0) {
      arr.splice(i, 1)
    } else {
      arr.push(v)
      while (arr.length > maxSelectedTags) {
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
            {effectiveConfig.title}
          </h2>
        </header>

        <div className="tg-filter-panel__body">
          {effectiveConfig.groups.map((group) => {
            const sid = `filter-${group.key}`
            if (group.type === 'single') {
              const cur = criteriaSingleValue(group.key)
              return (
                <section
                  key={group.key}
                  className="tg-filter-section"
                  aria-labelledby={group.title ? sid : undefined}
                >
                  {group.title ? (
                    <h3 id={sid} className="tg-filter-section__name">
                      {group.title}
                    </h3>
                  ) : null}
                  <div className="tg-filter-section__chips">
                    {group.options.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className={[
                          'tg-filter-chip',
                          o.pill ? 'tg-filter-chip--pill' : '',
                          cur === o.value ? 'tg-filter-chip--active' : '',
                          group.key === 'lengthId' && o.value !== 'all' && o.long !== false
                            ? 'tg-filter-chip--long'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        aria-pressed={cur === o.value}
                        onClick={() =>
                          narrowAndClose({
                            [group.key]: o.value,
                          })
                        }
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </section>
              )
            }
            if (group.type === 'tags') {
              return (
                <section
                  key={group.key}
                  className="tg-filter-section"
                  aria-labelledby={group.title ? sid : undefined}
                >
                  {group.title ? (
                    <h3 id={sid} className="tg-filter-section__name">
                      {group.title}
                    </h3>
                  ) : null}
                  {group.hintLabel ? (
                    <div className="tg-filter-section__hint-line">
                      <button type="button" className="tg-filter-section__hint-btn">
                        {group.hintLabel}
                      </button>
                    </div>
                  ) : null}
                  <div className="tg-filter-section__chips">
                    <button
                      id={`${sid}-all`}
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
                      {group.allLabel ?? 'ទាំងអស់'}
                    </button>
                    {group.options.map((o) => {
                      const on = tagSet.has(o.value)
                      return (
                        <button
                          key={o.value}
                          type="button"
                          className={['tg-filter-chip', on ? 'tg-filter-chip--active' : '']
                            .filter(Boolean)
                            .join(' ')}
                          aria-pressed={on}
                          onClick={() => toggleTag(o.value)}
                        >
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            }
            return null
          })}
        </div>

        <footer className="tg-filter-panel__foot">
          <button type="button" className="tg-filter-panel__collapse" onClick={beginClose}>
            {effectiveConfig.closeLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
