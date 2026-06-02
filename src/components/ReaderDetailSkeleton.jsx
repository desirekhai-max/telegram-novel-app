/**
 * 详情页加载占位：封面 / 标题 / 简介等 Skeleton，禁止空白深蓝屏。
 */
export default function ReaderDetailSkeleton({ partialNovel = null }) {
  const accent = partialNovel?.accent || 'violet'
  const hasCover = Boolean(partialNovel?.coverUrl)
  const hasTitle = Boolean(partialNovel?.title)

  return (
    <main className="tg-reader-detail tg-reader-detail--skeleton" lang="km" aria-busy="true" aria-label="កំពុងផ្ទុក">
      <section className="tg-reader-detail__head">
        <div className={`tg-reader-detail__cover-wrap tg-reader-detail__cover-wrap--${accent}`}>
          {hasCover ? (
            <img src={partialNovel.coverUrl} alt="" className="tg-reader-detail__cover" />
          ) : (
            <div className="tg-skeleton tg-skeleton--cover" aria-hidden />
          )}
        </div>
        <div className="tg-reader-detail__meta">
          {hasTitle ? (
            <h1 className="tg-reader-detail__title">{partialNovel.title}</h1>
          ) : (
            <div className="tg-skeleton tg-skeleton--title" aria-hidden />
          )}
          <div className="tg-skeleton tg-skeleton--line tg-skeleton--w80" aria-hidden />
          <div className="tg-skeleton tg-skeleton--line tg-skeleton--w65" aria-hidden />
          <div className="tg-skeleton tg-skeleton--line tg-skeleton--w55" aria-hidden />
          <div className="tg-skeleton tg-skeleton--line tg-skeleton--w70" aria-hidden />
        </div>
      </section>
      <div className="tg-skeleton tg-skeleton--read-btn" aria-hidden />
      <div className="tg-reader-detail__intro-head">
        <div className="tg-skeleton tg-skeleton--intro" aria-hidden />
        <div className="tg-skeleton tg-skeleton--intro tg-skeleton--w90" aria-hidden />
      </div>
      <div className="tg-skeleton tg-skeleton--tags" aria-hidden />
      <div className="tg-reader-detail__stats tg-reader-detail__stats--skeleton">
        <span className="tg-skeleton tg-skeleton--chip" aria-hidden />
        <span className="tg-skeleton tg-skeleton--chip" aria-hidden />
        <span className="tg-skeleton tg-skeleton--chip" aria-hidden />
      </div>
      <section className="tg-reader-detail__catalog">
        <div className="tg-reader-detail__catalog-head">
          <div className="tg-skeleton tg-skeleton--catalog-title" aria-hidden />
        </div>
        <ul className="tg-reader-detail__chapter-list">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="tg-reader-detail__chapter-item tg-reader-detail__chapter-item--skeleton">
              <span className="tg-skeleton tg-skeleton--chapter" aria-hidden />
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
