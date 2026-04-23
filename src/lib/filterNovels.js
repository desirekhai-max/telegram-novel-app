/** 筛选面板与首页共用的「空条件」对象（不要用 null 在面板内传） */
export const EMPTY_HOME_FILTER_CRITERIA = {
  genre: 'all',
  status: 'all',
  lengthId: 'all',
  source: 'all',
  tags: [],
}

/** 标签写法别名（用户选「1vs1」等与站内标签统一） */
const TAG_ALIASES = {
  '1vs1': '1v1',
  '1VS1': '1v1',
}

function normalizeTag(t) {
  return TAG_ALIASES[t] ?? t
}

function novelHasTag(novelTags, tag) {
  const want = normalizeTag(tag)
  return (novelTags ?? []).some((nt) => normalizeTag(nt) === want)
}

function matchesLength(wordCountWan, lengthId) {
  if (lengthId === 'all') return true
  const w = Number(wordCountWan)
  if (!Number.isFinite(w) || w < 0) return false
  if (lengthId === 'short') return w < 10
  if (lengthId === 'medium') return w >= 10 && w < 100
  if (lengthId === 'long') return w >= 100
  return true
}

export function isDefaultHomeFilterCriteria(c) {
  if (!c) return true
  return (
    c.genre === 'all' &&
    c.status === 'all' &&
    c.lengthId === 'all' &&
    c.source === 'all' &&
    (!c.tags || c.tags.length === 0)
  )
}

export function novelMatchesHomeCriteria(novel, c) {
  if (!c || isDefaultHomeFilterCriteria(c)) return true
  if (c.genre !== 'all' && novel.genreId !== c.genre) return false
  if (c.status !== 'all' && novel.status !== c.status) return false
  if (c.source !== 'all' && novel.source !== c.source) return false
  if (!matchesLength(novel.wordCountWan, c.lengthId)) return false
  const tags = c.tags ?? []
  if (tags.length > 0) {
    const novelTags = novel.tags ?? []
    for (const t of tags) {
      if (!novelHasTag(novelTags, t)) return false
    }
  }
  return true
}

export function filterNovelsByHomeCriteria(novels, c) {
  if (!c || isDefaultHomeFilterCriteria(c)) return novels
  return novels.filter((n) => novelMatchesHomeCriteria(n, c))
}
