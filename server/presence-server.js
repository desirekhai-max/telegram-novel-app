import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HOST = process.env.HOST || '0.0.0.0'
const PORT = Number(process.env.PORT || 8787)
const ONLINE_WINDOW_MS = 45 * 1000
const COIN_TO_RIEL = 1 // 100金币=100瑞尔 -> 1金币=1瑞尔
const RIEL_PER_USD = 4000
const PHNOM_PENH_UTC_OFFSET_HOURS = 7
const PHNOM_PENH_SETTLEMENT_HOUR = 9 // 每天早上9点结算
const records = new Map()
const knownMembers = new Set()
const paidMembers = new Set()
const memberFirstSeenAt = new Map()
const memberPaidAt = new Map()
const txMetrics = {
  readEvents: [],
  orderEvents: [],
  successEvents: [],
  failedEvents: [],
  manualEvents: [],
  coinBuyMemberEvents: [],
  firstDepositMemberEvents: [],
  withdrawalUsdEvents: [],
  sellUsdEvents: [],
  payUsdEvents: [],
}
const novelViews = new Map()
const novelReviews = new Map()
const novelReplies = new Map()
const novelReviewVotes = new Map()
const novelLikes = new Map()

const READ_RECORDS_CAP = 2000
/** @type {object[]} */
let readRecords = []
const ADMIN_USER = String(process.env.ADMIN_USER || '69KKH')
const ADMIN_PASS = String(process.env.ADMIN_PASS || 'AA112233')
const ADMIN_OTP = String(process.env.ADMIN_OTP || '123456')
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000
const adminSessions = new Map()

function normalizeReviewIn(raw, novelId = '') {
  if (!raw || typeof raw !== 'object') return null
  const scoreRaw = Number(raw.score)
  const score = Number.isFinite(scoreRaw) ? Math.min(10, Math.max(0, scoreRaw)) : 0
  if (score <= 0) return null
  const atRaw = Number(raw.at ?? raw.createdAt ?? raw.time)
  const at = Number.isFinite(atRaw) && atRaw > 0 ? atRaw : now()
  const id = String(raw.id || `rv-${novelId || 'novel'}-${at}-${Math.floor(Math.random() * 100000)}`).slice(0, 120)
  const userIdRaw = Number(raw.userId)
  return {
    id,
    score,
    text: String(raw.text || '').slice(0, 500),
    at,
    userName: String(raw.userName || raw.name || 'A').slice(0, 120),
    userAvatar: raw.userAvatar ?? raw.avatar ?? null,
    userId: Number.isFinite(userIdRaw) ? userIdRaw : undefined,
    memberTier: String(raw.memberTier || '').slice(0, 32),
  }
}

function normalizeReplyIn(raw, novelId = '', commentId = '') {
  if (!raw || typeof raw !== 'object') return null
  const atRaw = Number(raw.at ?? raw.createdAt ?? raw.time)
  const at = Number.isFinite(atRaw) && atRaw > 0 ? atRaw : now()
  const parentCommentId = String(raw.parentCommentId || commentId || '').trim().slice(0, 120)
  if (!parentCommentId) return null
  const id = String(raw.id || `rp-${novelId || 'novel'}-${parentCommentId}-${at}-${Math.floor(Math.random() * 100000)}`).slice(0, 140)
  const userIdRaw = Number(raw.userId)
  return {
    id,
    parentCommentId,
    text: String(raw.text || '').slice(0, 500),
    at,
    userName: String(raw.userName || raw.name || 'A').slice(0, 120),
    userAvatar: raw.userAvatar ?? raw.avatar ?? null,
    userId: Number.isFinite(userIdRaw) ? userIdRaw : undefined,
    memberTier: String(raw.memberTier || '').slice(0, 32),
  }
}

function normalizeVoteEntryIn(raw) {
  const up = Array.isArray(raw?.up) ? raw.up.map((v) => String(v || '').trim()).filter(Boolean) : []
  const down = Array.isArray(raw?.down) ? raw.down.map((v) => String(v || '').trim()).filter(Boolean) : []
  return {
    up: [...new Set(up)],
    down: [...new Set(down)],
  }
}

function normalizeReadRecordIn(raw) {
  if (!raw || typeof raw !== 'object') return null
  const readChapter = String(raw.readChapter || '').slice(0, 250)
  const out = {
    memberName: String(raw.memberName || '').slice(0, 120),
    memberId: String(raw.memberId || '').slice(0, 64),
    memberAccount: String(raw.memberAccount || '').slice(0, 120),
    memberLevel: String(raw.memberLevel || '').slice(0, 64),
    memberOrder: String(raw.memberOrder || '').slice(0, 32),
    shelfTitle: String(raw.shelfTitle || '').slice(0, 200),
    readChapter,
    readAt: String(raw.readAt || '').slice(0, 32),
    ts: Number(raw.ts) && Number.isFinite(Number(raw.ts)) ? Number(raw.ts) : now(),
  }
  if (!out.shelfTitle) return null
  return out
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_FILE = path.join(__dirname, 'presence-data.json')

function loadPersistedMembers() {
  try {
    if (!fs.existsSync(DATA_FILE)) return
    const raw = fs.readFileSync(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    const members = Array.isArray(parsed?.knownMembers) ? parsed.knownMembers : []
    const paid = Array.isArray(parsed?.paidMembers) ? parsed.paidMembers : []
    const firstSeenObj = parsed?.memberFirstSeenAt && typeof parsed.memberFirstSeenAt === 'object'
      ? parsed.memberFirstSeenAt
      : {}
    const paidAtObj = parsed?.memberPaidAt && typeof parsed.memberPaidAt === 'object'
      ? parsed.memberPaidAt
      : {}
    const tx = parsed?.txMetrics && typeof parsed.txMetrics === 'object' ? parsed.txMetrics : {}
    for (const id of members) {
      if (id) knownMembers.add(String(id))
    }
    for (const id of paid) {
      if (id) paidMembers.add(String(id))
    }
    for (const [id, ts] of Object.entries(firstSeenObj)) {
      if (id && Number(ts)) memberFirstSeenAt.set(String(id), Number(ts))
    }
    for (const [id, ts] of Object.entries(paidAtObj)) {
      if (id && Number(ts)) memberPaidAt.set(String(id), Number(ts))
    }
    txMetrics.readEvents = Array.isArray(tx.readEvents) ? tx.readEvents.map(Number).filter(Boolean) : []
    txMetrics.orderEvents = Array.isArray(tx.orderEvents) ? tx.orderEvents.map(Number).filter(Boolean) : []
    txMetrics.successEvents = Array.isArray(tx.successEvents) ? tx.successEvents.map(Number).filter(Boolean) : []
    txMetrics.failedEvents = Array.isArray(tx.failedEvents) ? tx.failedEvents.map(Number).filter(Boolean) : []
    txMetrics.manualEvents = Array.isArray(tx.manualEvents) ? tx.manualEvents.map(Number).filter(Boolean) : []
    txMetrics.coinBuyMemberEvents = Array.isArray(tx.coinBuyMemberEvents)
      ? tx.coinBuyMemberEvents.map(Number).filter(Boolean)
      : []
    txMetrics.firstDepositMemberEvents = Array.isArray(tx.firstDepositMemberEvents)
      ? tx.firstDepositMemberEvents.map(Number).filter(Boolean)
      : []
    txMetrics.withdrawalUsdEvents = Array.isArray(tx.withdrawalUsdEvents)
      ? tx.withdrawalUsdEvents
          .map((e) => ({ ts: Number(e?.ts), amount: Number(e?.amount || 0) }))
          .filter((e) => e.ts && Number.isFinite(e.amount))
      : []
    txMetrics.sellUsdEvents = Array.isArray(tx.sellUsdEvents)
      ? tx.sellUsdEvents
          .map((e) => ({ ts: Number(e?.ts), amount: Number(e?.amount || 0) }))
          .filter((e) => e.ts && Number.isFinite(e.amount))
      : []
    txMetrics.payUsdEvents = Array.isArray(tx.payUsdEvents)
      ? tx.payUsdEvents
          .map((e) => ({ ts: Number(e?.ts), amount: Number(e?.amount || 0) }))
          .filter((e) => e.ts && Number.isFinite(e.amount))
      : []
    const novelViewsObj = parsed?.novelViews && typeof parsed.novelViews === 'object'
      ? parsed.novelViews
      : {}
    for (const [novelId, count] of Object.entries(novelViewsObj)) {
      const n = Number(count)
      if (novelId && Number.isFinite(n) && n >= 0) {
        novelViews.set(String(novelId), Math.floor(n))
      }
    }
    const novelReviewsObj = parsed?.novelReviews && typeof parsed.novelReviews === 'object'
      ? parsed.novelReviews
      : {}
    for (const [novelId, row] of Object.entries(novelReviewsObj)) {
      const items = Array.isArray(row?.items) ? row.items.map((it) => normalizeReviewIn(it, novelId)).filter(Boolean) : []
      novelReviews.set(String(novelId), { items })
    }
    const novelRepliesObj = parsed?.novelReplies && typeof parsed.novelReplies === 'object'
      ? parsed.novelReplies
      : {}
    for (const [novelId, row] of Object.entries(novelRepliesObj)) {
      const items = Array.isArray(row?.items) ? row.items.map((it) => normalizeReplyIn(it, novelId)).filter(Boolean) : []
      novelReplies.set(String(novelId), { items })
    }
    const novelReviewVotesObj = parsed?.novelReviewVotes && typeof parsed.novelReviewVotes === 'object'
      ? parsed.novelReviewVotes
      : {}
    for (const [novelId, row] of Object.entries(novelReviewVotesObj)) {
      const votesRaw = row && typeof row === 'object' ? row : {}
      const votes = Object.fromEntries(
        Object.entries(votesRaw).map(([commentId, voteRow]) => [String(commentId), normalizeVoteEntryIn(voteRow)]),
      )
      novelReviewVotes.set(String(novelId), votes)
    }
    const novelLikesObj = parsed?.novelLikes && typeof parsed.novelLikes === 'object'
      ? parsed.novelLikes
      : {}
    for (const [novelId, row] of Object.entries(novelLikesObj)) {
      const users = Array.isArray(row?.users) ? row.users.map((v) => String(v || '').trim()).filter(Boolean) : []
      novelLikes.set(String(novelId), { users: [...new Set(users)] })
    }
    readRecords = Array.isArray(parsed.readRecords)
      ? parsed.readRecords.map(normalizeReadRecordIn).filter(Boolean)
      : []
    readRecords = readRecords.slice(0, READ_RECORDS_CAP)
  } catch {
    /* ignore corrupted file */
  }
}

function persistMembers() {
  try {
    const payload = JSON.stringify({
      knownMembers: [...knownMembers],
      paidMembers: [...paidMembers],
      memberFirstSeenAt: Object.fromEntries(memberFirstSeenAt),
      memberPaidAt: Object.fromEntries(memberPaidAt),
      txMetrics,
      novelViews: Object.fromEntries(novelViews),
      novelReviews: Object.fromEntries(novelReviews),
      novelReplies: Object.fromEntries(novelReplies),
      novelReviewVotes: Object.fromEntries(novelReviewVotes),
      novelLikes: Object.fromEntries(novelLikes),
      readRecords: readRecords.slice(0, READ_RECORDS_CAP),
    })
    fs.writeFileSync(DATA_FILE, payload, 'utf8')
  } catch {
    /* ignore file system failures */
  }
}

function resolveNovelReviews(novelId) {
  const key = String(novelId || '').trim()
  if (!key) return []
  const row = novelReviews.get(key)
  const items = Array.isArray(row?.items) ? row.items : []
  return items
}

function resolveNovelReplies(novelId) {
  const key = String(novelId || '').trim()
  if (!key) return []
  const row = novelReplies.get(key)
  const items = Array.isArray(row?.items) ? row.items : []
  return items
}

function resolveNovelReviewVotes(novelId) {
  const key = String(novelId || '').trim()
  if (!key) return {}
  const row = novelReviewVotes.get(key)
  return row && typeof row === 'object' ? row : {}
}

function resolveNovelLikeUsers(novelId) {
  const key = String(novelId || '').trim()
  if (!key) return []
  const row = novelLikes.get(key)
  const users = Array.isArray(row?.users) ? row.users : []
  return users
}

function getNovelCommentPoints(novelId) {
  const reviews = resolveNovelReviews(novelId)
  const replies = resolveNovelReplies(novelId)
  return Math.min(100, reviews.length + replies.length)
}

function buildHomeStats() {
  const ids = new Set([
    ...novelViews.keys(),
    ...novelLikes.keys(),
    ...novelReviews.keys(),
    ...novelReplies.keys(),
  ])
  const stats = {}
  for (const id of ids) {
    const novelId = String(id)
    const reviews = resolveNovelReviews(novelId)
    const replies = resolveNovelReplies(novelId)
    const lastReviewAt = reviews.reduce((m, it) => Math.max(m, Number(it?.at || 0)), 0)
    const lastReplyAt = replies.reduce((m, it) => Math.max(m, Number(it?.at || 0)), 0)
    const lastUpdateAtMs = Math.max(lastReviewAt, lastReplyAt)
    const viewCount = resolveNovelViewCount(novelId, 0)
    const favoriteCount = resolveNovelLikeUsers(novelId).length
    const ratingPoints = Math.min(100, reviews.length + replies.length)
    stats[novelId] = { viewCount, favoriteCount, ratingPoints, lastUpdateAtMs }
  }
  return stats
}

function resetInteractionData() {
  txMetrics.readEvents = []
  txMetrics.orderEvents = []
  txMetrics.successEvents = []
  txMetrics.failedEvents = []
  txMetrics.manualEvents = []
  txMetrics.coinBuyMemberEvents = []
  txMetrics.firstDepositMemberEvents = []
  txMetrics.withdrawalUsdEvents = []
  txMetrics.sellUsdEvents = []
  txMetrics.payUsdEvents = []
  novelViews.clear()
  novelReviews.clear()
  novelReplies.clear()
  novelReviewVotes.clear()
  novelLikes.clear()
  readRecords = []
  persistMembers()
}

function resolveNovelViewCount(novelId, baseCount = 0) {
  const key = String(novelId || '').trim()
  if (!key) return 0
  const base = Number(baseCount)
  const safeBase = Number.isFinite(base) && base >= 0 ? Math.floor(base) : 0
  const existing = novelViews.get(key)
  if (Number.isFinite(existing) && existing >= 0) return existing
  novelViews.set(key, safeBase)
  persistMembers()
  return safeBase
}

function now() {
  return Date.now()
}

function toUsdFromRiel(rielAmount) {
  const riel = Number(rielAmount || 0)
  if (!Number.isFinite(riel) || riel <= 0) return 0
  return riel / RIEL_PER_USD
}

function getSettlementStartMs(nowMs = Date.now()) {
  const tzOffsetMs = PHNOM_PENH_UTC_OFFSET_HOURS * 60 * 60 * 1000
  const shifted = new Date(nowMs + tzOffsetMs)
  const y = shifted.getUTCFullYear()
  const m = shifted.getUTCMonth()
  const d = shifted.getUTCDate()

  // 先取 Phnom Penh 当天 00:00，再加上 09:00 结算点，最后转回 UTC 毫秒
  const localDayStartMs = Date.UTC(y, m, d, 0, 0, 0, 0)
  const settlementLocalMs = localDayStartMs + PHNOM_PENH_SETTLEMENT_HOUR * 60 * 60 * 1000
  const settlementUtcMs = settlementLocalMs - tzOffsetMs

  // 若当前时间早于今天 09:00（柬时），则归到昨天 09:00 起算
  return nowMs >= settlementUtcMs ? settlementUtcMs : settlementUtcMs - 24 * 60 * 60 * 1000
}

function getSettlementRangeByDate(dateText) {
  const text = String(dateText || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const [y, m, d] = text.split('-').map(Number)
  if (!y || !m || !d) return null
  const tzOffsetMs = PHNOM_PENH_UTC_OFFSET_HOURS * 60 * 60 * 1000
  // dateText 视为 Phnom Penh 本地日期，当天结算点是 09:00
  const localSettlementMs = Date.UTC(y, m - 1, d, PHNOM_PENH_SETTLEMENT_HOUR, 0, 0, 0)
  const startMs = localSettlementMs - tzOffsetMs
  const endMs = startMs + 24 * 60 * 60 * 1000
  return { startMs, endMs }
}

/** 解析 `YYYY-MM-DD HH:mm:ss` 为 UTC 毫秒（与 getSettlementRangeByDate 相同：按柬时墙钟再减偏移） */
function parsePhnomPenhLocalDateTime(text) {
  const m = String(text || '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const hh = Number(m[4])
  const mi = Number(m[5])
  const ss = Number(m[6])
  if (![y, mo, d, hh, mi, ss].every((n) => Number.isFinite(n))) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mi > 59 || ss > 59) return null
  const tzOffsetMs = PHNOM_PENH_UTC_OFFSET_HOURS * 60 * 60 * 1000
  const localMs = Date.UTC(y, mo - 1, d, hh, mi, ss, 0)
  return localMs - tzOffsetMs
}

function prune() {
  const threshold = now() - ONLINE_WINDOW_MS
  for (const [key, rec] of records.entries()) {
    if (Number(rec?.lastSeenAt || 0) < threshold) records.delete(key)
  }
}

function normalizeDevice(input) {
  const v = String(input || '').toLowerCase()
  if (v === 'android') return 'android'
  if (v === 'ios') return 'ios'
  return 'web'
}

function makeCounts(rangeStartMs, rangeEndMs) {
  prune()
  const periodStartMs = Number.isFinite(rangeStartMs) ? rangeStartMs : getSettlementStartMs(now())
  const periodEndMs = Number.isFinite(rangeEndMs) ? rangeEndMs : periodStartMs + 24 * 60 * 60 * 1000

  let android = 0
  let ios = 0
  let web = 0
  let admin = 0
  let registeredToday = 0
  let paidToday = 0

  const inRange = (ts) => Number(ts) >= periodStartMs && Number(ts) < periodEndMs
  const toTodayCount = (arr) => arr.filter((ts) => inRange(ts)).length
  const toTodayUsd = (arr) =>
    arr.reduce((sum, e) => (inRange(e?.ts) ? sum + Number(e?.amount || 0) : sum), 0)
  const orderToday = toTodayCount(txMetrics.orderEvents)
  const successToday = toTodayCount(txMetrics.successEvents)
  const failedToday = toTodayCount(txMetrics.failedEvents)
  const manualToday = toTodayCount(txMetrics.manualEvents)
  const readToday = toTodayCount(txMetrics.readEvents)
  const coinBuyMemberToday = toTodayCount(txMetrics.coinBuyMemberEvents)
  const firstDepositMemberToday = toTodayCount(txMetrics.firstDepositMemberEvents)
  const withdrawalUsdToday = toTodayUsd(txMetrics.withdrawalUsdEvents)
  const sellUsdToday = toTodayUsd(txMetrics.sellUsdEvents)
  const payUsdToday = toTodayUsd(txMetrics.payUsdEvents)

  for (const ts of memberFirstSeenAt.values()) {
    if (inRange(ts)) registeredToday += 1
  }
  for (const ts of memberPaidAt.values()) {
    if (inRange(ts)) paidToday += 1
  }

  for (const rec of records.values()) {
    // 同一 member 只计入一个桶：后台优先，其次设备端
    if (rec.isAdmin) {
      admin += 1
      continue
    }
    if (rec.device === 'android') android += 1
    else if (rec.device === 'ios') ios += 1
    else web += 1
  }
  return {
    android,
    ios,
    web,
    admin,
    registeredTotal: knownMembers.size,
    paidTotal: paidMembers.size,
    registeredToday,
    paidToday,
    readToday,
    orderToday,
    successToday,
    failedToday,
    manualToday,
    coinBuyMemberToday,
    firstDepositMemberToday,
    withdrawalUsdToday,
    payoutSuccessUsdToday: withdrawalUsdToday,
    sellUsdToday,
    payUsdToday,
    orderTotal: txMetrics.orderEvents.length,
    successTotal: txMetrics.successEvents.length,
    failedTotal: txMetrics.failedEvents.length,
    manualTotal: txMetrics.manualEvents.length,
    readTotal: txMetrics.readEvents.length,
    payoutSuccessUsdTotal: txMetrics.withdrawalUsdEvents.reduce((sum, e) => sum + Number(e?.amount || 0), 0),
  }
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 1024 * 64) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

function sendJson(res, code, payload) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(payload))
}

function extractBearerToken(req) {
  const raw = String(req.headers.authorization || '')
  const m = raw.match(/^Bearer\s+(.+)$/i)
  return m ? String(m[1]).trim() : ''
}

function pruneAdminSessions() {
  const t = now()
  for (const [token, rec] of adminSessions.entries()) {
    if (!rec || Number(rec.expiresAt) <= t) adminSessions.delete(token)
  }
}

function isAdminTokenValid(token) {
  if (!token) return false
  pruneAdminSessions()
  const rec = adminSessions.get(token)
  return Boolean(rec && Number(rec.expiresAt) > now())
}

function getAdminSession(token) {
  if (!token) return null
  pruneAdminSessions()
  const rec = adminSessions.get(token)
  if (!rec || Number(rec.expiresAt) <= now()) return null
  return rec
}

function requireAdmin(req, res) {
  const token = extractBearerToken(req)
  if (!isAdminTokenValid(token)) {
    sendJson(res, 401, { ok: false, error: 'admin unauthorized' })
    return null
  }
  return token
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (req.method === 'OPTIONS') return sendJson(res, 204, {})

  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    const body = await parseJsonBody(req)
    const username = String(body.username || '').trim()
    const password = String(body.password || '').trim()
    const otp = String(body.otp || '').trim()
    if (!username || !password || !otp) {
      return sendJson(res, 400, { ok: false, error: 'username/password/otp required' })
    }
    if (username !== ADMIN_USER || password !== ADMIN_PASS || otp !== ADMIN_OTP) {
      return sendJson(res, 401, { ok: false, error: '账号、密码或动态码错误' })
    }
    const token = crypto.randomBytes(24).toString('hex')
    adminSessions.set(token, { username, createdAt: now(), expiresAt: now() + ADMIN_TOKEN_TTL_MS })
    return sendJson(res, 200, { ok: true, token, username, expiresInMs: ADMIN_TOKEN_TTL_MS })
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/session') {
    const token = extractBearerToken(req)
    const session = getAdminSession(token)
    if (!session) return sendJson(res, 401, { ok: false, error: 'admin unauthorized' })
    return sendJson(res, 200, { ok: true, username: String(session.username || ADMIN_USER) })
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
    const token = extractBearerToken(req)
    if (token) adminSessions.delete(token)
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url.pathname === '/api/presence/ping') {
    const body = await parseJsonBody(req)
    const memberId = String(body.memberId || '').trim()
    if (!memberId) return sendJson(res, 400, { ok: false, error: 'memberId required' })
    const device = normalizeDevice(body.device)
    const isAdmin = Boolean(body.isAdmin)
    if (!knownMembers.has(memberId)) {
      knownMembers.add(memberId)
      memberFirstSeenAt.set(memberId, now())
      persistMembers()
    }
    if (body.paidSuccess && !paidMembers.has(memberId)) {
      paidMembers.add(memberId)
      memberPaidAt.set(memberId, now())
      persistMembers()
    }
    records.set(memberId, { device, isAdmin, lastSeenAt: now() })
    return sendJson(res, 200, { ok: true, counts: makeCounts() })
  }

  if (req.method === 'POST' && url.pathname === '/api/presence/payment-success') {
    const body = await parseJsonBody(req)
    const memberId = String(body.memberId || '').trim()
    if (!memberId) return sendJson(res, 400, { ok: false, error: 'memberId required' })
    if (!knownMembers.has(memberId)) {
      knownMembers.add(memberId)
      memberFirstSeenAt.set(memberId, now())
    }
    if (!paidMembers.has(memberId)) {
      paidMembers.add(memberId)
      memberPaidAt.set(memberId, now())
    }
    persistMembers()
    return sendJson(res, 200, { ok: true, counts: makeCounts() })
  }

  if (req.method === 'POST' && url.pathname === '/api/metrics/tx-event') {
    const body = await parseJsonBody(req)
    const eventType = String(body.type || '').toLowerCase()
    const ts = now()
    if (eventType === 'read') txMetrics.readEvents.push(ts)
    else if (eventType === 'order') txMetrics.orderEvents.push(ts)
    else if (eventType === 'success') txMetrics.successEvents.push(ts)
    else if (eventType === 'failed') txMetrics.failedEvents.push(ts)
    else if (eventType === 'manual') txMetrics.manualEvents.push(ts)
    else if (eventType === 'coinbuymember' || eventType === 'coin-buy-member') txMetrics.coinBuyMemberEvents.push(ts)
    else if (eventType === 'firstdepositmember' || eventType === 'first-deposit-member') {
      txMetrics.firstDepositMemberEvents.push(ts)
    } else if (
      eventType === 'withdrawalusd' ||
      eventType === 'withdrawal-usd' ||
      eventType === 'withdrawal-success-usd' ||
      eventType === 'payout-success-usd'
    ) {
      txMetrics.withdrawalUsdEvents.push({ ts, amount: Number(body.amount || 0) })
    } else if (eventType === 'sellusd' || eventType === 'sell-usd') {
      txMetrics.sellUsdEvents.push({ ts, amount: Number(body.amount || 0) })
    } else if (eventType === 'coin-order' || eventType === 'coin-order-success') {
      const status = String(body.status || '').toLowerCase()
      // 仅“成功交易”累计
      if (status !== 'success' && status !== 'completed') {
        return sendJson(res, 200, { ok: true, ignored: true, reason: 'order not successful', counts: makeCounts() })
      }
      const coins = Number(body.coins || 0)
      const rielAmount = Number(body.rielAmount || coins * COIN_TO_RIEL)
      const usd = toUsdFromRiel(rielAmount)
      txMetrics.sellUsdEvents.push({ ts, amount: usd })
    } else if (
      eventType === 'payusd' ||
      eventType === 'pay-usd' ||
      eventType === 'vip-order-success-usd' ||
      eventType === 'vip-package-success-usd'
    ) {
      const status = String(body.status || '').toLowerCase()
      // 第三行第5卡：仅“系统审核成功”的VIP付费订单累计（美金直累加）
      if (status && status !== 'success' && status !== 'completed') {
        return sendJson(res, 200, { ok: true, ignored: true, reason: 'vip order not successful', counts: makeCounts() })
      }
      const amount = Number(body.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) {
        return sendJson(res, 400, { ok: false, error: 'amount must be positive usd number' })
      }
      txMetrics.payUsdEvents.push({ ts, amount })
    }
    else return sendJson(res, 400, { ok: false, error: 'invalid type' })
    persistMembers()
    return sendJson(res, 200, { ok: true, counts: makeCounts() })
  }

  if (req.method === 'POST' && url.pathname === '/api/reading-records/append') {
    const body = await parseJsonBody(req)
    const rec = normalizeReadRecordIn(body)
    if (!rec) return sendJson(res, 400, { ok: false, error: 'invalid record' })
    readRecords.unshift(rec)
    readRecords = readRecords.slice(0, READ_RECORDS_CAP)
    persistMembers()
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'GET' && url.pathname === '/api/reviews') {
    const novelId = String(url.searchParams.get('novelId') || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const votes = resolveNovelReviewVotes(novelId)
    const items = resolveNovelReviews(novelId)
      .slice()
      .sort((a, b) => Number(b?.at || 0) - Number(a?.at || 0))
      .map((it) => {
        const voteRow = normalizeVoteEntryIn(votes[String(it.id)] || {})
        return {
          ...it,
          likes: voteRow.up.length,
          dislikes: voteRow.down.length,
        }
      })
    return sendJson(res, 200, { ok: true, novelId, items })
  }

  if (req.method === 'POST' && url.pathname === '/api/reviews/append') {
    const body = await parseJsonBody(req)
    const novelId = String(body.novelId || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const item = normalizeReviewIn(body.entry ?? body, novelId)
    if (!item) return sendJson(res, 400, { ok: false, error: 'invalid review entry' })
    const items = resolveNovelReviews(novelId).slice()
    items.push(item)
    novelReviews.set(novelId, { items })
    persistMembers()
    return sendJson(res, 200, { ok: true, novelId, item })
  }

  if (req.method === 'POST' && url.pathname === '/api/reviews/vote') {
    const body = await parseJsonBody(req)
    const novelId = String(body.novelId || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const commentId = String(body.commentId || '').trim()
    if (!commentId) return sendJson(res, 400, { ok: false, error: 'commentId required' })
    const voterId = String(body.voterId || '').trim()
    if (!voterId) return sendJson(res, 400, { ok: false, error: 'voterId required' })
    const action = String(body.action || '').toLowerCase()
    if (action !== 'up' && action !== 'down' && action !== 'clear') {
      return sendJson(res, 400, { ok: false, error: 'action must be up/down/clear' })
    }
    const allVotes = { ...resolveNovelReviewVotes(novelId) }
    const voteRow = normalizeVoteEntryIn(allVotes[commentId] || {})
    const upSet = new Set(voteRow.up)
    const downSet = new Set(voteRow.down)
    upSet.delete(voterId)
    downSet.delete(voterId)
    if (action === 'up') upSet.add(voterId)
    if (action === 'down') downSet.add(voterId)
    allVotes[commentId] = { up: [...upSet], down: [...downSet] }
    novelReviewVotes.set(novelId, allVotes)
    persistMembers()
    return sendJson(res, 200, {
      ok: true,
      novelId,
      commentId,
      likes: upSet.size,
      dislikes: downSet.size,
    })
  }

  if (req.method === 'GET' && url.pathname === '/api/novel-likes') {
    const novelId = String(url.searchParams.get('novelId') || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const userId = String(url.searchParams.get('userId') || '').trim()
    const users = resolveNovelLikeUsers(novelId)
    const count = users.length
    const liked = userId ? users.includes(userId) : false
    return sendJson(res, 200, { ok: true, novelId, count, liked })
  }

  if (req.method === 'POST' && url.pathname === '/api/novel-likes/toggle') {
    const body = await parseJsonBody(req)
    const novelId = String(body.novelId || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const userId = String(body.userId || '').trim()
    if (!userId) return sendJson(res, 400, { ok: false, error: 'userId required' })
    const shouldLike = Boolean(body.like)
    const users = new Set(resolveNovelLikeUsers(novelId))
    if (shouldLike) users.add(userId)
    else users.delete(userId)
    novelLikes.set(novelId, { users: [...users] })
    persistMembers()
    return sendJson(res, 200, { ok: true, novelId, count: users.size, liked: shouldLike })
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/reset-interactions') {
    if (!requireAdmin(req, res)) return
    resetInteractionData()
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'GET' && url.pathname === '/api/home-stats') {
    return sendJson(res, 200, { ok: true, items: buildHomeStats() })
  }

  if (req.method === 'GET' && url.pathname === '/api/replies') {
    const novelId = String(url.searchParams.get('novelId') || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const parentCommentId = String(url.searchParams.get('parentCommentId') || '').trim()
    const all = resolveNovelReplies(novelId).slice()
    const items = parentCommentId
      ? all.filter((it) => String(it?.parentCommentId || '') === parentCommentId)
      : all
    items.sort((a, b) => Number(a?.at || 0) - Number(b?.at || 0))
    return sendJson(res, 200, { ok: true, novelId, items })
  }

  if (req.method === 'POST' && url.pathname === '/api/replies/append') {
    const body = await parseJsonBody(req)
    const novelId = String(body.novelId || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const parentCommentId = String(body.parentCommentId || body.entry?.parentCommentId || '').trim()
    if (!parentCommentId) return sendJson(res, 400, { ok: false, error: 'parentCommentId required' })
    const item = normalizeReplyIn(body.entry ?? body, novelId, parentCommentId)
    if (!item) return sendJson(res, 400, { ok: false, error: 'invalid reply entry' })
    const items = resolveNovelReplies(novelId).slice()
    items.push(item)
    novelReplies.set(novelId, { items })
    persistMembers()
    return sendJson(res, 200, { ok: true, novelId, item })
  }

  if (req.method === 'GET' && url.pathname === '/api/novel-views') {
    const novelId = String(url.searchParams.get('novelId') || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const baseCount = Number(url.searchParams.get('base') || 0)
    const count = resolveNovelViewCount(novelId, baseCount)
    return sendJson(res, 200, { ok: true, novelId, count })
  }

  if (req.method === 'POST' && url.pathname === '/api/novel-views/increment') {
    const body = await parseJsonBody(req)
    const novelId = String(body.novelId || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const baseCount = Number(body.baseCount || 0)
    const deltaRaw = Number(body.delta || 1)
    const delta = Number.isFinite(deltaRaw) && deltaRaw > 0 ? Math.floor(deltaRaw) : 1
    const current = resolveNovelViewCount(novelId, baseCount)
    const next = current + delta
    novelViews.set(novelId, next)
    persistMembers()
    return sendJson(res, 200, { ok: true, novelId, count: next })
  }

  if (req.method === 'GET' && url.pathname === '/api/reading-records') {
    if (!requireAdmin(req, res)) return
    return sendJson(res, 200, { ok: true, items: readRecords })
  }

  if (req.method === 'GET' && url.pathname === '/api/presence/online') {
    const dateText = url.searchParams.get('date')
    const startQ = url.searchParams.get('start')
    const endQ = url.searchParams.get('end')
    let range = null
    if (startQ && endQ) {
      const t0 = parsePhnomPenhLocalDateTime(String(startQ))
      const t1 = parsePhnomPenhLocalDateTime(String(endQ))
      if (t0 != null && t1 != null) {
        const lo = Math.min(t0, t1)
        const hi = Math.max(t0, t1)
        const endMs = hi + 1000
        range = { startMs: lo, endMs: endMs > lo ? endMs : lo + 1000 }
      }
    }
    if (!range && dateText) {
      range = getSettlementRangeByDate(dateText)
    }
    const counts = range ? makeCounts(range.startMs, range.endMs) : makeCounts()
    return sendJson(res, 200, {
      ok: true,
      counts,
      windowMs: ONLINE_WINDOW_MS,
      period: range || null,
    })
  }

  return sendJson(res, 404, { ok: false, error: 'not found' })
})

loadPersistedMembers()
server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[presence] listening at http://${HOST}:${PORT}`)
})
