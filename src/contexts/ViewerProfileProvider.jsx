import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTelegramUser } from '../hooks/useTelegramUser.js'
import {
  getDefaultViewerProfile,
  normalizeViewerProfile,
  resolveViewerProfile,
} from '../lib/viewerProfileApi.js'
import {
  getInitialViewerProfile,
  readCachedViewerProfile,
  writeCachedViewerProfile,
} from '../lib/viewerProfileCache.js'
import { ViewerProfileContext } from './viewerProfileContext.js'

const inflightByUserId = new Map()

async function resolveViewerProfileOnce(telegramUserId) {
  const id = Number(telegramUserId) || 0
  if (!id) return getDefaultViewerProfile(null)

  const existing = inflightByUserId.get(id)
  if (existing) return existing

  const promise = resolveViewerProfile().finally(() => {
    inflightByUserId.delete(id)
  })
  inflightByUserId.set(id, promise)
  return promise
}

/** 应用级会员资料：启动即预拉取，并缓存上次结果，避免进个人中心先闪「普通方案」 */
export function ViewerProfileProvider({ children }) {
  const tgUser = useTelegramUser()
  const tgUserId = tgUser?.id
  const tgUserRef = useRef(tgUser)
  tgUserRef.current = tgUser

  const [viewerProfile, setViewerProfile] = useState(() => getInitialViewerProfile(tgUser))
  const [viewerProfileLoading, setViewerProfileLoading] = useState(() => {
    if (!tgUserId) return false
    return !readCachedViewerProfile(tgUserId, tgUser)
  })

  useEffect(() => {
    if (!tgUserId) {
      setViewerProfile(getDefaultViewerProfile(null))
      setViewerProfileLoading(false)
      return
    }
    const cached = readCachedViewerProfile(tgUserId, tgUser)
    setViewerProfile(cached ?? getDefaultViewerProfile(tgUser))
    setViewerProfileLoading(!cached)
  }, [tgUserId, tgUser])

  const refreshViewerProfile = useCallback(async () => {
    const user = tgUserRef.current
    const userId = user?.id
    if (!userId) {
      const empty = getDefaultViewerProfile(null)
      setViewerProfile(empty)
      setViewerProfileLoading(false)
      return empty
    }

    const hadCache = Boolean(readCachedViewerProfile(userId, user))
    if (!hadCache) setViewerProfileLoading(true)

    const next = await resolveViewerProfileOnce(userId)
    setViewerProfile(next)
    writeCachedViewerProfile(userId, next)
    setViewerProfileLoading(false)
    return next
  }, [tgUserId])

  const applyViewerProfile = useCallback((profile) => {
    const user = tgUserRef.current
    const userId = user?.id
    if (!userId || !profile) return getDefaultViewerProfile(user)
    const next = normalizeViewerProfile(profile, user)
    setViewerProfile(next)
    writeCachedViewerProfile(userId, next)
    setViewerProfileLoading(false)
    return next
  }, [tgUserId])

  useEffect(() => {
    void refreshViewerProfile()
  }, [refreshViewerProfile])

  const value = useMemo(
    () => ({
      viewerProfile,
      viewerProfileLoading,
      refreshViewerProfile,
      applyViewerProfile,
    }),
    [viewerProfile, viewerProfileLoading, refreshViewerProfile, applyViewerProfile],
  )

  return (
    <ViewerProfileContext.Provider value={value}>
      {children}
    </ViewerProfileContext.Provider>
  )
}
