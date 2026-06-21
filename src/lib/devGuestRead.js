import { getNovelById } from '../data/novels.js'

/** 仅 Vite 开发服务器为 true；生产 build 恒为 false。 */
export function isDevGuestReadEnabled() {
  return import.meta.env.DEV === true
}

/** 是否为 src/data/novels.js 内置演示书 id。 */
export function isBundledDemoNovelId(novelId) {
  const key = String(novelId || '').trim()
  if (!key) return false
  return Boolean(getNovelById(key))
}

/** 本地开发：允许未登录阅读内置演示书全部章节（含 VIP 章）。 */
export function canDevGuestReadNovel(novelId) {
  return isDevGuestReadEnabled() && isBundledDemoNovelId(novelId)
}
