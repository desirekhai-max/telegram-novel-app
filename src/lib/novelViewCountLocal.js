/**
 * 观看次数本地持久化（localStorage）：服务端不可用时仍能记住「至少到过」的次数，刷新不丢。
 * 与接口返回值取 max，避免低于用户已见过的数字。
 */

const STORAGE_KEY = 'tg-novel-view-count-max-v1'

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const o = raw ? JSON.parse(raw) : {}
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota / 隐私模式 */
  }
}

/** @param {string|number} novelId */
export function getLocalViewMax(novelId) {
  const id = String(novelId || '').trim()
  if (!id) return 0
  const n = Number(readAll()[id])
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

/**
 * 将本书观看「下限」抬到至少 count（只增不减）
 * @param {string|number} novelId
 * @param {number} count
 */
export function bumpLocalViewMax(novelId, count) {
  const id = String(novelId || '').trim()
  if (!id) return
  const next = Math.max(0, Math.floor(Number(count) || 0))
  const all = readAll()
  const prev = Number(all[id]) || 0
  if (next <= prev) return
  all[id] = next
  writeAll(all)
}
