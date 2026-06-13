import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { bindNovelNavPrefetchHandlers } from '../lib/prefetchNovelOnNav.js'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'
import { useTelegramUser } from '../hooks/useTelegramUser.js'
import { fetchReadingRecordsByMemberId, getPresenceMemberId } from '../lib/miniAppPresence.js'
import { buildReadingHistoryNavigateTarget } from '../lib/readingHistoryNav.js'
import {
  buildListedReadingHistory,
  loadReadingHistoryLocal,
  mergeReadingHistoryLists,
  syncReadingHistoryLocalListed,
} from '../lib/readerStorage.js'
import {
  getListedNovelSummaryById,
  isCatalogLoadedFromApi,
  refreshCatalogNovels,
  resolveListedNovelIdFromHistoryItem,
} from '../lib/novelsRuntime.js'

function formatChapterLabelKh(raw) {
  const text = String(raw || '').trim()
  if (!text) return 'ភាគទី—'
  const m = text.match(/^第\s*([一二三四五六七八九十百千万0-9]+)\s*章[\s:：.-]*/u)
  if (!m) return text
  const rawNo = String(m[1] || '').trim()
  const digitMap = {
    零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
  }
  const unitMap = { 十: 10, 百: 100, 千: 1000, 万: 10000 }
  const toArabic = (s) => {
    if (/^\d+$/.test(s)) return s
    let total = 0
    let section = 0
    let number = 0
    for (const ch of s) {
      if (ch in digitMap) {
        number = digitMap[ch]
      } else if (ch in unitMap) {
        const unit = unitMap[ch]
        if (unit === 10000) {
          section = (section + (number || 0)) * unit
          total += section
          section = 0
          number = 0
        } else {
          section += (number || 1) * unit
          number = 0
        }
      }
    }
    const out = total + section + number
    return out > 0 ? String(out) : s
  }
  const no = toArabic(rawNo)
  const tail = text.slice(m[0].length).trim()
  return tail ? `ភាគទី${no} ${tail}` : `ភាគទី${no}`
}

const historyHelpers = {
  resolveListedId: resolveListedNovelIdFromHistoryItem,
  getListedSummary: getListedNovelSummaryById,
  get catalogReady() {
    return isCatalogLoadedFromApi()
  },
}

export default function ReadingHistoryPage() {
  const swipeHandlers = useEdgeSwipeBack()
  const tgUser = useTelegramUser()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const applyListedHistory = useCallback((mergedRows) => {
    const listed = buildListedReadingHistory(mergedRows, historyHelpers)
    syncReadingHistoryLocalListed(listed)
    setItems(listed)
  }, [])

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      await refreshCatalogNovels()
      if (!active) return
      const local = loadReadingHistoryLocal()
      applyListedHistory(mergeReadingHistoryLists([], local))
      setLoading(false)
    }
    void run()
    return () => {
      active = false
    }
  }, [applyListedHistory])

  useEffect(() => {
    if (loading) return
    const rawPresenceId = String(getPresenceMemberId() || '').trim()
    const numericId = tgUser?.id != null
      ? String(tgUser.id)
      : rawPresenceId.replace(/^tg_/, '')
    const candidateIds = [...new Set([
      numericId,
      numericId ? `tg_${numericId}` : '',
      rawPresenceId,
    ].map((v) => String(v || '').trim()).filter(Boolean))]
    const local = loadReadingHistoryLocal()
    let active = true
    void Promise.all(candidateIds.map((id) => fetchReadingRecordsByMemberId(id)))
      .then((rowsList) => {
        if (!active) return
        const serverFlat = rowsList.flat().filter((it) => it && typeof it === 'object')
        applyListedHistory(mergeReadingHistoryLists(serverFlat, local))
      })
    return () => {
      active = false
    }
  }, [tgUser?.id, loading, applyListedHistory])

  return (
    <div className="tg-app tg-app--account">
      <BrandTabToolbar title="ប្រវត្តិអាន" titleLang="km" showDivider />
      <main
        className="tg-list-wrap tg-account-scroll flex flex-1 flex-col px-6 py-8"
        {...swipeHandlers}
      >
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="mx-auto w-full max-w-md text-center text-sm text-white/60" lang="km">
              កំពុងផ្ទុក…
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="mx-auto w-full max-w-md text-center text-sm text-white/60" lang="km">
              មិនទាន់មានប្រវត្តិអាននៅឡើយទេ
            </p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            {items.map((it) => {
              const navTarget = buildReadingHistoryNavigateTarget(it)
              if (!navTarget) return null
              const cardClass =
                'group block rounded-2xl border border-white/10 bg-white/[0.05] p-3 transition-colors active:bg-white/[0.08] cursor-pointer hover:bg-white/[0.07]'
              return (
                <Link
                  key={`${it.novelId}-${it.ts}`}
                  to={navTarget.pathname}
                  state={navTarget.state}
                  className={cardClass}
                  {...bindNovelNavPrefetchHandlers(it.novelId)}
                >
                  <p className="truncate text-[15px] font-semibold text-white">{it.shelfTitle || '—'}</p>
                  <p className="mt-1 truncate text-sm text-white/65">{formatChapterLabelKh(it.readChapter)}</p>
                  <p className="mt-1 truncate text-xs text-white/45">{it.readAt || ''}</p>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
