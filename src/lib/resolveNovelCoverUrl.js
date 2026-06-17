import { apiAssetUrl } from './apiBase.js'

/**
 * 卡片/详情封面 URL：相对路径在 Telegram 手机端会解析错域名，需转为 API 绝对地址。
 */
export function resolveNovelCoverUrl(coverUrl) {
  const raw = String(coverUrl || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('/uploads/novel-covers/') || raw.startsWith('/covers/')) {
    return apiAssetUrl(raw)
  }
  if (raw.startsWith('/')) {
    try {
      return `${window.location.origin}${raw}`
    } catch {
      return raw
    }
  }
  return raw
}
