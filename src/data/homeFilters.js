/**
 * 首页筛选默认词条（小说 genreId/status/source/tags 等仍须与本文件 id 对齐）。
 * 面板标题、分组顺序与展示文案可由后台 JSON 覆盖，见 `fetchHomeFilterPanelConfig`、`normalizeHomeFilterPanelConfig`。
 */

export const GENRE_OPTIONS = [
  { id: 'all', label: 'ទាំងអស់' },
  { id: 'urban', label: 'ទីក្រុង' },
  { id: 'rural', label: 'ជនបទ' },
  { id: 'campus', label: 'សាលារៀន' },
  { id: 'taboo', label: 'គ្រួសារ' },
  { id: 'transmigration', label: 'ឆ្លងភព' },
  { id: 'history', label: 'ប្រវត្តិសាស្ត្រ' },
  { id: 'celebrity', label: 'តារា' },
  { id: 'samegender', label: 'ភេទដូចគ្នា' },
]

export const STATUS_OPTIONS = [
  { id: 'all', label: 'ទាំងអស់' },
  { id: 'ongoing', label: 'កំពុងចេញ' },
  { id: 'completed', label: 'ចប់ហើយ' },
]

export const LENGTH_OPTIONS = [
  { id: 'all', label: 'ទាំងអស់' },
  { id: 'w_lt_5', label: 'ក្រោម5ម៉ឺនពាក្យ' },
  { id: 'w_5_10', label: '5ម៉ឺន-10ម៉ឺនពាក្យ' },
  { id: 'w_gte_10', label: '10ម៉ឺនពាក្យឡើង' },
]

/** 读者向：`male` / `female` 与 `novel.audience` 对齐 */
export const AUDIENCE_OPTIONS = [
  { id: 'all', label: 'គ្រប់ភេទ' },
  { id: 'male', label: 'សម្រាប់បុរស' },
  { id: 'female', label: 'សម្រាប់ស្ត្រី' },
]

export const SOURCE_OPTIONS = [
  { id: 'all', label: 'គ្រប់ប្រភព' },
  { id: 'original', label: 'ស្នាដៃដើម' },
  { id: 'upload', label: 'ស្នាដៃសមាជិក' },
]

/** 筛选中可同时选中的标签个数；再选时按先进先出顶掉最早选中的 */
export const MAX_SELECTED_FILTER_TAGS = 3

/** 标签云（与 server/data/filter-tags.json 对齐） */
export const TAG_CHIPS = [
  '1v1',
  'BL',
  'GL',
  'កំប្លែង',
  'សងសឹក',
  'គ្មានរោម',
  'ប្រែកាយ',
  'រ៉ូមែនទិក',
  'ឧបករណ៍សិច',
  'ចេញទឹកដោះ',
  'ស្ត្រីល្មភតណ្ហា',
  'ស្រ្តីមេមេម៉ាយ',
  'ជំនួយដោយ AI',
  'មានប្តីហើយ',
  'លួចលាក់មានថ្មី',
  'ស្នេហាស្មោះស្ម័គ្រ',
  'បង្វឹកផ្លូវភេទ',
  'ពាក្យអាសអាភាស',
  'ឪពុកនិងកូនស្រី',
  'រួមភេទតាមរន្ធគូទ',
  'បងប្អូនបង្កើត',
  'រឿងនយោបាយ',
  'ដូរដៃគូរួមភេទ',
  'ចងចំណង',
  'ម្តាយក្បត់ចិត្ត',
  'ម្តាយនិងកូនប្រុស',
  'ស្រីចាប់បង្ខំប្រុស',
  'បំបែកព្រហ្មចារី',
  'ចាប់រំលោភ',
  'វាយបូក',
  'ប្រពន្ធគេ',
  'រួមភេទជាមួយសត្វ',
  'ស្រោមបារ',
  'ផ្អែមល្ហែម',
  'គ្មានការក្បត់ចិត្ត',
  'ទាសករផ្លូវភេទ',
  'ប្រើថ្នាំសម្រើប',
  'ស្រីស្អាតប្រចាំសាលា',
  'ជនជាតិបរទេស',
  'ពូជសាសន៍ចម្លែក',
  'មើលសង្សារ/ប្រពន្ធផ្ទាល់ភ្នែក',
  'ឪពុកក្មេកនិងកូនប្រសារស្រី',
  'ចូលចិត្តប្រពន្ធដេកជាមួយគេផ្សេង',
  'ស្រ្តីវ័យកណ្តាលតណ្ហាក្រាស់',
  'ក្មេងប្រុសរួមភេទជាមួយស្រីចាស់',
  'សំលៀកបំពាក់ឯកសណ្ឋាន',
  'ប្រពន្ធក្បត់ចិត្តល្មភតណ្ហា',
  'លួចរួមភេទពេលដេកលក់/មិនដឹងខ្លួន',
]

export function tagChipLabel(value) {
  return String(value ?? '').trim()
}
