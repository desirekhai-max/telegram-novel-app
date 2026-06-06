async function resolveQrBlob(qrImageSrc) {
  const src = String(qrImageSrc || '').trim()
  if (!src) return null

  if (src.startsWith('data:')) {
    const res = await fetch(src)
    return res.blob()
  }

  const res = await fetch(src, { mode: 'cors' })
  if (!res.ok) return null
  return res.blob()
}

async function rasterizeSvgBlobToPng(blob) {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = () => resolve(undefined)
      img.onerror = () => reject(new Error('svg_rasterize_failed'))
      img.src = url
    })
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return blob
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(img, 0, 0, size, size)
    const pngBlob = await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/png', 0.92)
    })
    return pngBlob && pngBlob.size > 0 ? pngBlob : blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function normalizeQrDownloadBlob(blob) {
  const type = String(blob?.type || '').toLowerCase()
  if (type.includes('svg')) {
    try {
      return await rasterizeSvgBlobToPng(blob)
    } catch {
      return blob
    }
  }
  return blob
}

function pickDownloadFilename(blob) {
  const type = String(blob?.type || '').toLowerCase()
  if (type.includes('svg')) return '69kkh-khqr.svg'
  if (type.includes('jpeg') || type.includes('jpg')) return '69kkh-khqr.jpg'
  return '69kkh-khqr.png'
}

async function tryShareQrFile(blob, filename) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  const file = new File([blob], filename, { type: blob.type || 'image/png' })
  if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
    return false
  }
  await navigator.share({ files: [file], title: 'KHQR' })
  return true
}

function triggerAnchorDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function openBlobPreview(blob) {
  const url = URL.createObjectURL(blob)
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    triggerAnchorDownload(blob, '69kkh-khqr.png')
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function openQrInNewTab(qrImageSrc) {
  window.open(qrImageSrc, '_blank', 'noopener,noreferrer')
}

/** 将 KHQR 二维码保存到手机（分享面板或下载）。 */
export async function downloadKhqrQrImage(qrImageSrc) {
  const src = String(qrImageSrc || '').trim()
  if (!src) return { ok: false, error: 'qr_missing' }

  try {
    const rawBlob = await resolveQrBlob(src)
    if (!rawBlob || rawBlob.size <= 0) return { ok: false, error: 'qr_unreadable' }

    const blob = await normalizeQrDownloadBlob(rawBlob)
    const filename = pickDownloadFilename(blob)

    if (await tryShareQrFile(blob, filename)) {
      return { ok: true, method: 'share' }
    }

    triggerAnchorDownload(blob, filename)
    return { ok: true, method: 'download' }
  } catch (err) {
    try {
      const rawBlob = await resolveQrBlob(src)
      if (rawBlob && rawBlob.size > 0) {
        const blob = await normalizeQrDownloadBlob(rawBlob)
        openBlobPreview(blob)
        return { ok: true, method: 'preview' }
      }
      openQrInNewTab(src)
      return { ok: true, method: 'open' }
    } catch {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'qr_download_failed',
      }
    }
  }
}
