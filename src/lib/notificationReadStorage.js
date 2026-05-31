import { getPresenceMemberId } from './miniAppPresence.js'

export const NOTIFICATION_READ_STORAGE_KEY = 'tg_notification_read_ids_v1'
export const NOTIFICATION_READ_CHANGED_EVENT = 'tg-notifications-read-changed'

function hasNotificationIdKeys(obj) {
  for (const k of Object.keys(obj || {})) {
    if (k.startsWith('like-') || k.startsWith('reply-') || k.startsWith('sys-')) return true
  }
  return false
}

export function resolveNotificationViewerId(tgUser) {
  if (tgUser?.id != null) return Number(tgUser.id)
  const presenceId = String(getPresenceMemberId() || '')
  const m = presenceId.match(/^tg_(\d+)$/)
  if (m) return Number(m[1])
  return null
}

export function readReadMap() {
  try {
    const raw = localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writeReadMap(next) {
  try {
    localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore storage failure */
  }
}

/** 读取某用户的已读 map；兼容旧版根级平铺结构。 */
export function readByViewer(all, viewerId) {
  if (viewerId == null) return {}
  const src = all && typeof all === 'object' ? all : {}
  const byUser = src[String(viewerId)]
  if (byUser && typeof byUser === 'object') return byUser
  if (hasNotificationIdKeys(src)) return src
  return {}
}

/** 将旧版平铺结构迁移为按 viewerId 分组。 */
export function ensureNestedReadMap(all, viewerId) {
  const src = all && typeof all === 'object' ? { ...all } : {}
  const key = String(viewerId)
  if (src[key] && typeof src[key] === 'object') return src
  if (!hasNotificationIdKeys(src)) return src
  const flat = {}
  for (const [k, v] of Object.entries(src)) {
    if (k.startsWith('like-') || k.startsWith('reply-') || k.startsWith('sys-')) {
      flat[k] = v
    }
  }
  if (Object.keys(flat).length > 0) {
    src[key] = flat
    for (const k of Object.keys(flat)) delete src[k]
  }
  return src
}

/** @param {{ id?: string, readAliases?: string[] }} notification */
export function getNotificationReadKeys(notification) {
  const id = String(notification?.id || '').trim()
  const aliases = Array.isArray(notification?.readAliases) ? notification.readAliases : []
  const keys = new Set([id, ...aliases.map((a) => String(a || '').trim()).filter(Boolean)])
  return [...keys]
}

/** @param {{ id?: string, readAliases?: string[] }} notification */
export function isNotificationRead(readMap, notification) {
  const map = readMap && typeof readMap === 'object' ? readMap : {}
  return getNotificationReadKeys(notification).some((k) => Boolean(map[k]))
}

/** @param {{ id?: string, readAliases?: string[] }} notification */
export function markNotificationReadInMap(readMap, notification, ts = Date.now()) {
  const next = { ...(readMap && typeof readMap === 'object' ? readMap : {}) }
  const keys = getNotificationReadKeys(notification)
  const canonical = String(notification?.id || '').trim()
  if (!canonical) return { next, changed: false }

  const existingTs = keys.reduce((max, k) => Math.max(max, Number(next[k] || 0)), 0)
  const finalTs = Math.max(existingTs, ts)
  if (next[canonical] === finalTs && keys.every((k) => !next[k] || k === canonical)) {
    return { next, changed: false }
  }

  for (const k of keys) delete next[k]
  next[canonical] = finalTs
  return { next, changed: true }
}

/**
 * 成功加载通知列表后：把旧 ID 的已读状态合并到 canonical id，并清理多余 alias 键。
 * @param {object[]} notifications
 */
export function syncReadMapWithNotifications(allReadMap, viewerId, notifications) {
  const all = ensureNestedReadMap(allReadMap, viewerId)
  const current = { ...readByViewer(all, viewerId) }
  const items = Array.isArray(notifications) ? notifications : []
  const next = {}
  let changed = false

  for (const it of items) {
    const canonical = String(it?.id || '').trim()
    if (!canonical) continue
    const readTs = getNotificationReadKeys(it).reduce(
      (max, k) => Math.max(max, Number(current[k] || 0)),
      0,
    )
    if (readTs > 0) {
      next[canonical] = readTs
      if (!current[canonical] || Number(current[canonical]) !== readTs) changed = true
    }
  }

  if (Object.keys(current).length !== Object.keys(next).length) changed = true
  all[String(viewerId)] = next
  return { all, next, changed }
}

/** @param {object[]} notifications */
export function countUnreadNotifications(notifications, readMap) {
  const items = Array.isArray(notifications) ? notifications : []
  const map = readMap && typeof readMap === 'object' ? readMap : {}
  return items.reduce((sum, it) => sum + (isNotificationRead(map, it) ? 0 : 1), 0)
}

export function dispatchNotificationReadChanged() {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_READ_CHANGED_EVENT))
}
