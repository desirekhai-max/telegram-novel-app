import { novels } from './src/data/novels.js'

function escapeHtmlAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function attachNovelOgMiddleware(middlewares) {
  middlewares.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    const path = (req.url || '').split('?')[0]
    const m = /^\/read\/([^/]+)\/?$/.exec(path)
    if (!m) return next()
    const novelId = decodeURIComponent(m[1])
    const novel = novels.find((n) => String(n.id) === String(novelId))
    if (!novel) return next()
    const ua = String(req.headers['user-agent'] || '')
    if (
      !/telegrambot|facebookexternalhit|twitterbot|slackbot|discordbot|linkedinbot|whatsapp|vkshare|pinterest|googlebot|bingpreview|crawler|bot/i.test(
        ua,
      )
    ) {
      return next()
    }
    const host = req.headers.host || 'localhost:5173'
    const xfProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    const proto =
      xfProto || (host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https')
    const base = `${proto}://${host}`
    const readUrl = `${base}/read/${encodeURIComponent(novelId)}`
    const coverRaw = String(novel.coverUrl || '').trim()
    const coverAbs = /^https?:\/\//i.test(coverRaw)
      ? coverRaw
      : coverRaw
        ? `${base}${coverRaw.startsWith('/') ? '' : '/'}${coverRaw}`
        : ''
    const title = String(novel.title || '')
    const author = String(novel.author || '')
    const descSlice = String(novel.synopsis || '')
      .replace(/\s+/g, ' ')
      .slice(0, 180)
    const ogDesc = author ? `អ្នកនិពន្ធ：${author} · ${descSlice}` : descSlice
    const html = `<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtmlAttr(`《${title}》`)}" />
<meta property="og:description" content="${escapeHtmlAttr(ogDesc)}" />
<meta property="og:url" content="${escapeHtmlAttr(readUrl)}" />
${coverAbs ? `<meta property="og:image" content="${escapeHtmlAttr(coverAbs)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${escapeHtmlAttr(coverAbs)}" />
` : ''}<meta http-equiv="refresh" content="0;url=${escapeHtmlAttr(readUrl)}" />
<title>${escapeHtmlAttr(title)}</title>
</head>
<body>
<p><a href="${escapeHtmlAttr(readUrl)}">${escapeHtmlAttr(title)}</a></p>
</body>
</html>`
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=120')
    res.end(html)
  })
}

/**
 * 开发 / vite preview：对链接预览爬虫返回带 og:image 的 HTML，使分享 /read/:id 时仍显示封面且不暴露图片直链。
 * 纯静态部署（如默认 Netlify）无此中间件时，预览图会退回 index.html 的默认 og。
 */
export function novelOgPreviewPlugin() {
  return {
    name: 'novel-og-preview',
    configureServer(server) {
      attachNovelOgMiddleware(server.middlewares)
    },
    configurePreviewServer(server) {
      attachNovelOgMiddleware(server.middlewares)
    },
  }
}
