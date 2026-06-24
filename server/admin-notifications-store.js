import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { PERSISTENT_DATA_DIR } from './persistent-data-dir.js'

const DATA_FILE = path.join(PERSISTENT_DATA_DIR, 'admin-notifications.json')
const MAX_ITEMS = 500
const PANEL_LIMIT = 20

const CATEGORY_LABELS = {
  order: '支付通知',
  user: '用户通知',
  novel: '小说通知',
  comment: '评论通知',
  report: '举报通知',
  vip: 'VIP通知',
  system: '系统通知',
  announcement: '公告通知',
}

const DEFAULT_SETTINGS = {
  categories: {
    order: true,
    user: true,
    novel: true,
    comment: true,
    report: true,
    vip: true,
    system: true,
    announcement: true,
  },
}

/** @type {{ items: object[], settings: object } | null} */
let cached = null

function now() {
  return Date.now()
}

function readJson() {
  if (!fs.existsSync(DATA_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  } catch {
    return null
  }
}

function normalizeItem(raw = {}, index = 0) {
  const id = String(raw.id || '').trim() || `n_${crypto.randomBytes(6).toString('hex')}`
  const category = CATEGORY_LABELS[raw.category] ? raw.category : 'system'
  return {
    id,
    category,
    title: String(raw.title || CATEGORY_LABELS[category] || '通知').slice(0, 80),
    message: String(raw.message || '').slice(0, 500),
    status: String(raw.status || '').slice(0, 40),
    read: raw.read === true,
    createdAtMs: Number(raw.createdAtMs || 0) || now() - index,
    sourceKey: String(raw.sourceKey || id).slice(0, 120),
    href: String(raw.href || '').slice(0, 160),
  }
}

function seedItems() {
  const base = now()
  const hour = 60 * 60 * 1000
  return [
    {
      id: 'seed_order_1',
      category: 'order',
      title: '支付通知',
      message: '用户 69kkh 成功购买 VIP 24小时套餐',
      read: false,
      createdAtMs: base - hour * 0.5,
      sourceKey: 'seed:order:1',
      href: '/admin/orders',
    },
    {
      id: 'seed_user_1',
      category: 'user',
      title: '用户通知',
      message: '新用户注册：@abc123',
      read: false,
      createdAtMs: base - hour * 1.2,
      sourceKey: 'seed:user:1',
      href: '/admin/users',
    },
    {
      id: 'seed_novel_1',
      category: 'novel',
      title: '小说通知',
      message: '《修罗武神》新增章节 325',
      read: false,
      createdAtMs: base - hour * 2,
      sourceKey: 'seed:novel:1',
      href: '/admin/stats',
    },
    {
      id: 'seed_report_1',
      category: 'report',
      title: '举报通知',
      message: '用户举报《XXX小说》第15章',
      status: '待处理',
      read: false,
      createdAtMs: base - hour * 2.5,
      sourceKey: 'seed:report:1',
      href: '/admin/reports',
    },
    {
      id: 'seed_comment_1',
      category: 'comment',
      title: '评论通知',
      message: '《斗罗大陆》收到新评论',
      read: false,
      createdAtMs: base - hour * 3.5,
      sourceKey: 'seed:comment:1',
      href: '/admin/lists',
    },
    {
      id: 'seed_vip_1',
      category: 'vip',
      title: 'VIP通知',
      message: '用户 69kkh VIP 将于24小时后到期',
      read: false,
      createdAtMs: base - hour * 4,
      sourceKey: 'seed:vip:1',
      href: '/admin/users',
    },
    {
      id: 'seed_system_1',
      category: 'system',
      title: '系统通知',
      message: 'Railway 服务重启成功',
      read: false,
      createdAtMs: base - hour * 4.2,
      sourceKey: 'seed:system:1',
      href: '/admin/settings',
    },
    {
      id: 'seed_announce_1',
      category: 'announcement',
      title: '公告通知',
      message: '管理员发布新公告',
      read: true,
      createdAtMs: base - hour * 5,
      sourceKey: 'seed:announce:1',
      href: '/admin/dashboard',
    },
  ].map((row, i) => normalizeItem(row, i))
}

function persist(state) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  cached = state
  return state
}

function loadState() {
  if (cached) return cached
  const raw = readJson()
  if (raw && Array.isArray(raw.items)) {
    cached = {
      items: raw.items.map((row, i) => normalizeItem(row, i)).slice(0, MAX_ITEMS),
      settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}), categories: { ...DEFAULT_SETTINGS.categories, ...(raw.settings?.categories || {}) } },
    }
    return cached
  }
  cached = { items: seedItems(), settings: { ...DEFAULT_SETTINGS } }
  persist(cached)
  return cached
}

export function initAdminNotificationsStore() {
  loadState()
}

function categoryEnabled(category) {
  const settings = loadState().settings
  return settings.categories?.[category] !== false
}

function upsertItem(item) {
  const state = loadState()
  const key = String(item.sourceKey || item.id)
  const idx = state.items.findIndex((row) => row.sourceKey === key)
  if (idx >= 0) {
    state.items[idx] = { ...state.items[idx], ...item, sourceKey: key }
  } else {
    state.items.unshift(normalizeItem(item))
  }
  state.items.sort((a, b) => b.createdAtMs - a.createdAtMs)
  state.items = state.items.slice(0, MAX_ITEMS)
  persist(state)
}

export function pushAdminNotification(item) {
  if (!categoryEnabled(item.category)) return null
  upsertItem(item)
  return item
}

export function syncAdminNotificationsFromSources(sources = {}) {
  const orders = Array.isArray(sources.orders) ? sources.orders : []
  const reports = Array.isArray(sources.reports) ? sources.reports : []
  const comments = Array.isArray(sources.comments) ? sources.comments : []
  const auditLogs = Array.isArray(sources.auditLogs) ? sources.auditLogs : []

  orders.forEach((order) => {
    if (String(order.status || '').toLowerCase() !== 'paid') return
    const user = order.telegram_username || order.telegramUsername || order.member_id || '用户'
    const pkg = order.package_name || order.packageName || order.plan_id || 'VIP套餐'
    upsertItem({
      category: 'order',
      title: CATEGORY_LABELS.order,
      message: `用户 ${user} 成功购买 ${pkg}`,
      createdAtMs: Number(order.paid_at_ms || order.paidAtMs || order.created_at_ms || order.createdAtMs || now()),
      sourceKey: `order:${order.tran_id || order.tranId || order.order_no || order.orderNo}`,
      href: '/admin/orders',
    })
  })

  reports.forEach((row) => {
    const pending = !row.status || row.status === 'pending' || row.status === '待处理'
    upsertItem({
      category: 'report',
      title: CATEGORY_LABELS.report,
      message: `用户举报《${row.novelTitle || row.novelId || '小说'}》${row.chapterTitle ? ` ${row.chapterTitle}` : ''}`,
      status: pending ? '待处理' : '',
      createdAtMs: Number(row.at || row.createdAtMs || now()),
      sourceKey: `report:${row.novelId}:${row.id}`,
      href: '/admin/reports',
    })
  })

  comments.slice(0, 30).forEach((row) => {
    upsertItem({
      category: 'comment',
      title: CATEGORY_LABELS.comment,
      message: `《${row.novelTitle || row.novelId}》收到新评论`,
      createdAtMs: Number(row.at || now()),
      sourceKey: `comment:${row.novelId}:${row.id}`,
      href: '/admin/lists',
    })
  })

  auditLogs.slice(0, 20).forEach((row) => {
    const action = String(row.action || '')
    let category = 'system'
    let message = row.note || action || '系统操作'
    if (action.includes('gift') || action.includes('vip')) {
      category = 'vip'
      message = row.note || `VIP 操作：${action}`
    } else if (action.includes('user') || action.includes('ban')) {
      category = 'user'
      message = row.note || `用户操作：${action}`
    }
    upsertItem({
      category,
      title: CATEGORY_LABELS[category] || CATEGORY_LABELS.system,
      message,
      createdAtMs: Number(row.at || now()),
      sourceKey: `audit:${row.id}`,
      href: category === 'user' ? '/admin/users' : '/admin/settings',
    })
  })

  return loadState().items
}

function filterItems(query = {}) {
  const state = loadState()
  let rows = [...state.items]
  const category = String(query.category || '').trim()
  if (category && CATEGORY_LABELS[category]) {
    rows = rows.filter((row) => row.category === category)
  }
  if (query.unreadOnly === true || query.unreadOnly === 'true' || query.unreadOnly === '1') {
    rows = rows.filter((row) => !row.read)
  }
  rows = rows.filter((row) => categoryEnabled(row.category))
  return rows
}

export function listAdminNotifications(query = {}) {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || PANEL_LIMIT))
  const page = Math.max(1, Number(query.page) || 1)
  const rows = filterItems(query)
  const total = rows.length
  const start = (page - 1) * limit
  return {
    items: rows.slice(start, start + limit),
    total,
    unreadCount: rows.filter((row) => !row.read).length,
    page,
    limit,
  }
}

export function getAdminNotificationsUnreadCount() {
  return filterItems({ unreadOnly: true }).length
}

export function markAdminNotificationRead(id) {
  const state = loadState()
  const key = String(id || '').trim()
  const row = state.items.find((it) => it.id === key)
  if (!row) return null
  row.read = true
  persist(state)
  return row
}

export function markAllAdminNotificationsRead() {
  const state = loadState()
  state.items.forEach((row) => {
    row.read = true
  })
  persist(state)
  return { ok: true }
}

export function getAdminNotificationSettings() {
  return loadState().settings
}

export function saveAdminNotificationSettings(patch = {}) {
  const state = loadState()
  state.settings = {
    ...state.settings,
    categories: {
      ...state.settings.categories,
      ...(patch.categories || {}),
    },
  }
  persist(state)
  return state.settings
}

export { CATEGORY_LABELS, PANEL_LIMIT }
