import { setTimeout as sleep } from 'node:timers/promises'

const base = String(process.argv[2] || 'http://127.0.0.1:8787').replace(/\/+$/, '')
const tranId = process.argv[3] || 'V65487983105686120'
const telegramUserId = Number(process.argv[4] || '8399654879')
const planId = process.argv[5] || 'vip_premium'

async function confirm(label) {
  const startedAt = new Date()
  const res = await fetch(`${base}/api/vip-orders/confirm-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramUser: { id: telegramUserId, first_name: 'PayWayTimeline' },
      tranId,
      planId,
      strictVerify: true,
    }),
  })
  await res.text()
  console.log(`${label} client=${startedAt.toISOString()} status=${res.status}`)
}

console.log(`Test TranId: ${tranId}`)
await Promise.all([
  confirm('A1_same_second'),
  confirm('A2_same_second'),
  confirm('A3_same_second'),
])
await sleep(1000)
await confirm('B_plus_1s')
await sleep(3000)
await Promise.all([
  confirm('C1_plus_4s'),
  confirm('C2_same_second'),
])
await sleep(3000)
await confirm('D_plus_3s')
await sleep(1000)
await confirm('E_plus_4s')
