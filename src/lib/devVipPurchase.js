/** 仅 Vite 开发服务器为 true；生产 build 恒为 false。 */
export function isDevVipPurchaseEnabled() {
  return import.meta.env.DEV === true
}

/** 本地浏览器无 Telegram 壳时，用于 VIP / ABA KHQR 联调的固定测试用户。 */
export function getDevVipTestTelegramUser() {
  return {
    id: 900000001,
    first_name: 'Dev',
    last_name: 'VIP',
    username: 'dev_vip_tester',
  }
}

/** 是否可在当前环境发起 VIP 购买（正式必须 Telegram 登录）。 */
export function canAccessVipPurchase(tgUser) {
  return Boolean(tgUser?.id) || isDevVipPurchaseEnabled()
}
