/**
 * Telegram Mini App `initDataUnsafe.user`（仅展示用；敏感逻辑请在服务端校验 initData）
 * @typedef {object} TelegramWebAppUser
 * @property {number} id
 * @property {boolean} [is_bot]
 * @property {string} first_name
 * @property {string} [last_name]
 * @property {string} [username]
 * @property {string} [language_code]
 * @property {boolean} [is_premium]
 * @property {string} [photo_url]
 */

import { getDevVipTestTelegramUser, isDevVipPurchaseEnabled } from '../lib/devVipPurchase.js'

function readUnsafeUser() {
  if (typeof window === 'undefined') return null
  const u = window.Telegram?.WebApp?.initDataUnsafe?.user
  if (!u || u.is_bot) return null
  return u
}

export function getTelegramInitDataRaw() {
  if (typeof window === 'undefined') return ''
  return String(window.Telegram?.WebApp?.initData || '').trim()
}

export function getTelegramAuthPayload() {
  const user = readUnsafeUser()
  if (user) {
    return {
      telegramUser: user,
      initDataRaw: getTelegramInitDataRaw(),
    }
  }
  if (isDevVipPurchaseEnabled()) {
    return {
      telegramUser: getDevVipTestTelegramUser(),
      initDataRaw: '',
    }
  }
  return {
    telegramUser: null,
    initDataRaw: '',
  }
}

/** 从 Telegram 内嵌环境读取当前用户；浏览器直接打开（无 Telegram 壳）时为 `null`，与真机 Mini App 规则一致 */
export function useTelegramUser() {
  return readUnsafeUser()
}

/** 展示用昵称 */
export function formatTelegramDisplayName(user) {
  const parts = [user.first_name, user.last_name].filter(Boolean)
  if (parts.length) return parts.join(' ')
  if (user.username) return `@${user.username}`
  return `User ${user.id}`
}
