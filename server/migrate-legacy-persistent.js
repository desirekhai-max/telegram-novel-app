import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PERSISTENT_DATA_DIR } from './persistent-data-dir.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {{ novels?: object, presence?: object, covers?: object } | null} */
let lastMigrationResults = null

function copyFileIfNeeded(legacyPath, targetPath) {
  if (fs.existsSync(targetPath)) {
    return { migrated: false, reason: 'target_exists', legacyPath, targetPath }
  }
  if (!fs.existsSync(legacyPath)) {
    return { migrated: false, reason: 'legacy_missing', legacyPath, targetPath }
  }
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(legacyPath, targetPath)
    return { migrated: true, legacyPath, targetPath }
  } catch (err) {
    return { migrated: false, reason: 'error', error: String(err?.message || err), legacyPath, targetPath }
  }
}

const NOVELS_RESTORE_BUNDLE = path.join(__dirname, 'novels-data-restore-20260620.json')
const NOVELS_RESTORE_TARGET_COUNT = 24

function countNovelsInDataFile(filePath) {
  if (!fs.existsSync(filePath)) return 0
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const list = Array.isArray(parsed?.novels) ? parsed.novels : []
    return list.length
  } catch {
    return 0
  }
}

/** 正式环境 Ephemeral：目标少于 24 本时，从 Git 内置备份恢复；已有 24 本则不覆盖。 */
function restoreNovelsBundleIfNeeded(targetPath) {
  const currentCount = countNovelsInDataFile(targetPath)
  if (currentCount >= NOVELS_RESTORE_TARGET_COUNT) {
    return {
      restored: false,
      reason: 'already_full',
      currentCount,
      targetPath,
      restorePath: NOVELS_RESTORE_BUNDLE,
    }
  }
  if (!fs.existsSync(NOVELS_RESTORE_BUNDLE)) {
    return {
      restored: false,
      reason: 'restore_missing',
      currentCount,
      targetPath,
      restorePath: NOVELS_RESTORE_BUNDLE,
    }
  }
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(NOVELS_RESTORE_BUNDLE, targetPath)
    const afterCount = countNovelsInDataFile(targetPath)
    return {
      restored: true,
      reason: 'copied',
      beforeCount: currentCount,
      afterCount,
      targetPath,
      restorePath: NOVELS_RESTORE_BUNDLE,
    }
  } catch (err) {
    return {
      restored: false,
      reason: 'error',
      error: String(err?.message || err),
      currentCount,
      targetPath,
      restorePath: NOVELS_RESTORE_BUNDLE,
    }
  }
}

function copyDirMerge(legacyDir, targetDir) {
  if (!fs.existsSync(legacyDir)) {
    return { migrated: false, reason: 'legacy_missing', legacyDir, targetDir }
  }
  try {
    fs.mkdirSync(targetDir, { recursive: true })
    const entries = fs.readdirSync(legacyDir, { withFileTypes: true })
    let copied = 0
    for (const ent of entries) {
      const from = path.join(legacyDir, ent.name)
      const to = path.join(targetDir, ent.name)
      if (ent.isDirectory()) {
        const sub = copyDirMerge(from, to)
        copied += Number(sub.filesCopied || 0)
        continue
      }
      if (!fs.existsSync(to)) {
        fs.copyFileSync(from, to)
        copied += 1
      }
    }
    return {
      migrated: copied > 0,
      reason: copied > 0 ? 'copied' : 'nothing_new',
      filesCopied: copied,
      legacyDir,
      targetDir,
    }
  } catch (err) {
    return { migrated: false, reason: 'error', error: String(err?.message || err), legacyDir, targetDir }
  }
}

/**
 * 将旧容器路径数据迁移到 Volume（仅当目标不存在或封面目录需合并时执行）。
 */
export function runAllLegacyMigrations() {
  const targetNovels = path.join(PERSISTENT_DATA_DIR, 'novels-data.json')
  const targetPresence = path.join(PERSISTENT_DATA_DIR, 'presence-data.json')
  const targetCovers = path.join(PERSISTENT_DATA_DIR, 'uploads', 'novel-covers')

  const results = {
    novels: copyFileIfNeeded(path.join(__dirname, 'novels-data.json'), targetNovels),
    novelsFromDataDir: copyFileIfNeeded(path.join(__dirname, 'data', 'novels-data.json'), targetNovels),
    presence: copyFileIfNeeded(path.join(__dirname, 'presence-data.json'), targetPresence),
    presenceFromDataDir: copyFileIfNeeded(path.join(__dirname, 'data', 'presence-data.json'), targetPresence),
    covers: copyDirMerge(path.join(__dirname, 'uploads', 'novel-covers'), targetCovers),
    coversFromDataDir: copyDirMerge(path.join(__dirname, 'data', 'uploads', 'novel-covers'), targetCovers),
    novelsRestore: restoreNovelsBundleIfNeeded(targetNovels),
  }
  lastMigrationResults = results
  for (const [key, r] of Object.entries(results)) {
    if (r.migrated) {
      console.log(`[migrate] ${key}:`, r.legacyPath || r.legacyDir, '->', r.targetPath || r.targetDir)
    }
    if (key === 'novelsRestore' && r.restored) {
      console.log(
        `[migrate] novelsRestore: ${r.restorePath} -> ${r.targetPath} (${r.beforeCount} -> ${r.afterCount})`,
      )
    }
  }
  return results
}

export function getLastMigrationResults() {
  return lastMigrationResults
}

export function isVolumeConfigured() {
  if (PERSISTENT_DATA_DIR !== '/data') return false
  const configured = String(process.env.PERSISTENT_DATA_DIR || '').trim()
  const mount = String(process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim()
  return configured === '/data' || mount === '/data'
}
