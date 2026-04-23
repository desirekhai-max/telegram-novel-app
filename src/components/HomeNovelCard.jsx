import { Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  formatLatestChapterRelativeLabel,
  formatViewCount,
  formatWordCountFooter,
  getDisplayWordCountWan,
  getMeatCategoryByWordCount,
  commentPointsToStars,
} from '../lib/novelDisplay.js'

function StarRow({ commentPoints }) {
  const p = Number(commentPoints)
  const safePoints = Number.isFinite(p) && p > 0 ? Math.floor(p) : 0
  const starValue = commentPointsToStars(safePoints)
  return (
    <div className="tg-novel-card__rating-row tg-novel-card__row">
      <span className="tg-novel-card__label">ពិន្ទុ：</span>
      <span className="tg-novel-card__rating-tail tg-novel-card__ellipsis">
        <>
          <span className="tg-novel-card__rating-num">{safePoints}</span>
          <span className="tg-novel-card__stars" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className={[
                  'tg-novel-card__star',
                  starValue >= i + 1
                    ? 'tg-novel-card__star--on'
                    : starValue >= i + 0.5
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
        </>
      </span>
    </div>
  )
}

/**
 * @param {{ novel: object, meatCohort?: object[], onPickOriginal?: () => void, onPickTheme?: (label: string) => void, onPickTag?: (tag: string) => void, onPickAuthor?: (name: string) => void, canOpenRead?: boolean, onRequireLogin?: () => void }} props
 */
export default function HomeNovelCard({
  novel: n,
  meatCohort,
  onPickOriginal,
  onPickTheme,
  onPickTag,
  onPickAuthor,
  canOpenRead = true,
  onRequireLogin,
}) {
  const statusLabel = n.status === 'completed' ? 'ចប់ហើយ' : 'កំពុងចេញ'
  const showOriginal = n.source === 'original'
  const chapters = n.chapters ?? []
  const latestTitle = chapters.length ? `ភាគទី${chapters.length}` : '暂无章节'
  const latestRel = Number(n.cardUpdatedAtMs) > 0
    ? formatLatestChapterRelativeLabel({ updatedAtMs: Number(n.cardUpdatedAtMs) })
    : formatLatestChapterRelativeLabel(n)
  const themes = Array.isArray(n.listThemes) ? n.listThemes : []
  const tags = n.tags ?? []
  const views = Number.isFinite(Number(n.cardViewCount)) ? Math.max(0, Number(n.cardViewCount)) : 0
  const favs = Number.isFinite(Number(n.cardFavoriteCount)) ? Math.max(0, Number(n.cardFavoriteCount)) : 0
  const meatCat = getMeatCategoryByWordCount(n)
  const commentPoints = Number.isFinite(Number(n.cardRatingPoints)) ? Math.max(0, Number(n.cardRatingPoints)) : 0

  return (
    <div className="tg-novel-card">
      <Link
        to={`/read/${n.id}`}
        className="tg-novel-card__backdrop"
        aria-label={`阅读《${n.title}》`}
        onClick={(e) => {
          if (canOpenRead) return
          e.preventDefault()
          onRequireLogin?.()
        }}
      />
      <div className="tg-novel-card__content">
        <div className={`tg-novel-card__cover-wrap tg-novel-card__cover-wrap--${n.accent}`}>
          {n.coverUrl ? (
            <img src={n.coverUrl} alt="" className="tg-novel-card__cover-img" width="120" height="168" loading="lazy" />
          ) : (
            <div className="tg-novel-card__cover-ph" aria-hidden>
              <span className="tg-novel-card__cover-ph-text">{n.title.slice(0, 1)}</span>
            </div>
          )}
          <span className="tg-novel-card__status-badge">{statusLabel}</span>
        </div>
        <div className="tg-novel-card__main">
          <div className="tg-novel-card__title-line">
            {showOriginal ? (
              onPickOriginal ? (
                <button
                  type="button"
                  className="tg-novel-card__pill tg-novel-card__hit"
                  lang="zh-Hans"
                  onClick={(e) => {
                    e.preventDefault()
                    onPickOriginal()
                  }}
                >
                  ស្នាដៃដើម
                </button>
              ) : (
                <span className="tg-novel-card__pill" lang="zh-Hans">
                  ស្នាដៃដើម
                </span>
              )
            ) : null}
            <h3 className="tg-novel-card__title tg-novel-card__ellipsis">{n.title}</h3>
          </div>
          <p className="tg-novel-card__line tg-novel-card__row">
            <span className="tg-novel-card__label">អ្នកនិពន្ធ：</span>
            {onPickAuthor ? (
              <button
                type="button"
                className="tg-novel-card__value tg-novel-card__ellipsis tg-novel-card__hit tg-novel-card__author-btn"
                onClick={(e) => {
                  e.preventDefault()
                  onPickAuthor(n.author)
                }}
              >
                {n.author}
              </button>
            ) : (
              <span className="tg-novel-card__value tg-novel-card__ellipsis">{n.author}</span>
            )}
          </p>
          <StarRow commentPoints={commentPoints} />
          {themes.length > 0 ? (
            <p className="tg-novel-card__line tg-novel-card__row tg-novel-card__chip-row-wrap">
              <span className="tg-novel-card__label">ប្រភេទ：</span>
              <span className="tg-novel-card__chip-row">
                {themes.map((t) =>
                  onPickTheme ? (
                    <button
                      key={t}
                      type="button"
                      className="tg-novel-card__chip tg-novel-card__hit tg-novel-card__chip--theme"
                      onClick={(e) => {
                        e.preventDefault()
                        onPickTheme(t)
                      }}
                    >
                      {t}
                    </button>
                  ) : (
                    <span key={t} className="tg-novel-card__chip tg-novel-card__chip--theme">
                      {t}
                    </span>
                  ),
                )}
              </span>
            </p>
          ) : null}
          {tags.length > 0 ? (
            <p className="tg-novel-card__line tg-novel-card__row tg-novel-card__chip-row-wrap">
              <span className="tg-novel-card__label">ស្លាក：</span>
              <span className="tg-novel-card__chip-row tg-novel-card__chip-row--tags">
                {tags.map((t) =>
                  onPickTag ? (
                    <button
                      key={t}
                      type="button"
                      className="tg-novel-card__chip tg-novel-card__hit tg-novel-card__chip--tag"
                      onClick={(e) => {
                        e.preventDefault()
                        onPickTag(t)
                      }}
                    >
                      #{t}
                    </button>
                  ) : (
                    <span key={t} className="tg-novel-card__chip tg-novel-card__chip--tag">
                      #{t}
                    </span>
                  ),
                )}
              </span>
            </p>
          ) : null}
          <p className="tg-novel-card__line tg-novel-card__row tg-novel-card__intro">
            <span className="tg-novel-card__label">សេចក្តីសង្ខេប：</span>
            <span className="tg-novel-card__intro-text tg-novel-card__ellipsis">{n.synopsis}</span>
          </p>
          <p className="tg-novel-card__line tg-novel-card__row">
            <span className="tg-novel-card__label">ថ្មីបំផុត：</span>
            <span className="tg-novel-card__value tg-novel-card__ellipsis">
              {latestTitle}
              {latestRel ? <span className="tg-novel-card__rel">（{latestRel}）</span> : null}
            </span>
          </p>
          <div className="tg-novel-card__stats">
            <span><Eye size={12} strokeWidth={1.9} className="tg-novel-card__stats-icon" />{formatViewCount(views)}</span>
            <span>☆ {favs}</span>
            <span>{formatWordCountFooter(getDisplayWordCountWan(n))}</span>
            <span>（{meatCat}）</span>
          </div>
        </div>
      </div>
    </div>
  )
}
