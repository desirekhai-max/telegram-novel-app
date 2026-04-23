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

function readUnsafeUser() {
  if (typeof window === 'undefined') return null
  const u = window.Telegram?.WebApp?.initDataUnsafe?.user
  if (!u || u.is_bot) return null
  return u
}

/** 从 Telegram 内嵌环境读取当前用户；浏览器直接打开时为 `null`（会话内一般不变，无需 state） */
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
