import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const envPath = path.join(root, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (key && process.env[key] == null) process.env[key] = value
  }
}

const payway = await import(pathToFileURL(path.join(root, 'server/payway.js')).href)
const status = payway.getPayWaySandboxStatus()
console.log(
  JSON.stringify(
    {
      configured: status.configured,
      merchantIdPresent: status.merchantIdPresent,
      apiKeyPresent: status.apiKeyPresent,
      apiBaseUrl: status.apiBaseUrl,
      PAYWAY_MERCHANT_ID_loaded: Boolean(process.env.PAYWAY_MERCHANT_ID),
      PAYWAY_API_KEY_loaded: Boolean(process.env.PAYWAY_API_KEY),
      PAYWAY_API_URL: process.env.PAYWAY_API_URL || null,
    },
    null,
    2,
  ),
)
