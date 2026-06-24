import { useViewerProfile } from '../hooks/useViewerProfile.js'
import { useTelegramUser } from '../hooks/useTelegramUser.js'

export default function BannedUserGate({ children }) {
  const tgUser = useTelegramUser()
  const { viewerProfile, viewerProfileLoading } = useViewerProfile()

  if (!tgUser?.id) return children
  if (viewerProfileLoading) return children
  if (!viewerProfile?.isBanned) return children

  return (
    <div className="banned-user-gate" role="alert">
      <div className="banned-user-gate__card">
        <p className="banned-user-gate__title">账号已被限制</p>
        <p className="banned-user-gate__desc">你的账号已被管理员封禁，暂时无法使用阅读、VIP 与互动功能。如有疑问请联系客服。</p>
      </div>
    </div>
  )
}
