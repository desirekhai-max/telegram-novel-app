import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  buildPurchaseFormFields,
  buildVipTranId,
  checkPayWayTransaction,
  getPayWayCheckoutUrl,
  isPayWayConfigured,
  parseUsdAmountFromLabel,
} from './payway.js'
import { buildPayWayCustomFields, getNeutralVipOrderProductLabel } from './paywayNeutralCopy.js'
import { filterCheckoutFormFieldsForClient, stripSensitivePaymentFields } from './payway-security.js'
import { PERSISTENT_DATA_DIR } from './persistent-data-dir.js'
import { runAllLegacyMigrations, getLastMigrationResults, isVolumeConfigured } from './migrate-legacy-persistent.js'
import {
  initNovelsStore,
  getNovelsDataFilePath,
  getNovelsCount,
  getNovelsCatalogPayload,
  getNovelById as getStoredNovelById,
  listNovelsAdmin,
  createNovel,
  updateNovel,
  deleteNovel as deleteStoredNovel,
  listChaptersAdmin,
  createChapter,
  updateChapter,
  deleteChapter,
  listNovelTitles,
} from './novels-store.js'
import {
  initNovelCoverUpload,
  COVERS_DIR,
  saveCoverImage,
  deleteManagedCoverFile,
  serveNovelCoverFile,
  readJsonBody as readCoverJsonBody,
} from './novel-cover-upload.js'
import {
  initAppFiltersStore,
  getAdminAppFiltersPayload,
  saveAppFilterSection,
  buildPublicAppFilters,
} from './app-filters-store.js'

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
const memberRegisterIp = new Map()
const memberRegisterGeo = new Map()
const memberLastLoginIp = new Map()
const memberLastLoginGeo = new Map()
const memberLastLoginAt = new Map()
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
const novelReviewVoteProfiles = new Map()
const novelLikes = new Map()
const novelFavorites = new Map()
const novelReports = new Map()
const memberProfiles = new Map()
const vipOrdersByUser = new Map()
const pendingVipOrdersByTranId = new Map()
const fulfilledVipTranIds = new Set()
const APP_PUBLIC_URL = String(
  process.env.PAYWAY_APP_PUBLIC_URL
  || process.env.APP_PUBLIC_URL
  || process.env.FRONTEND_URL
  || 'https://statuesque-scone-309617.netlify.app',
).trim().replace(/\/+$/, '')

const READ_RECORDS_CAP = 2000
const READ_RECORD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
/** @type {object[]} */
let readRecords = []
const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim()
const ADMIN_USER = String(process.env.ADMIN_USER || '69KKH')
const ADMIN_PASS = String(process.env.ADMIN_PASS || 'AA112233')
const ADMIN_OTP_SECRET = String(process.env.ADMIN_OTP_SECRET || '').trim()
const ADMIN_LEGACY_USER = String(process.env.ADMIN_LEGACY_USER || 'admin')
const ADMIN_LEGACY_PASS = String(process.env.ADMIN_LEGACY_PASS || 'admin123')
const ADMIN_LEGACY_OTP = String(process.env.ADMIN_LEGACY_OTP || '123456')
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000
const adminSessions = new Map()
const adminLegacySessions = new Map()

function decodeBase32Secret(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = String(secret || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/\s+/g, '')
  let bits = ''
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch)
    if (idx < 0) return null
    bits += idx.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

function buildTotpCode(secretBuf, counter) {
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeBigUInt64BE(BigInt(counter))
  const hash = crypto.createHmac('sha1', secretBuf).update(counterBuf).digest()
  const offset = hash[hash.length - 1] & 0x0f
  const binCode = ((hash[offset] & 0x7f) << 24)
    | ((hash[offset + 1] & 0xff) << 16)
    | ((hash[offset + 2] & 0xff) << 8)
    | (hash[offset + 3] & 0xff)
  return String(binCode % 1_000_000).padStart(6, '0')
}

function verifyAdminOtp(code) {
  const otp = String(code || '').trim()
  if (!otp) return false

  if (!ADMIN_OTP_SECRET) return false

  const secretBuf = decodeBase32Secret(ADMIN_OTP_SECRET)
  if (!secretBuf || secretBuf.length === 0) return false
  const currentCounter = Math.floor(now() / 1000 / 30)
  for (let step = -1; step <= 1; step += 1) {
    if (buildTotpCode(secretBuf, currentCounter + step) === otp) return true
  }
  return false
}

function verifyAdminPassword(password) {
  const inputPassword = String(password || '')
  if (!inputPassword) return false
  return inputPassword === ADMIN_PASS
}

function normalizeTelegramUserIdIn(raw) {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) return Math.floor(n)
  const s = String(raw).trim()
  const m = s.match(/^tg_(\d+)$/i)
  if (m) {
    const id = Number(m[1])
    return Number.isFinite(id) && id > 0 ? Math.floor(id) : null
  }
  if (/^\d+$/.test(s)) {
    const id = Number(s)
    return Number.isFinite(id) && id > 0 ? Math.floor(id) : null
  }
  return null
}

function normalizeReviewIn(raw, novelId = '') {
  if (!raw || typeof raw !== 'object') return null
  const scoreRaw = Number(raw.score)
  const score = Number.isFinite(scoreRaw) ? Math.min(10, Math.max(0, scoreRaw)) : 0
  if (score <= 0) return null
  const atRaw = Number(raw.at ?? raw.createdAt ?? raw.time)
  const at = Number.isFinite(atRaw) && atRaw > 0 ? atRaw : now()
  const id = String(raw.id || `rv-${novelId || 'novel'}-${at}-${Math.floor(Math.random() * 100000)}`).slice(0, 120)
  const userIdNorm = normalizeTelegramUserIdIn(raw.userId)
  const memberRole = normalizeViewerSnapshotRole(raw.memberRole, raw.memberTier)
  const vipActive = normalizeViewerSnapshotVipActive(raw.vipActive, raw.memberTier)
  return {
    id,
    score,
    text: String(raw.text || '').slice(0, 500),
    at,
    userName: String(raw.userName || raw.name || 'A').slice(0, 120),
    userAvatar: raw.userAvatar ?? raw.avatar ?? null,
    userId: userIdNorm ?? undefined,
    memberTier: deriveViewerBadgeTier(memberRole, vipActive),
    memberRole,
    vipActive,
  }
}

function enrichReplyNotificationTargets(item, novelId) {
  if (!item) return item
  const parentReplyId = String(item.parentReplyId || '').trim()
  if (!parentReplyId) return item
  const parent = resolveNovelReplies(novelId).find((row) => String(row?.id || '') === parentReplyId)
  if (!parent) return item
  if (!item.replyToUserId && parent.userId) item.replyToUserId = parent.userId
  const parentName = String(parent.userName || '').trim()
  if (!String(item.replyToName || '').trim() && parentName) item.replyToName = parentName
  return item
}

function normalizeReplyIn(raw, novelId = '', commentId = '') {
  if (!raw || typeof raw !== 'object') return null
  const atRaw = Number(raw.at ?? raw.createdAt ?? raw.time)
  const at = Number.isFinite(atRaw) && atRaw > 0 ? atRaw : now()
  const parentCommentId = String(raw.parentCommentId || commentId || '').trim().slice(0, 120)
  if (!parentCommentId) return null
  const parentReplyId = String(raw.parentReplyId || '').trim().slice(0, 140)
  const id = String(raw.id || `rp-${novelId || 'novel'}-${parentCommentId}-${at}-${Math.floor(Math.random() * 100000)}`).slice(0, 140)
  const userIdNorm = normalizeTelegramUserIdIn(raw.userId)
  const replyToUserIdNorm = normalizeTelegramUserIdIn(raw.replyToUserId)
  const memberRole = normalizeViewerSnapshotRole(raw.memberRole, raw.memberTier)
  const vipActive = normalizeViewerSnapshotVipActive(raw.vipActive, raw.memberTier)
  return {
    id,
    parentCommentId,
    parentReplyId,
    text: String(raw.text || '').slice(0, 500),
    replyToName: String(raw.replyToName || '').slice(0, 120),
    replyToUserId: replyToUserIdNorm ?? undefined,
    at,
    userName: String(raw.userName || raw.name || 'A').slice(0, 120),
    userAvatar: raw.userAvatar ?? raw.avatar ?? null,
    userId: userIdNorm ?? undefined,
    memberTier: deriveViewerBadgeTier(memberRole, vipActive),
    memberRole,
    vipActive,
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

function normalizeReportIn(raw, novelId = '') {
  if (!raw || typeof raw !== 'object') return null
  const text = String(raw.text || '').trim().slice(0, 500)
  if (!text) return null
  const atRaw = Number(raw.at ?? raw.createdAt ?? raw.time)
  const at = Number.isFinite(atRaw) && atRaw > 0 ? atRaw : now()
  const id = String(raw.id || `rpt-${novelId || 'novel'}-${at}-${Math.floor(Math.random() * 100000)}`).slice(0, 120)
  const userIdRaw = String(raw.userId ?? '').trim()
  const memberRole = normalizeViewerSnapshotRole(raw.memberRole, raw.memberTier)
  const vipActive = normalizeViewerSnapshotVipActive(raw.vipActive, raw.memberTier)
  return {
    id,
    text,
    at,
    novelTitle: String(raw.novelTitle || '').slice(0, 200),
    userName: String(raw.userName || raw.name || 'A').slice(0, 120),
    userAvatar: raw.userAvatar ?? raw.avatar ?? null,
    userId: userIdRaw || undefined,
    memberTier: deriveViewerBadgeTier(memberRole, vipActive),
    memberRole,
    vipActive,
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

function pruneExpiredReadRecords(nowMs = now()) {
  const threshold = Number(nowMs) - READ_RECORD_RETENTION_MS
  readRecords = readRecords.filter((it) => Number(it?.ts || 0) >= threshold)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_FILE = path.join(PERSISTENT_DATA_DIR, 'presence-data.json')

function normalizeTelegramUserId(raw) {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? String(Math.trunc(n)) : ''
}

function normalizeViewerRole(raw) {
  return String(raw || '').toLowerCase().trim() === 'author' ? 'author' : 'normal'
}

function normalizeViewerBadgeTier(raw) {
  const s = String(raw || '').toLowerCase().trim()
  if (s === 'author') return 'author'
  if (s === 'vip' || s === 'paid_vip') return 'vip'
  return 'normal'
}

function normalizeViewerSnapshotRole(raw, fallbackTier = '') {
  const role = normalizeViewerRole(raw)
  if (role === 'author') return 'author'
  return normalizeViewerBadgeTier(fallbackTier) === 'author' ? 'author' : 'normal'
}

function normalizeViewerSnapshotVipActive(raw, fallbackTier = '') {
  if (raw === true) return true
  return normalizeViewerBadgeTier(fallbackTier) === 'vip'
}

function deriveViewerBadgeTier(role, vipActive) {
  if (vipActive) return 'vip'
  return normalizeViewerRole(role) === 'author' ? 'author' : 'normal'
}

function formatOrderTime(ms) {
  const d = new Date(ms)
  const pad2 = (n) => String(Math.trunc(n)).padStart(2, '0')
  const y = d.getFullYear()
  const mo = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const h = pad2(d.getHours())
  const mi = pad2(d.getMinutes())
  const s = pad2(d.getSeconds())
  return `${y}-${mo}-${day} ${h}:${mi}:${s}`
}

function buildVipOrderId(nowMs, seq) {
  const d = new Date(nowMs)
  const pad2 = (n) => String(Math.trunc(n)).padStart(2, '0')
  const y = d.getFullYear()
  const mo = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const h = pad2(d.getHours())
  const mi = pad2(d.getMinutes())
  const s = pad2(d.getSeconds())
  return `VIP${y}${mo}${day}${h}${mi}${s}${String(Math.max(0, seq)).padStart(3, '0')}`
}

function readAuthorTelegramIdsFromNovelsFile() {
  try {
    const novelsPath = path.join(__dirname, '..', 'src', 'data', 'novels.js')
    if (!fs.existsSync(novelsPath)) return new Set()
    const text = fs.readFileSync(novelsPath, 'utf8')
    const out = new Set()
    const sectionPattern = /authorTelegramIds\s*:\s*\[([^\]]*)\]/g
    for (const match of text.matchAll(sectionPattern)) {
      const body = String(match?.[1] || '')
      const itemPattern = /'([^']+)'|"([^"]+)"|(\d+)/g
      for (const item of body.matchAll(itemPattern)) {
        const id = String(item?.[1] || item?.[2] || item?.[3] || '').trim()
        if (/^\d+$/.test(id)) out.add(id)
      }
    }
    return out
  } catch {
    return new Set()
  }
}

const authorTelegramIds = readAuthorTelegramIdsFromNovelsFile()

function resolveViewerRoleByTelegramUserId(telegramUserId, existingRole = 'normal') {
  const id = normalizeTelegramUserId(telegramUserId)
  if (!id) return 'normal'
  if (normalizeViewerRole(existingRole) === 'author') return 'author'
  return authorTelegramIds.has(id) ? 'author' : 'normal'
}

function normalizeMemberProfileIn(raw, telegramUserIdHint = '') {
  const telegramUserId = normalizeTelegramUserId(raw?.telegramUserId || telegramUserIdHint)
  if (!telegramUserId) return null
  const vipExpireAtMs = Number(raw?.vipExpireAtMs || 0)
  const createdAt = Number(raw?.createdAt || 0) || now()
  const updatedAt = Number(raw?.updatedAt || 0) || createdAt
  const role = resolveViewerRoleByTelegramUserId(telegramUserId, raw?.role)
  return {
    telegramUserId,
    memberId: `tg_${telegramUserId}`,
    username: String(raw?.username || '').trim().slice(0, 120),
    displayName: String(raw?.displayName || '').trim().slice(0, 160),
    photoUrl: raw?.photoUrl != null ? String(raw.photoUrl).slice(0, 500) : '',
    languageCode: String(raw?.languageCode || '').trim().slice(0, 32),
    role,
    vipExpireAtMs: Number.isFinite(vipExpireAtMs) && vipExpireAtMs > 0 ? Math.floor(vipExpireAtMs) : 0,
    createdAt,
    updatedAt,
    lastSeenAt: Number(raw?.lastSeenAt || 0) || updatedAt,
    authVerified: raw?.authVerified === true,
    authMode: String(raw?.authMode || '').trim().slice(0, 64),
  }
}

function normalizeVipOrderIn(raw) {
  const id = String(raw?.id || '').trim().slice(0, 120)
  if (!id) return null
  const atMs = Number(raw?.atMs || 0) || now()
  return {
    id,
    planId: String(raw?.planId || '').trim().slice(0, 80),
    amount: String(raw?.amount || '$0').trim().slice(0, 40),
    status: String(raw?.status || 'success').trim().slice(0, 40),
    statusLabel: String(raw?.statusLabel || 'បង់ប្រាក់ជោគជ័យ').trim().slice(0, 120),
    time: String(raw?.time || formatOrderTime(atMs)).trim().slice(0, 40),
    atMs,
    product: String(raw?.product || '').trim().slice(0, 180),
    audience: normalizeViewerRole(raw?.audience),
    durationHours: Math.max(0, Number(raw?.durationHours || 0)),
    priceUsdLabel: String(raw?.priceUsdLabel || '').trim().slice(0, 40),
  }
}

function parseTelegramUserFromInitData(initDataRaw) {
  const raw = String(initDataRaw || '').trim()
  if (!raw) return null
  try {
    const params = new URLSearchParams(raw)
    const userJson = String(params.get('user') || '').trim()
    if (!userJson) return null
    const parsed = JSON.parse(userJson)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function verifyTelegramInitData(initDataRaw) {
  const raw = String(initDataRaw || '').trim()
  if (!raw || !TELEGRAM_BOT_TOKEN) return { ok: false, reason: raw ? 'bot_token_missing' : 'init_data_missing', user: null }
  try {
    const params = new URLSearchParams(raw)
    const receivedHash = String(params.get('hash') || '').trim().toLowerCase()
    if (!receivedHash) return { ok: false, reason: 'hash_missing', user: null }
    const authDate = Number(params.get('auth_date') || 0)
    if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, reason: 'auth_date_invalid', user: null }
    const dataCheckString = [...params.entries()]
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
    const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest()
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
    if (expectedHash !== receivedHash) return { ok: false, reason: 'hash_mismatch', user: null }
    return { ok: true, reason: 'verified', user: parseTelegramUserFromInitData(raw) }
  } catch {
    return { ok: false, reason: 'verify_failed', user: null }
  }
}

function normalizeTelegramUserIn(raw) {
  const telegramUserId = normalizeTelegramUserId(raw?.telegramUserId || raw?.id)
  if (!telegramUserId) return null
  const firstName = String(raw?.first_name || raw?.firstName || '').trim().slice(0, 120)
  const lastName = String(raw?.last_name || raw?.lastName || '').trim().slice(0, 120)
  const username = String(raw?.username || '').trim().slice(0, 120)
  const displayName = String(
    raw?.displayName
    || [firstName, lastName].filter(Boolean).join(' ')
    || (username ? `@${username}` : `User ${telegramUserId}`),
  )
    .trim()
    .slice(0, 160)
  return {
    telegramUserId,
    username,
    displayName,
    photoUrl: raw?.photoUrl != null
      ? String(raw.photoUrl).slice(0, 500)
      : raw?.photo_url != null
        ? String(raw.photo_url).slice(0, 500)
        : '',
    languageCode: String(raw?.languageCode || raw?.language_code || '').trim().slice(0, 32),
  }
}

function resolveViewerAuth(body = {}) {
  const verified = verifyTelegramInitData(body.initDataRaw)
  const verifiedUser = normalizeTelegramUserIn(verified.user)
  const fallbackUser = normalizeTelegramUserIn(body.telegramUser)
  if (verified.ok && verifiedUser) {
    return { telegramUser: verifiedUser, authVerified: true, authMode: 'telegram-init-data' }
  }
  if (fallbackUser) {
    return {
      telegramUser: fallbackUser,
      authVerified: false,
      authMode: TELEGRAM_BOT_TOKEN ? 'unverified-fallback' : 'unsafe-no-bot-token',
    }
  }
  return { telegramUser: null, authVerified: false, authMode: verified.reason || 'missing' }
}

function readVipPlansConfig() {
  try {
    const configPath = path.join(__dirname, 'vip-plans.json')
    if (!fs.existsSync(configPath)) return { plans: [], plansAuthor: [] }
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    return {
      plans: Array.isArray(parsed?.plans) ? parsed.plans : [],
      plansAuthor: Array.isArray(parsed?.plansAuthor) ? parsed.plansAuthor : [],
    }
  } catch {
    return { plans: [], plansAuthor: [] }
  }
}

function getVipPlanForRole(planId, role = 'normal') {
  const pid = String(planId || '').trim()
  if (!pid) return null
  const config = readVipPlansConfig()
  const list = normalizeViewerRole(role) === 'author' && config.plansAuthor.length > 0
    ? config.plansAuthor
    : config.plans
  const row = list.find((it) => String(it?.planId || '').trim() === pid)
  if (!row || typeof row !== 'object') return null
  return {
    planId: String(row.planId || '').trim(),
    titleKm: String(row.titleKm || '').trim(),
    durationKm: String(row.durationKm || '').trim(),
    durationHours: Math.max(0, Number(row.durationHours || 0)),
    priceUsdLabel: String(row.priceUsdLabel || '$0').trim(),
  }
}

function resolveViewerProfileByTelegramUserId(telegramUserId) {
  const id = normalizeTelegramUserId(telegramUserId)
  if (!id) return null
  const existing = memberProfiles.get(id)
  if (existing) return existing
  const created = normalizeMemberProfileIn({ telegramUserId: id })
  memberProfiles.set(id, created)
  return created
}

function ensurePresenceMemberKnown(memberId, req, atMs = now()) {
  const mid = String(memberId || '').trim()
  if (!mid) return
  const reqIp = getRequestIp(req)
  const reqGeo = getRequestGeoLabel(req)
  if (!knownMembers.has(mid)) {
    knownMembers.add(mid)
    memberFirstSeenAt.set(mid, atMs)
    if (reqIp) memberRegisterIp.set(mid, reqIp)
    if (reqGeo) memberRegisterGeo.set(mid, reqGeo)
  }
  if (reqIp) memberLastLoginIp.set(mid, reqIp)
  if (reqGeo) memberLastLoginGeo.set(mid, reqGeo)
  memberLastLoginAt.set(mid, atMs)
}

function upsertViewerProfile(telegramUser, req, authMeta = {}) {
  const normalizedUser = normalizeTelegramUserIn(telegramUser)
  if (!normalizedUser?.telegramUserId) return null
  const atMs = now()
  const existing = resolveViewerProfileByTelegramUserId(normalizedUser.telegramUserId)
  const next = normalizeMemberProfileIn({
    ...existing,
    ...normalizedUser,
    role: resolveViewerRoleByTelegramUserId(normalizedUser.telegramUserId, existing?.role),
    updatedAt: atMs,
    lastSeenAt: atMs,
    authVerified: authMeta.authVerified === true || existing?.authVerified === true,
    authMode: String(authMeta.authMode || existing?.authMode || ''),
  }, normalizedUser.telegramUserId)
  memberProfiles.set(normalizedUser.telegramUserId, next)
  ensurePresenceMemberKnown(next.memberId, req, atMs)
  return next
}

function isViewerVipActive(profile, atMs = now()) {
  return Number(profile?.vipExpireAtMs || 0) > atMs
}

function buildViewerProfileResponse(profile) {
  const p = profile || null
  const vipActive = isViewerVipActive(p)
  const role = normalizeViewerRole(p?.role)
  return {
    telegramUserId: Number(p?.telegramUserId || 0),
    role,
    vipActive,
    vipExpireAtMs: Number(p?.vipExpireAtMs || 0),
    badgeTier: deriveViewerBadgeTier(role, vipActive),
    canReadVipChapters: vipActive,
    authVerified: p?.authVerified === true,
    authMode: String(p?.authMode || ''),
  }
}

function buildViewerSnapshotFields(userId) {
  const profile = resolveViewerProfileByTelegramUserId(userId)
  const vipActive = isViewerVipActive(profile)
  const role = normalizeViewerRole(profile?.role)
  return {
    memberRole: role,
    vipActive,
    memberTier: deriveViewerBadgeTier(role, vipActive),
  }
}

function applyViewerSnapshotFields(rawEntry) {
  const entry = rawEntry && typeof rawEntry === 'object' ? { ...rawEntry } : {}
  const snapshot = buildViewerSnapshotFields(entry.userId)
  return { ...entry, ...snapshot }
}

function resolveVipOrdersForUser(telegramUserId) {
  const id = normalizeTelegramUserId(telegramUserId)
  if (!id) return []
  return Array.isArray(vipOrdersByUser.get(id)) ? vipOrdersByUser.get(id).slice() : []
}

function createSuccessfulVipOrderForViewer(profile, planId) {
  if (!profile?.telegramUserId) return null
  const plan = getVipPlanForRole(planId, profile.role)
  if (!plan || !plan.planId || plan.durationHours <= 0) return null
  const atMs = now()
  const currentOrders = resolveVipOrdersForUser(profile.telegramUserId)
  const order = normalizeVipOrderIn({
    id: buildVipOrderId(atMs, currentOrders.length),
    planId: plan.planId,
    amount: plan.priceUsdLabel,
    status: 'success',
    statusLabel: 'បង់ប្រាក់ជោគជ័យ',
    time: formatOrderTime(atMs),
    atMs,
    product: getNeutralVipOrderProductLabel(),
    audience: profile.role,
    durationHours: plan.durationHours,
    priceUsdLabel: plan.priceUsdLabel,
  })
  const addMs = plan.durationHours * 60 * 60 * 1000
  const currentExpire = Math.max(0, Number(profile.vipExpireAtMs || 0))
  const nextExpire = Math.max(atMs, currentExpire) + addMs
  const updatedProfile = normalizeMemberProfileIn({
    ...profile,
    vipExpireAtMs: nextExpire,
    updatedAt: atMs,
    lastSeenAt: atMs,
  }, profile.telegramUserId)
  memberProfiles.set(updatedProfile.telegramUserId, updatedProfile)
  vipOrdersByUser.set(updatedProfile.telegramUserId, [order, ...currentOrders].slice(0, 200))
  paidMembers.add(updatedProfile.memberId)
  if (!memberPaidAt.has(updatedProfile.memberId)) memberPaidAt.set(updatedProfile.memberId, atMs)
  txMetrics.orderEvents.push(atMs)
  txMetrics.successEvents.push(atMs)
  return { order, profile: updatedProfile }
}

function parseMemberIdToTelegramUserId(memberId) {
  const mid = String(memberId || '').trim()
  const matched = mid.match(/^tg_(\d+)$/i)
  if (matched) return normalizeTelegramUserId(matched[1])
  return normalizeTelegramUserId(mid)
}

function markMemberPaidPresence(memberId, req, atMs = now()) {
  if (!memberId) return
  ensurePresenceMemberKnown(memberId, req, atMs)
  if (!paidMembers.has(memberId)) {
    paidMembers.add(memberId)
    memberPaidAt.set(memberId, atMs)
  }
}

function fulfillVipAfterPayment(input = {}) {
  const tranId = String(input.tranId || input.tran_id || '').trim().slice(0, 20)
  const pending = tranId ? pendingVipOrdersByTranId.get(tranId) : null
  const planId = String(input.planId || input.plan_id || pending?.planId || '').trim()
  const telegramUserId = normalizeTelegramUserId(
    input.telegramUserId || input.telegram_user_id || pending?.telegramUserId,
  ) || parseMemberIdToTelegramUserId(input.memberId || pending?.memberId)
  if (!telegramUserId) {
    return { ok: false, error: 'telegram user required', profile: null, order: null, alreadyFulfilled: false }
  }
  if (!planId) {
    return { ok: false, error: 'planId required', profile: null, order: null, alreadyFulfilled: false }
  }
  if (tranId && fulfilledVipTranIds.has(tranId)) {
    const existing = resolveViewerProfileByTelegramUserId(telegramUserId)
    return {
      ok: true,
      error: '',
      profile: buildViewerProfileResponse(existing),
      order: null,
      alreadyFulfilled: true,
    }
  }

  let profile = null
  if (input.telegramUser && typeof input.telegramUser === 'object') {
    profile = upsertViewerProfile(input.telegramUser, input.req, {
      authVerified: input.authVerified === true,
      authMode: String(input.authMode || ''),
    })
  } else {
    profile = resolveViewerProfileByTelegramUserId(telegramUserId)
  }
  if (!profile) {
    return { ok: false, error: 'profile not found', profile: null, order: null, alreadyFulfilled: false }
  }

  const result = createSuccessfulVipOrderForViewer(profile, planId)
  if (!result) {
    return { ok: false, error: 'invalid vip plan', profile: null, order: null, alreadyFulfilled: false }
  }

  if (tranId) {
    fulfilledVipTranIds.add(tranId)
    const row = pendingVipOrdersByTranId.get(tranId)
    if (row) pendingVipOrdersByTranId.set(tranId, { ...row, status: 'paid', paidAt: now() })
  }
  markMemberPaidPresence(result.profile.memberId, input.req)

  return {
    ok: true,
    error: '',
    profile: buildViewerProfileResponse(result.profile),
    order: result.order,
    alreadyFulfilled: false,
  }
}

function applyPaymentSuccessPayload(body, req) {
  const safeBody = stripSensitivePaymentFields(body)
  const payload = safeBody && typeof safeBody === 'object' && !Array.isArray(safeBody) ? safeBody : {}
  const memberId = String(payload.memberId || '').trim()
  const atMs = now()
  const reqIp = getRequestIp(req)
  const reqGeo = getRequestGeoLabel(req)
  if (memberId) {
    if (!knownMembers.has(memberId)) {
      knownMembers.add(memberId)
      memberFirstSeenAt.set(memberId, atMs)
      if (reqIp) memberRegisterIp.set(memberId, reqIp)
      if (reqGeo) memberRegisterGeo.set(memberId, reqGeo)
    }
    if (reqIp) memberLastLoginIp.set(memberId, reqIp)
    if (reqGeo) memberLastLoginGeo.set(memberId, reqGeo)
    memberLastLoginAt.set(memberId, atMs)
    markMemberPaidPresence(memberId, req, atMs)
  }
  const fulfillment = fulfillVipAfterPayment({
    memberId,
    planId: payload.planId || payload.plan_id,
    tranId: payload.tranId || payload.tran_id,
    telegramUserId: payload.telegramUserId || payload.telegram_user_id,
    telegramUser: payload.telegramUser,
    authVerified: payload.authVerified,
    authMode: payload.authMode,
    req,
  })
  return { memberId, fulfillment }
}

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
    const registerIpObj = parsed?.memberRegisterIp && typeof parsed.memberRegisterIp === 'object'
      ? parsed.memberRegisterIp
      : {}
    const registerGeoObj = parsed?.memberRegisterGeo && typeof parsed.memberRegisterGeo === 'object'
      ? parsed.memberRegisterGeo
      : {}
    const loginIpObj = parsed?.memberLastLoginIp && typeof parsed.memberLastLoginIp === 'object'
      ? parsed.memberLastLoginIp
      : {}
    const loginGeoObj = parsed?.memberLastLoginGeo && typeof parsed.memberLastLoginGeo === 'object'
      ? parsed.memberLastLoginGeo
      : {}
    const loginAtObj = parsed?.memberLastLoginAt && typeof parsed.memberLastLoginAt === 'object'
      ? parsed.memberLastLoginAt
      : {}
    const memberProfilesObj = parsed?.memberProfiles && typeof parsed.memberProfiles === 'object'
      ? parsed.memberProfiles
      : {}
    const vipOrdersByUserObj = parsed?.vipOrdersByUser && typeof parsed.vipOrdersByUser === 'object'
      ? parsed.vipOrdersByUser
      : {}
    const pendingVipOrdersObj = parsed?.pendingVipOrdersByTranId && typeof parsed.pendingVipOrdersByTranId === 'object'
      ? parsed.pendingVipOrdersByTranId
      : {}
    const fulfilledTranIds = Array.isArray(parsed?.fulfilledVipTranIds) ? parsed.fulfilledVipTranIds : []
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
    for (const [id, ip] of Object.entries(registerIpObj)) {
      const v = normalizeIp(ip)
      if (id && v) memberRegisterIp.set(String(id), v)
    }
    for (const [id, geo] of Object.entries(registerGeoObj)) {
      const v = String(geo || '').trim()
      if (id && v) memberRegisterGeo.set(String(id), v.slice(0, 120))
    }
    for (const [id, ip] of Object.entries(loginIpObj)) {
      const v = normalizeIp(ip)
      if (id && v) memberLastLoginIp.set(String(id), v)
    }
    for (const [id, geo] of Object.entries(loginGeoObj)) {
      const v = String(geo || '').trim()
      if (id && v) memberLastLoginGeo.set(String(id), v.slice(0, 120))
    }
    for (const [id, ts] of Object.entries(loginAtObj)) {
      if (id && Number(ts)) memberLastLoginAt.set(String(id), Number(ts))
    }
    for (const [telegramUserId, row] of Object.entries(memberProfilesObj)) {
      const normalized = normalizeMemberProfileIn(row, telegramUserId)
      if (!normalized) continue
      memberProfiles.set(normalized.telegramUserId, normalized)
    }
    for (const [telegramUserId, rows] of Object.entries(vipOrdersByUserObj)) {
      const id = normalizeTelegramUserId(telegramUserId)
      if (!id) continue
      const list = Array.isArray(rows) ? rows.map((it) => normalizeVipOrderIn(it)).filter(Boolean) : []
      vipOrdersByUser.set(id, list.sort((a, b) => Number(b?.atMs || 0) - Number(a?.atMs || 0)))
    }
    for (const [tranId, row] of Object.entries(pendingVipOrdersObj)) {
      const tid = String(tranId || '').trim().slice(0, 20)
      if (!tid || !row || typeof row !== 'object') continue
      pendingVipOrdersByTranId.set(tid, {
        tranId: tid,
        planId: String(row.planId || '').trim(),
        telegramUserId: normalizeTelegramUserId(row.telegramUserId),
        memberId: String(row.memberId || '').trim(),
        amount: String(row.amount || '').trim(),
        status: String(row.status || 'pending').trim(),
        createdAt: Number(row.createdAt || 0) || 0,
        paidAt: Number(row.paidAt || 0) || 0,
      })
    }
    for (const tranId of fulfilledTranIds) {
      const tid = String(tranId || '').trim().slice(0, 20)
      if (tid) fulfilledVipTranIds.add(tid)
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
    const novelReviewVoteProfilesObj =
      parsed?.novelReviewVoteProfiles && typeof parsed.novelReviewVoteProfiles === 'object'
        ? parsed.novelReviewVoteProfiles
        : {}
    for (const [novelId, row] of Object.entries(novelReviewVoteProfilesObj)) {
      const profilesRaw = row && typeof row === 'object' ? row : {}
      const profiles = Object.fromEntries(
        Object.entries(profilesRaw).map(([commentId, userMap]) => {
          const userRows = userMap && typeof userMap === 'object' ? userMap : {}
          const normalizedUserMap = Object.fromEntries(
            Object.entries(userRows).map(([uid, p]) => [
              String(uid),
              {
                name: String(p?.name || '').slice(0, 120),
                avatar: p?.avatar != null ? String(p.avatar).slice(0, 500) : '',
                lastUpAt: Number.isFinite(Number(p?.lastUpAt)) ? Number(p.lastUpAt) : 0,
              },
            ]),
          )
          return [String(commentId), normalizedUserMap]
        }),
      )
      novelReviewVoteProfiles.set(String(novelId), profiles)
    }
    const novelLikesObj = parsed?.novelLikes && typeof parsed.novelLikes === 'object'
      ? parsed.novelLikes
      : {}
    for (const [novelId, row] of Object.entries(novelLikesObj)) {
      const users = Array.isArray(row?.users) ? row.users.map((v) => String(v || '').trim()).filter(Boolean) : []
      novelLikes.set(String(novelId), { users: [...new Set(users)] })
    }
    const novelFavoritesObj = parsed?.novelFavorites && typeof parsed.novelFavorites === 'object'
      ? parsed.novelFavorites
      : {}
    for (const [novelId, row] of Object.entries(novelFavoritesObj)) {
      novelFavorites.set(String(novelId), normalizeNovelFavoritesRow(row))
    }
    const novelReportsObj = parsed?.novelReports && typeof parsed.novelReports === 'object'
      ? parsed.novelReports
      : {}
    for (const [novelId, row] of Object.entries(novelReportsObj)) {
      const items = Array.isArray(row?.items) ? row.items.map((it) => normalizeReportIn(it, novelId)).filter(Boolean) : []
      novelReports.set(String(novelId), { items })
    }
    readRecords = Array.isArray(parsed.readRecords)
      ? parsed.readRecords.map(normalizeReadRecordIn).filter(Boolean)
      : []
    readRecords = readRecords.slice(0, READ_RECORDS_CAP)
    pruneExpiredReadRecords()
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
      memberRegisterIp: Object.fromEntries(memberRegisterIp),
      memberRegisterGeo: Object.fromEntries(memberRegisterGeo),
      memberLastLoginIp: Object.fromEntries(memberLastLoginIp),
      memberLastLoginGeo: Object.fromEntries(memberLastLoginGeo),
      memberLastLoginAt: Object.fromEntries(memberLastLoginAt),
      memberProfiles: Object.fromEntries(memberProfiles),
      vipOrdersByUser: Object.fromEntries(vipOrdersByUser),
      pendingVipOrdersByTranId: Object.fromEntries(pendingVipOrdersByTranId),
      fulfilledVipTranIds: [...fulfilledVipTranIds],
      txMetrics,
      novelViews: Object.fromEntries(novelViews),
      novelReviews: Object.fromEntries(novelReviews),
      novelReplies: Object.fromEntries(novelReplies),
      novelReviewVotes: Object.fromEntries(novelReviewVotes),
      novelReviewVoteProfiles: Object.fromEntries(novelReviewVoteProfiles),
      novelLikes: Object.fromEntries(novelLikes),
      novelFavorites: Object.fromEntries(novelFavorites),
      novelReports: Object.fromEntries(novelReports),
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

function resolveNovelReviewVoteProfiles(novelId) {
  const key = String(novelId || '').trim()
  if (!key) return {}
  const row = novelReviewVoteProfiles.get(key)
  return row && typeof row === 'object' ? row : {}
}

function resolveNovelLikeUsers(novelId) {
  const key = String(novelId || '').trim()
  if (!key) return []
  const row = novelLikes.get(key)
  const users = Array.isArray(row?.users) ? row.users : []
  return users
}

function normalizeNovelFavoritesRow(raw) {
  const users = Array.isArray(raw?.users)
    ? raw.users.map((v) => String(v || '').trim()).filter(Boolean)
    : []
  const atByUser =
    raw?.atByUser && typeof raw.atByUser === 'object' && !Array.isArray(raw.atByUser)
      ? Object.fromEntries(
          Object.entries(raw.atByUser)
            .map(([uid, ms]) => [String(uid || '').trim(), Number(ms)])
            .filter(([uid, ms]) => uid && Number.isFinite(ms) && ms > 0),
        )
      : {}
  return { users: [...new Set(users)], atByUser }
}

function resolveNovelFavoriteUsers(novelId) {
  const key = String(novelId || '').trim()
  if (!key) return []
  return normalizeNovelFavoritesRow(novelFavorites.get(key)).users
}

function resolveUserFavoritedNovels(userId) {
  const uid = String(userId || '').trim()
  if (!uid) return []
  const out = []
  for (const [novelId, row] of novelFavorites.entries()) {
    const normalized = normalizeNovelFavoritesRow(row)
    if (!normalized.users.includes(uid)) continue
    const favoritedAtMs = Number(normalized.atByUser[uid]) || 0
    out.push({ novelId: String(novelId), favoritedAtMs })
  }
  out.sort((a, b) => b.favoritedAtMs - a.favoritedAtMs)
  return out
}

function resolveUserFavoritedNovelIds(userId) {
  return resolveUserFavoritedNovels(userId).map((it) => it.novelId)
}

function resolveNovelReports(novelId) {
  const key = String(novelId || '').trim()
  if (!key) return []
  const row = novelReports.get(key)
  return Array.isArray(row?.items) ? row.items : []
}

function cascadeDeleteNovelRelations(novelId, novelTitle) {
  const id = String(novelId || '').trim()
  const title = String(novelTitle || '').trim()
  readRecords = readRecords.filter((it) => {
    const rid = String(it?.novelId || '').trim()
    if (rid && rid === id) return false
    const shelf = String(it?.shelfTitle || '').trim()
    if (title && shelf === title) return false
    return true
  })
  novelReports.delete(id)
  novelReviews.delete(id)
  novelReplies.delete(id)
  novelLikes.delete(id)
  novelFavorites.delete(id)
  novelViews.delete(id)
  novelReviewVotes.delete(id)
  novelReviewVoteProfiles.delete(id)
  persistMembers()
}

function buildAdminReports() {
  const out = []
  for (const [novelId, row] of novelReports.entries()) {
    const items = Array.isArray(row?.items) ? row.items : []
    for (const it of items) {
      out.push({
        ...it,
        novelId: String(novelId || ''),
      })
    }
  }
  return out.sort((a, b) => Number(b?.at || 0) - Number(a?.at || 0))
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
    ...novelFavorites.keys(),
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
    const likeCount = resolveNovelLikeUsers(novelId).length
    const favoriteCount = resolveNovelFavoriteUsers(novelId).length
    const ratingPoints = Math.min(100, reviews.length + replies.length)
    stats[novelId] = { viewCount, likeCount, favoriteCount, ratingPoints, lastUpdateAtMs }
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
  novelReviewVoteProfiles.clear()
  novelLikes.clear()
  novelFavorites.clear()
  novelReports.clear()
  readRecords = []
  persistMembers()
}

function resolveNovelViewCount(novelId, baseCount = 0) {
  const key = String(novelId || '').trim()
  if (!key) return 0
  const base = Number(baseCount)
  const safeBase = Number.isFinite(base) && base >= 0 ? Math.floor(base) : 0
  const existing = novelViews.get(key)
  if (Number.isFinite(existing) && existing >= 0) {
    const elevated = Math.max(Math.floor(existing), safeBase)
    if (elevated !== existing) {
      novelViews.set(key, elevated)
      persistMembers()
    }
    return elevated
  }
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

function normalizeIp(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  if (text === '::1') return '127.0.0.1'
  return text.replace(/^::ffff:/, '')
}

function getRequestIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0]
  const cfIp = String(req.headers['cf-connecting-ip'] || '')
  const realIp = String(req.headers['x-real-ip'] || '')
  const socketIp = String(req.socket?.remoteAddress || '')
  return normalizeIp(xff || cfIp || realIp || socketIp)
}

function getRequestGeoLabel(req) {
  const bodyCity = String(req.headers['x-geo-city'] || req.headers['x-vercel-ip-city'] || req.headers['cf-ipcity'] || '').trim()
  const bodyRegion = String(req.headers['x-geo-region'] || req.headers['x-vercel-ip-region'] || req.headers['cf-region'] || '').trim()
  const bodyDistrict = String(req.headers['x-geo-district'] || req.headers['x-location-district'] || '').trim()
  const userProvided = String(req.headers['x-location-label'] || '').trim()
  if (userProvided) return userProvided.slice(0, 120)
  if (bodyRegion && bodyDistrict) return `${bodyRegion} / ${bodyDistrict}`.slice(0, 120)
  if (bodyRegion && bodyCity) return `${bodyRegion} / ${bodyCity}`.slice(0, 120)
  if (bodyRegion) return bodyRegion.slice(0, 120)
  if (bodyCity) return bodyCity.slice(0, 120)
  return ''
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
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

function pruneLegacyAdminSessions() {
  const t = now()
  for (const [token, rec] of adminLegacySessions.entries()) {
    if (!rec || Number(rec.expiresAt) <= t) adminLegacySessions.delete(token)
  }
}

function isLegacyAdminTokenValid(token) {
  if (!token) return false
  pruneLegacyAdminSessions()
  const rec = adminLegacySessions.get(token)
  return Boolean(rec && Number(rec.expiresAt) > now())
}

function getLegacyAdminSession(token) {
  if (!token) return null
  pruneLegacyAdminSessions()
  const rec = adminLegacySessions.get(token)
  if (!rec || Number(rec.expiresAt) <= now()) return null
  return rec
}

function requireLegacyAdmin(req, res) {
  const token = extractBearerToken(req)
  if (!isLegacyAdminTokenValid(token)) {
    sendJson(res, 401, { ok: false, error: 'legacy admin unauthorized' })
    return null
  }
  return token
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (req.method === 'OPTIONS') return sendJson(res, 204, {})

  if (req.method === 'GET' && url.pathname === '/api/health/persistence') {
    const novelsPath = getNovelsDataFilePath()
    const legacyNovelsPath = path.join(__dirname, 'novels-data.json')
    let volumeWritable = false
    try {
      const probe = path.join(PERSISTENT_DATA_DIR, '.health-probe')
      fs.writeFileSync(probe, String(Date.now()), 'utf8')
      fs.unlinkSync(probe)
      volumeWritable = true
    } catch {
      volumeWritable = false
    }
    return sendJson(res, 200, {
      ok: true,
      volumeConfigured: isVolumeConfigured(),
      persistentDataDir: PERSISTENT_DATA_DIR,
      envPersistentDataDir: process.env.PERSISTENT_DATA_DIR || null,
      railwayVolumeMountPath: process.env.RAILWAY_VOLUME_MOUNT_PATH || null,
      volumeWritable,
      paths: {
        novelsData: novelsPath,
        presenceData: DATA_FILE,
        coversDir: COVERS_DIR,
      },
      novelsCount: getNovelsCount(),
      files: {
        novelsDataExists: fs.existsSync(novelsPath),
        presenceDataExists: fs.existsSync(DATA_FILE),
        legacyNovelsExists: fs.existsSync(legacyNovelsPath),
      },
      lastMigration: getLastMigrationResults(),
    })
  }

  /** 首页筛选面板配置：放置 `server/home-filter-panel-config.json`，后台任意改标题/分组/选项即生效（重启可选：当前每次 GET 读盘） */
  const coverStaticMatch = url.pathname.match(/^\/uploads\/novel-covers\/([^/]+)$/)
  if (req.method === 'GET' && coverStaticMatch) {
    serveNovelCoverFile(res, decodeURIComponent(coverStaticMatch[1]))
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/home-filter-panel-config') {
    return sendJson(res, 200, buildPublicAppFilters().panel)
  }

  if (req.method === 'GET' && url.pathname === '/api/app-filters') {
    return sendJson(res, 200, buildPublicAppFilters())
  }

  if (req.method === 'GET' && url.pathname === '/api/admin-legacy/app-filters') {
    if (!requireLegacyAdmin(req, res)) return
    return sendJson(res, 200, getAdminAppFiltersPayload())
  }

  const adminFilterSectionMatch = url.pathname.match(
    /^\/api\/admin-legacy\/app-filters\/(genres|tags|status|wordRanges|sort)$/,
  )

  if (adminFilterSectionMatch && req.method === 'PUT') {
    if (!requireLegacyAdmin(req, res)) return
    try {
      const body = await parseJsonBody(req)
      return sendJson(res, 200, saveAppFilterSection(adminFilterSectionMatch[1], body?.items))
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: String(err?.message || err) })
    }
  }

  /** VIP 套餐：与 `src/data/vipPlansCatalog.js` 同结构；编辑 `server/vip-plans.json` 后 GET 即生效 */
  if (req.method === 'GET' && url.pathname === '/api/vip-plans') {
    try {
      const configPath = path.join(__dirname, 'vip-plans.json')
      if (!fs.existsSync(configPath)) {
        sendJson(res, 404, { ok: false, error: 'vip-plans.json missing' })
        return
      }
      const body = fs.readFileSync(configPath, 'utf8')
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(body)
      return
    } catch {
      sendJson(res, 500, { ok: false, error: 'vip-plans read failed' })
      return
    }
  }

  if (req.method === 'PUT' && url.pathname === '/api/admin/vip-plans') {
    if (!requireLegacyAdmin(req, res)) return
    sendJson(res, 501, {
      ok: false,
      error:
        'PUT /api/admin/vip-plans not implemented; edit server/vip-plans.json or add persist logic',
    })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/viewer-profile/resolve') {
    const body = await parseJsonBody(req)
    const auth = resolveViewerAuth(body)
    if (!auth.telegramUser?.telegramUserId) {
      return sendJson(res, 401, { ok: false, error: 'telegram user required' })
    }
    if (TELEGRAM_BOT_TOKEN && auth.authVerified !== true) {
      return sendJson(res, 401, { ok: false, error: 'telegram initData verify failed' })
    }
    const profile = upsertViewerProfile(auth.telegramUser, req, auth)
    persistMembers()
    return sendJson(res, 200, { ok: true, profile: buildViewerProfileResponse(profile) })
  }

  if (req.method === 'POST' && url.pathname === '/api/vip-orders/list') {
    const body = await parseJsonBody(req)
    const auth = resolveViewerAuth(body)
    if (!auth.telegramUser?.telegramUserId) {
      return sendJson(res, 401, { ok: false, error: 'telegram user required' })
    }
    if (TELEGRAM_BOT_TOKEN && auth.authVerified !== true) {
      return sendJson(res, 401, { ok: false, error: 'telegram initData verify failed' })
    }
    const profile = upsertViewerProfile(auth.telegramUser, req, auth)
    const items = resolveVipOrdersForUser(profile.telegramUserId)
    persistMembers()
    return sendJson(res, 200, { ok: true, items, profile: buildViewerProfileResponse(profile) })
  }

  if (req.method === 'POST' && url.pathname === '/api/vip-orders/checkout') {
    const body = await parseJsonBody(req)
    const auth = resolveViewerAuth(body)
    if (!auth.telegramUser?.telegramUserId) {
      return sendJson(res, 401, { ok: false, error: 'telegram user required' })
    }
    if (TELEGRAM_BOT_TOKEN && auth.authVerified !== true) {
      return sendJson(res, 401, { ok: false, error: 'telegram initData verify failed' })
    }
    if (!isPayWayConfigured()) {
      return sendJson(res, 503, { ok: false, paywayConfigured: false, error: 'payway_not_configured' })
    }
    const planId = String(body.planId || '').trim()
    if (!planId) return sendJson(res, 400, { ok: false, error: 'planId required' })
    const profile = upsertViewerProfile(auth.telegramUser, req, auth)
    const plan = getVipPlanForRole(planId, profile.role)
    if (!plan || plan.durationHours <= 0) {
      return sendJson(res, 400, { ok: false, error: 'invalid vip plan' })
    }
    const atMs = now()
    const tranId = buildVipTranId(profile.telegramUserId, atMs)
    const amount = parseUsdAmountFromLabel(plan.priceUsdLabel)
    const returnUrl = `${APP_PUBLIC_URL}/vip/payment-return?tran_id=${encodeURIComponent(tranId)}&plan_id=${encodeURIComponent(planId)}`
    pendingVipOrdersByTranId.set(tranId, {
      tranId,
      planId: plan.planId,
      telegramUserId: profile.telegramUserId,
      memberId: profile.memberId,
      amount,
      status: 'pending',
      createdAt: atMs,
      paidAt: 0,
    })
    const formFields = buildPurchaseFormFields({
      tranId,
      amount,
      planId: plan.planId,
      customFields: buildPayWayCustomFields({ tranId, planId: plan.planId }),
      returnUrl,
      cancelUrl: `${APP_PUBLIC_URL}/vip?cancel=1`,
      continueSuccessUrl: returnUrl,
      returnParams: JSON.stringify({ planId: plan.planId, telegramUserId: profile.telegramUserId }),
    })
    persistMembers()
    return sendJson(res, 200, {
      ok: true,
      paywayConfigured: true,
      tranId,
      checkoutUrl: getPayWayCheckoutUrl(),
      formFields: filterCheckoutFormFieldsForClient(formFields),
      hostedCheckout: true,
      profile: buildViewerProfileResponse(profile),
    })
  }

  if (req.method === 'POST' && url.pathname === '/api/vip-orders/confirm-payment') {
    const body = stripSensitivePaymentFields(await parseJsonBody(req))
    const auth = resolveViewerAuth(body)
    if (!auth.telegramUser?.telegramUserId) {
      return sendJson(res, 401, { ok: false, error: 'telegram user required' })
    }
    if (TELEGRAM_BOT_TOKEN && auth.authVerified !== true) {
      return sendJson(res, 401, { ok: false, error: 'telegram initData verify failed' })
    }
    const tranId = String(body.tranId || body.tran_id || '').trim().slice(0, 20)
    const planId = String(body.planId || body.plan_id || '').trim()
    if (!tranId) return sendJson(res, 400, { ok: false, error: 'tranId required' })
    const pending = pendingVipOrdersByTranId.get(tranId)
    if (pending && pending.telegramUserId !== auth.telegramUser.telegramUserId) {
      return sendJson(res, 403, { ok: false, error: 'tran_id owner mismatch' })
    }
    const skipVerify = body.skipVerify === true || process.env.PAYWAY_SKIP_VERIFY === '1'
    if (isPayWayConfigured() && !skipVerify) {
      const checked = await checkPayWayTransaction(tranId)
      if (!checked.ok) {
        return sendJson(res, 402, {
          ok: false,
          error: 'payment_not_confirmed',
          paywayStatus: checked.status,
          paywayError: checked.error,
        })
      }
    }
    const fulfillment = fulfillVipAfterPayment({
      tranId,
      planId,
      memberId: auth.telegramUser.telegramUserId ? `tg_${auth.telegramUser.telegramUserId}` : '',
      telegramUser: auth.telegramUser,
      authVerified: auth.authVerified,
      authMode: auth.authMode,
      req,
    })
    if (!fulfillment.ok) return sendJson(res, 400, { ok: false, error: fulfillment.error })
    persistMembers()
    return sendJson(res, 200, {
      ok: true,
      alreadyFulfilled: fulfillment.alreadyFulfilled,
      order: fulfillment.order,
      profile: fulfillment.profile,
    })
  }

  if (req.method === 'POST' && url.pathname === '/api/vip-orders/purchase') {
    const body = await parseJsonBody(req)
    const auth = resolveViewerAuth(body)
    if (!auth.telegramUser?.telegramUserId) {
      return sendJson(res, 401, { ok: false, error: 'telegram user required' })
    }
    if (TELEGRAM_BOT_TOKEN && auth.authVerified !== true) {
      return sendJson(res, 401, { ok: false, error: 'telegram initData verify failed' })
    }
    const planId = String(body.planId || '').trim()
    if (!planId) return sendJson(res, 400, { ok: false, error: 'planId required' })
    const profile = upsertViewerProfile(auth.telegramUser, req, auth)
    const result = createSuccessfulVipOrderForViewer(profile, planId)
    if (!result) return sendJson(res, 400, { ok: false, error: 'invalid vip plan' })
    persistMembers()
    return sendJson(res, 200, {
      ok: true,
      order: result.order,
      profile: buildViewerProfileResponse(result.profile),
    })
  }

  if (req.method === 'GET' && url.pathname === '/api/novels-catalog') {
    const payload = getNovelsCatalogPayload()
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(JSON.stringify(payload))
    return
  }

  const novelDetailMatch = url.pathname.match(/^\/api\/novels\/([^/]+)$/)
  if (req.method === 'GET' && novelDetailMatch) {
    const novel = getStoredNovelById(decodeURIComponent(novelDetailMatch[1]))
    if (!novel) return sendJson(res, 404, { ok: false, error: 'novel not found' })
    return sendJson(res, 200, { ok: true, novel })
  }

  if (req.method === 'PUT' && url.pathname === '/api/admin/novels-catalog') {
    if (!requireLegacyAdmin(req, res)) return
    sendJson(res, 410, {
      ok: false,
      error: 'Use /api/admin-legacy/novels CRUD instead of bulk catalog PUT',
    })
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/admin-legacy/novel-titles') {
    if (!requireLegacyAdmin(req, res)) return
    return sendJson(res, 200, { ok: true, items: listNovelTitles() })
  }

  if (req.method === 'POST' && url.pathname === '/api/admin-legacy/novels/cover-upload') {
    if (!requireLegacyAdmin(req, res)) return
    try {
      const body = await readCoverJsonBody(req)
      const result = saveCoverImage(req, {
        dataUrl: body.dataUrl,
        mimeType: body.mimeType,
        base64: body.base64,
        previousCoverUrl: body.previousCoverUrl,
      })
      return sendJson(res, 200, { ok: true, ...result })
    } catch (err) {
      const msg = String(err?.message || err)
      const code = msg.includes('1MB') || msg.includes('支持') ? 400 : 500
      return sendJson(res, code, { ok: false, error: msg })
    }
  }

  if (req.method === 'DELETE' && url.pathname === '/api/admin-legacy/novels/cover-upload') {
    if (!requireLegacyAdmin(req, res)) return
    try {
      const body = await readCoverJsonBody(req)
      const coverUrl = String(body.coverUrl || url.searchParams.get('coverUrl') || '').trim()
      if (!coverUrl) return sendJson(res, 400, { ok: false, error: 'coverUrl required' })
      const deleted = deleteManagedCoverFile(coverUrl)
      return sendJson(res, 200, { ok: true, deleted })
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: String(err?.message || err) })
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/admin-legacy/novels') {
    if (!requireLegacyAdmin(req, res)) return
    const result = listNovelsAdmin({
      page: url.searchParams.get('page'),
      pageSize: url.searchParams.get('pageSize'),
      title: url.searchParams.get('title'),
      author: url.searchParams.get('author'),
      genreId: url.searchParams.get('genreId') || url.searchParams.get('genre'),
      status: url.searchParams.get('status'),
    })
    return sendJson(res, 200, { ok: true, ...result })
  }

  const adminNovelMatch = url.pathname.match(/^\/api\/admin-legacy\/novels\/([^/]+)$/)
  if (adminNovelMatch && req.method === 'GET') {
    if (!requireLegacyAdmin(req, res)) return
    const novel = getStoredNovelById(decodeURIComponent(adminNovelMatch[1]))
    if (!novel) return sendJson(res, 404, { ok: false, error: 'novel not found' })
    return sendJson(res, 200, { ok: true, novel })
  }

  if (req.method === 'POST' && url.pathname === '/api/admin-legacy/novels') {
    if (!requireLegacyAdmin(req, res)) return
    try {
      const body = await parseJsonBody(req)
      const novel = createNovel(body)
      return sendJson(res, 200, { ok: true, novel })
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: String(err?.message || err) })
    }
  }

  if (adminNovelMatch && req.method === 'PUT') {
    if (!requireLegacyAdmin(req, res)) return
    try {
      const body = await parseJsonBody(req)
      const novel = updateNovel(decodeURIComponent(adminNovelMatch[1]), body)
      return sendJson(res, 200, { ok: true, novel })
    } catch (err) {
      const code = String(err?.message || '').includes('not found') ? 404 : 400
      return sendJson(res, code, { ok: false, error: String(err?.message || err) })
    }
  }

  if (adminNovelMatch && req.method === 'DELETE') {
    if (!requireLegacyAdmin(req, res)) return
    try {
      const removed = deleteStoredNovel(decodeURIComponent(adminNovelMatch[1]))
      cascadeDeleteNovelRelations(removed.id, removed.title)
      return sendJson(res, 200, { ok: true, ...removed })
    } catch (err) {
      return sendJson(res, 404, { ok: false, error: String(err?.message || err) })
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/admin-legacy/chapters') {
    if (!requireLegacyAdmin(req, res)) return
    const result = listChaptersAdmin({
      page: url.searchParams.get('page'),
      pageSize: url.searchParams.get('pageSize'),
      novelId: url.searchParams.get('novelId'),
      search: url.searchParams.get('search'),
    })
    return sendJson(res, 200, { ok: true, ...result })
  }

  if (req.method === 'POST' && url.pathname === '/api/admin-legacy/chapters') {
    if (!requireLegacyAdmin(req, res)) return
    try {
      const body = await parseJsonBody(req)
      const result = createChapter(body.novelId, body)
      return sendJson(res, 200, { ok: true, ...result })
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: String(err?.message || err) })
    }
  }

  const adminChapterMatch = url.pathname.match(/^\/api\/admin-legacy\/chapters\/([^/]+)\/(\d+)$/)
  if (adminChapterMatch && req.method === 'PUT') {
    if (!requireLegacyAdmin(req, res)) return
    try {
      const body = await parseJsonBody(req)
      const result = updateChapter(
        decodeURIComponent(adminChapterMatch[1]),
        Number(adminChapterMatch[2]),
        body,
      )
      return sendJson(res, 200, { ok: true, ...result })
    } catch (err) {
      const code = String(err?.message || '').includes('not found') ? 404 : 400
      return sendJson(res, code, { ok: false, error: String(err?.message || err) })
    }
  }

  if (adminChapterMatch && req.method === 'DELETE') {
    if (!requireLegacyAdmin(req, res)) return
    try {
      const result = deleteChapter(
        decodeURIComponent(adminChapterMatch[1]),
        Number(adminChapterMatch[2]),
      )
      return sendJson(res, 200, { ok: true, ...result })
    } catch (err) {
      return sendJson(res, 404, { ok: false, error: String(err?.message || err) })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    const body = await parseJsonBody(req)
    const username = String(body.username || '').trim()
    const password = String(body.password || '').trim()
    const otp = String(body.otp || '').trim()
    if (!username || !password || !otp) {
      return sendJson(res, 400, { ok: false, error: 'username/password/otp required' })
    }
    const passwordOk = verifyAdminPassword(password)
    if (username !== ADMIN_USER || !passwordOk || !verifyAdminOtp(otp)) {
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

  if (req.method === 'POST' && url.pathname === '/api/admin-legacy/login') {
    const body = await parseJsonBody(req)
    const username = String(body.username || '').trim()
    const password = String(body.password || '').trim()
    const otp = String(body.otp || '').trim()
    if (!username || !password || !otp) {
      return sendJson(res, 400, { ok: false, error: 'username/password/otp required' })
    }
    const legacyOk =
      username === ADMIN_LEGACY_USER &&
      password === ADMIN_LEGACY_PASS &&
      otp === ADMIN_LEGACY_OTP
    const adminOk =
      username === ADMIN_USER &&
      verifyAdminPassword(password) &&
      verifyAdminOtp(otp)
    if (!legacyOk && !adminOk) {
      return sendJson(res, 401, { ok: false, error: '账号、密码或动态码错误' })
    }
    const token = crypto.randomBytes(24).toString('hex')
    adminLegacySessions.set(token, { username, createdAt: now(), expiresAt: now() + ADMIN_TOKEN_TTL_MS })
    return sendJson(res, 200, { ok: true, token, username, expiresInMs: ADMIN_TOKEN_TTL_MS })
  }

  if (req.method === 'GET' && url.pathname === '/api/admin-legacy/session') {
    const token = extractBearerToken(req)
    const session = getLegacyAdminSession(token)
    if (!session) return sendJson(res, 401, { ok: false, error: 'legacy admin unauthorized' })
    return sendJson(res, 200, { ok: true, username: String(session.username || ADMIN_LEGACY_USER) })
  }

  if (req.method === 'POST' && url.pathname === '/api/admin-legacy/logout') {
    const token = extractBearerToken(req)
    if (token) adminLegacySessions.delete(token)
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url.pathname === '/api/presence/ping') {
    const body = await parseJsonBody(req)
    const memberId = String(body.memberId || '').trim()
    if (!memberId) return sendJson(res, 400, { ok: false, error: 'memberId required' })
    const device = normalizeDevice(body.device)
    const isAdmin = Boolean(body.isAdmin)
    const reqIp = getRequestIp(req)
    const reqGeo = getRequestGeoLabel(req)
    if (!knownMembers.has(memberId)) {
      knownMembers.add(memberId)
      memberFirstSeenAt.set(memberId, now())
      if (reqIp) memberRegisterIp.set(memberId, reqIp)
      if (reqGeo) memberRegisterGeo.set(memberId, reqGeo)
      persistMembers()
    }
    if (reqIp) memberLastLoginIp.set(memberId, reqIp)
    if (reqGeo) memberLastLoginGeo.set(memberId, reqGeo)
    memberLastLoginAt.set(memberId, now())
    if (body.paidSuccess) {
      applyPaymentSuccessPayload(body, req)
      persistMembers()
    }
    records.set(memberId, { device, isAdmin, lastSeenAt: now() })
    persistMembers()
    return sendJson(res, 200, { ok: true, counts: makeCounts() })
  }

  if (req.method === 'POST' && url.pathname === '/api/presence/payment-success') {
    const body = await parseJsonBody(req)
    const memberId = String(body.memberId || '').trim()
    if (!memberId) return sendJson(res, 400, { ok: false, error: 'memberId required' })
    const { fulfillment } = applyPaymentSuccessPayload(body, req)
    persistMembers()
    return sendJson(res, 200, {
      ok: true,
      counts: makeCounts(),
      vipActivated: fulfillment.ok,
      vipError: fulfillment.ok ? '' : fulfillment.error,
      profile: fulfillment.profile,
      order: fulfillment.order,
    })
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
    pruneExpiredReadRecords()
    persistMembers()
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'GET' && url.pathname === '/api/reviews') {
    const novelId = String(url.searchParams.get('novelId') || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const votes = resolveNovelReviewVotes(novelId)
    const voteProfiles = resolveNovelReviewVoteProfiles(novelId)
    const items = resolveNovelReviews(novelId)
      .slice()
      .sort((a, b) => Number(b?.at || 0) - Number(a?.at || 0))
      .map((it) => {
        const voteRow = normalizeVoteEntryIn(votes[String(it.id)] || {})
        const commentProfiles = voteProfiles[String(it.id)] && typeof voteProfiles[String(it.id)] === 'object'
          ? voteProfiles[String(it.id)]
          : {}
        let latestLikeAt = 0
        let latestLikeUserId = ''
        let latestLikeUserName = ''
        let latestLikeUserAvatar = ''
        let firstLikeAt = Number.POSITIVE_INFINITY
        let firstLikeUserId = ''
        let firstLikeUserName = ''
        let firstLikeUserAvatar = ''
        const likeUsers = []
        for (const uid of voteRow.up) {
          const p = commentProfiles[String(uid)] && typeof commentProfiles[String(uid)] === 'object'
            ? commentProfiles[String(uid)]
            : null
          const ts = Number(p?.lastUpAt || 0)
          if (ts >= latestLikeAt) {
            latestLikeAt = ts
            latestLikeUserId = String(uid || '').trim()
            latestLikeUserName = String(p?.name || '').trim().slice(0, 120)
            latestLikeUserAvatar = String(p?.avatar || '').trim().slice(0, 500)
          }
          const firstTs = ts > 0 ? ts : Number.POSITIVE_INFINITY
          if (firstTs <= firstLikeAt) {
            firstLikeAt = firstTs
            firstLikeUserId = String(uid || '').trim()
            firstLikeUserName = String(p?.name || '').trim().slice(0, 120)
            firstLikeUserAvatar = String(p?.avatar || '').trim().slice(0, 500)
          }
          if (!firstLikeUserId) {
            firstLikeUserId = String(uid || '').trim()
            firstLikeUserName = String(p?.name || '').trim().slice(0, 120)
            firstLikeUserAvatar = String(p?.avatar || '').trim().slice(0, 500)
          }
          likeUsers.push({
            userId: String(uid || '').trim(),
            name: String(p?.name || '').trim().slice(0, 120),
            avatar: String(p?.avatar || '').trim().slice(0, 500),
            at: Number.isFinite(ts) && ts > 0 ? ts : 0,
          })
        }
        return {
          ...it,
          likes: voteRow.up.length,
          dislikes: voteRow.down.length,
          latestLikeAt,
          latestLikeUserId,
          latestLikeUserName,
          latestLikeUserAvatar,
          firstLikeUserId,
          firstLikeUserName,
          firstLikeUserAvatar,
          likeUsers,
        }
      })
    return sendJson(res, 200, { ok: true, novelId, items })
  }

  if (req.method === 'POST' && url.pathname === '/api/reviews/append') {
    const body = await parseJsonBody(req)
    const novelId = String(body.novelId || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const item = normalizeReviewIn(applyViewerSnapshotFields(body.entry ?? body), novelId)
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
    const allProfiles = { ...resolveNovelReviewVoteProfiles(novelId) }
    const voteRow = normalizeVoteEntryIn(allVotes[commentId] || {})
    const upSet = new Set(voteRow.up)
    const downSet = new Set(voteRow.down)
    upSet.delete(voterId)
    downSet.delete(voterId)
    if (action === 'up') upSet.add(voterId)
    if (action === 'down') downSet.add(voterId)
    const voterNameRaw = String(body.voterName || '').trim()
    const voterNameFallback = voterId.startsWith('tg_') ? voterId.slice(3) : voterId
    const voterName = String(voterNameRaw || voterNameFallback || '').trim().slice(0, 120)
    const voterAvatar = String(body.voterAvatar || '').trim().slice(0, 500)
    const commentProfiles = allProfiles[commentId] && typeof allProfiles[commentId] === 'object'
      ? { ...allProfiles[commentId] }
      : {}
    const prevProfile = commentProfiles[voterId] && typeof commentProfiles[voterId] === 'object'
      ? commentProfiles[voterId]
      : {}
    if (action === 'clear') {
      delete commentProfiles[voterId]
    } else {
      commentProfiles[voterId] = {
        name: voterName || String(prevProfile?.name || ''),
        avatar: voterAvatar || String(prevProfile?.avatar || ''),
        lastUpAt: action === 'up' ? now() : Number(prevProfile?.lastUpAt || 0),
      }
    }
    allVotes[commentId] = { up: [...upSet], down: [...downSet] }
    allProfiles[commentId] = commentProfiles
    novelReviewVotes.set(novelId, allVotes)
    novelReviewVoteProfiles.set(novelId, allProfiles)
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

  if (req.method === 'GET' && url.pathname === '/api/novel-favorites') {
    const novelId = String(url.searchParams.get('novelId') || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const userId = String(url.searchParams.get('userId') || '').trim()
    const users = resolveNovelFavoriteUsers(novelId)
    const count = users.length
    const favorited = userId ? users.includes(userId) : false
    return sendJson(res, 200, { ok: true, novelId, count, favorited })
  }

  if (req.method === 'GET' && url.pathname === '/api/novel-favorites/by-user') {
    const userId = String(url.searchParams.get('userId') || '').trim()
    if (!userId) return sendJson(res, 400, { ok: false, error: 'userId required' })
    const items = resolveUserFavoritedNovels(userId)
    return sendJson(res, 200, {
      ok: true,
      userId,
      novelIds: items.map((it) => it.novelId),
      items,
    })
  }

  if (req.method === 'POST' && url.pathname === '/api/novel-favorites/toggle') {
    const body = await parseJsonBody(req)
    const novelId = String(body.novelId || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const userId = String(body.userId || '').trim()
    if (!userId) return sendJson(res, 400, { ok: false, error: 'userId required' })
    const shouldFavorite = Boolean(body.favorite)
    const prev = normalizeNovelFavoritesRow(novelFavorites.get(novelId))
    const users = new Set(prev.users)
    const atByUser = { ...prev.atByUser }
    let favoritedAtMs = 0
    if (shouldFavorite) {
      users.add(userId)
      favoritedAtMs = Date.now()
      atByUser[userId] = favoritedAtMs
    } else {
      users.delete(userId)
      delete atByUser[userId]
    }
    novelFavorites.set(novelId, { users: [...users], atByUser })
    persistMembers()
    return sendJson(res, 200, {
      ok: true,
      novelId,
      count: users.size,
      favorited: shouldFavorite,
      favoritedAtMs: shouldFavorite ? favoritedAtMs : null,
    })
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/reset-interactions') {
    if (!requireAdmin(req, res)) return
    resetInteractionData()
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url.pathname === '/api/admin-legacy/reset-interactions') {
    if (!requireLegacyAdmin(req, res)) return
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
    let item = normalizeReplyIn(applyViewerSnapshotFields(body.entry ?? body), novelId, parentCommentId)
    if (!item) return sendJson(res, 400, { ok: false, error: 'invalid reply entry' })
    item = enrichReplyNotificationTargets(item, novelId)
    const items = resolveNovelReplies(novelId).slice()
    items.push(item)
    novelReplies.set(novelId, { items })
    persistMembers()
    return sendJson(res, 200, { ok: true, novelId, item })
  }

  if (req.method === 'POST' && url.pathname === '/api/reports/append') {
    const body = await parseJsonBody(req)
    const novelId = String(body.novelId || '').trim()
    if (!novelId) return sendJson(res, 400, { ok: false, error: 'novelId required' })
    const item = normalizeReportIn(applyViewerSnapshotFields(body.entry ?? body), novelId)
    if (!item) return sendJson(res, 400, { ok: false, error: 'invalid report entry' })
    const items = resolveNovelReports(novelId).slice()
    items.push(item)
    novelReports.set(novelId, { items })
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

  if (req.method === 'GET' && url.pathname === '/api/reading-records/by-member') {
    const memberId = String(url.searchParams.get('memberId') || '').trim()
    if (!memberId) return sendJson(res, 400, { ok: false, error: 'memberId required' })
    pruneExpiredReadRecords()
    const items = readRecords
      .filter((it) => String(it?.memberId || '').trim() === memberId)
      .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0))
    return sendJson(res, 200, { ok: true, memberId, items })
  }

  if (req.method === 'GET' && url.pathname === '/api/admin-legacy/member-ips') {
    if (!requireLegacyAdmin(req, res)) return
    const items = [...knownMembers]
      .map((memberId) => {
        const rec = records.get(memberId) || {}
        const registerIp = String(memberRegisterIp.get(memberId) || '')
        const registerLocation = String(memberRegisterGeo.get(memberId) || '')
        const loginIp = String(memberLastLoginIp.get(memberId) || '')
        const loginLocation = String(memberLastLoginGeo.get(memberId) || '')
        return {
          memberId,
          registerAt: Number(memberFirstSeenAt.get(memberId) || 0),
          registerIp,
          registerLocation,
          loginAt: Number(memberLastLoginAt.get(memberId) || Number(rec?.lastSeenAt || 0)),
          loginIp,
          loginLocation,
          online: Number(rec?.lastSeenAt || 0) >= now() - ONLINE_WINDOW_MS,
        }
      })
      .sort((a, b) => Number(b?.loginAt || 0) - Number(a?.loginAt || 0))
    return sendJson(res, 200, { ok: true, items })
  }

  if (req.method === 'GET' && url.pathname === '/api/admin-legacy/reading-records') {
    if (!requireLegacyAdmin(req, res)) return
    return sendJson(res, 200, { ok: true, items: readRecords })
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/reports') {
    if (!requireAdmin(req, res)) return
    return sendJson(res, 200, { ok: true, items: buildAdminReports() })
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

const migrationResults = runAllLegacyMigrations()
initAppFiltersStore()
loadPersistedMembers()
initNovelCoverUpload()
initNovelsStore()
  .then(() => {
    server.listen(PORT, HOST, () => {
      // eslint-disable-next-line no-console
      console.log(`[presence] listening at http://${HOST}:${PORT}`)
      console.log(`[data] persistent dir: ${PERSISTENT_DATA_DIR}`)
      console.log(`[novels-store] data file: ${getNovelsDataFilePath()}`)
      console.log(`[novels-store] count: ${getNovelsCount()}`)
      console.log('[migrate] results:', JSON.stringify(migrationResults))
    })
  })
  .catch((err) => {
    console.error('[novels-store] init failed', err)
    process.exit(1)
  })
