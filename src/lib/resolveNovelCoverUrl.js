import { apiAssetUrl } from './apiBase.js'

/**
 * 卡片/详情封面 URL：Telegram 手机端对相对路径解析不稳定，需转为绝对地址。
 * - `/covers/*`：前端静态资源（Netlify dist/public）
 * - `/uploads/novel-covers/*`：API 持久化上传目录
 */
export function resolveNovelCoverUrl(coverUrl) {
  const raw = String(coverUrl || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('/uploads/novel-covers/')) {
    return apiAssetUrl(raw)
  }
  if (raw.startsWith('/covers/')) {
    try {
      return `${window.location.origin}${raw}`
    } catch {
      return raw
    }
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
