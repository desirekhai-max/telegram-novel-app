import { getDefaultViewerProfile, normalizeViewerProfile } from './viewerProfileApi.js'

const STORAGE_PREFIX = 'tg-viewer-profile:'
const memoryByUserId = new Map()

function storageKey(telegramUserId) {
  return `${STORAGE_PREFIX}${telegramUserId}`
}

/** 读取本页内存或 sessionStorage 中的上次会员资料（用于首屏免闪烁） */
export function readCachedViewerProfile(telegramUserId, tgUser = null) {
  const id = Number(telegramUserId) || 0
  if (!id) return null

  const mem = memoryByUserId.get(id)
  if (mem) return mem

  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(storageKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const profile = normalizeViewerProfile(parsed?.profile ?? parsed, tgUser ?? { id })
    memoryByUserId.set(id, profile)
    return profile
  } catch {
    return null
  }
}

export function writeCachedViewerProfile(telegramUserId, profile) {
  const id = Number(telegramUserId) || Number(profile?.telegramUserId) || 0
  if (!id || !profile) return

  memoryByUserId.set(id, profile)

  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      storageKey(id),
      JSON.stringify({ profile, at: Date.now() }),
    )
  } catch {
    /* quota / private mode */
  }
}

export function clearCachedViewerProfile(telegramUserId) {
  const id = Number(telegramUserId) || 0
  if (!id) return
  memoryByUserId.delete(id)
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(id))
  } catch {
    /* ignore */
  }
}

export function getInitialViewerProfile(tgUser) {
  const id = Number(tgUser?.id) || 0
  if (!id) return getDefaultViewerProfile(null)
  return readCachedViewerProfile(id, tgUser) ?? getDefaultViewerProfile(tgUser)
}
