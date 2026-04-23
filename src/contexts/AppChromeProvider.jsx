import { useMemo, useState } from 'react'
import { AppChromeContext } from './appChromeContext.js'

/** 首页打开热搜 / 筛选层时隐藏底栏；阅读页由 AppShell 判断 */
export function AppChromeProvider({ children }) {
  const [searchExploreOpen, setSearchExploreOpen] = useState(false)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  /** 首页顶栏搜索框聚焦时隐藏底栏，避免被键盘顶到输入区上方 */
  const [homeSearchInputFocused, setHomeSearchInputFocused] = useState(false)

  const value = useMemo(
    () => ({
      searchExploreOpen,
      setSearchExploreOpen,
      filterPanelOpen,
      setFilterPanelOpen,
      homeSearchInputFocused,
      setHomeSearchInputFocused,
    }),
    [searchExploreOpen, filterPanelOpen, homeSearchInputFocused],
  )

  return (
    <AppChromeContext.Provider value={value}>
      {children}
    </AppChromeContext.Provider>
  )
}
