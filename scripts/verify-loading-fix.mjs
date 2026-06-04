/**
 * 验收脚本：构建产物 + API + 源码路由覆盖
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const distAssets = join(root, 'dist', 'assets')
const jsFile = readdirSync(distAssets).find((f) => f.startsWith('index-') && f.endsWith('.js'))
const cssFile = readdirSync(distAssets).find((f) => f.startsWith('index-') && f.endsWith('.css'))
const js = readFileSync(join(distAssets, jsFile), 'utf8')
const css = readFileSync(join(distAssets, cssFile), 'utf8')
const runtimeSrc = readFileSync(join(root, 'src', 'lib', 'novelsRuntime.js'), 'utf8')
const readerSrc = readFileSync(join(root, 'src', 'pages', 'ReaderPage.jsx'), 'utf8')

const results = {
  buildArtifacts: js.includes('tg-skeleton') && css.includes('tg-skeleton-shimmer'),
  detailSkeleton:
    js.includes('tg-reader-detail--skeleton') &&
    readerSrc.includes('ReaderDetailSkeleton') &&
    readerSrc.includes("loadStatus === 'notFound'"),
  readerSkeleton:
    js.includes('tg-reader-article__body--skeleton') &&
    readerSrc.includes('ReaderArticleSkeleton') &&
    readerSrc.includes('readingContentLoading'),
  cache:
    runtimeSrc.includes('NOVEL_STALE_TIME_MS = 5 * 60 * 1000') &&
    runtimeSrc.includes('NOVEL_CACHE_TIME_MS = 30 * 60 * 1000') &&
    runtimeSrc.includes('cache-stale') &&
    runtimeSrc.includes('getNovelFullSync'),
  prefetchRoutes:
    readFileSync(join(root, 'src', 'components', 'HomeNovelCard.jsx'), 'utf8').includes('prefetchNovelNav') &&
    readFileSync(join(root, 'src', 'components', 'SearchExploreOverlay.jsx'), 'utf8').includes('bindNovelNavPrefetchHandlers') &&
    readFileSync(join(root, 'src', 'pages', 'SavedPage.jsx'), 'utf8').includes('bindNovelNavPrefetchHandlers') &&
    readFileSync(join(root, 'src', 'pages', 'ReadingHistoryPage.jsx'), 'utf8').includes('bindNovelNavPrefetchHandlers') &&
    readFileSync(join(root, 'src', 'pages', 'NotificationsPage.jsx'), 'utf8').includes('prefetchNovelNav'),
  api: false,
  novelDetailApi: false,
}

const apiBase = process.env.API_BASE || 'http://127.0.0.1:8787'
try {
  const catalogRes = await fetch(`${apiBase}/api/novels-catalog`, { signal: AbortSignal.timeout(8000) })
  results.api = catalogRes.ok
  if (catalogRes.ok) {
    const data = await catalogRes.json()
    const firstId = data?.novels?.[0]?.id
    if (firstId) {
      const t0 = performance.now()
      const detailRes = await fetch(`${apiBase}/api/novels/${encodeURIComponent(firstId)}`, {
        signal: AbortSignal.timeout(8000),
      })
      const t1 = performance.now()
      results.novelDetailApi = detailRes.ok
      console.info(`[verify] GET /api/novels/${firstId} ${(t1 - t0).toFixed(1)}ms ok=${detailRes.ok}`)
      if (detailRes.ok) {
        const t2 = performance.now()
        const detailRes2 = await fetch(`${apiBase}/api/novels/${encodeURIComponent(firstId)}`, {
          signal: AbortSignal.timeout(8000),
        })
        const t3 = performance.now()
        console.info(`[verify] GET /api/novels/${firstId} (repeat) ${(t3 - t2).toFixed(1)}ms ok=${detailRes2.ok}`)
      }
    }
  }
} catch (err) {
  console.error('[verify] API error:', err.message)
}

const allPass = Object.values(results).every(Boolean)
console.log(JSON.stringify({ pass: allPass, results }, null, 2))
process.exit(allPass ? 0 : 1)
