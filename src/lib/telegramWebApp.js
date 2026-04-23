/** 在 Telegram 内嵌 WebView 中初始化 Mini App（非 Telegram 环境无操作） */
export function initTelegramWebApp() {
  try {
    const w = window.Telegram?.WebApp
    if (!w) return
    w.ready()
    w.expand()
  } catch {
    // 非 Telegram 或旧客户端
  }
}

/**
 * 打开 t.me 链接：在 Telegram Mini App 内优先用 openTelegramLink，直接跳进对话。
 * @param {string} url 须为 https://t.me/…
 * @returns {boolean} 为 true 时已由 WebApp 处理，调用方应 preventDefault
 */
export function tryOpenTelegramMeLink(url) {
  if (typeof window === 'undefined' || !url) return false
  if (!/^https:\/\/t\.me\//i.test(url)) return false
  const tg = window.Telegram?.WebApp
  if (typeof tg?.openTelegramLink === 'function') {
    try {
      tg.openTelegramLink(url)
      return true
    } catch {
      return false
    }
  }
  return false
}
