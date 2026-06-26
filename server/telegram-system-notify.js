import { getTelegramBotToken, getTelegramNotifyChatId, saveTelegramNotifyChatId } from './app-settings-store.js'

const ENABLED_TYPES = new Set(['user_register', 'vip_order', 'vip_inapp', 'report', 'comment'])

async function callTelegramApi(method, payload = {}, { get = false } = {}) {
  const token = getTelegramBotToken()
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN 未配置')

  let url = `https://api.telegram.org/bot${token}/${method}`
  const init = { method: get ? 'GET' : 'POST' }
  if (get) {
    const params = new URLSearchParams()
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      params.set(key, String(value))
    })
    const qs = params.toString()
    if (qs) url += `?${qs}`
  } else {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(payload)
  }

  const response = await fetch(url, init)
  const data = await response.json().catch(() => ({}))
  if (!data?.ok) {
    throw new Error(String(data?.description || `Telegram API ${method} failed`))
  }
  return data.result
}

function formatPhnomPenhTime(ms = Date.now()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Phnom_Penh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(ms))
    const pick = (type) => parts.find((part) => part.type === type)?.value || ''
    return `${pick('year')}/${pick('month')}/${pick('day')} ${pick('hour')}:${pick('minute')}`
  } catch {
    return new Date(ms).toISOString()
  }
}

function clip(text, max = 500) {
  const value = String(text || '').trim()
  if (!value) return ''
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function buildNotifyMessage(titleLine, bodyLines = []) {
  const body = bodyLines
    .filter((line) => line != null && line !== false && String(line).trim() !== '')
    .join('\n')
  return body ? `${titleLine}\n${body}` : titleLine
}

function formatNickname({ username, displayName, telegramUserId, userName } = {}) {
  const fromName = String(userName || displayName || '').trim()
  if (fromName && fromName !== 'A') return clip(fromName, 60)
  const uname = String(username || '').trim().replace(/^@/, '')
  if (uname) return clip(uname, 60)
  const id = String(telegramUserId || '').trim()
  if (id) return id
  return '—'
}

function formatUsdAmount(raw) {
  const label = String(raw || '').trim()
  if (!label) return '—'
  const num = Number(label.replace(/[^\d.]/g, ''))
  if (Number.isFinite(num) && num > 0) {
    const normalized = Number.isInteger(num) ? String(num) : String(num)
    return `${normalized} USD`
  }
  if (/usd/i.test(label)) return label
  return `${label} USD`
}

function formatVipPlanLabel(order = {}) {
  const hours = Number(order?.durationHours || 0)
  if (Number.isFinite(hours) && hours > 0) {
    return clip(`VIP ${hours}小时`, 80)
  }
  return clip(order?.product || order?.planId || 'VIP套餐', 80) || '—'
}

function formatOrderNo(order = {}, tranId = '') {
  return clip(order?.id || tranId || '', 60) || '—'
}

function buildVipNotifyLines({ profile, order, tranId = '' } = {}) {
  const atMs = Number(order?.atMs || Date.now())
  return [
    `用户：${formatNickname(profile)}`,
    `套餐：${formatVipPlanLabel(order)}`,
    `金额：${formatUsdAmount(order?.priceUsdLabel || order?.amount)}`,
    `订单号：${formatOrderNo(order, tranId)}`,
    `时间：${formatPhnomPenhTime(atMs)}`,
  ]
}

export async function discoverTelegramNotifyChatId(options = {}) {
  const titleHint = String(options.titleHint || '69KKH').trim()
  const botUsername = String(options.botUsername || 'nithian_kh_bot').trim().replace(/^@/, '')

  const me = await callTelegramApi('getMe', {}, { get: true })
  const actualBot = String(me?.username || '').trim().replace(/^@/, '')
  if (botUsername && actualBot && actualBot.toLowerCase() !== botUsername.toLowerCase()) {
    throw new Error(`Bot 不匹配：期望 @${botUsername}，当前 @${actualBot}`)
  }

  const webhook = await callTelegramApi('getWebhookInfo', {}, { get: true })
  if (webhook?.url) {
    await callTelegramApi('deleteWebhook', { drop_pending_updates: false })
  }

  const updates = await callTelegramApi('getUpdates', { limit: 100 }, { get: true })
  const rows = Array.isArray(updates) ? updates : []
  const matches = []
  const seen = new Set()

  const pushChat = (chat, atMs = 0) => {
    if (!chat) return
    if (chat.type !== 'group' && chat.type !== 'supergroup') return
    const id = String(chat.id || '')
    if (!id || seen.has(id)) return
    seen.add(id)
    matches.push({ chatId: chat.id, title: String(chat.title || '').trim(), type: chat.type, atMs })
  }

  for (const update of rows) {
    const msg = update?.message || update?.channel_post || update?.edited_message
    if (msg?.chat) pushChat(msg.chat, Number(msg?.date || 0) * 1000)
    const member = update?.my_chat_member
    if (member?.chat) pushChat(member.chat, Number(member?.date || 0) * 1000)
  }

  const titleMatched = titleHint ? matches.filter((row) => row.title.includes(titleHint)) : matches
  const notifyMatched = matches.filter(
    (row) => row.title.includes('系统通知') || row.title.includes('🔔'),
  )
  const pick = titleMatched.length ? titleMatched : notifyMatched.length ? notifyMatched : matches
  if (!pick.length) {
    throw new Error('未在 getUpdates 中找到通知群。请在「69KKH 系统通知🔔」发一条消息后再重试。')
  }

  pick.sort((a, b) => Number(b.atMs || 0) - Number(a.atMs || 0))
  const best = pick[0]
  return {
    chatId: String(best.chatId),
    title: best.title,
    type: best.type,
    botUsername: actualBot || botUsername,
  }
}

export async function bootstrapTelegramNotifyChatId() {
  if (getTelegramNotifyChatId()) return getTelegramNotifyChatId()
  if (!getTelegramBotToken()) return ''
  try {
    const found = await discoverTelegramNotifyChatId()
    if (found?.chatId) {
      saveTelegramNotifyChatId(found.chatId)
      console.log(`[telegram-notify] chat_id=${found.chatId} title=${found.title}`)
      return found.chatId
    }
  } catch (err) {
    console.warn('[telegram-notify] chat_id 自动发现失败:', err?.message || err)
  }
  return ''
}

export function notifyUserRegister(profile, { onlineCount } = {}) {
  const online = Number(onlineCount)
  const text = buildNotifyMessage('👤 新用户注册', [
    `昵称：${formatNickname(profile)}`,
    `TG ID：${String(profile?.telegramUserId || '').trim() || '—'}`,
    `在线人数：${Number.isFinite(online) && online >= 0 ? online : '—'}`,
    `时间：${formatPhnomPenhTime()}`,
  ])
  void sendSystemTelegramNotify('user_register', text)
}

export function notifyVipOrder(payload = {}) {
  const text = buildNotifyMessage('👑 新VIP订单', buildVipNotifyLines(payload))
  void sendSystemTelegramNotify('vip_order', text)
}

export function notifyVipInAppPurchase(payload = {}) {
  const text = buildNotifyMessage('📫VIP内购', buildVipNotifyLines(payload))
  void sendSystemTelegramNotify('vip_inapp', text)
}

export function notifyReport({ novelTitle, userName, content } = {}) {
  const text = buildNotifyMessage('🚩 举报通知', [
    `举报人：${formatNickname({ userName })}`,
    `小说：${clip(novelTitle || '—', 120)}`,
    `内容：${clip(content || '—', 500) || '—'}`,
    `时间：${formatPhnomPenhTime()}`,
  ])
  void sendSystemTelegramNotify('report', text)
}

export function notifyComment({ novelTitle, userName, content } = {}) {
  const text = buildNotifyMessage('💬 评论通知', [
    `用户：${formatNickname({ userName })}`,
    `小说：${clip(novelTitle || '—', 120)}`,
    `评论：${clip(content || '—', 500) || '—'}`,
    `时间：${formatPhnomPenhTime()}`,
  ])
  void sendSystemTelegramNotify('comment', text)
}

export async function sendSystemTelegramNotify(type, text) {
  if (!ENABLED_TYPES.has(type)) return { ok: false, skipped: 'type_disabled' }
  const chatId = getTelegramNotifyChatId()
  const token = getTelegramBotToken()
  if (!chatId || !token) return { ok: false, skipped: 'not_configured' }
  try {
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: String(text || '').slice(0, 4000),
      disable_web_page_preview: true,
    })
    return { ok: true }
  } catch (err) {
    console.warn('[telegram-notify]', type, err?.message || err)
    return { ok: false, error: String(err?.message || err) }
  }
}

export { ENABLED_TYPES }
