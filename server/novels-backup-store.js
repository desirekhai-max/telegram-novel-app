import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { PERSISTENT_DATA_DIR } from './persistent-data-dir.js'
import { exportNovelsBackupPayload, restoreNovelsFromBackup } from './novels-store.js'
import { zipSingleFile } from './zip-utils.js'

const BACKUPS_DIR = path.join(PERSISTENT_DATA_DIR, 'novels-backups')
const SETTINGS_FILE = path.join(BACKUPS_DIR, 'settings.json')
const INDEX_FILE = path.join(BACKUPS_DIR, 'index.json')

const DEFAULT_SETTINGS = {
  autoEnabled: false,
  intervalHours: 24,
  maxVersions: 20,
  lastAutoAtMs: 0,
}

function nowStamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function ensureDirs() {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true })
}

function readIndex() {
  ensureDirs()
  const raw = readJson(INDEX_FILE, { versions: [] })
  const versions = Array.isArray(raw?.versions) ? raw.versions : []
  return { versions: versions.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)) }
}

function writeIndex(index) {
  writeJson(INDEX_FILE, index)
}

function pruneOldVersions(index) {
  const settings = getBackupSettings()
  const max = Math.max(1, Number(settings.maxVersions) || 20)
  if (index.versions.length <= max) return index
  const drop = index.versions.slice(max)
  drop.forEach((v) => {
    const filePath = path.join(BACKUPS_DIR, v.filename)
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch {
        /* ignore */
      }
    }
  })
  index.versions = index.versions.slice(0, max)
  return index
}

export function initNovelsBackupStore() {
  ensureDirs()
  if (!fs.existsSync(SETTINGS_FILE)) {
    writeJson(SETTINGS_FILE, DEFAULT_SETTINGS)
  }
  if (!fs.existsSync(INDEX_FILE)) {
    writeJson(INDEX_FILE, { versions: [] })
  }
}

export function getBackupSettings() {
  ensureDirs()
  return { ...DEFAULT_SETTINGS, ...readJson(SETTINGS_FILE, DEFAULT_SETTINGS) }
}

export function saveBackupSettings(patch = {}) {
  const next = {
    ...getBackupSettings(),
    autoEnabled: patch.autoEnabled === true,
    intervalHours: Math.max(1, Math.min(168, Number(patch.intervalHours) || 24)),
    maxVersions: Math.max(1, Math.min(100, Number(patch.maxVersions) || 20)),
  }
  writeJson(SETTINGS_FILE, next)
  return next
}

export function listBackupVersions() {
  return readIndex().versions
}

function buildBackupFilename(stamp, id) {
  return `69kkh-books-${stamp}-${id}.json`
}

export function createNovelsBackup({ kind = 'manual' } = {}) {
  ensureDirs()
  const payload = exportNovelsBackupPayload()
  const id = crypto.randomBytes(4).toString('hex')
  const stamp = nowStamp()
  const filename = buildBackupFilename(stamp, id)
  const filePath = path.join(BACKUPS_DIR, filename)
  const json = `${JSON.stringify(payload, null, 2)}\n`
  fs.writeFileSync(filePath, json, 'utf8')

  const entry = {
    id,
    filename,
    kind: kind === 'auto' ? 'auto' : 'manual',
    createdAtMs: Date.now(),
    count: payload.count,
    sizeBytes: Buffer.byteLength(json, 'utf8'),
  }

  let index = readIndex()
  index.versions.unshift(entry)
  index = pruneOldVersions(index)
  writeIndex(index)
  return entry
}

export function readBackupPayloadById(id) {
  const key = String(id || '').trim()
  if (!key) throw new Error('备份 ID 无效')
  const entry = readIndex().versions.find((v) => v.id === key)
  if (!entry) throw new Error('备份不存在')
  const filePath = path.join(BACKUPS_DIR, entry.filename)
  if (!fs.existsSync(filePath)) throw new Error('备份文件已丢失')
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  return { entry, payload: parsed }
}

export function getBackupDownloadBuffer(id, format = 'json') {
  const { entry, payload } = readBackupPayloadById(id)
  const json = `${JSON.stringify(payload, null, 2)}\n`
  if (format === 'zip') {
    const zipName = entry.filename.replace(/\.json$/i, '.json')
    return {
      entry,
      filename: entry.filename.replace(/\.json$/i, '.zip'),
      contentType: 'application/zip',
      buffer: zipSingleFile(zipName, json),
    }
  }
  return {
    entry,
    filename: entry.filename,
    contentType: 'application/json; charset=utf-8',
    buffer: Buffer.from(json, 'utf8'),
  }
}

export function exportLiveBackupBuffer(format = 'json') {
  const payload = exportNovelsBackupPayload()
  const stamp = nowStamp()
  const base = `69kkh-books-${stamp}.json`
  const json = `${JSON.stringify(payload, null, 2)}\n`
  if (format === 'zip') {
    return {
      filename: base.replace(/\.json$/i, '.zip'),
      contentType: 'application/zip',
      buffer: zipSingleFile(base, json),
    }
  }
  return {
    filename: base,
    contentType: 'application/json; charset=utf-8',
    buffer: Buffer.from(json, 'utf8'),
  }
}

export function restoreNovelsBackupById(id) {
  const { entry, payload } = readBackupPayloadById(id)
  const result = restoreNovelsFromBackup(payload)
  return { entry, ...result }
}

export function restoreNovelsBackupFromPayload(payload) {
  return restoreNovelsFromBackup(payload)
}

export function maybeRunAutoBackup() {
  const settings = getBackupSettings()
  if (!settings.autoEnabled) return null
  const intervalMs = Math.max(1, Number(settings.intervalHours) || 24) * 60 * 60 * 1000
  const last = Number(settings.lastAutoAtMs) || 0
  if (Date.now() - last < intervalMs) return null
  const entry = createNovelsBackup({ kind: 'auto' })
  const nextSettings = { ...settings, lastAutoAtMs: Date.now() }
  writeJson(SETTINGS_FILE, nextSettings)
  console.log(`[novels-backup] auto backup created (${entry.count} novels, id=${entry.id})`)
  return entry
}

export function startAutoBackupScheduler() {
  initNovelsBackupStore()
  const tick = () => {
    try {
      maybeRunAutoBackup()
    } catch (err) {
      console.warn('[novels-backup] auto tick failed', err?.message || err)
    }
  }
  tick()
  setInterval(tick, 15 * 60 * 1000)
}
