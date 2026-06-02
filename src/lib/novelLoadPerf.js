const PERF_PREFIX = '[novel-perf]'

export function logApiRequestDuration(novelId, durationMs, source = 'network') {
  console.info(`${PERF_PREFIX} API /api/novels/${novelId} ${durationMs.toFixed(1)}ms (${source})`)
}

export function logPageFirstRender(page, durationMs) {
  console.info(`${PERF_PREFIX} ${page} first render ${durationMs.toFixed(1)}ms`)
}

export function logDetailPageReady(durationMs, novelId) {
  console.info(`${PERF_PREFIX} Detail ready ${durationMs.toFixed(1)}ms novel=${novelId}`)
}

export function logReaderPageReady(durationMs, novelId, chapterIndex) {
  console.info(
    `${PERF_PREFIX} Reader ready ${durationMs.toFixed(1)}ms novel=${novelId} chapter=${chapterIndex}`,
  )
}
