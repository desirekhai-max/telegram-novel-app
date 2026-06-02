/**
 * 阅读页加载占位：章节标题 + 段落 Skeleton。
 */
export default function ReaderArticleSkeleton() {
  return (
    <section className="tg-reader-article__body tg-reader-article__body--skeleton" aria-busy="true" aria-label="កំពុងផ្ទុកអត្ថបទ">
      <div className="tg-skeleton tg-skeleton--article-title" aria-hidden />
      <div className="tg-skeleton tg-skeleton--article-subtitle" aria-hidden />
      <div className="tg-skeleton tg-skeleton--article-meta" aria-hidden />
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className={[
            'tg-skeleton',
            'tg-skeleton--paragraph',
            i % 3 === 2 ? 'tg-skeleton--w75' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden
        />
      ))}
    </section>
  )
}
