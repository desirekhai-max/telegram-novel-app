import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { PERSISTENT_DATA_DIR } from './persistent-data-dir.js'
import {
  decodeCoverImageInput,
  resolvePublicApiOrigin,
} from './novel-cover-upload.js'

export const REPORT_SCREENSHOTS_DIR = path.join(PERSISTENT_DATA_DIR, 'uploads', 'report-screenshots')
export const REPORT_SCREENSHOTS_URL_PREFIX = '/uploads/report-screenshots/'
export const MAX_REPORT_SCREENSHOT_BYTES = 2 * 1024 * 1024

function ensureDir() {
  fs.mkdirSync(REPORT_SCREENSHOTS_DIR, { recursive: true })
}

export function initReportScreenshotUpload() {
  ensureDir()
}

function extForMime(mime) {
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  return '.jpg'
}

export function buildReportScreenshotPublicUrl(req, filename) {
  const origin = resolvePublicApiOrigin(req)
  return `${origin}${REPORT_SCREENSHOTS_URL_PREFIX}${encodeURIComponent(filename)}`
}

export function saveReportScreenshot(req, { dataUrl, mimeType, base64 } = {}) {
  ensureDir()
  const { mime, buffer } = decodeCoverImageInput({ dataUrl, mimeType, base64 })
  if (buffer.length > MAX_REPORT_SCREENSHOT_BYTES) {
    throw new Error('截图不能超过 2MB')
  }
  const ext = extForMime(mime)
  const filename = `report_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`
  const filePath = path.join(REPORT_SCREENSHOTS_DIR, filename)
  fs.writeFileSync(filePath, buffer)
  return {
    screenshotUrl: buildReportScreenshotPublicUrl(req, filename),
    filename,
    bytes: buffer.length,
    mime,
  }
}

export function serveReportScreenshotFile(res, filename) {
  const safe = String(filename || '').trim()
  if (!safe || !/^[a-zA-Z0-9._-]+$/.test(safe)) {
    res.writeHead(400)
    res.end()
    return
  }
  const filePath = path.join(REPORT_SCREENSHOTS_DIR, safe)
  if (!filePath.startsWith(REPORT_SCREENSHOTS_DIR) || !fs.existsSync(filePath)) {
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
