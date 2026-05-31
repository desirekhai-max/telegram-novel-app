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

export const DEFAULT_SUPPORT_EMAIL = 'support.69kkh@gmail.com'
export const DEFAULT_SUPPORT_EMAIL_SUBJECT = '69KKH Support'

/** 是否在 Telegram Mini App 内（WebView 内直接跳 mailto: 会 ERR_UNKNOWN_URL_SCHEME） */
export function isTelegramMiniApp() {
  try {
    const w = typeof window !== 'undefined' ? window.Telegram?.WebApp : null
    if (!w) return false
    if (String(w.initData || '').trim()) return true
    const platform = String(w.platform || '').toLowerCase()
    return Boolean(platform && platform !== 'unknown')
  } catch {
    return false
  }
}

function normalizeEmailAddress(email) {
  return String(email || '').trim().replace(/^mailto:/i, '').split('?')[0]
}

/** mailto 写信（收件人 + 主题） */
export function buildMailtoComposeUrl(email, subject = DEFAULT_SUPPORT_EMAIL_SUBJECT) {
  const addr = normalizeEmailAddress(email)
  if (!addr) return ''
  const subj = String(subject || '').trim()
  if (!subj) return `mailto:${addr}`
  return `mailto:${addr}?subject=${encodeURIComponent(subj)}`
}

/** Gmail 原生 App 写信深链（Android / iOS 已安装 Gmail 时直达写信页） */
export function buildGmailAppComposeUrl(email, subject = DEFAULT_SUPPORT_EMAIL_SUBJECT) {
  const addr = normalizeEmailAddress(email)
  if (!addr) return ''
  const params = new URLSearchParams({ to: addr })
  const subj = String(subject || '').trim()
  if (subj) params.set('subject', subj)
  return `googlegmail://co?${params.toString()}`
}

/**
 * Gmail 网页写信（仅作最后兜底；Telegram 内优先 mailto / Gmail App，避免只进收件箱）。
 * 使用 tf=cm（compose），勿用已废弃的 view=cm。
 */
export function buildGmailComposeUrl(email, subject = DEFAULT_SUPPORT_EMAIL_SUBJECT) {
  const addr = normalizeEmailAddress(email)
  if (!addr) return ''
  const params = new URLSearchParams({
    tf: 'cm',
    to: addr,
  })
  const subj = String(subject || '').trim()
  if (subj) params.set('su', subj)
  return `https://mail.google.com/mail/u/0/?${params.toString()}`
}

/**
 * 供 <a href> 使用：Telegram 内不用可导航的 mailto/https，避免 WebView 误跳；
 * 实际打开由 openMailtoEmail + openLink 处理。
 */
export function buildSupportEmailOpenHref(
  email = DEFAULT_SUPPORT_EMAIL,
  subject = DEFAULT_SUPPORT_EMAIL_SUBJECT,
) {
  if (isTelegramMiniApp()) return '#support-email'
  return buildMailtoComposeUrl(email, subject)
}

/** 普通浏览器：模拟点击 mailto */
function tryOpenMailtoInBrowser(mailtoUrl) {
  if (!mailtoUrl || typeof window === 'undefined') return false
  try {
    const a = document.createElement('a')
    a.href = mailtoUrl
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
    return true
  } catch {
    return false
  }
}

/**
 * Telegram Mini App：用 openLink 交给系统处理（邮件 App / Gmail App），
 * 绝不在 WebView 内 location.href 或默认 <a> 导航。
 */
function openViaTelegramExternal(url) {
  if (!url || typeof window === 'undefined') return false
  const tg = window.Telegram?.WebApp
  if (typeof tg?.openLink !== 'function') return false
  try {
    tg.openLink(url)
    return true
  } catch {
    return false
  }
}

function openUrlInNewTab(url) {
  if (!url || typeof window === 'undefined') return false
  try {
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (opened) return true
  } catch {
    /* ignore */
  }
  try {
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
    return true
  } catch {
    return false
  }
}

function showEmailHelpAlert(message) {
  const tg = window.Telegram?.WebApp
  if (typeof tg?.showAlert === 'function') {
    try {
      tg.showAlert(message)
      return
    } catch {
      /* ignore */
    }
  }
  window.alert(message)
}

/**
 * 打开邮件写信。
 * Telegram：mailto → Gmail App → Gmail 网页写信（均经 openLink，预填收件人/主题）。
 * 桌面浏览器：mailto 调系统默认邮件客户端。
 */
export async function openMailtoEmail(email = DEFAULT_SUPPORT_EMAIL, options = {}) {
  const addr = normalizeEmailAddress(email)
  if (!addr || typeof window === 'undefined') return false

  const subject = String(options.subject ?? DEFAULT_SUPPORT_EMAIL_SUBJECT).trim()
  const mailto = buildMailtoComposeUrl(addr, subject)
  const gmailAppUrl = buildGmailAppComposeUrl(addr, subject)
  const gmailWebUrl = buildGmailComposeUrl(addr, subject)

  if (isTelegramMiniApp()) {
    if (mailto && openViaTelegramExternal(mailto)) return true
    if (gmailAppUrl && openViaTelegramExternal(gmailAppUrl)) return true
    if (gmailWebUrl && openViaTelegramExternal(gmailWebUrl)) return true

    showEmailHelpAlert(
      `មិនអាចបើកកម្មវិធីអ៊ីមែលបានទេ។\n\nសូមបញ្ជូនទៅ៖ ${addr}\nប្រធានបទ៖ ${subject}\n\nឬទាក់ទង @VIP_69kkh តាម Telegram`,
    )
    return false
  }

  if (mailto && tryOpenMailtoInBrowser(mailto)) return true
  if (gmailAppUrl && openUrlInNewTab(gmailAppUrl)) return true
  if (gmailWebUrl && openUrlInNewTab(gmailWebUrl)) return true

  showEmailHelpAlert(`មិនអាចបើកកម្មវិធីអ៊ីមែលបានទេ។ សូមបញ្ជូនទៅ ${addr}`)
  return false
}
