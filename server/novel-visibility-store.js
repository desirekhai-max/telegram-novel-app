import fs from 'node:fs'
import path from 'node:path'
import { PERSISTENT_DATA_DIR } from './persistent-data-dir.js'

const DATA_FILE = path.join(PERSISTENT_DATA_DIR, 'novel-visibility.json')
export const DEFAULT_VISIBILITY = 'published'
export const VISIBILITY_VALUES = ['draft', 'published', 'hidden']

/** @type {Map<string, string>} */
let byId = new Map()
let loaded = false

export function normalizeVisibility(raw) {
  const value = String(raw || '').trim().toLowerCase()
  if (VISIBILITY_VALUES.includes(value)) return value
  return DEFAULT_VISIBILITY
}

function persistVisibilityMap() {
  const payload = {
    version: 1,
    byId: Object.fromEntries(byId.entries()),
  }
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

export function initNovelVisibilityStore() {
  if (loaded) return
  loaded = true

  if (!fs.existsSync(DATA_FILE)) {
    byId = new Map()
    return
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    const entries = parsed?.byId && typeof parsed.byId === 'object' ? parsed.byId : {}
    byId = new Map(
      Object.entries(entries).map(([id, visibility]) => [String(id).trim(), normalizeVisibility(visibility)]),
    )
    console.log(`[novel-visibility] loaded ${byId.size} override(s) from ${DATA_FILE}`)
  } catch (err) {
    console.warn('[novel-visibility] load failed, using defaults:', err?.message || err)
    byId = new Map()
  }
}

export function getNovelVisibilityDataFilePath() {
  return DATA_FILE
}

export function getNovelVisibility(id) {
  const key = String(id || '').trim()
  if (!key) return DEFAULT_VISIBILITY
  return byId.get(key) || DEFAULT_VISIBILITY
}

export function setNovelVisibility(id, visibility) {
  const key = String(id || '').trim()
  if (!key) throw new Error('novel id required')

  const next = normalizeVisibility(visibility)
  if (next === DEFAULT_VISIBILITY) {
    byId.delete(key)
  } else {
    byId.set(key, next)
  }
  persistVisibilityMap()
  return next
}

export function attachVisibilityToNovel(novel) {
  if (!novel || typeof novel !== 'object') return novel
  return {
    ...novel,
    visibility: getNovelVisibility(novel.id),
  }
}

export function attachVisibilityToList(items = []) {
  return items.map((item) => attachVisibilityToNovel(item))
}

export function filterPublishedNovels(items = []) {
  return items.filter((item) => getNovelVisibility(item?.id) === 'published')
}

export function matchesVisibilityFilter(item, visibilityFilter) {
  const filter = String(visibilityFilter || '').trim().toLowerCase()
  if (!filter) return true
  return getNovelVisibility(item?.id) === normalizeVisibility(filter)
}
