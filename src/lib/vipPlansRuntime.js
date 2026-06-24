import { apiUrl } from './apiBase.js'
import {
  VIP_MEMBER_FOOTER_KM,
  VIP_PLAN_TIER_ACCENT_COLOR,
  VIP_PLAN_TIER_CLASS,
  buildVipPlansPublicPayload,
  formatVipOrderProductLabel,
  isVipPlansAuthorMember,
} from '../data/vipPlansCatalog.js'

export { VIP_PLAN_TIER_CLASS, VIP_PLAN_TIER_ACCENT_COLOR, formatVipOrderProductLabel }

export const VIP_PLANS_STALE_MS = 30 * 1000

/** @type {object | null} */
let cachedPayload = null
/** @type {number} */
let fetchedAt = 0
/** @type {Promise<object> | null} */
let loadPromise = null

function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object') return null
  const plans = Array.isArray(raw.plans) ? raw.plans : null
  if (!plans?.length) return null
  const footerKm =
    typeof raw.footerKm === 'string' && raw.footerKm.trim()
      ? raw.footerKm.trim()
      : VIP_MEMBER_FOOTER_KM
  const sorted = [...plans].sort(
    (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
  )
  const plansAuthorRaw = Array.isArray(raw.plansAuthor) ? raw.plansAuthor : null
  const plansAuthor =
    plansAuthorRaw && plansAuthorRaw.length > 0
      ? [...plansAuthorRaw].sort(
          (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
        )
      : null
  return {
    version: Number(raw.version) || 1,
    updatedAtMs: Number(raw.updatedAtMs || 0) || Date.now(),
    footerKm,
    plans: sorted,
    ...(plansAuthor ? { plansAuthor } : {}),
  }
}

export function getVipPlansCatalogSync() {
  return cachedPayload
}

export function invalidateVipPlansCache() {
  cachedPayload = null
  fetchedAt = 0
  loadPromise = null
}

export async function loadVipPlansCatalog({ force = false } = {}) {
  if (!force && cachedPayload && Date.now() - fetchedAt <= VIP_PLANS_STALE_MS) {
    return cachedPayload
  }
  if (!force && loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const res = await fetch(apiUrl('/api/vip-plans'), { cache: 'no-store' })
      if (!res.ok) throw new Error(`vip-plans ${res.status}`)
      const data = await res.json()
      const norm = normalizePayload(data)
      if (norm) {
        cachedPayload = norm
        fetchedAt = Date.now()
        return cachedPayload
      }
    } catch {
      // fall through
    }
    if (import.meta.env.DEV) {
      cachedPayload = normalizePayload(buildVipPlansPublicPayload())
      fetchedAt = Date.now()
      return cachedPayload
    }
    cachedPayload = {
      version: 1,
      footerKm: VIP_MEMBER_FOOTER_KM,
      plans: [],
      plansAuthor: [],
    }
    fetchedAt = Date.now()
    return cachedPayload
  })().finally(() => {
    loadPromise = null
  })

  return loadPromise
}

export function getVipPlansCatalogForRole(role, payload = cachedPayload) {
  const data = payload || cachedPayload
  if (!data) return []
  const enabledOnly = (list) => (Array.isArray(list) ? list.filter((p) => p.enabled !== false) : [])
  if (isVipPlansAuthorMember(role) && Array.isArray(data.plansAuthor) && data.plansAuthor.length) {
    return enabledOnly(data.plansAuthor)
  }
  return enabledOnly(data.plans)
}

export function getVipPlanById(planId, opts = {}) {
  const id = String(planId || '').trim()
  if (!id) return null
  const list = getVipPlansCatalogForRole(opts.authorPricing ? 'author' : 'normal')
  return list.find((p) => p.planId === id) ?? null
}

export function getVipPlanForPurchase(planId, role) {
  const authorPricing = isVipPlansAuthorMember(role)
  return getVipPlanById(planId, { authorPricing })
}

export function getVipPlanTierClass(planId) {
  const id = String(planId || '').trim()
  return VIP_PLAN_TIER_CLASS[id] || VIP_PLAN_TIER_CLASS.vip_entry
}

export function getVipPlanTierAccentColor(planId) {
  const id = String(planId || '').trim()
  return VIP_PLAN_TIER_ACCENT_COLOR[id] || VIP_PLAN_TIER_ACCENT_COLOR.vip_entry
}

export function getVipMemberFooterKm(payload = cachedPayload) {
  return payload?.footerKm || VIP_MEMBER_FOOTER_KM
}
