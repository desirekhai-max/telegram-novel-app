import {
  AUDIENCE_OPTIONS,
  GENRE_OPTIONS,
  LENGTH_OPTIONS,
  SOURCE_OPTIONS,
  STATUS_OPTIONS,
} from '../data/homeFilters.js'
import { isDefaultHomeFilterCriteria } from './filterNovels.js'
import { resolveHomeFilterOptionLabel } from './homeFilterPanelConfig.js'

function labelById(options, id) {
  return options.find((o) => o.id === id)?.label ?? id
}

/** 用于首页「已选」旁可移除标签（顺序与后台下发的筛选分组顺序一致） */
export function getAppliedFilterChips(criteria, panelConfig) {
  if (!criteria || isDefaultHomeFilterCriteria(criteria)) return []
  const chips = []
  const groups = panelConfig?.groups
  if (groups && groups.length > 0) {
    for (const g of groups) {
      if (g.type === 'single') {
        const key = g.key
        const val = criteria[key]
        if (val !== undefined && val !== 'all') {
          chips.push({
            removeKey: key,
            label: resolveHomeFilterOptionLabel(panelConfig, key, String(val)),
          })
        }
      } else if (g.type === 'tags') {
        for (const t of criteria.tags ?? []) {
          chips.push({
            removeKey: `tag:${encodeURIComponent(t)}`,
            label: resolveHomeFilterOptionLabel(panelConfig, 'tags', String(t)),
          })
        }
      }
    }
    return chips
  }
  if (criteria.genre !== 'all') {
    chips.push({
      removeKey: 'genre',
      label: labelById(GENRE_OPTIONS, criteria.genre),
    })
  }
  if (criteria.status !== 'all') {
    chips.push({
      removeKey: 'status',
      label: labelById(STATUS_OPTIONS, criteria.status),
    })
  }
  if (criteria.source !== 'all') {
    chips.push({
      removeKey: 'source',
      label: labelById(SOURCE_OPTIONS, criteria.source),
    })
  }
  for (const t of criteria.tags ?? []) {
    chips.push({
      removeKey: `tag:${encodeURIComponent(t)}`,
      label: t,
    })
  }
  if (criteria.lengthId !== 'all') {
    chips.push({
      removeKey: 'lengthId',
      label: labelById(LENGTH_OPTIONS, criteria.lengthId),
    })
  }
  if (criteria.audience !== 'all') {
    chips.push({
      removeKey: 'audience',
      label: labelById(AUDIENCE_OPTIONS, criteria.audience),
    })
  }
  return chips
}

export function removeCriterionFromCriteria(criteria, removeKey) {
  if (!criteria) return null
  const next = {
    genre: criteria.genre,
    status: criteria.status,
    lengthId: criteria.lengthId,
    source: criteria.source,
    audience: criteria.audience ?? 'all',
    tags: [...(criteria.tags ?? [])],
  }
  if (removeKey === 'genre') next.genre = 'all'
  else if (removeKey === 'status') next.status = 'all'
  else if (removeKey === 'lengthId') next.lengthId = 'all'
  else if (removeKey === 'source') next.source = 'all'
  else if (removeKey === 'audience') next.audience = 'all'
  else if (removeKey.startsWith('tag:')) {
    const raw = decodeURIComponent(removeKey.slice(4))
    next.tags = next.tags.filter((x) => x !== raw)
  }
  return isDefaultHomeFilterCriteria(next) ? null : next
}
