import fs from 'node:fs'
import path from 'node:path'
import { PERSISTENT_DATA_DIR } from './persistent-data-dir.js'

const SETTINGS_FILE = path.join(PERSISTENT_DATA_DIR, 'app-settings.json')

const DEFAULT_SETTINGS = {
  version: 1,
  updatedAtMs: 0,
  basic: {
    platformName: '69KKH NOVEL',
    logoUrl: '',
    contact: '',
    about: '',
    terms: '',
    privacy: '',
  },
  payment: {
    merchantId: '',
    apiKey: '',
    sandbox: true,
    production: false,
    abaEnabled: true,
    paywayEnabled: true,
  },
  telegram: {
    botToken: '',
    miniAppUrl: '',
    webhookUrl: '',
  },
  reading: {
    defaultFreeChapters: 3,
    commentModeration: false,
    reportEnabled: true,
    vipEnabled: true,
  },
}

/** @type {object | null} */
let cached = null

function readFileSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
  } catch {
    return null
  }
}

function seedFromEnv(settings) {
  const next = { ...settings }
  next.payment = { ...next.payment }
  next.telegram = { ...next.telegram }

  if (!next.payment.merchantId) {
    next.payment.merchantId = String(process.env.PAYWAY_MERCHANT_ID || '').trim()
  }
  if (!next.payment.apiKey) {
    next.payment.apiKey = String(process.env.PAYWAY_API_KEY || process.env.PAYWAY_PUBLIC_KEY || '').trim()
  }
  if (!next.telegram.botToken) {
    next.telegram.botToken = String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim()
  }
  if (!next.telegram.miniAppUrl) {
    next.telegram.miniAppUrl = String(
      process.env.PAYWAY_APP_PUBLIC_URL || process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || '',
    )
      .trim()
      .replace(/\/+$/, '')
  }
  if (!next.telegram.webhookUrl) {
    next.telegram.webhookUrl = String(process.env.TELEGRAM_WEBHOOK_URL || '').trim()
  }
  if (!next.basic.platformName) {
    next.basic.platformName = '69KKH NOVEL'
  }
  return next
}

function normalizeBool(value, fallback = false) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true
  if (value === false || value === 'false' || value === 0 || value === '0') return false
  return fallback
}

function normalizeSection(raw = {}, defaults = {}) {
  const out = { ...defaults }
  Object.keys(defaults).forEach((key) => {
    if (raw[key] === undefined) return
    const def = defaults[key]
    if (typeof def === 'boolean') out[key] = normalizeBool(raw[key], def)
    else if (typeof def === 'number') {
      const n = Number(raw[key])
      out[key] = Number.isFinite(n) ? n : def
    } else out[key] = String(raw[key] ?? '').trim()
  })
  return out
}

function normalizeSettings(raw = {}) {
  const merged = {
    version: Number(raw.version) || 1,
    updatedAtMs: Number(raw.updatedAtMs) || 0,
    basic: normalizeSection(raw.basic, DEFAULT_SETTINGS.basic),
    payment: normalizeSection(raw.payment, DEFAULT_SETTINGS.payment),
    telegram: normalizeSection(raw.telegram, DEFAULT_SETTINGS.telegram),
    reading: normalizeSection(raw.reading, DEFAULT_SETTINGS.reading),
  }
  merged.reading.defaultFreeChapters = Math.max(
    0,
    Math.min(999, Math.floor(Number(merged.reading.defaultFreeChapters) || 0)),
  )
  if (merged.payment.production) merged.payment.sandbox = false
  else if (merged.payment.sandbox) merged.payment.production = false
  else merged.payment.sandbox = true
  return merged
}

function persist(settings) {
  const next = { ...settings, updatedAtMs: Date.now() }
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true })
  fs.writeFileSync(SETTINGS_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  cached = next
  return next
}

export function initAppSettingsStore() {
  fs.mkdirSync(PERSISTENT_DATA_DIR, { recursive: true })
  const fromFile = readFileSettings()
  if (fromFile) {
    cached = normalizeSettings(seedFromEnv(fromFile))
    return cached
  }
  cached = normalizeSettings(seedFromEnv(JSON.parse(JSON.stringify(DEFAULT_SETTINGS))))
  persist(cached)
  return cached
}

export function getAppSettings() {
  if (!cached) initAppSettingsStore()
  return cached
}

export function getTelegramBotToken() {
  const token = String(getAppSettings()?.telegram?.botToken || '').trim()
  if (token) return token
  return String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim()
}

export function getMiniAppPublicUrl() {
  const url = String(getAppSettings()?.telegram?.miniAppUrl || '').trim().replace(/\/+$/, '')
  if (url) return url
  return String(
    process.env.PAYWAY_APP_PUBLIC_URL || process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || '',
  )
    .trim()
    .replace(/\/+$/, '')
}

export function getReadingSettings() {
  return getAppSettings().reading
}

export function getPaymentChannelSettings() {
  return getAppSettings().payment
}

function maskSecret(value) {
  const s = String(value || '')
  if (!s) return ''
  if (s.length <= 4) return '••••'
  return `••••${s.slice(-4)}`
}

function isMaskedSecretInput(value) {
  const s = String(value || '').trim()
  return !s || s.startsWith('••••')
}

export function getAdminAppSettingsPayload() {
  const settings = getAppSettings()
  return {
    version: settings.version,
    updatedAtMs: settings.updatedAtMs,
    basic: { ...settings.basic },
    payment: {
      merchantId: settings.payment.merchantId,
      apiKey: maskSecret(settings.payment.apiKey),
      apiKeySet: Boolean(settings.payment.apiKey),
      sandbox: settings.payment.sandbox,
      production: settings.payment.production,
      abaEnabled: settings.payment.abaEnabled,
      paywayEnabled: settings.payment.paywayEnabled,
    },
    telegram: {
      botToken: maskSecret(settings.telegram.botToken),
      botTokenSet: Boolean(settings.telegram.botToken),
      miniAppUrl: settings.telegram.miniAppUrl,
      webhookUrl: settings.telegram.webhookUrl,
    },
    reading: { ...settings.reading },
  }
}

export function getPublicAppSettingsPayload() {
  const settings = getAppSettings()
  return {
    platformName: settings.basic.platformName,
    logoUrl: settings.basic.logoUrl,
    contact: settings.basic.contact,
    about: settings.basic.about,
    terms: settings.basic.terms,
    privacy: settings.basic.privacy,
    reading: { ...settings.reading },
    payment: {
      abaEnabled: settings.payment.abaEnabled,
      paywayEnabled: settings.payment.paywayEnabled,
      sandbox: settings.payment.sandbox,
    },
  }
}

export function saveAdminAppSettings(patch = {}) {
  const current = getAppSettings()
  const next = normalizeSettings({
    ...current,
    basic: { ...current.basic, ...(patch.basic || {}) },
    payment: { ...current.payment, ...(patch.payment || {}) },
    telegram: { ...current.telegram, ...(patch.telegram || {}) },
    reading: { ...current.reading, ...(patch.reading || {}) },
  })

  if (patch.payment) {
    if (!isMaskedSecretInput(patch.payment.apiKey)) {
      next.payment.apiKey = String(patch.payment.apiKey || '').trim()
    } else {
      next.payment.apiKey = current.payment.apiKey
    }
    if (patch.payment.production === true) {
      next.payment.production = true
      next.payment.sandbox = false
    } else if (patch.payment.sandbox === true) {
      next.payment.sandbox = true
      next.payment.production = false
    }
  }

  if (patch.telegram && !isMaskedSecretInput(patch.telegram.botToken)) {
    next.telegram.botToken = String(patch.telegram.botToken || '').trim()
  } else if (patch.telegram) {
    next.telegram.botToken = current.telegram.botToken
  }

  return persist(normalizeSettings(next))
}

export function getAppSettingsDataFilePath() {
  return SETTINGS_FILE
}
