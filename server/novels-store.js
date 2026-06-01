import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PERSISTENT_DATA_DIR } from './persistent-data-dir.js'

const DATA_FILE = path.join(PERSISTENT_DATA_DIR, 'novels-data.json')

export function getNovelsDataFilePath() {
  return DATA_FILE
}
const BUNDLED_NOVELS_PATH = path.join(__dirname, '..', 'src', 'data', 'novels.js')
const SYNOPSIS_PREVIEW_MAX = 320

/** @type {Map<string, object>} */
let novelsById = new Map()
let loaded = false

function now() {
  return Date.now()
}

function newId(prefix = 'n') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`
}

function normalizeTags(raw) {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean).slice(0, 32)
  const text = String(raw || '').trim()
  if (!text) return []
  return text
    .split(/[,，、]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 32)
}

function normalizeBody(raw) {
  if (Array.isArray(raw)) return raw.map((p) => String(p ?? '').trim()).filter(Boolean)
  const text = String(raw ?? '').trim()
  if (!text) return []
  return text.split(/\n+/).map((p) => p.trim()).filter(Boolean)
}

function countChapterWords(body) {
  const paragraphs = normalizeBody(body)
  return paragraphs.join('').length
}

function normalizeChapter(raw = {}, index = 0) {
  const body = normalizeBody(raw.body ?? raw.content)
  const atMs = Number(raw.updatedAtMs || raw.atMs || 0) || now()
  return {
    id: String(raw.id || `ch_${index + 1}`).trim() || `ch_${index + 1}`,
    title: String(raw.title || '').trim().slice(0, 240) || `第${index + 1}章`,
    body,
    isVip: raw.isVip === true || raw.isVip === 'true' || raw.isVip === 1,
    wordCount: countChapterWords(body),
    updatedAtMs: atMs,
  }
}

function normalizeStatus(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'completed' || s === '完结' || s === 'finished') return 'completed'
  return 'ongoing'
}

function normalizeSource(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'member' || s === '会员创' || s === 'member-created') return 'member'
  return 'original'
}

function computeNovelWordCountWan(chapters) {
  const total = (chapters || []).reduce((sum, ch) => sum + Number(ch.wordCount || 0), 0)
  return Math.round((total / 10000) * 100) / 100
}

/** 与首页筛选 `genreId` 对齐；非此类 id 时后台常把「题材」文案写入 genreId */
const FILTER_GENRE_IDS = new Set([
  'urban',
  'campus',
  'taboo',
  'xuanhuan',
  'system',
  'transmigration',
  'wuxia',
  'fantasy',
  'rural',
  'history',
  'celebrity',
  'superpower',
  'scifi',
  'fanfic',
])

function normalizeListThemes(raw = {}) {
  if (Array.isArray(raw.listThemes)) {
    return raw.listThemes.map((t) => String(t).trim()).filter(Boolean).slice(0, 16)
  }
  if (Array.isArray(raw.themes)) {
    return raw.themes.map((t) => String(t).trim()).filter(Boolean).slice(0, 16)
  }
  const themeText = raw.theme ?? raw.subject ?? raw['题材']
  if (themeText != null && String(themeText).trim()) {
    return normalizeTags(themeText)
  }
  return []
}

function deriveListThemesFromGenreId(genreId, listThemes) {
  if (listThemes.length) return listThemes
  const gid = String(genreId || '').trim()
  if (!gid || FILTER_GENRE_IDS.has(gid.toLowerCase())) return []
  return [gid]
}

function normalizeNovel(raw = {}, { preserveId } = {}) {
  const id = String(preserveId || raw.id || '').trim() || newId('novel')
  const createdAtMs = Number(raw.createdAtMs || 0) || now()
  const chaptersIn = Array.isArray(raw.chapters) ? raw.chapters : []
  const chapters = chaptersIn.map((ch, i) => normalizeChapter(ch, i))
  const updatedAtMs = Number(raw.updatedAtMs || 0) || chapters.reduce((m, ch) => Math.max(m, ch.updatedAtMs), createdAtMs)
  const genreId = String(raw.genreId || raw.genre || '').trim().slice(0, 80)
  const listThemes = deriveListThemesFromGenreId(genreId, normalizeListThemes(raw))

  return {
    id,
    title: String(raw.title || '').trim().slice(0, 240),
    author: String(raw.author || '').trim().slice(0, 120),
    synopsis: String(raw.synopsis || raw.description || '').trim().slice(0, 20000),
    coverUrl: String(raw.coverUrl || raw.cover || '').trim().slice(0, 500),
    genreId,
    listThemes,
    tags: normalizeTags(raw.tags),
    status: normalizeStatus(raw.status),
    source: normalizeSource(raw.source || raw.novelType),
    accent: String(raw.accent || 'violet').trim().slice(0, 40),
    audience: String(raw.audience || 'male').trim().slice(0, 20),
    authorTelegramIds: Array.isArray(raw.authorTelegramIds)
      ? raw.authorTelegramIds.map((x) => String(x).trim()).filter(Boolean)
      : [],
    createdAtMs,
    updatedAtMs,
    shelvedAtMs: Number(raw.shelvedAtMs || 0) || createdAtMs,
    wordCountWan: computeNovelWordCountWan(chapters),
    chapters,
  }
}

function stripNovelForCatalog(novel) {
  const synopsis = String(novel.synopsis || '')
  const preview =
    synopsis.length > SYNOPSIS_PREVIEW_MAX
      ? `${synopsis.slice(0, SYNOPSIS_PREVIEW_MAX - 1)}…`
      : synopsis
  const ch = Array.isArray(novel.chapters) ? novel.chapters : []
  const lastChapter = ch[ch.length - 1]
  const lastMs = Number(lastChapter?.updatedAtMs || novel.updatedAtMs || 0)
  const minutesAgo =
    lastMs > 0 ? Math.max(0, Math.round((now() - lastMs) / 60000)) : undefined

  return {
    id: novel.id,
    title: novel.title,
    author: novel.author,
    synopsisPreview: preview,
    accent: novel.accent,
    genreId: novel.genreId,
    listThemes: Array.isArray(novel.listThemes) ? novel.listThemes : [],
    status: novel.status,
    source: novel.source,
    wordCountWan: novel.wordCountWan,
    tags: novel.tags,
    coverUrl: novel.coverUrl,
    updatedAtMs: novel.updatedAtMs,
    shelvedAtMs: novel.shelvedAtMs,
    chapterCount: ch.length,
    lastChapterMinutesAgo: minutesAgo,
    latestChapterTitle: lastChapter?.title || '',
    createdAtMs: novel.createdAtMs,
  }
}

function persist() {
  const payload = {
    version: 1,
    novels: [...novelsById.values()],
  }
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function seedFromBundledIfEmpty() {
  if (novelsById.size > 0) return
  try {
    if (!fs.existsSync(BUNDLED_NOVELS_PATH)) return
    const mod = await import(pathToFileURL(BUNDLED_NOVELS_PATH).href)
    const list = Array.isArray(mod.novels) ? mod.novels : []
    list.forEach((raw) => {
      const novel = normalizeNovel(raw)
      if (!novel.title) return
      novelsById.set(novel.id, novel)
    })
    if (novelsById.size > 0) persist()
  } catch (err) {
    console.warn('[novels-store] seed failed', err?.message || err)
  }
}

export function getNovelsCount() {
  return novelsById.size
}

export async function initNovelsStore() {
  if (loaded) return
  loaded = true

  const fileExists = fs.existsSync(DATA_FILE)
  if (fileExists) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
      const list = Array.isArray(parsed?.novels) ? parsed.novels : []
      list.forEach((raw) => {
        const novel = normalizeNovel(raw, { preserveId: raw.id })
        if (novel.id && novel.title) novelsById.set(novel.id, novel)
      })
      console.log(
        `[novels-store] loaded ${novelsById.size} novel(s) from ${DATA_FILE} (dir=${PERSISTENT_DATA_DIR})`,
      )
      return
    } catch (err) {
      console.error(
        '[novels-store] load failed — file kept on disk, will NOT re-seed or auto-delete:',
        err?.message || err,
      )
      return
    }
  }

  await seedFromBundledIfEmpty()
  if (novelsById.size > 0) {
    console.log(`[novels-store] seeded ${novelsById.size} novel(s) into ${DATA_FILE}`)
  }
}

export function getNovelsCatalogPayload() {
  return {
    version: 1,
    novels: [...novelsById.values()].map(stripNovelForCatalog),
  }
}

export function getNovelById(id) {
  const key = String(id || '').trim()
  if (!key) return null
  const novel = novelsById.get(key)
  return novel ? JSON.parse(JSON.stringify(novel)) : null
}

function matchTextFilter(value, keyword) {
  const key = String(keyword || '').trim().toLowerCase()
  if (!key) return true
  return String(value || '').toLowerCase().includes(key)
}

export function listNovelsAdmin(query = {}) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const status = String(query.status || '').trim().toLowerCase()

  let rows = [...novelsById.values()].map((novel) => ({
    ...stripNovelForCatalog(novel),
    synopsis: novel.synopsis,
    createdAtMs: novel.createdAtMs,
    updatedAtMs: novel.updatedAtMs,
  }))

  rows = rows.filter((row) => {
    if (!matchTextFilter(row.title, query.title)) return false
    if (!matchTextFilter(row.author, query.author)) return false
    if (!matchTextFilter(row.genreId, query.genreId || query.genre)) return false
    if (status && String(row.status || '').toLowerCase() !== status) return false
    return true
  })

  rows.sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0))
  const total = rows.length
  const start = (page - 1) * pageSize
  const items = rows.slice(start, start + pageSize)
  return { items, total, page, pageSize }
}

export function createNovel(input = {}) {
  const novel = normalizeNovel(input)
  if (!novel.title) throw new Error('title required')

  const firstTitle = String(input.firstChapterTitle || input.chapterTitle || '').trim()
  const firstBody = input.firstChapterContent ?? input.chapterContent ?? ''
  if (firstTitle || firstBody) {
    novel.chapters = [
      normalizeChapter(
        {
          title: firstTitle || '第一章',
          body: firstBody,
          isVip: input.firstChapterIsVip === true,
        },
        0,
      ),
    ]
  }

  novel.wordCountWan = computeNovelWordCountWan(novel.chapters)
  novel.updatedAtMs = now()
  novelsById.set(novel.id, novel)
  persist()
  return JSON.parse(JSON.stringify(novel))
}

export function updateNovel(id, patch = {}) {
  const key = String(id || '').trim()
  const existing = novelsById.get(key)
  if (!existing) throw new Error('novel not found')

  const merged = normalizeNovel(
    {
      ...existing,
      ...patch,
      id: key,
      chapters: existing.chapters,
      createdAtMs: existing.createdAtMs,
    },
    { preserveId: key },
  )

  merged.updatedAtMs = now()
  merged.wordCountWan = computeNovelWordCountWan(merged.chapters)
  novelsById.set(key, merged)
  persist()
  return JSON.parse(JSON.stringify(merged))
}

export function deleteNovel(id) {
  const key = String(id || '').trim()
  const existing = novelsById.get(key)
  if (!existing) throw new Error('novel not found')
  novelsById.delete(key)
  persist()
  return { id: key, title: existing.title }
}

export function listChaptersAdmin(query = {}) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const novelId = String(query.novelId || '').trim()
  const search = String(query.search || query.title || '').trim().toLowerCase()

  const rows = []
  const novels = novelId
    ? [novelsById.get(novelId)].filter(Boolean)
    : [...novelsById.values()]

  novels.forEach((novel) => {
    ;(novel.chapters || []).forEach((ch, index) => {
      if (search) {
        const hay = `${ch.title} ${novel.title}`.toLowerCase()
        if (!hay.includes(search)) return
      }
      rows.push({
        novelId: novel.id,
        novelTitle: novel.title,
        chapterIndex: index,
        chapterId: ch.id,
        title: ch.title,
        wordCount: ch.wordCount,
        isVip: ch.isVip === true,
        updatedAtMs: ch.updatedAtMs,
      })
    })
  })

  rows.sort((a, b) => {
    const novelCmp = String(a.novelTitle).localeCompare(String(b.novelTitle))
    if (novelCmp !== 0) return novelCmp
    return a.chapterIndex - b.chapterIndex
  })

  const total = rows.length
  const start = (page - 1) * pageSize
  return { items: rows.slice(start, start + pageSize), total, page, pageSize }
}

function reindexChapters(chapters) {
  return chapters.map((ch, i) => ({
    ...normalizeChapter(ch, i),
    id: ch.id || `ch_${i + 1}`,
  }))
}

export function createChapter(novelId, input = {}) {
  const key = String(novelId || '').trim()
  const novel = novelsById.get(key)
  if (!novel) throw new Error('novel not found')

  const chapter = normalizeChapter(
    {
      title: input.title,
      body: input.content ?? input.body,
      isVip: input.isVip,
    },
    novel.chapters.length,
  )
  if (!chapter.title) throw new Error('chapter title required')

  novel.chapters.push(chapter)
  novel.chapters = reindexChapters(novel.chapters)
  novel.updatedAtMs = now()
  novel.wordCountWan = computeNovelWordCountWan(novel.chapters)
  novelsById.set(key, novel)
  persist()
  return { novel: JSON.parse(JSON.stringify(novel)), chapter: chapter }
}

export function updateChapter(novelId, chapterIndex, patch = {}) {
  const key = String(novelId || '').trim()
  const novel = novelsById.get(key)
  if (!novel) throw new Error('novel not found')
  const idx = Number(chapterIndex)
  if (!Number.isFinite(idx) || idx < 0 || idx >= novel.chapters.length) {
    throw new Error('chapter not found')
  }

  const prev = novel.chapters[idx]
  const next = normalizeChapter(
    {
      ...prev,
      title: patch.title ?? prev.title,
      body: patch.content ?? patch.body ?? prev.body,
      isVip: patch.isVip ?? prev.isVip,
      id: prev.id,
    },
    idx,
  )

  novel.chapters[idx] = next
  novel.updatedAtMs = now()
  novel.wordCountWan = computeNovelWordCountWan(novel.chapters)
  novelsById.set(key, novel)
  persist()
  return { novel: JSON.parse(JSON.stringify(novel)), chapter: next }
}

export function deleteChapter(novelId, chapterIndex) {
  const key = String(novelId || '').trim()
  const novel = novelsById.get(key)
  if (!novel) throw new Error('novel not found')
  const idx = Number(chapterIndex)
  if (!Number.isFinite(idx) || idx < 0 || idx >= novel.chapters.length) {
    throw new Error('chapter not found')
  }

  const removed = novel.chapters[idx]
  novel.chapters.splice(idx, 1)
  novel.chapters = reindexChapters(novel.chapters)
  novel.updatedAtMs = now()
  novel.wordCountWan = computeNovelWordCountWan(novel.chapters)
  novelsById.set(key, novel)
  persist()
  return { novel: JSON.parse(JSON.stringify(novel)), removed }
}

export function listNovelTitles() {
  return [...novelsById.values()].map((n) => ({ id: n.id, title: n.title }))
}
