import { useMemo, useRef, useState } from 'react'
import { AppChromeContext } from './appChromeContext.js'

/** 首页打开热搜 / 筛选层时隐藏底栏；阅读页由 AppShell 判断 */
export function AppChromeProvider({ children }) {
  const [searchExploreOpen, setSearchExploreOpen] = useState(false)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  /** 首页顶栏搜索框聚焦时隐藏底栏，避免被键盘顶到输入区上方 */
  const [homeSearchInputFocused, setHomeSearchInputFocused] = useState(false)
  /** 首页书本详情 Overlay 打开时隐藏底栏，退回后自下而上滑入 */
  const [homeNovelDetailOpen, setHomeNovelDetailOpen] = useState(false)
  /** 通知页「全部已读」由 NotificationsPage 注册，顶栏按钮调用 */
  const notificationsMarkAllRef = useRef(null)
  /** 共用顶栏搜索：跨 Tab 保活，切回首页不丢草稿/已提交关键词 */
  const [homeSearchDraft, setHomeSearchDraft] = useState('')
  const [homeCommittedQuery, setHomeCommittedQuery] = useState('')
  const homeSearchInputRef = useRef(null)

  const registerNotificationsMarkAll = useMemo(
    () => (handler) => {
      notificationsMarkAllRef.current = typeof handler === 'function' ? handler : null
    },
    [],
  )

  const callNotificationsMarkAll = useMemo(
    () => () => {
      notificationsMarkAllRef.current?.()
    },
    [],
  )

  const value = useMemo(
    () => ({
      searchExploreOpen,
      setSearchExploreOpen,
      filterPanelOpen,
      setFilterPanelOpen,
      homeSearchInputFocused,
      setHomeSearchInputFocused,
      homeNovelDetailOpen,
      setHomeNovelDetailOpen,
      registerNotificationsMarkAll,
      callNotificationsMarkAll,
      homeSearchDraft,
      setHomeSearchDraft,
      homeCommittedQuery,
      setHomeCommittedQuery,
      homeSearchInputRef,
    }),
    [
      searchExploreOpen,
      filterPanelOpen,
      homeSearchInputFocused,
      homeNovelDetailOpen,
      registerNotificationsMarkAll,
      callNotificationsMarkAll,
      homeSearchDraft,
      homeCommittedQuery,
    ],
  )

  return (
    <AppChromeContext.Provider value={value}>
      {children}
    </AppChromeContext.Provider>
  )
}
