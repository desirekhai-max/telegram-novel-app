/**
 * ABA PayWay 对外展示用中性文案（投资人要求）。
 * 禁止：小说名、高棉套餐营销标题、章节名等敏感/业务暴露内容。
 *
 * PayWay purchase API 字段映射（本仓库）：
 * - order_title / item_name / payment description → `items`（base64 明文行）
 * - description / order metadata → `custom_fields`（JSON，仅中性键值）
 * - 订单备注（应用内订单 product）→ `getNeutralVipOrderProductLabel()`
 */

export const PAYWAY_NEUTRAL_ORDER_TITLE = 'VIP-Subscription'
export const PAYWAY_NEUTRAL_ITEM_NAME = 'VIP-Subscription'
export const PAYWAY_NEUTRAL_DESCRIPTION = 'Digital Content'
export const PAYWAY_NEUTRAL_PAYMENT_DESCRIPTION = 'Reading-Topup'
export const PAYWAY_NEUTRAL_ORDER_NOTE = 'VIP-Subscription'

/** PayWay `items` 字段解码后的单行商品说明（ABA 收银台展示） */
export function getPayWayItemsLine() {
  return PAYWAY_NEUTRAL_ITEM_NAME
}

/**
 * PayWay `custom_fields`：结构化中性元数据（不含书名/套餐 Khmer 标题）。
 * @param {{ tranId?: string, planId?: string }} [meta]
 */
export function buildPayWayCustomFields(meta = {}) {
  const ref = String(meta.tranId || '').trim().slice(0, 20)
  const sku = String(meta.planId || '').trim().slice(0, 40)
  return JSON.stringify({
    order_title: PAYWAY_NEUTRAL_ORDER_TITLE,
    description: PAYWAY_NEUTRAL_DESCRIPTION,
    item_name: PAYWAY_NEUTRAL_ITEM_NAME,
    payment_description: PAYWAY_NEUTRAL_PAYMENT_DESCRIPTION,
    note: PAYWAY_NEUTRAL_ORDER_NOTE,
    ...(ref ? { ref } : {}),
    ...(sku ? { sku } : {}),
  })
}

/** 应用内 VIP 订单 `product` / 备注展示（非 PayWay，但统一中性） */
export function getNeutralVipOrderProductLabel() {
  return PAYWAY_NEUTRAL_ORDER_NOTE
}
