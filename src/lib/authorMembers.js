import { novels as bundledNovels } from '../data/novels.js'

function parseExtraAuthorIdsFromEnv() {
  const raw = String(import.meta.env.VITE_EXTRA_AUTHOR_TELEGRAM_IDS || '').trim()
  if (!raw) return []
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 从书目合并「作者」Telegram 数字 ID（字符串集合）。
 * 每本书可选 `authorTelegramIds: (string|number)[]`；
 * 另支持 `VITE_EXTRA_AUTHOR_TELEGRAM_IDS`（逗号/空格分隔）。
 *
 * @param {object[] | undefined} novelList
 * @returns {Set<string>}
 */
export function buildAuthorTelegramIdSet(novelList = bundledNovels) {
  const list = Array.isArray(novelList) ? novelList : bundledNovels
  const set = new Set()
  for (const n of list) {
    const ids = n?.authorTelegramIds
    if (!Array.isArray(ids)) continue
    for (const x of ids) {
      const s = String(x ?? '').trim()
      if (s) set.add(s)
    }
  }
  for (const id of parseExtraAuthorIdsFromEnv()) {
    set.add(id)
  }
  return set
}

/**
 * @param {string|number|undefined|null} userId Telegram user id
 * @param {object[] | undefined} novelList
 */
export function isTelegramUserRegisteredAuthor(userId, novelList) {
  if (userId == null || userId === '') return false
  const id = String(userId).trim()
  if (!id || !/^\d+$/.test(id)) return false
  return buildAuthorTelegramIdSet(novelList).has(id)
}
