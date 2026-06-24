import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PERSISTENT_DATA_DIR } from './persistent-data-dir.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BUNDLED_FILE = path.join(__dirname, 'vip-plans.json')
const DATA_FILE = path.join(PERSISTENT_DATA_DIR, 'vip-plans.json')

const DEFAULT_FOOTER_KM = 'អាចអានរឿងទាំងអស់បានក្នុងអំឡុងពេលជាសមាជិកVIP'
const DEFAULT_PRICE_HINT_KM = 'សិទ្ធិអាន VIP'

/** @type {object | null} */
let cachedPayload = null

function normalizePlan(raw = {}, index = 0) {
  const planId = String(raw.planId || '').trim()
  if (!planId) return null
  return {
    planId,
    name: String(raw.name || '').trim().slice(0, 80),
    enabled: raw.enabled === false || raw.enabled === 'false' || raw.enabled === 0 ? false : true,
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : index + 1,
    featured: raw.featured === true || raw.featured === 'true' || raw.featured === 1,
    titleKm: String(raw.titleKm || '').trim().slice(0, 240),
    flagKm: String(raw.flagKm || '').trim().slice(0, 480),
    priceUsdLabel: String(raw.priceUsdLabel || '$0').trim().slice(0, 32),
    priceHintKm: String(raw.priceHintKm || DEFAULT_PRICE_HINT_KM).trim().slice(0, 120),
    durationKm: String(raw.durationKm || '').trim().slice(0, 240),
    durationHours: Math.max(0, Number(raw.durationHours || 0)),
    buyButtonKm: String(raw.buyButtonKm || 'ទិញកម្រិតនេះ').trim().slice(0, 120),
  }
}

function normalizePlanList(rawList) {
  const itemsIn = Array.isArray(rawList) ? rawList : []
  const items = []
  const seen = new Set()
  itemsIn.forEach((row, i) => {
    const plan = normalizePlan(row, i)
    if (!plan || seen.has(plan.planId)) return
    seen.add(plan.planId)
    items.push(plan)
  })
  items.sort((a, b) => a.sortOrder - b.sortOrder || a.planId.localeCompare(b.planId))
  return items
}

function normalizePayload(raw = {}) {
  const plans = normalizePlanList(raw.plans)
  const plansAuthor = normalizePlanList(raw.plansAuthor)
  if (!plans.length) throw new Error('plans required')
  return {
    version: Number(raw.version) || 1,
    updatedAtMs: Number(raw.updatedAtMs || 0) || Date.now(),
    footerKm:
      typeof raw.footerKm === 'string' && raw.footerKm.trim()
        ? raw.footerKm.trim().slice(0, 500)
        : DEFAULT_FOOTER_KM,
    plans,
    ...(plansAuthor.length ? { plansAuthor } : {}),
  }
}

function readFilePayload(filePath) {
  if (!fs.existsSync(filePath)) return null
  try {
    return normalizePayload(JSON.parse(fs.readFileSync(filePath, 'utf8')))
  } catch {
    return null
  }
}

function persist(payload) {
  const next = { ...payload, updatedAtMs: Date.now() }
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  cachedPayload = next
  return next
}

export function getVipPlansDataFilePath() {
  return DATA_FILE
}

export function initVipPlansStore() {
  fs.mkdirSync(PERSISTENT_DATA_DIR, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) {
    if (fs.existsSync(BUNDLED_FILE)) {
      fs.copyFileSync(BUNDLED_FILE, DATA_FILE)
      console.log(`[vip-plans] seeded from ${BUNDLED_FILE} -> ${DATA_FILE}`)
    }
  } else if (!fs.existsSync(BUNDLED_FILE)) {
    console.warn('[vip-plans] bundled file missing; using existing data file only')
  }
  cachedPayload = readFilePayload(DATA_FILE) || readFilePayload(BUNDLED_FILE)
  if (cachedPayload) {
    console.log(`[vip-plans] loaded ${cachedPayload.plans.length} plan(s) from ${DATA_FILE}`)
  }
}

export function getVipPlansPayload() {
  if (cachedPayload) return { ...cachedPayload }
  cachedPayload = readFilePayload(DATA_FILE) || readFilePayload(BUNDLED_FILE)
  if (!cachedPayload) {
    return {
      version: 1,
      updatedAtMs: Date.now(),
      footerKm: DEFAULT_FOOTER_KM,
      plans: [],
      plansAuthor: [],
    }
  }
  return { ...cachedPayload }
}

export function saveVipPlansPayload(raw) {
  const normalized = normalizePayload(raw)
  return persist(normalized)
}

export function getVipPlanForRole(planId, role = 'normal') {
  const pid = String(planId || '').trim()
  if (!pid) return null
  const payload = getVipPlansPayload()
  const author = String(role || '').toLowerCase().trim() === 'author'
  const list =
    author && Array.isArray(payload.plansAuthor) && payload.plansAuthor.length > 0
      ? payload.plansAuthor
      : payload.plans
  const row = list.find((it) => String(it?.planId || '').trim() === pid && it.enabled !== false)
  if (!row) return null
  return {
    planId: row.planId,
    titleKm: row.titleKm,
    durationKm: row.durationKm,
    durationHours: row.durationHours,
    priceUsdLabel: row.priceUsdLabel,
  }
}
