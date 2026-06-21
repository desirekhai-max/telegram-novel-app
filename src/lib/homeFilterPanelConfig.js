import { apiUrl } from './apiBase.js'
import {
  GENRE_OPTIONS,
  AUDIENCE_OPTIONS,
  LENGTH_OPTIONS,
  MAX_SELECTED_FILTER_TAGS as DEFAULT_MAX_TAGS,
  SOURCE_OPTIONS,
  STATUS_OPTIONS,
  TAG_CHIPS,
  tagChipLabel,
} from '../data/homeFilters.js'

/** @typedef {{ value: string, label: string, pill?: boolean, long?: boolean }} HomeFilterOption */

/** @typedef {{
 *   key: string,
 *   title: string,
 *   type: 'single' | 'tags',
 *   allLabel?: string,
 *   options: HomeFilterOption[],
 * }} HomeFilterPanelGroup */

/** @typedef {{
 *   version?: number,
 *   title: string,
 *   closeLabel: string,
 *   maxSelectedTags: number,
 *   groups: HomeFilterPanelGroup[],
 * }} HomeFilterPanelConfig */

const SINGLE_KEYS = new Set(['genre', 'status', 'lengthId', 'source', 'audience'])

function clampInt(n, min, max, fallback) {
  const v = Math.floor(Number(n))
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, v))
}

function safeNonEmptyStr(v, fallback) {
  const s = String(v ?? '').trim()
  return s || fallback
}

function normalizeOptions(raw, groupType) {
  if (!Array.isArray(raw)) return []
  /** @type {HomeFilterOption[]} */
  const out = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const value = String(row.value ?? '').trim()
    const label = String(row.label ?? '').trim() || value
    if (!value) continue
    const pill =
      Boolean(row.pill) ||
      (groupType === 'single' && (value === 'all' || row.style === 'pill'))
    const long = Boolean(row.long)
    out.push({ value, label, pill, long })
  }
  return out
}

function normalizeGroup(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  const key = safeNonEmptyStr(raw.key, '')
  const type = safeNonEmptyStr(raw.type, '')
  if (!key || (type !== 'single' && type !== 'tags')) return null
  if (type === 'single' && !SINGLE_KEYS.has(key)) return null
  if (type === 'tags' && key !== 'tags') return null
  const title = Object.prototype.hasOwnProperty.call(raw, 'title')
    ? String(raw.title ?? '').trim()
    : safeNonEmptyStr(raw.title, key)
  const options = normalizeOptions(raw.options, type)
  if (type === 'tags') {
    const allLabel = safeNonEmptyStr(raw.allLabel, 'ទាំងអស់')
    return {
      key,
      title,
      type,
      allLabel,
      options,
    }
  }
  if (options.length === 0) return null
  return { key, title, type, options }
}

/**
 * 校验并规范化后台返回的筛选面板 JSON。
 * 约定：`genre|status|lengthId|source|audience` 下选项的 `value` 须与小说数据字段一致（如 novel.genreId、novel.audience）；
 * `tags` 下选项的 `value` 须与 novel.tags 中存的字符串一致（可与 `label` 不同）。
 * @param {unknown} raw
 * @returns {HomeFilterPanelConfig | null}
 */
export function normalizeHomeFilterPanelConfig(raw) {
  if (!raw || typeof raw !== 'object') return null
  const title = safeNonEmptyStr(raw.title, 'ចម្រោះ')
  const closeLabel = safeNonEmptyStr(raw.closeLabel, 'បិទ')
  const maxSelectedTags = clampInt(raw.maxSelectedTags, 1, 20, DEFAULT_MAX_TAGS)
  const groupsIn = Array.isArray(raw.groups) ? raw.groups : []
  /** @type {HomeFilterPanelGroup[]} */
  const groups = []
  const seen = new Set()
  let i = 0
  for (const g of groupsIn) {
    const ng = normalizeGroup(g, i)
    i += 1
    if (!ng || seen.has(ng.key)) continue
    seen.add(ng.key)
    groups.push(ng)
  }
  if (groups.length === 0) return null
  return { title, closeLabel, maxSelectedTags, groups }
}

/** @returns {HomeFilterPanelConfig} */
export function buildDefaultHomeFilterPanelConfig() {
  return normalizeHomeFilterPanelConfig({
    version: 1,
    title: 'ចម្រោះ',
    closeLabel: 'បិទ',
    maxSelectedTags: DEFAULT_MAX_TAGS,
    groups: [
      {
        key: 'genre',
        title: 'ប្រភេទ',
        type: 'single',
        options: GENRE_OPTIONS.map((o) => ({
          value: o.id,
          label: o.label,
          pill: o.id === 'all',
        })),
      },
      {
        key: 'status',
        title: 'ស្ថានភាព',
        type: 'single',
        options: STATUS_OPTIONS.map((o) => ({
          value: o.id,
          label: o.label,
          pill: o.id === 'all',
        })),
      },
      {
        key: 'source',
        title: 'ប្រភព',
        type: 'single',
        options: SOURCE_OPTIONS.map((o) => ({
          value: o.id,
          label: o.label,
          pill: o.id === 'all',
        })),
      },
      {
        key: 'tags',
        title: 'ស្លាក',
        type: 'tags',
        allLabel: 'ទាំងអស់',
        options: TAG_CHIPS.map((t) => ({ value: t, label: tagChipLabel(t) })),
      },
      {
        key: 'lengthId',
        title: 'កម្រិត',
        type: 'single',
        options: LENGTH_OPTIONS.map((o) => ({
          value: o.id,
          label: o.label,
          pill: o.id === 'all',
          long: o.id !== 'all',
        })),
      },
      {
        key: 'audience',
        title: '',
        type: 'single',
        options: AUDIENCE_OPTIONS.map((o) => ({
          value: o.id,
          label: o.label,
          pill: o.id === 'all',
        })),
      },
    ],
  })
}

export const DEFAULT_HOME_FILTER_PANEL_CONFIG = buildDefaultHomeFilterPanelConfig()

/**
 * 按分组与 value 解析展示用文案（用于首页「已选」 chips）。
 * @param {HomeFilterPanelConfig | null | undefined} cfg
 * @param {string} criteriaKey
 * @param {string} value
 */
export function resolveHomeFilterOptionLabel(cfg, criteriaKey, value) {
  const v = String(value ?? '').trim()
  if (!v) return v
  const groups = cfg?.groups ?? DEFAULT_HOME_FILTER_PANEL_CONFIG.groups
  const g = groups.find((x) => x.key === criteriaKey)
  if (!g?.options) return v
  const hit = g.options.find((o) => o.value === v)
  return hit?.label ?? v
}

const RAW_CONFIG_URL = String(import.meta.env.VITE_HOME_FILTER_CONFIG_URL || '').trim()

/**
 * 从后台拉取筛选面板定义。顺序：
 * 1) `VITE_HOME_FILTER_CONFIG_URL`（可指向任意绝对地址）
 * 2) `apiUrl('/api/home-filter-panel-config')`（可与现有 /api 代理共用）
 * 3) 同源 `/home-filter-panel-config.json`（可将静态 JSON 放到 `public/`）
 *
 * 任一返回合法 JSON 且通过 `normalizeHomeFilterPanelConfig` 即采用；全部失败返回 `null`（前端用内置默认）。
 * @param {AbortSignal} [signal]
 * @returns {Promise<HomeFilterPanelConfig | null>}
 */
export async function fetchHomeFilterPanelConfig(signal) {
  /** @type {string[]} */
  const urls = []
  if (RAW_CONFIG_URL) urls.push(RAW_CONFIG_URL)
  urls.push(apiUrl('/api/home-filter-panel-config'))
  try {
    if (typeof window !== 'undefined') {
      urls.push(new URL('/home-filter-panel-config.json', window.location.origin).href)
    }
  } catch {
    /* ignore */
  }

  const deduped = [...new Set(urls.filter(Boolean))]
  for (const url of deduped) {
    try {
      const res = await fetch(url, { signal, credentials: 'omit' })
      if (!res.ok) continue
      const data = await res.json()
      const norm = normalizeHomeFilterPanelConfig(data)
      if (norm) return norm
    } catch {
      /* try next */
    }
  }
  return null
}
