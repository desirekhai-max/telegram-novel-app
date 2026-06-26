/** 应用内 VIP 订单展示文案（高棉语，UTF-8） */

export const VIP_ORDER_STATUS_SUCCESS_KM = 'បង់ប្រាក់ជោគជ័យ'
export const VIP_ORDER_STATUS_FAILED_KM = 'បង់ប្រាក់មិនជោគជ័យ'

/** 历史错误编码写入的乱码默认值（勿再使用） */
const LEGACY_CORRUPTED_STATUS_LABEL =
  'ß₧öß₧äßƒïß₧ößƒÆß₧Üß₧╢ß₧Çßƒïß₧çßƒäß₧éß₧çßƒÉß₧Ö'

function isCorruptedVipOrderStatusLabel(label) {
  const s = String(label || '').trim()
  if (!s) return true
  if (s === LEGACY_CORRUPTED_STATUS_LABEL) return true
  return /ß[₧ƒ]/.test(s)
}

export function resolveVipOrderStatusLabel(rawLabel, status = 'success') {
  if (isCorruptedVipOrderStatusLabel(rawLabel)) {
    return String(status || '').toLowerCase() === 'success'
      ? VIP_ORDER_STATUS_SUCCESS_KM
      : VIP_ORDER_STATUS_FAILED_KM
  }
  return String(rawLabel || '').trim().slice(0, 120)
}
