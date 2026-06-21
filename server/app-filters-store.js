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
    { id: 'all', label: 'ទាំងអស់', enabled: true, sort: 0, pill: true },
    { id: 'urban', label: 'ទីក្រុង', enabled: true, sort: 10 },
    { id: 'rural', label: 'ជនបទ', enabled: true, sort: 20 },
    { id: 'campus', label: 'សាលារៀន', enabled: true, sort: 30 },
    { id: 'taboo', label: 'គ្រួសារ', enabled: true, sort: 40 },
    { id: 'transmigration', label: 'ឆ្លងភព', enabled: true, sort: 50 },
    { id: 'history', label: 'ប្រវត្តិសាស្ត្រ', enabled: true, sort: 60 },
    { id: 'celebrity', label: 'តារា', enabled: true, sort: 70 },
    { id: 'samegender', label: 'ភេទដូចគ្នា', enabled: true, sort: 80 },
  ]
}

function defaultStatus() {
  return [
    { id: 'all', label: 'ទាំងអស់', enabled: true, sort: 0, pill: true },
    { id: 'ongoing', label: 'កំពុងចេញ', enabled: true, sort: 10 },
    { id: 'completed', label: 'ចប់ហើយ', enabled: true, sort: 20 },
  ]
}

function defaultWordRanges() {
  return [
    { id: 'all', label: 'ទាំងអស់', enabled: true, sort: 0, pill: true },
    { id: 'w_lt_5', label: 'ក្រោម5ម៉ឺនពាក្យ', enabled: true, sort: 10, long: true },
    { id: 'w_5_10', label: '5ម៉ឺន-10ម៉ឺនពាក្យ', enabled: true, sort: 20, long: true },
    { id: 'w_gte_10', label: '10ម៉ឺនពាក្យឡើង', enabled: true, sort: 30, long: true },
  ]
}

function defaultTags() {
  const names = [
    '1v1', 'BL', 'GL', 'កំប្លែង', 'សងសឹក', 'គ្មានរោម', 'ប្រែកាយ', 'រ៉ូមែនទិក', 'ឧបករណ៍សិច',
    'ចេញទឹកដោះ', 'ស្ត្រីល្មភតណ្ហា', 'ស្រ្តីមេមេម៉ាយ', 'ជំនួយដោយ AI', 'មានប្តីហើយ', 'លួចលាក់មានថ្មី',
    'ស្នេហាស្មោះស្ម័គ្រ', 'បង្វឹកផ្លូវភេទ', 'ពាក្យអាសអាភាស', 'ឪពុកនិងកូនស្រី', 'រួមភេទតាមរន្ធគូទ',
    'បងប្អូនបង្កើត', 'រឿងនយោបាយ', 'ដូរដៃគូរួមភេទ', 'ចងចំណង', 'ម្តាយក្បត់ចិត្ត', 'ម្តាយនិងកូនប្រុស',
    'ស្រីចាប់បង្ខំប្រុស', 'បំបែកព្រហ្មចារី', 'ចាប់រំលោភ', 'វាយបូក', 'ប្រពន្ធគេ', 'រួមភេទជាមួយសត្វ',
    'ស្រោមបារ', 'ផ្អែមល្ហែម', 'គ្មានការក្បត់ចិត្ត', 'ទាសករផ្លូវភេទ', 'ប្រើថ្នាំសម្រើប', 'ស្រីស្អាតប្រចាំសាលា',
    'ជនជាតិបរទេស', 'ពូជសាសន៍ចម្លែក', 'មើលសង្សារ/ប្រពន្ធផ្ទាល់ភ្នែក', 'ឪពុកក្មេកនិងកូនប្រសារស្រី',
    'ចូលចិត្តប្រពន្ធដេកជាមួយគេផ្សេង', 'ស្រ្តីវ័យកណ្តាលតណ្ហាក្រាស់', 'ក្មេងប្រុសរួមភេទជាមួយស្រីចាស់',
    'សំលៀកបំពាក់ឯកសណ្ឋាន', 'ប្រពន្ធក្បត់ចិត្តល្មភតណ្ហា', 'លួចរួមភេទពេលដេកលក់/មិនដឹងខ្លួន',
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
    { id: 'update', label: 'កំណែថ្មី', enabled: true, sort: 0 },
    { id: 'views', label: 'អ្នកអាន', enabled: true, sort: 10 },
    { id: 'rating', label: 'ពិន្ទុ', enabled: true, sort: 20 },
    { id: 'publish', label: 'បោះផ្សាយថ្មី', enabled: true, sort: 30 },
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

export function saveAppFilterSection(key, body) {
  return saveSection(key, body)
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
        allLabel: 'ទាំងអស់',
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
