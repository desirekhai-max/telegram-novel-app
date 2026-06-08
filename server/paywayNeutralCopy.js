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

/**
 * QR API `custom_fields`：须 base64(JSON)，且编码后总长 ≤ 255。
 * 使用精简键值，避免 purchase 用的完整 custom_fields 超长被拒（code 04）。
 */
export function buildPayWayQrCustomFieldsBase64(meta = {}) {
  const payload = {}
  const ref = String(meta.tranId || '').trim().slice(0, 20)
  const sku = String(meta.planId || '').trim().slice(0, 40)
  if (ref) payload.ref = ref
  if (sku) payload.sku = sku
  if (!Object.keys(payload).length) return ''
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  return encoded.length <= 255 ? encoded : ''
}

/** 应用内 VIP 订单 `product` / 备注展示（非 PayWay，但统一中性） */
export function getNeutralVipOrderProductLabel() {
  return PAYWAY_NEUTRAL_ORDER_NOTE
}
