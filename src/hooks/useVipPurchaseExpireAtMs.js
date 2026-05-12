import { useSyncExternalStore } from 'react'
import {
  getPurchasedVipExpireAtMsSnapshot,
  subscribePurchasedVip,
} from '../lib/vipMembership.js'

/**
 * 当前登录 Telegram 用户的购买 VIP 到期时间戳（毫秒）。未登录恒为 0。
 * @param {number | string | null | undefined} tgUserId
 */
export function useVipPurchaseExpireAtMs(tgUserId) {
  return useSyncExternalStore(
    subscribePurchasedVip,
    () => getPurchasedVipExpireAtMsSnapshot(tgUserId),
    () => 0,
  )
}
