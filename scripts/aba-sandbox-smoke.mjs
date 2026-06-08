/**
 * ABA Sandbox 联调脚本（读取环境变量，不硬编码凭证）
 * 用法：先设置 PAYWAY_* 环境变量，再 node scripts/aba-sandbox-smoke.mjs [baseUrl]
 */
import {
  getPayWaySandboxStatus,
  isPayWayConfigured,
  generateAbaKhqrPayment,
  buildVipTranId,
  checkPayWayTransaction,
} from '../server/payway.js'
import {
  initOrdersStore,
  getOrderByTranId,
  getOrdersDataFilePath,
} from '../server/orders-store.js'

const baseUrl = String(process.argv[2] || 'http://127.0.0.1:8787').replace(/\/+$/, '')
const testUser = { id: 900001001, first_name: 'Sandbox', username: 'sandbox_test' }
const testPlanId = 'vip_entry'

const results = []

function log(section, ok, detail) {
  results.push({ section, ok, detail })
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${section}`)
  if (detail) console.log(detail)
}

async function fetchJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function runModuleChecks() {
  const status = getPayWaySandboxStatus()
  log(
    '1. Sandbox 配置加载',
    isPayWayConfigured() && status.sandboxMode && status.phase1SandboxOnly,
    JSON.stringify(status, null, 2),
  )

  const apiUrl = String(process.env.PAYWAY_API_URL || '').trim()
  if (apiUrl.includes('/payments/generate-qr')) {
    log(
      '1b. API URL 格式提示',
      true,
      'PAYWAY_API_URL 为完整 generate-qr 端点；代码已自动剥离为根路径并重新拼接三端点。推荐联调通过后改为根路径：\n'
        + 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1',
    )
  }

  const tranId = buildVipTranId(testUser.id, Date.now())
  const khqr = await generateAbaKhqrPayment({
    tranId,
    amount: '1.00',
    planId: testPlanId,
    returnDeeplinkUrl: 'https://example.test/vip/payment-return?tran_id=' + encodeURIComponent(tranId),
  })
  const khqrOk = Boolean(khqr.ok && (khqr.qrImage || khqr.qrString || khqr.abapayDeeplink))
  log(
    '2. KHQR API 直连 generate-qr',
    khqrOk,
    khqrOk
      ? `tranId=${tranId} qrImage=${Boolean(khqr.qrImage)} qrString=${Boolean(khqr.qrString)} deeplink=${Boolean(khqr.abapayDeeplink)}`
      : `error=${khqr.error || 'unknown'}`,
  )

  const checkUnpaid = await checkPayWayTransaction(tranId)
  log(
    '3. check-transaction（未支付订单）',
    checkUnpaid.ok === false && (checkUnpaid.error === 'not_approved' || checkUnpaid.status !== 'APPROVED'),
    JSON.stringify({ ok: checkUnpaid.ok, status: checkUnpaid.status, error: checkUnpaid.error }),
  )

  return { tranId, khqrTranId: khqrOk ? tranId : '' }
}

async function runHttpChecks(moduleTranId) {
  let healthOk = false
  try {
    const res = await fetch(`${baseUrl}/api/health/persistence`)
    const data = await res.json()
    healthOk = res.ok && data?.payway?.configured === true
    log(
      '4. HTTP health / payway',
      healthOk,
      JSON.stringify({ status: res.status, payway: data?.payway, ordersCount: data?.ordersCount }, null, 2),
    )
  } catch (err) {
    log('4. HTTP health / payway', false, err instanceof Error ? err.message : String(err))
  }

  const checkout = await fetchJson('/api/vip-orders/checkout', {
    telegramUser: testUser,
    planId: testPlanId,
  })
  const checkoutOk = checkout.status === 200
    && checkout.data?.ok === true
    && checkout.data?.tranId
    && checkout.data?.orderNo
    && checkout.data?.formFields?.hash
  log(
    '5. HTTP checkout 创建订单',
    checkoutOk,
    JSON.stringify({
      status: checkout.status,
      tranId: checkout.data?.tranId,
      orderNo: checkout.data?.orderNo,
      expireAt: checkout.data?.expireAt,
      hasFormFields: Boolean(checkout.data?.formFields?.hash),
      error: checkout.data?.error,
    }, null, 2),
  )

  initOrdersStore()
  const checkoutTranId = String(checkout.data?.tranId || '')
  const storedCheckout = checkoutTranId ? getOrderByTranId(checkoutTranId) : null
  log(
    '5b. orders-store checkout 记录',
    Boolean(storedCheckout && storedCheckout.order_no && storedCheckout.expire_at),
    storedCheckout ? JSON.stringify(storedCheckout, null, 2) : 'no record',
  )

  const khqr = await fetchJson('/api/vip-orders/aba-khqr', {
    telegramUser: testUser,
    planId: testPlanId,
  })
  const khqrOk = khqr.status === 200
    && khqr.data?.ok === true
    && khqr.data?.tranId
    && (khqr.data?.qrImage || khqr.data?.qrString || khqr.data?.abapayDeeplink)
  log(
    '6. HTTP aba-khqr 生成二维码',
    khqrOk,
    JSON.stringify({
      status: khqr.status,
      tranId: khqr.data?.tranId,
      orderNo: khqr.data?.orderNo,
      expireAt: khqr.data?.expireAt,
      qrImage: Boolean(khqr.data?.qrImage),
      qrString: Boolean(khqr.data?.qrString),
      abapayDeeplink: Boolean(khqr.data?.abapayDeeplink),
      error: khqr.data?.error,
    }, null, 2),
  )

  const khqrTranId = String(khqr.data?.tranId || moduleTranId || checkoutTranId || '')
  const confirm = await fetchJson('/api/vip-orders/confirm-payment', {
    telegramUser: testUser,
    planId: testPlanId,
    tranId: khqrTranId,
  })
  const confirmQueries = confirm.status === 402 && confirm.data?.error === 'payment_not_confirmed'
  log(
    '7. HTTP confirm-payment 查询未支付状态',
    confirmQueries,
    JSON.stringify({
      status: confirm.status,
      error: confirm.data?.error,
      paywayStatus: confirm.data?.paywayStatus,
      paywayError: confirm.data?.paywayError,
    }, null, 2),
  )

  return {
    healthOk,
    checkoutOk,
    khqrOk,
    confirmQueries,
    ordersFile: getOrdersDataFilePath(),
  }
}

const moduleResult = await runModuleChecks()
let httpSummary = null
try {
  httpSummary = await runHttpChecks(moduleResult.khqrTranId)
} catch (err) {
  log('HTTP 联调', false, err instanceof Error ? err.message : String(err))
}

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log('\n========== 联调汇总 ==========')
console.log(`通过: ${passed}  失败: ${failed}  合计: ${results.length}`)
if (httpSummary) {
  console.log(`orders 文件: ${httpSummary.ordersFile}`)
}
process.exit(failed > 0 ? 1 : 0)
