import fs from 'node:fs'
import path from 'node:path'
import { PERSISTENT_DATA_DIR } from './persistent-data-dir.js'

function getPersistentDataRoot() {
  return PERSISTENT_DATA_DIR
}

const FILES = {
  genres: 'filter-genres.json',
  tags: 'filter-tags.json',
  status: 'filter-status.json',
  wordRanges: 'filter-word-ranges.json',
  sort: 'filter-sort.json',
}

const DEFAULTS = {
  genres: [
    { id: 'all', label: '全部', enabled: true, sort: 0, pill: true },
    { id: 'urban', label: '都市', enabled: true, sort: 10 },
    { id: 'campus', label: '校园', enabled: true, sort: 20 },
    { id: 'xuanhuan', label: '玄幻', enabled: true, sort: 30 },
    { id: 'wuxia', label: '武侠', enabled: true, sort: 40 },
    { id: 'scifi', label: '科幻', enabled: true, sort: 50 },
  ],
  tags: [
    { id: '爽文', label: '爽文', enabled: true, sort: 0 },
    { id: '甜宠', label: '甜宠', enabled: true, sort: 10 },
    { id: '校园', label: '校园', enabled: true, sort: 20 },
    { id: '科幻', label: '科幻', enabled: true, sort: 30 },
  ],
  status: [
    { id: 'all', label: '全部', enabled: true, sort: 0, pill: true },
    { id: 'ongoing', label: '连载中', enabled: true, sort: 10 },
    { id: 'completed', label: '已完结', enabled: true, sort: 20 },
  ],
  wordRanges: [
    { id: 'all', label: '全部', enabled: true, sort: 0, pill: true, long: true },
    { id: 'w_lt_10', label: '10万以下', enabled: true, sort: 10, long: true },
    { id: 'w_10_30', label: '10-30万', enabled: true, sort: 20, long: true },
    { id: 'w_30_50', label: '30-50万', enabled: true, sort: 30, long: true },
    { id: 'w_50_100', label: '50-100万', enabled: true, sort: 40, long: true },
    { id: 'w_gt_100', label: '100万以上', enabled: true, sort: 50, long: true },
  ],
  sort: [
    { id: 'update', label: '最新更新', enabled: true, sort: 0 },
    { id: 'views', label: '最多阅读', enabled: true, sort: 10 },
    { id: 'rating', label: '最高评分', enabled: true, sort: 20 },
    { id: 'publish', label: '最新发布', enabled: true, sort: 30 },
  ],
}

function filePath(section) {
  return path.join(getPersistentDataRoot(), FILES[section])
}

function normalize(items, fallback) {
  const source = Array.isArray(items) ? items : fallback
  const out = []
  const seen = new Set()
  source.forEach((row, i) => {
    const id = String(row?.id ?? row?.value ?? '').trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    out.push({
      id,
      label: String(row?.label ?? id).trim() || id,
      enabled: row?.enabled !== false && row?.enabled !== 0 && row?.enabled !== 'false',
      sort: Number.isFinite(Number(row?.sort)) ? Number(row.sort) : i * 10,
      pill: Boolean(row?.pill || id === 'all'),
      long: Boolean(row?.long),
    })
  })
  return out.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
}

function readSection(section) {
  const file = filePath(section)
  if (!fs.existsSync(file)) return normalize([], DEFAULTS[section])
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return normalize(parsed?.items ?? parsed, DEFAULTS[section])
  } catch {
    return normalize([], DEFAULTS[section])
  }
}

function writeSection(section, items) {
  const file = filePath(section)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const payload = { version: 1, updatedAtMs: Date.now(), items: normalize(items, DEFAULTS[section]) }
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return payload
}

export function initAppFiltersStore() {
  fs.mkdirSync(getPersistentDataRoot(), { recursive: true })
  for (const section of Object.keys(FILES)) {
    const file = filePath(section)
    if (!fs.existsSync(file)) writeSection(section, DEFAULTS[section])
  }
}

export function getAdminAppFiltersPayload() {
  const payload = { ok: true }
  for (const section of Object.keys(FILES)) {
    payload[section] = { version: 1, items: readSection(section) }
  }
  return payload
}

export function saveAppFilterSection(section, items) {
  if (!FILES[section]) throw new Error('unknown section')
  const saved = writeSection(section, items)
  return { ok: true, section, ...saved }
}

export function buildPublicAppFilters() {
  const admin = getAdminAppFiltersPayload()
  const enabled = (arr) => (arr || []).filter((it) => it.enabled !== false).sort((a, b) => a.sort - b.sort)
  const toOptions = (arr) =>
    enabled(arr).map((it) => ({ value: it.id, label: it.label, pill: Boolean(it.pill), long: Boolean(it.long) }))

  return {
    ok: true,
    genres: enabled(admin.genres.items),
    tags: enabled(admin.tags.items),
    status: enabled(admin.status.items),
    wordRanges: enabled(admin.wordRanges.items),
    sort: enabled(admin.sort.items),
    panel: {
      title: '筛选',
      closeLabel: '关闭',
      maxSelectedTags: 3,
      groups: [
        { key: 'genre', title: '题材', type: 'single', options: toOptions(admin.genres.items) },
        { key: 'status', title: '状态', type: 'single', options: toOptions(admin.status.items) },
        { key: 'tags', title: '标签', type: 'tags', allLabel: '全部', options: toOptions(admin.tags.items) },
        { key: 'lengthId', title: '字数', type: 'single', options: toOptions(admin.wordRanges.items) },
      ],
    },
  }
}
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PERSISTENT_DATA_DIR } from './persistent-data-dir.js'

function getAppFilterFile(filename) {
  return path.join(PERSISTENT_DATA_DIR, filename)
}

function getPersistentDataRoot() {
  return PERSISTENT_DATA_DIR
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LEGACY_PANEL_CONFIG = path.join(__dirname, 'home-filter-panel-config.json')

export const FILTER_FILES = {
  genres: 'filter-genres.json',
  tags: 'filter-tags.json',
  status: 'filter-status.json',
  wordRanges: 'filter-word-ranges.json',
  sort: 'filter-sort.json',
}

const DEFAULT_PANEL = {
  title: 'ចម្រោះ',
  closeLabel: 'បិទ',
  maxSelectedTags: 3,
}

function defaultGenres() {
  return [
    { id: 'all', label: '全部', enabled: true, sort: 0, pill: true },
    { id: 'urban', label: '都市', enabled: true, sort: 10 },
    { id: 'campus', label: '校园', enabled: true, sort: 20 },
    { id: 'taboo', label: '乱伦', enabled: true, sort: 30 },
    { id: 'xuanhuan', label: '玄幻', enabled: true, sort: 40 },
    { id: 'system', label: '系统', enabled: true, sort: 50 },
    { id: 'transmigration', label: '穿越', enabled: true, sort: 60 },
    { id: 'wuxia', label: '武侠', enabled: true, sort: 70 },
    { id: 'fantasy', label: '奇幻', enabled: true, sort: 80 },
    { id: 'rural', label: '乡村', enabled: true, sort: 90 },
    { id: 'history', label: '历史', enabled: true, sort: 100 },
    { id: 'celebrity', label: '明星', enabled: true, sort: 110 },
    { id: 'superpower', label: '异能', enabled: true, sort: 120 },
    { id: 'scifi', label: '科幻', enabled: true, sort: 130 },
    { id: 'fanfic', label: '同人', enabled: true, sort: 140 },
  ]
}

function defaultStatus() {
  return [
    { id: 'all', label: '全部', enabled: true, sort: 0, pill: true },
    { id: 'ongoing', label: '连载中', enabled: true, sort: 10 },
    { id: 'completed', label: '已完结', enabled: true, sort: 20 },
  ]
}

function defaultWordRanges() {
  return [
    { id: 'all', label: '全部', enabled: true, sort: 0, pill: true },
    { id: 'w_lt_10', label: '10万以下', enabled: true, sort: 10, long: true },
    { id: 'w_10_30', label: '10-30万', enabled: true, sort: 20, long: true },
    { id: 'w_30_50', label: '30-50万', enabled: true, sort: 30, long: true },
    { id: 'w_50_100', label: '50-100万', enabled: true, sort: 40, long: true },
    { id: 'w_gt_100', label: '100万以上', enabled: true, sort: 50, long: true },
  ]
}

function defaultTags() {
  const names = [
    '1v1', '1vs1', 'AI辅助', 'BE', 'HE', 'NTR', 'SM', '人外', '先婚后爱', '克系', '公路文', '剧情',
    '单元剧', '双向暗恋', '双洁', '古穿今', '古言', '同居', '后宫', '团宠', '娱乐圈', '复仇', '大女主',
    '天作之合', '失忆', '奇幻', '异能', '年上', '年下', '强强', '快穿', '悬疑', '情有独钟', '成长',
    '战争', '无限流', '日常', '星际', '末世', '校园', '欢喜冤家', '治愈', '流俗地', '灵异', '爽文',
    '甜宠', '甜文', '生子', '电竞', '破镜重圆', '科幻', '穿越', '系统', '纯爱', '综漫', '美强惨',
    '职场', '肉香', '虐恋', '西幻', '谍战', '赛博朋克', '轻松', '边限', '追妻火葬场', '都市', '重生',
    '金手指', '银发', '青梅竹马', '异世界', '豪门', '黑暗向',
  ]
  return names.map((label, i) => ({
    id: label,
    label,
    enabled: true,
    sort: i * 10,
  }))
}

function defaultSort() {
  return [
    { id: 'update', label: '最新更新', enabled: true, sort: 0 },
    { id: 'views', label: '最多阅读', enabled: true, sort: 10 },
    { id: 'rating', label: '最高评分', enabled: true, sort: 20 },
    { id: 'publish', label: '最新发布', enabled: true, sort: 30 },
  ]
}

const DEFAULTS = {
  genres: defaultGenres,
  tags: defaultTags,
  status: defaultStatus,
  wordRanges: defaultWordRanges,
  sort: defaultSort,
}

function normalizeItem(raw, index = 0) {
  const id = String(raw?.id ?? raw?.value ?? '').trim()
  const label = String(raw?.label ?? id).trim() || id
  if (!id) return null
  return {
    id,
    label: label.slice(0, 120),
    enabled: raw?.enabled !== false && raw?.enabled !== 0 && raw?.enabled !== 'false',
    sort: Number.isFinite(Number(raw?.sort)) ? Number(raw.sort) : index * 10,
    pill: raw?.pill === true || raw?.pill === 'true' || id === 'all',
    long: raw?.long === true || raw?.long === 'true',
  }
}

function normalizeSectionPayload(raw, fallbackItems) {
  const itemsIn = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw)
      ? raw
      : fallbackItems()
  const items = []
  const seen = new Set()
  itemsIn.forEach((row, i) => {
    const item = normalizeItem(row, i)
    if (!item || seen.has(item.id)) return
    seen.add(item.id)
    items.push(item)
  })
  items.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
  return {
    version: 1,
    updatedAtMs: Number(raw?.updatedAtMs || 0) || Date.now(),
    items,
  }
}

function readSectionFile(key) {
  const file = getAppFilterFile(FILTER_FILES[key])
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeSectionFile(key, payload) {
  const file = getAppFilterFile(FILTER_FILES[key])
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const body = {
    ...payload,
    version: 1,
    updatedAtMs: Date.now(),
  }
  fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`, 'utf8')
  return body
}

export function loadSection(key) {
  const raw = readSectionFile(key)
  const fallback = DEFAULTS[key]
  if (!fallback) throw new Error(`unknown filter section: ${key}`)
  return normalizeSectionPayload(raw || {}, fallback)
}

export function saveSection(key, body) {
  const fallback = DEFAULTS[key]
  if (!fallback) throw new Error(`unknown filter section: ${key}`)
  const normalized = normalizeSectionPayload(body, fallback)
  return writeSectionFile(key, normalized)
}

export function listEnabledItems(section) {
  return section.items
    .filter((it) => it.enabled)
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
}

function toPanelOptions(items) {
  return items.map((it) => ({
    value: it.id,
    label: it.label,
    pill: Boolean(it.pill),
    long: Boolean(it.long),
  }))
}

export function buildPublicAppFilters() {
  const genres = loadSection('genres')
  const tags = loadSection('tags')
  const status = loadSection('status')
  const wordRanges = loadSection('wordRanges')
  const sort = loadSection('sort')

  const genreItems = listEnabledItems(genres)
  const tagItems = listEnabledItems(tags)
  const statusItems = listEnabledItems(status)
  const wordItems = listEnabledItems(wordRanges)
  const sortItems = listEnabledItems(sort)

  const panel = {
    version: 1,
    title: DEFAULT_PANEL.title,
    closeLabel: DEFAULT_PANEL.closeLabel,
    maxSelectedTags: DEFAULT_PANEL.maxSelectedTags,
    groups: [
      {
        key: 'genre',
        title: 'ប្រភេទ',
        type: 'single',
        options: toPanelOptions(genreItems),
      },
      {
        key: 'status',
        title: 'ស្ថានភាព',
        type: 'single',
        options: toPanelOptions(statusItems),
      },
      {
        key: 'tags',
        title: 'ស្លាក',
        type: 'tags',
        allLabel: 'ស្លាកទាំងអស់',
        options: toPanelOptions(tagItems),
      },
      {
        key: 'lengthId',
        title: 'កម្រិត',
        type: 'single',
        options: toPanelOptions(wordItems),
      },
    ],
  }

  return {
    ok: true,
    version: 1,
    ...DEFAULT_PANEL,
    genres: genreItems,
    tags: tagItems,
    status: statusItems,
    wordRanges: wordItems,
    sort: sortItems,
    panel,
  }
}

export function getAdminAppFiltersPayload() {
  return {
    ok: true,
    files: FILTER_FILES,
    dataRoot: getPersistentDataRoot(),
    genres: loadSection('genres'),
    tags: loadSection('tags'),
    status: loadSection('status'),
    wordRanges: loadSection('wordRanges'),
    sort: loadSection('sort'),
  }
}

function migrateLegacyPanelConfig() {
  if (!fs.existsSync(LEGACY_PANEL_CONFIG)) return
  try {
    const parsed = JSON.parse(fs.readFileSync(LEGACY_PANEL_CONFIG, 'utf8'))
    const groups = Array.isArray(parsed?.groups) ? parsed.groups : []
    const mapKey = {
      genre: 'genres',
      status: 'status',
      tags: 'tags',
      lengthId: 'wordRanges',
    }
    for (const g of groups) {
      const key = mapKey[g?.key]
      if (!key) continue
      const file = getAppFilterFile(FILTER_FILES[key])
      if (fs.existsSync(file)) continue
      const items = (Array.isArray(g?.options) ? g.options : []).map((o, i) =>
        normalizeItem(
          {
            id: o.value,
            label: o.label,
            pill: o.pill,
            long: o.long,
            enabled: true,
            sort: i * 10,
          },
          i,
        ),
      ).filter(Boolean)
      if (items.length) writeSectionFile(key, { items })
    }
    console.log('[app-filters] migrated legacy home-filter-panel-config.json')
  } catch (err) {
    console.warn('[app-filters] legacy migrate failed', err?.message || err)
  }
}

export function initAppFiltersStore() {
  fs.mkdirSync(getPersistentDataRoot(), { recursive: true })
  migrateLegacyPanelConfig()
  for (const key of Object.keys(FILTER_FILES)) {
    const file = getAppFilterFile(FILTER_FILES[key])
    if (!fs.existsSync(file)) {
      const fallback = DEFAULTS[key]
      writeSectionFile(key, { items: fallback() })
    }
  }
}
