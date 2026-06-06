/**
 * សារកំហុស / ការព្រមានសម្រាប់អ្នកប្រើ — ប្រើរួមទូទាំងកម្មវិធី។
 */

/** បម្លែងសារបច្ចេកទេសពី API / fetch ទៅកាន់ភាសាខ្មែរ (រក្សាលេខកូដ HTTP ប្រសិនបើមាន) */
export function apiVerboseErrorKm(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const low = s.toLowerCase()
  if (low === 'network error' || (low.includes('network') && low.includes('error'))) {
    return 'មិនអាចភ្ជាប់បណ្តាញ។'
  }
  if (/^http\s*\d{3}/i.test(s) || /^HTTP\s*\d{3}/i.test(s)) {
    const clip = s.length > 200 ? `${s.slice(0, 197)}…` : s
    return `ម៉ាស៊ីនមេត្រឡប់មក៖ ${clip}`
  }
  if (/failed|error:/i.test(s) && s.length < 400) {
    const clip = s.length > 200 ? `${s.slice(0, 197)}…` : s
    return `ប្រតិបត្តិការមិនបានសម្រេច៖ ${clip}`
  }
  const clip = s.length > 200 ? `${s.slice(0, 197)}…` : s
  return clip
}

export function translateBackendLoginErrorKm(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const low = s.toLowerCase()
  if (/登录失败|账号|密码|动态码|验证码|invalid|unauthorized|credential|otp/i.test(low)) {
    return 'គណនី ពាក្យសម្ងាត់ ឬលេខកូដមិនត្រឹមត្រូវ។'
  }
  return apiVerboseErrorKm(s)
}

export const ADMIN_LOGIN_FAIL_DEFAULT_KM = 'មិនអាចចូលបាន។ សូមពិនិត្យព័ត៌មាន។'
export const ADMIN_SESSION_UNAVAILABLE_KM = 'មិនអាចរក្សាសេសុនកម្មវិធីរុករកបាន។ សូមព្យាយាមម្តងទៀត។'

export const ADMIN_LOGIN_ERR_NEED_FIELDS_KM = 'សូមបំពេញគណនី ពាក្យសម្ងាត់ និងលេខកូដបញ្ជាក់។'
export const ADMIN_LOGIN_ERR_CAPTCHA_KM = 'លេខកូដបញ្ជាក់មិនត្រឹមត្រូវ។'
export const ADMIN_OTP_ERR_TIMEOUT_KM = 'ផុតពេលផ្ទៀងផ្ទាត់។ សូមផ្ទុកទំព័រឡើងវិញ។'
export const ADMIN_OTP_ERR_DIGITS_KM = 'សូមបញ្ចូលលេខ ៦ ខ្ទង់។'
export const ADMIN_OTP_ERR_LOGIN_KM = 'គណនី ពាក្យសម្ងាត់ ឬលេខកូដ Google មិនត្រឹមត្រូវ។'

/** មតិ / របាយ / ឆ្លើយតប */
export function formatReaderSubmitErrorKm(technicalDetail, endpoint) {
  const normalized = apiVerboseErrorKm(technicalDetail)
  const tech = normalized ? ` (${normalized})` : ''
  const api =
    endpoint != null && String(endpoint).trim() ? `\nAPI: ${String(endpoint).trim()}` : ''
  return `មិនអាចផ្ញើបាន។ សូមពិនិត្យការភ្ជាប់អ៊ីនធឺណិត ឬព្យាយាមម្តងទៀតនៅពេលក្រោយ។${tech}${api}`
}

/** រកមិនឃើញ​រឿង */
export const READER_NOVEL_NOT_FOUND_TITLE_KM = 'រកមិនឃើញ'
export const READER_NOVEL_NOT_FOUND_DESC_KM = 'រឿងនេះមិនមាន ឬត្រូវបានដកចេញរួច។'
export const READER_BACK_TO_LIST_KM = 'ត្រឡប់ទៅបញ្ជី'

export const READER_NO_CHAPTER_YET_KM = 'មិនទាន់មានជំពូក'
export const READER_NO_BODY_KM = 'មិនទាន់មានខ្លឹមសារ'
export const READER_THEME_UNCATEGORIZED_KM = 'មិនទាន់ចាត់ថ្នាក់'

/** ទំព័រអានជំពូក — ព័ត៌មានក្រោមចំណងជើងជំពូក */
export const READER_ARTICLE_AUTHOR_LABEL_KM = 'អ្នកនិពន្ធ'
export const READER_ARTICLE_AUTHOR_UNKNOWN_KM = 'មិនស្គាល់'
export const READER_ARTICLE_WORD_COUNT_LABEL_KM = 'ចំនួនអក្សរ'
export const READER_ARTICLE_WORD_UNIT_KM = 'អក្សរ'

/** Fallback title text when sharing a novel page without a title */
export const READER_SHARE_DETAIL_FALLBACK_KM = 'ព័ត៌មានលម្អិតរឿង'

/** សមាជិកធម្មតា — អានបានតែភាគទី ១ */
export const READER_VIP_CHAPTER_GATE_TITLE_KM = 'ត្រូវការសមាជិក VIP'
export const READER_VIP_CHAPTER_GATE_DESC_KM =
  'សមាជិកធម្មតាអាចអានបានតែភាគទី ១។ សូមក្លាយជាសមាជិក VIP ដើម្បីអានភាគបន្ទាប់។'

/** VIP — ទិញកញ្ចប់ត្រូវការចូលគណនី Telegram */
export const VIP_LOGIN_GATE_TITLE_KM = 'ការជូនដំណឹង'
export const VIP_LOGIN_GATE_DESC_KM =
  'សូមចូលគណនីមុនពេលទិញសមាជិក VIP។ សូមបើកក្នុង Telegram Mini App ដើម្បីបន្ត។'

/** ស្វែងរក */
export const SEARCH_NO_RESULTS_KM = 'រកមិនឃើញលទ្ធផលត្រូវ។'

/** គណនី */
export const ACCOUNT_OPEN_IN_TELEGRAM_KM =
  'សូមបើកកម្មវិធីនេះនៅក្នុង Telegram Mini App ដើម្បីចូលគណនីដោយស្វ័យប្រវត្តិ។'

/** ប្រតិបត្តិការរដ្ឋបាល */
export const ADMIN_EXPORT_EMPTY_KM = 'មិនមានកំណត់ត្រាសម្រាប់នាំចេញ។'
export const ADMIN_TABLE_EMPTY_KM = 'មិនទាន់មានទិន្នន័យ។'
export const ADMIN_TABLE_FILTER_EMPTY_KM = 'គ្មានកំណត់ត្រាត្រូវនឹងលក្ខខណ្ឌបច្ចុប្បន្ន។'
export const ADMIN_IP_EMPTY_KM = 'មិនទាន់មានកំណត់ត្រា IP របស់អ្នកប្រើ។'
export const ADMIN_REPORTS_EMPTY_KM = 'មិនទាន់មានការរាយការណ៍។'

/** បញ្ជាទិញ (កម្មវិធីរដ្ឋបាល) */
export const ADMIN_ORDER_LOCK_TITLE_KM = 'ការជូនដំណឹង'
export const ADMIN_ORDER_LOCK_BODY_KM =
  'តើអ្នកប្រាកដថាចង់ចាក់សោប្រតិបត្តិការលើបញ្ជាទិញនេះទេ? បន្ទាប់ពីចាក់សោ អ្នកផ្សេងនឹងមិនអាចប្រតិបត្តិបានទេ!'
export const ADMIN_ORDER_PAY_CONFIRM_TITLE_KM = 'ការជូនដំណឹង'
export const ADMIN_ORDER_PAY_CONFIRM_BODY_KM =
  'តើអ្នកបញ្ជាក់ថាបានទទួលប្រាក់សម្រាប់បញ្ជាទិញនេះហើយឬនៅ? បន្ទាប់ពីបញ្ជាក់ ស្ថានភាពនឹងក្លាយជា «បង់ប្រាក់ជោគជ័យ»។'

export const ADMIN_DIALOG_CANCEL_KM = 'បោះបង់'
export const ADMIN_DIALOG_CONFIRM_KM = 'យល់ព្រម'
export const ADMIN_ORDER_PAY_FAIL_BTN_KM = 'បង់ប្រាក់បរាជ័យ'
export const ADMIN_ORDER_PAY_SUCCESS_BTN_KM = 'បង់ប្រាក់ជោគជ័យ'

/** ស្វែងរក + ចម្រោះទទេ */
export function formatHomeSearchFilterEmptyKm(searchTrim) {
  const q = String(searchTrim || '').trim()
  return `ក្នុងលទ្ធផលស្វែងរក «${q}» គ្មានរឿងដែលត្រូវនឹងលក្ខខណ្ឌចម្រោះបច្ចុប្បន្ន។ សូមលែងលក្ខខណ្ឌ ឬយក «បានជ្រើសរើស» ចេញ រួចព្យាយាមម្តងទៀត។`
}
