/**
 * VIP 套餐文案与定价（与 Mini App `VipPage`、订单演示一致）。
 * - **普通会员**：$1 / 3h、$3 / 12h、$5 / 24h（未登录 `normal` 等走普通目录）
 * - **作者会员价**：$1 / 5h、$3 / 18h、$5 / 36h（仅后端 `role === 'author'` 时启用）
 *
 * 业务能力摘要（简体）：同一美元价、同一 `planId`，普通会员与作者会员到账小时数不同——普通 $1→3h、$3→12h、$5→24h；作者 $1→5h、$3→18h、$5→36h。下单/支付请用 `getVipPlanForPurchase(planId, tgUser)` 快照 `durationHours`，勿仅凭 `planId` 从单一目录取值。
 *
 * 后台「VIP套餐」与此同源；上线后由 GET `/api/vip-plans` 返回同结构 JSON 覆盖展示（可含 `plansAuthor`）。
 *
 * @typedef {object} VipPlanCatalogEntry
 * @property {string} planId 稳定 ID（订单、支付回调请用此字段，勿依赖文案）
 * @property {number} sortOrder 展示顺序，越小越靠上
 * @property {boolean} featured 是否高亮样式（中间「最受欢迎」档）
 * @property {string} titleKm 套餐标题
 * @property {string} flagKm 副标题 / 卖点一行
 * @property {string} priceUsdLabel 价格展示，如 `$1`
 * @property {string} priceHintKm 价格旁小标签，如 VIP 阅读权限
 * @property {string} durationKm 时长说明（展示）
 * @property {number} durationHours 时长数值（小时，供后台/支付逻辑）
 * @property {string} buyButtonKm 按钮文案
 */

/** 每张套餐卡价格旁小标签（与各档统一） */
export const VIP_PLAN_PRICE_HINT_KM = 'សិទ្ធិអាន VIP'

/** 每张套餐卡底部灰色说明（与各档共用） */
export const VIP_MEMBER_FOOTER_KM =
  'អាចអានរឿងទាំងអស់បានក្នុងអំឡុងពេលជាសមាជិកVIP'

/** 普通会员：$1·3h / $3·12h / $5·24h */
export const VIP_PLANS_CATALOG_NORMAL = [
  {
    planId: 'vip_entry',
    sortOrder: 1,
    featured: false,
    titleKm: 'VIPកម្រិតដំបូង',
    flagKm: 'សាកល្បងកម្រិតស្រាល',
    priceUsdLabel: '$1',
    priceHintKm: VIP_PLAN_PRICE_HINT_KM,
    durationKm: 'អានបាន 3 ម៉ោង',
    durationHours: 3,
    buyButtonKm: 'ទិញកម្រិតនេះ',
  },
  {
    planId: 'vip_standard',
    sortOrder: 2,
    featured: true,
    titleKm: 'VIPស្តង់ដារ',
    flagKm: 'ពេញនិយមបំផុត',
    priceUsdLabel: '$3',
    priceHintKm: VIP_PLAN_PRICE_HINT_KM,
    durationKm: 'អានបាន 12 ម៉ោង',
    durationHours: 12,
    buyButtonKm: 'ទិញកម្រិតនេះ',
  },
  {
    planId: 'vip_premium',
    sortOrder: 3,
    featured: false,
    titleKm: 'VIPកម្រិតខ្ពស់',
    flagKm: 'អានដោយគ្មានកំណត់ ២៤ម៉ោង',
    priceUsdLabel: '$5',
    priceHintKm: VIP_PLAN_PRICE_HINT_KM,
    durationKm: 'អានបាន 24 ម៉ោង',
    durationHours: 24,
    buyButtonKm: 'ទិញកម្រិតនេះ',
  },
]

/** 作者会员：$1·5h / $3·18h / $5·36h（planId 与普通档一致，便于订单键） */
export const VIP_PLANS_CATALOG_AUTHOR = [
  {
    planId: 'vip_entry',
    sortOrder: 1,
    featured: false,
    titleKm: 'VIPកម្រិតដំបូង',
    flagKm: 'សាកល្បងកម្រិតស្រាល · អ្នកនិពន្ធ',
    priceUsdLabel: '$1',
    priceHintKm: VIP_PLAN_PRICE_HINT_KM,
    durationKm: 'អានបាន 5 ម៉ោង',
    durationHours: 5,
    buyButtonKm: 'ទិញកម្រិតនេះ',
  },
  {
    planId: 'vip_standard',
    sortOrder: 2,
    featured: true,
    titleKm: 'VIPស្តង់ដារ',
    flagKm: 'ពេញនិយមបំផុត · អ្នកនិពន្ធ',
    priceUsdLabel: '$3',
    priceHintKm: VIP_PLAN_PRICE_HINT_KM,
    durationKm: 'អានបាន 18 ម៉ោង',
    durationHours: 18,
    buyButtonKm: 'ទិញកម្រិតនេះ',
  },
  {
    planId: 'vip_premium',
    sortOrder: 3,
    featured: false,
    titleKm: 'VIPកម្រិតខ្ពស់',
    flagKm: 'អានដោយគ្មានកំណត់ ៣៦ម៉ោង',
    priceUsdLabel: '$5',
    priceHintKm: VIP_PLAN_PRICE_HINT_KM,
    durationKm: 'អានបាន 36 ម៉ោង',
    durationHours: 36,
    buyButtonKm: 'ទិញកម្រិតនេះ',
  },
]

/** @deprecated 与 `VIP_PLANS_CATALOG_NORMAL` 同义，兼容旧 import */
export const VIP_PLANS_CATALOG = VIP_PLANS_CATALOG_NORMAL

/**
 * 是否走「作者会员」时长价目（与普通档同 planId、不同小时数）。
 * @param {'normal'|'author'|string|null|undefined} role
 */
export function isVipPlansAuthorMember(role) {
  return String(role || '').toLowerCase().trim() === 'author'
}

/**
 * @param {'normal'|'author'|string|null|undefined} role
 * @returns {VipPlanCatalogEntry[]}
 */
export function getVipPlansCatalogForRole(role) {
  return isVipPlansAuthorMember(role) ? VIP_PLANS_CATALOG_AUTHOR : VIP_PLANS_CATALOG_NORMAL
}

/**
 * 给接口用的 envelope（与 `server/vip-plans.json` 一致；可含 `plansAuthor`）。
 * @returns {{ version: number, footerKm: string, plans: VipPlanCatalogEntry[], plansAuthor?: VipPlanCatalogEntry[] }}
 */
export function buildVipPlansPublicPayload() {
  return {
    version: 1,
    footerKm: VIP_MEMBER_FOOTER_KM,
    plans: VIP_PLANS_CATALOG_NORMAL.map((p) => ({ ...p })),
    plansAuthor: VIP_PLANS_CATALOG_AUTHOR.map((p) => ({ ...p })),
  }
}

/**
 * @param {string} planId
 * @param {{ authorPricing?: boolean }} [opts]
 */
export function getVipPlanById(planId, opts = {}) {
  const id = String(planId || '').trim()
  const list = opts.authorPricing ? VIP_PLANS_CATALOG_AUTHOR : VIP_PLANS_CATALOG_NORMAL
  return list.find((p) => p.planId === id) ?? null
}

/**
 * 创建订单 / 发起支付时：按购买人当前角色取完整套餐行（含正确的 `durationHours`）。
 * 仅 `planId` 无法区分分支，须与当前 viewer `role` 一起使用。
 * @param {string} planId
 * @param {'normal'|'author'|string|null|undefined} role 购买人角色
 * @returns {VipPlanCatalogEntry | null}
 */
export function getVipPlanForPurchase(planId, role) {
  const authorPricing = isVipPlansAuthorMember(role)
  return getVipPlanById(planId, { authorPricing })
}

/** 订单商品名：中性英文（禁止高棉套餐标题进入支付/订单对外字段） */
export function formatVipOrderProductLabel(_planId, _authorPricing = false) {
  return 'VIP-Subscription'
}
