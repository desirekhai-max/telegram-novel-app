import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandTabToolbar from '../components/BrandTabToolbar.jsx'
import { novels } from '../data/novels.js'
import { useEdgeSwipeBack } from '../hooks/useEdgeSwipeBack.js'
import { useTelegramUser } from '../hooks/useTelegramUser.js'
import { fetchFavoritedNovelIdsByUser, getPresenceMemberId } from '../lib/miniAppPresence.js'

const DETAIL_INTERACTIONS_STORAGE_KEY = 'tg_novel_detail_interactions_v1'
const serverFavoritesMemoryCache = new Map()

function readSavedNovelRows() {
  try {
    const raw = localStorage.getItem(DETAIL_INTERACTIONS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object') return []
    return Object.entries(parsed)
      .filter(([, row]) => row && typeof row === 'object' && row.favorited === true)
      .map(([novelId, row]) => ({
        novelId: String(novelId),
        favoritedAtMs: Number(row.favoritedAtMs) || 0,
      }))
      .sort((a, b) => b.favoritedAtMs - a.favoritedAtMs)
  } catch {
    return []
  }
}

export default function SavedPage() {
  const swipeHandlers = useEdgeSwipeBack()
  const tgUser = useTelegramUser()
  const [savedRows, setSavedRows] = useState(() => readSavedNovelRows())
  const effectiveUserId = tgUser?.id != null ? `tg_${tgUser.id}` : getPresenceMemberId()
  const [serverNovelIds, setServerNovelIds] = useState(
    () => serverFavoritesMemoryCache.get(effectiveUserId) ?? [],
  )

  useEffect(() => {
    const sync = () => setSavedRows(readSavedNovelRows())
    sync()
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  useEffect(() => {
    setServerNovelIds(serverFavoritesMemoryCache.get(effectiveUserId) ?? [])
    let active = true
    void fetchFavoritedNovelIdsByUser(effectiveUserId).then((ids) => {
      if (!active) return
      serverFavoritesMemoryCache.set(effectiveUserId, ids)
      setServerNovelIds(ids)
    })
    return () => {
      active = false
    }
  }, [effectiveUserId])

  const savedNovels = useMemo(() => {
    const byId = new Map(novels.map((n) => [String(n.id), n]))
    // 以服务端为主（同账号跨设备一致），本地记录仅作网络失败/未同步时兜底补充。
    const serverSet = new Set(serverNovelIds.map((id) => String(id)))
    const mergedRows = [
      ...serverNovelIds.map((id) => ({ novelId: String(id), favoritedAtMs: 0 })),
      ...savedRows.filter((row) => !serverSet.has(String(row.novelId))),
    ]
    return mergedRows
      .map((row) => {
        const novel = byId.get(String(row.novelId))
        if (!novel) return null
        return { ...row, novel }
      })
      .filter(Boolean)
  }, [savedRows, serverNovelIds])

  return (
    <div className="tg-app tg-app--account">
      <BrandTabToolbar title="រក្សាទុក" titleLang="km" showDivider />
      <main
        className="tg-list-wrap tg-account-scroll flex flex-1 flex-col px-6 py-8"
        {...swipeHandlers}
      >
        {savedNovels.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="mx-auto w-full max-w-md text-center text-sm text-white/60" lang="km">
              មិនទាន់មានរឿងដែលបានរក្សាទុកនៅឡើយទេ
            </p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            {savedNovels.map(({ novel }) => {
              const accent = novel.accent === 'teal' || novel.accent === 'rose' ? novel.accent : 'violet'
              return (
              <Link
                key={novel.id}
                to={`/read/${novel.id}`}
                state={{ from: 'saved' }}
                className="tg-saved-card"
              >
                <div className={`tg-saved-card__cover-wrap tg-saved-card__cover-wrap--${accent}`}>
                  {novel.coverUrl ? (
                    <img src={novel.coverUrl} alt="" className="tg-saved-card__cover-img" loading="lazy" />
                  ) : (
                    <div className="tg-saved-card__cover-ph" aria-hidden>
                      <span className="tg-saved-card__cover-ph-text">{novel.title.slice(0, 1)}</span>
                    </div>
                  )}
                </div>
                <div className="tg-saved-card__body">
                  <p className="tg-saved-card__title truncate">{novel.title}</p>
                  <p className="tg-saved-card__meta truncate">
                    អ្នកនិពន្ធ៖ {novel.author}
                  </p>
                </div>
              </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
