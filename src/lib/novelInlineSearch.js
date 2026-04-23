function norm(s) {
  return String(s ?? '').toLowerCase()
}

/** 标题、作者、标签、列表题材词（listThemes）子串匹配，忽略大小写（对中文无影响） */
export function novelMatchesInlineSearch(novel, rawQuery) {
  const q = norm(rawQuery).trim()
  if (!q) return true
  if (norm(novel.title).includes(q)) return true
  if (norm(novel.author).includes(q)) return true
  for (const t of novel.tags ?? []) {
    if (norm(t).includes(q)) return true
  }
  for (const t of novel.listThemes ?? []) {
    if (norm(t).includes(q)) return true
  }
  return false
}
