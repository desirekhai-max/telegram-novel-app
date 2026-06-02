import { prefetchNovelFull } from './novelsRuntime.js'

export function prefetchNovelNav(id) {
  const key = String(id || '').trim()
  if (!key) return
  void prefetchNovelFull(key)
}

export function bindNovelNavPrefetchHandlers(id) {
  return {
    onMouseEnter: () => prefetchNovelNav(id),
    onFocus: () => prefetchNovelNav(id),
    onTouchStart: () => prefetchNovelNav(id),
    onClick: () => prefetchNovelNav(id),
  }
}
