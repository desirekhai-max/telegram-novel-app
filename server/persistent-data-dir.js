import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 生产环境请在 Railway 挂载 Volume 并设置 PERSISTENT_DATA_DIR=/data
 * （或依赖 RAILWAY_VOLUME_MOUNT_PATH）。未配置时回退到 server/data（本地开发可写）。
 */
function resolvePersistentDataDir() {
  const candidates = [
    process.env.PERSISTENT_DATA_DIR,
    process.env.NOVELS_DATA_DIR,
    process.env.RAILWAY_VOLUME_MOUNT_PATH,
    process.env.DATA_DIR,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean)

  for (const dir of candidates) {
    if (tryWritableDir(dir)) return dir
  }

  const fallback = path.join(__dirname, 'data')
  if (tryWritableDir(fallback)) return fallback
  return __dirname
}

function tryWritableDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    const probe = path.join(dir, '.write-probe')
    fs.writeFileSync(probe, 'ok', 'utf8')
    fs.unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

export const PERSISTENT_DATA_DIR = resolvePersistentDataDir()
