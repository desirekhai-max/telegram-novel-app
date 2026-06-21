/** 筛选面板与首页共用的「空条件」对象（不要用 null 在面板内传） */
export const EMPTY_HOME_FILTER_CRITERIA = {
  genre: 'all',
  status: 'all',
  lengthId: 'all',
  source: 'all',
  audience: 'all',
  tags: [],
}

const FEMALE_AUDIENCE_TAG_HINTS = ['甜宠', '虐恋', '追妻', '大女主', '言情', '宫斗', '豪门', '现代言情']
const MALE_AUDIENCE_TAG_HINTS = ['后宫', '爽文', '玄幻', '武侠', '异能', '战争', '科幻', '奇幻']

/** @returns {'male' | 'female'} */
export function resolveNovelAudience(novel) {
  const raw = String(novel?.audience || '').trim().toLowerCase()
  if (raw === 'male' || raw === 'female') return raw
  const tags = novel?.tags ?? []
  if (tags.some((t) => MALE_AUDIENCE_TAG_HINTS.includes(String(t)))) return 'male'
  if (tags.some((t) => FEMALE_AUDIENCE_TAG_HINTS.includes(String(t)))) return 'female'
  const idNum = Number(String(novel?.id ?? '').replace(/\D/g, ''))
  return Number.isFinite(idNum) && idNum % 2 === 0 ? 'female' : 'male'
}

function novelHasTag(novelTags, tag) {
  const want = String(tag ?? '').trim()
  return (novelTags ?? []).some((nt) => String(nt ?? '').trim() === want)
}

function matchesLength(wordCountWan, lengthId) {
  if (lengthId === 'all') return true
  const w = Number(wordCountWan)
  if (!Number.isFinite(w) || w < 0) return false
  if (lengthId === 'w_lt_5') return w < 5
  if (lengthId === 'w_5_10') return w >= 5 && w <= 10
  if (lengthId === 'w_gte_10') return w > 10
  return false
}

export function isDefaultHomeFilterCriteria(c) {
  if (!c) return true
  return (
    c.genre === 'all' &&
    c.status === 'all' &&
    c.lengthId === 'all' &&
    c.source === 'all' &&
    c.audience === 'all' &&
    (!c.tags || c.tags.length === 0)
  )
}

export function novelMatchesHomeCriteria(novel, c) {
  if (!c || isDefaultHomeFilterCriteria(c)) return true
  if (c.genre !== 'all' && novel.genreId !== c.genre) return false
  if (c.status !== 'all' && novel.status !== c.status) return false
  if (c.source !== 'all' && novel.source !== c.source) return false
  if (!matchesLength(novel.wordCountWan, c.lengthId)) return false
  if (c.audience !== 'all' && resolveNovelAudience(novel) !== c.audience) return false
  const tags = c.tags ?? []
  if (tags.length > 0) {
    const novelTags = novel.tags ?? []
    for (const t of tags) {
      if (!novelHasTag(novelTags, t)) return false
    }
  }
  return true
}

export function filterNovelsByHomeCriteria(novels, c) {
  if (!c || isDefaultHomeFilterCriteria(c)) return novels
  return novels.filter((n) => novelMatchesHomeCriteria(n, c))
}
