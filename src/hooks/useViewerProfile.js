import { useCallback, useEffect, useState } from 'react'
import { getDefaultViewerProfile, resolveViewerProfile } from '../lib/viewerProfileApi.js'

export function useViewerProfile(tgUser) {
  const tgUserId = tgUser?.id
  const [viewerProfile, setViewerProfile] = useState(() => getDefaultViewerProfile(tgUser))
  const [viewerProfileLoading, setViewerProfileLoading] = useState(Boolean(tgUserId))

  const refreshViewerProfile = useCallback(async () => {
    if (!tgUserId) {
      setViewerProfile(getDefaultViewerProfile(null))
      setViewerProfileLoading(false)
      return getDefaultViewerProfile(null)
    }
    setViewerProfileLoading(true)
    const next = await resolveViewerProfile()
    setViewerProfile(next)
    setViewerProfileLoading(false)
    return next
  }, [tgUserId])

  useEffect(() => {
    void refreshViewerProfile()
  }, [refreshViewerProfile])

  return {
    viewerProfile,
    viewerProfileLoading,
    refreshViewerProfile,
  }
}
