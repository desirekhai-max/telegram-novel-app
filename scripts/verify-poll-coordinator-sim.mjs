/**
 * Simulates coordinator + in-flight dedupe (no network).
 */
import { setTimeout as sleep } from 'node:timers/promises'

const POLL_MS = 4000

function formatTs(ms) {
  const d = new Date(ms)
  const pad = (n, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

async function simulateCoordinator() {
  const tranId = 'SIM-TRAN-001'
  const inflight = new Map()
  const callTimes = []

  async function confirmViewerVipPayment({ tranId: tid }) {
    const key = String(tid || '').trim()
    if (inflight.has(key)) return inflight.get(key)
    const work = (async () => {
      callTimes.push(Date.now())
      await sleep(80)
      return { ok: false, error: 'payment_not_confirmed' }
    })()
    inflight.set(key, work)
    work.finally(() => {
      if (inflight.get(key) === work) inflight.delete(key)
    })
    return work
  }

  const sessions = new Map()

  function subscribe(tranId, listener) {
    let session = sessions.get(tranId)
    if (!session) {
      session = { listeners: new Set(), timerId: 0, stopped: false, inFlight: false }
      sessions.set(tranId, session)
      void tick(session)
    }
    session.listeners.add(listener)
    return () => session.listeners.delete(listener)
  }

  async function tick(session) {
    if (session.stopped || session.inFlight) return
    session.inFlight = true
    try {
      await confirmViewerVipPayment({ tranId })
    } finally {
      session.inFlight = false
    }
    if (!session.stopped) {
      session.timerId = setTimeout(() => {
        session.timerId = 0
        void tick(session)
      }, POLL_MS)
    }
  }

  const noop = () => {}
  subscribe(tranId, noop)
  subscribe(tranId, noop)
  subscribe(tranId, noop)

  await sleep(50)
  const burstCount = callTimes.length

  await sleep(POLL_MS * 4 + 200)
  clearTimeout(sessions.get(tranId)?.timerId)

  return { burstCount, callTimes }
}

const { burstCount, callTimes } = await simulateCoordinator()

console.log('Coordinator simulation (3 subscribers, same tran_id):')
console.log(`First burst API calls: ${burstCount} (expect 1)`)
console.log('')
console.log('Test TranId:\nSIM-TRAN-001\n')
callTimes.slice(0, 5).forEach((t, i) => {
  if (i === 0) {
    console.log(`Poll #${i + 1}\n${formatTs(t)}`)
    return
  }
  const delta = (t - callTimes[i - 1]) / 1000
  console.log(`\nPoll #${i + 1}\n${formatTs(t)}\nΔ ${delta.toFixed(3)}s`)
})
