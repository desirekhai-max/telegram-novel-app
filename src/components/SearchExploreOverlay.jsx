import { ArrowLeft, Flame, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { novels } from '../data/novels'

/** 演示用热度排序（后续可接 API） */
const byHeat = [...novels].map((n, i) => ({
  ...n,
  heatScore: 9800 - i * 420,
  readers: `${(12.4 - i * 2.1).toFixed(1)}万`,
}))

export default function SearchExploreOverlay({ onClose, query, setQuery }) {
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const [exiting, setExiting] = useState(false)
  const exitingGuardRef = useRef(false)
  const closeDoneRef = useRef(false)

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
    const t = requestAnimationFrame(() => inputRef.current?.focus())
    const onKey = (e) => {
      if (e.key === 'Escape') beginClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [beginClose])

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase()
    if (!s) return byHeat
    return byHeat.filter(
      (n) =>
        n.title.toLowerCase().includes(s) ||
        n.author.toLowerCase().includes(s) ||
        n.synopsis.toLowerCase().includes(s),
    )
  }, [query])

  return (
    <div
      className={exiting ? 'tg-search-explore tg-search-explore--exiting' : 'tg-search-explore'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-explore-title"
    >
      <button
        type="button"
        className="tg-search-explore__backdrop"
        aria-label="关闭"
        onClick={beginClose}
      />
      <div ref={panelRef} className="tg-search-explore__panel">
        <header className="tg-search-explore__head">
          <button
            type="button"
            className="tg-search-explore__back"
            onClick={beginClose}
            aria-label="返回"
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
          <h2 id="search-explore-title" className="tg-search-explore__title">
            热搜
          </h2>
        </header>

        <div className="tg-search-explore__search">
          <div className="tg-search-field tg-search-field--explore" role="search">
            <span className="tg-search-field__icon" aria-hidden="true">
              <Search size={18} strokeWidth={2} />
            </span>
            <input
              ref={inputRef}
              type="search"
              className="tg-search-field__input"
              placeholder="搜索小说、作者…"
              aria-label="搜索小说或作者"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <p className="tg-search-explore__hint">
            以下为当前站内热度排序（演示数据）
          </p>
        </div>

        {filtered.length === 0 ? (
          <p className="tg-search-explore__empty">没有匹配的结果</p>
        ) : (
          <ol className="tg-trend-list">
            {filtered.map((n, idx) => (
              <li key={n.id} className="tg-trend-list__item">
                <Link to={`/read/${n.id}`} className="tg-trend-row">
                  <span
                    className={`tg-trend-row__rank tg-trend-row__rank--${idx < 3 ? 'top' : 'rest'}`}
                  >
                    {idx < 3 ? (
                      <Flame size={18} aria-hidden />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <div className="tg-trend-row__body">
                    <div className="tg-trend-row__top">
                      <span className="tg-trend-row__title">{n.title}</span>
                      <span className="tg-trend-row__heat">{n.readers} 在读</span>
                    </div>
                    <div className="tg-trend-row__meta">
                      <span>{n.author}</span>
                      <span className="tg-trend-row__score">
                        热度 {n.heatScore.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
