/** 由「距今秒数」得到 X秒前 / X分钟前 / … / X年前（不含括号） */
function formatSecondsAgo(secTotal) {
  const s = Math.floor(Number(secTotal))
  if (!Number.isFinite(s) || s < 0) return ''
  if (s < 1) return '0 វិនាទីមុន'
  if (s < 60) return `${s} វិនាទីមុន`
  if (s < 3600) return `${Math.floor(s / 60)} នាទីមុន`
  if (s < 86400) return `${Math.floor(s / 3600)} ម៉ោងមុន`
  const days = Math.floor(s / 86400)
  if (days < 30) return `${days} ថ្ងៃមុន`
  if (days < 365) {
    const mo = Math.max(1, Math.floor(days / 30))
    return `${mo} ខែមុន`
  }
  const years = Math.max(1, Math.floor(days / 365))
  return `${years} ឆ្នាំមុន`
}

/**
 * 仅知「多少分钟前」时的相对文案（可为小数分钟，用于秒级）。
 */
export function formatChapterRelativeTime(minutesAgo) {
  const m = Number(minutesAgo)
  if (!Number.isFinite(m) || m < 0) return ''
  return formatSecondsAgo(Math.round(m * 60))
}

/**
 * 卡片「最新：…（…）」内括号：秒前 → 分钟前 → 小时前 → 天前 → 个月前 → 年前。
 * 优先 `lastChapterMinutesAgo`（支持小数，如 0.5 表示约 30 秒前）；无则用 `updatedAtMs` 与当前时间差。
 */
export function formatLatestChapterRelativeLabel(novel, nowMs = Date.now()) {
  const mins = Number(novel?.lastChapterMinutesAgo)
  if (Number.isFinite(mins) && mins >= 0) {
    return formatSecondsAgo(Math.round(mins * 60))
  }
  const u = Number(novel?.updatedAtMs)
  if (!Number.isFinite(u) || u <= 0) return ''
  return formatSecondsAgo(Math.floor((nowMs - u) / 1000))
}

export function formatViewCount(n) {
  const v = Math.floor(Number(n))
  if (!Number.isFinite(v) || v < 0) return '0'
  if (v >= 10000) {
    const x = v / 10000
    const t = x % 1 === 0 ? String(x) : x.toFixed(2).replace(/\.?0+$/, '')
    return `${t}万`
  }
  if (v >= 1000) {
    const k = v / 1000
    const t = k % 1 === 0 ? String(k) : k.toFixed(2).replace(/\.?0+$/, '')
    return `${t}K`
  }
  return String(v)
}

/** 统计已发布章节正文字符数（每章标题 + 各段 body）；作者增删章节后卡片字数会随之变化 */
function countPublishedChapterChars(n) {
  let sum = 0
  for (const ch of n.chapters ?? []) {
    sum += [...String(ch.title ?? '')].length
    for (const p of ch.body ?? []) {
      sum += [...String(p)].length
    }
  }
  return sum
}

/**
 * 卡片「X万字」用：按章节正文自动统计，**无需作者单独维护字数**；无正文数据时退回 `wordCountWan`。
 * @returns {number} 以「万」为单位（与 formatWordCountFooter 一致）
 */
export function getDisplayWordCountWan(n) {
  const chars = countPublishedChapterChars(n)
  if (chars > 0) return chars / 10000
  const w = Number(n.wordCountWan)
  return Number.isFinite(w) && w > 0 ? w : 0
}

/**
 * 与首页「肉量」排序同源：章节正文 + 书名 + 简介；有 `totalChars` 时优先用接口字段。
 * 用于相对全列表自动划档少/中/多肉。
 */
export function getNovelMeatCharCount(n) {
  if (n.totalChars != null) {
    const direct = Number(n.totalChars)
    if (Number.isFinite(direct) && direct >= 0) return direct
  }
  let sum = 0
  for (const ch of n.chapters ?? []) {
    for (const p of ch.body ?? []) {
      sum += [...String(p)].length
    }
  }
  sum += [...String(n.title ?? '')].length + [...String(n.synopsis ?? '')].length
  return sum
}

function medianSorted(sorted) {
  const len = sorted.length
  if (len === 0) return 0
  const mid = Math.floor(len / 2)
  if (len % 2) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * 相对**当前列表里全部作品**的正文字符总量自动标「រឿងខ្លី / រឿងមធ្យម / រឿងវែង」，**无需作者手选**。
 * - រឿងខ្លី：低于列表**中位数的一半**
 * - រឿងវែង：达到中位数的 **1.5 倍**及以上（比别人明显多）
 * - រឿងមធ្យម：介于两者之间（含「约一半量级」的中间带）
 */
export function getAutoMeatTierLabel(novel, cohort) {
  const counts = (cohort ?? [])
    .map((x) => getNovelMeatCharCount(x))
    .filter((c) => Number.isFinite(c) && c >= 0)
    .sort((a, b) => a - b)
  const mine = getNovelMeatCharCount(novel)
  if (!counts.length || !Number.isFinite(mine)) return 'រឿងមធ្យម'
  const m = medianSorted(counts)
  if (m <= 0) return mine > 0 ? 'រឿងវែង' : 'រឿងមធ្យម'
  if (mine < m * 0.5) return 'រឿងខ្លី'
  if (mine >= m * 1.5) return 'រឿងវែង'
  return 'រឿងមធ្យម'
}

/** 相对当前列表最高字数的比例（0–100），与档位同屏展示 */
export function getAutoMeatPercent(novel, cohort) {
  const counts = (cohort ?? []).map((x) => getNovelMeatCharCount(x)).filter((c) => Number.isFinite(c) && c >= 0)
  const maxC = counts.length ? Math.max(...counts) : 0
  if (maxC <= 0) return 0
  const mine = getNovelMeatCharCount(novel)
  return Math.min(100, Math.round((mine / maxC) * 10000) / 100)
}

/** wordCountWan：≥1 时为「万字」规模；小于 1 时按总字数显示 K 字 */
export function formatWordCountFooter(wan) {
  const w = Number(wan)
  if (!Number.isFinite(w) || w <= 0) return '0អក្សរ'
  if (w >= 1) {
    const t = w % 1 === 0 ? String(w) : w.toFixed(1).replace(/\.0$/, '')
    return `${t}万អក្សរ`
  }
  const chars = Math.round(w * 10000)
  if (chars >= 1000) return `${(chars / 1000).toFixed(1).replace(/\.0$/, '')}Kអក្សរ`
  return `${chars}អក្សរ`
}

/**
 * 按总字数（万字）分档：
 * - < 2万字：រឿងខ្លី
 * - 2万到10万字：រឿងមធ្យម
 * - > 10万字：រឿងវែង
 */
export function getMeatCategoryByWordCount(novel) {
  const w = getDisplayWordCountWan(novel)
  if (w < 2) return 'រឿងខ្លី'
  if (w <= 10) return 'រឿងមធ្យម'
  return 'រឿងវែង'
}

/** 5 星展示：rating 为 0–10 分 */
export function ratingToFilledStars(rating) {
  const r = Number(rating)
  if (!Number.isFinite(r) || r <= 0) return 0
  return Math.min(5, Math.max(0, Math.round(r / 2)))
}

/**
 * 评论积分 → 星级值（支持半星）：
 * - 每 20 分 = 1 星
 * - 每个 20 分区间达到 10 分先亮半星
 * - 最多 5 星（100 分封顶）
 * @param {number} points 评论条数（每条 1 分）
 */
export function commentPointsToStars(points) {
  const p = Number(points)
  if (!Number.isFinite(p) || p <= 0) return 0
  const halfStars = Math.floor(p / 10)
  return Math.min(5, halfStars / 2)
}

/** 向后兼容：旧调用名保留为同义函数 */
export function commentPointsToFilledStars(points) {
  return commentPointsToStars(points)
}
