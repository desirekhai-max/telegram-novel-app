/**
 * Verify Check Transaction polling interval and dedupe against local API.
 * Usage: node scripts/verify-check-transaction-polling.mjs <realTranId> <telegramUserId> [baseUrl] [planId]
 */
import { setTimeout as sleep } from 'node:timers/promises'

const tranId = String(process.argv[2] || '').trim()
const telegramUserIdRaw = String(process.argv[3] || '').trim()
const telegramUserId = Number(telegramUserIdRaw)
const baseUrl = String(process.argv[4] || 'http://127.0.0.1:8787').replace(/\/+$/, '')
const planId = String(process.argv[5] || 'vip_entry').trim()

if (!tranId || !telegramUserIdRaw || !Number.isFinite(telegramUserId)) {
  console.error('Usage: node scripts/verify-check-transaction-polling.mjs <realTranId> <telegramUserId> [baseUrl] [planId]')
  process.exit(1)
}

const POLL_MS = 4000
const POLL_COUNT = 5

function formatTs(ms) {
  const d = new Date(ms)
  const pad = (n, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

async function confirmOnce() {
  const started = Date.now()
  const res = await fetch(`${baseUrl}/api/vip-orders/confirm-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramUser: { id: telegramUserId, first_name: 'PollVerify' },
      tranId,
      planId,
      strictVerify: true,
    }),
  })
  await res.json().catch(() => ({}))
  return started
}

async function runStrictPollChain() {
  const stamps = []
  for (let i = 0; i < POLL_COUNT; i += 1) {
    const started = await confirmOnce()
    stamps.push(started)
    if (i < POLL_COUNT - 1) {
      const elapsed = Date.now() - started
      const wait = Math.max(0, POLL_MS - elapsed)
      await sleep(wait)
    }
  }
  return stamps
}

async function runParallelBurst(count = 3) {
  return Promise.all(Array.from({ length: count }, () => confirmOnce()))
}

async function main() {
  console.log(`Test TranId:\n${tranId}\n`)

  const burst = await runParallelBurst(3)
  const burstUniqueMs = new Set(burst.map((t) => Math.floor(t / 1000))).size
  console.log('Parallel burst (simulates old triple same-second):')
  burst.forEach((t, i) => {
    console.log(`Burst #${i + 1} ${formatTs(t)}`)
  })
  console.log(`Burst unique seconds: ${burstUniqueMs} (dedupe expects 1 in-flight → 1 PayWay call)\n`)

  const stamps = await runStrictPollChain()
  console.log('Strict 4s poll chain:')
  stamps.forEach((t, i) => {
    if (i === 0) {
      console.log(`Poll #${i + 1}\n${formatTs(t)}`)
      return
    }
    const delta = (t - stamps[i - 1]) / 1000
    console.log(`\nPoll #${i + 1}\n${formatTs(t)}\nΔ ${delta.toFixed(3)}s`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
