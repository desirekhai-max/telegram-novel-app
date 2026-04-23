import { GENRE_OPTIONS, MAX_SELECTED_FILTER_TAGS } from '../data/homeFilters.js'
import { EMPTY_HOME_FILTER_CRITERIA, isDefaultHomeFilterCriteria } from './filterNovels.js'

function normalizeTag(t) {
  return String(t).trim()
}

/** 将卡片上点选的「题材」文案落到 genre 或 tags（与筛选面板语义一致） */
export function applyThemeLabelToCriteria(themeLabel, criteria) {
  const label = normalizeTag(themeLabel)
  if (!label) return criteria ?? EMPTY_HOME_FILTER_CRITERIA
  const c = { ...(criteria ?? EMPTY_HOME_FILTER_CRITERIA) }
  const genreOpt = GENRE_OPTIONS.find((o) => o.id !== 'all' && o.label === label)
  if (genreOpt) {
    c.genre = genreOpt.id
    return c
  }
  const tags = [...(c.tags ?? [])]
  if (!tags.includes(label)) tags.push(label)
  c.tags =
    tags.length > MAX_SELECTED_FILTER_TAGS ? tags.slice(-MAX_SELECTED_FILTER_TAGS) : tags
  return c
}

export function mergeSourceOriginal(criteria) {
  const c = { ...(criteria ?? EMPTY_HOME_FILTER_CRITERIA), source: 'original' }
  return c
}

export function mergeAppendTag(criteria, tag) {
  const t = normalizeTag(tag)
  if (!t) return criteria ?? EMPTY_HOME_FILTER_CRITERIA
  const c = { ...(criteria ?? EMPTY_HOME_FILTER_CRITERIA) }
  const tags = [...(c.tags ?? [])]
  if (!tags.includes(t)) tags.push(t)
  c.tags =
    tags.length > MAX_SELECTED_FILTER_TAGS ? tags.slice(-MAX_SELECTED_FILTER_TAGS) : tags
  return c
}

export function criteriaToAppliedState(c) {
  return isDefaultHomeFilterCriteria(c) ? null : c
}
