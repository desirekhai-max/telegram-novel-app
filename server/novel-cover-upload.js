import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const COVERS_DIR = path.join(__dirname, 'uploads', 'novel-covers')
export const COVERS_URL_PREFIX = '/uploads/novel-covers/'
export const MAX_COVER_BYTES = 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

const API_PUBLIC_BASE = String(process.env.API_PUBLIC_BASE || '').trim().replace(/\/+$/, '')

function ensureCoversDir() {
  fs.mkdirSync(COVERS_DIR, { recursive: true })
}

export function initNovelCoverUpload() {
  ensureCoversDir()
}

export function resolvePublicApiOrigin(req) {
  if (API_PUBLIC_BASE) return API_PUBLIC_BASE
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https'
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim()
  return `${proto}://${host}`.replace(/\/+$/, '')
}

export function buildCoverPublicUrl(req, filename) {
  const origin = resolvePublicApiOrigin(req)
  return `${origin}${COVERS_URL_PREFIX}${encodeURIComponent(filename)}`
}

export function isManagedCoverUrl(coverUrl) {
  const raw = String(coverUrl || '').trim()
  if (!raw) return false
  try {
    const u = new URL(raw, 'http://local')
    const p = u.pathname
    return p.startsWith(COVERS_URL_PREFIX) && !p.includes('..')
  } catch {
    return raw.startsWith(COVERS_URL_PREFIX) && !raw.includes('..')
  }
}

function filenameFromCoverUrl(coverUrl) {
  const raw = String(coverUrl || '').trim()
  if (!raw) return ''
  let pathname = raw
  try {
    pathname = new URL(raw).pathname
  } catch {
    pathname = raw.startsWith('/') ? raw : `/${raw}`
  }
  if (!pathname.startsWith(COVERS_URL_PREFIX)) return ''
  const name = decodeURIComponent(pathname.slice(COVERS_URL_PREFIX.length))
  if (!name || name.includes('/') || name.includes('..')) return ''
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return ''
  return name
}

export function deleteManagedCoverFile(coverUrl) {
  const name = filenameFromCoverUrl(coverUrl)
  if (!name) return false
  const filePath = path.join(COVERS_DIR, name)
  if (!filePath.startsWith(COVERS_DIR)) return false
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    return true
  } catch {
    return false
  }
}

function detectMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
  ) {
    return 'image/png'
  }
  if (
    buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return ''
}

function extForMime(mime) {
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  return ''
}

export function decodeCoverImageInput({ dataUrl, mimeType, base64 }) {
  let mime = String(mimeType || '').trim().toLowerCase()
  let buffer = null

  const rawDataUrl = String(dataUrl || '').trim()
  if (rawDataUrl) {
    const m = rawDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i)
    if (!m) throw new Error('仅支持 jpg/png/webp 图片')
    mime = m[1].toLowerCase()
    buffer = Buffer.from(m[2], 'base64')
  } else {
    const rawB64 = String(base64 || '').trim()
    if (!rawB64) throw new Error('未收到图片数据')
    if (!ALLOWED_MIME.has(mime)) throw new Error('仅支持 jpg/png/webp 图片')
    buffer = Buffer.from(rawB64, 'base64')
  }

  if (!buffer || !buffer.length) throw new Error('图片为空')
  if (buffer.length > MAX_COVER_BYTES) throw new Error('图片不能超过 1MB')

  const detected = detectMime(buffer)
  if (!detected) throw new Error('无法识别的图片格式')
  if (mime && mime !== detected) {
    mime = detected
  } else {
    mime = detected
  }
  if (!ALLOWED_MIME.has(mime)) throw new Error('仅支持 jpg/png/webp 图片')

  return { mime, buffer }
}

export function saveCoverImage(req, { dataUrl, mimeType, base64, previousCoverUrl } = {}) {
  ensureCoversDir()
  const { mime, buffer } = decodeCoverImageInput({ dataUrl, mimeType, base64 })
  const ext = extForMime(mime)
  const filename = `cover_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`
  const filePath = path.join(COVERS_DIR, filename)
  fs.writeFileSync(filePath, buffer)

  if (previousCoverUrl && isManagedCoverUrl(previousCoverUrl)) {
    deleteManagedCoverFile(previousCoverUrl)
  }

  return {
    coverUrl: buildCoverPublicUrl(req, filename),
    filename,
    bytes: buffer.length,
    mime,
  }
}

export function serveNovelCoverFile(res, filename) {
  const safe = String(filename || '').trim()
  if (!safe || !/^[a-zA-Z0-9._-]+$/.test(safe)) {
    res.writeHead(400)
    res.end()
    return
  }
  const filePath = path.join(COVERS_DIR, safe)
  if (!filePath.startsWith(COVERS_DIR) || !fs.existsSync(filePath)) {
    res.writeHead(404)
    res.end()
    return
  }
  const ext = path.extname(safe).toLowerCase()
  const type =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  const body = fs.readFileSync(filePath)
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(body)
}

export async function readJsonBody(req, maxBytes = 1024 * 1024 * 2) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > maxBytes) {
        req.destroy()
        reject(new Error('payload too large'))
      }
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('invalid json'))
      }
    })
    req.on('error', reject)
  })
}
