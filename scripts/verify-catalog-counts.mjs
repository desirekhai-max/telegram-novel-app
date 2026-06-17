/**
 * 验证三端 /api/novels-catalog 实际返回本数。
 * node scripts/verify-catalog-counts.mjs
 */
const endpoints = [
  ['vite-proxy-5173', 'http://127.0.0.1:5173/api/novels-catalog'],
  ['local-api-8787', 'http://127.0.0.1:8787/api/novels-catalog'],
  ['production', 'https://telegram-novel-app-production-7f1e.up.railway.app/api/novels-catalog'],
]

for (const [label, url] of endpoints) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const data = await res.json()
    const list = Array.isArray(data?.novels) ? data.novels : []
    console.log(`\n[${label}] HTTP ${res.status} count=${list.length}`)
    for (const n of list) console.log(`  ${n.id}\t${n.title}`)
  } catch (err) {
    console.log(`\n[${label}] ERROR ${err?.message || err}`)
  }
}
