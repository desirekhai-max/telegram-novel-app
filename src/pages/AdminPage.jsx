import {
  Banknote,
  BarChart3,
  Book,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Funnel,
  Gauge,
  Settings,
  User,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminDashboardConsole from '../components/AdminDashboardConsole.jsx'
import AdminOrdersFilterPanel from '../components/AdminOrdersFilterPanel.jsx'
import { AdminRecordsDateTimeMenu } from '../components/AdminDateTimePickerMenu.jsx'
import {
  getPhnomPenhTodayStartText,
  getYearMonthFromText,
  keepTimeOrDefault,
  shiftYearMonth,
  toDateOnly,
} from '../lib/adminDateTimePickerUtils.js'
import { formatTelegramDisplayName, useTelegramUser } from '../hooks/useTelegramUser.js'
import { logoutAdmin } from '../lib/adminAuth.js'
import { readActiveMembers5m } from '../lib/miniAppPresence.js'

const NAV = [
  { id: 'dashboard', label: '控制台', icon: Gauge },
  { id: 'lists', label: '阅读记录管理', icon: BookOpen },
  { id: 'orders', label: '订单管理', icon: ClipboardList },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'finance', label: '财务结算', icon: Banknote },
  { id: 'profile', label: '账户资料', icon: User },
  { id: 'analytics', label: '数据统计', icon: BarChart3 },
  { id: 'reports', label: '筛选报表', icon: Funnel },
  { id: 'settings', label: '系统设置', icon: Settings },
]

const ADMIN_DISPLAY_NAME = 'shunshun'
const ADMIN_ACTIVE_TAB_KEY = 'tg-admin-active-tab'

const PLACEHOLDER = {
  lists: '',
  orders: '',
  users: '用户与角色权限管理，支持搜索与批量操作。',
  finance: '账单、对账与提现记录；当前为占位界面。',
  profile: '管理员个人信息与安全设置。',
  analytics: '阅读、转化与留存等图表分析。',
  reports: '按条件筛选导出报表与漏斗分析。',
  settings: '站点参数、通知与第三方集成配置。',
}

const LEVEL_OPTIONS = ['所有等级', '普通等级', 'VIP等级', '金币等级', '作者等级']

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100, 200, 500]

const AUTO_REFRESH_OPTIONS = [
  { label: '不刷新', seconds: 0 },
  { label: '间隔10秒', seconds: 10 },
  { label: '间隔30秒', seconds: 30 },
  { label: '间隔60秒', seconds: 60 },
  { label: '间隔120秒', seconds: 120 },
  { label: '间隔180秒', seconds: 180 },
]

function normLower(s) {
  return String(s ?? '').trim().toLowerCase()
}

function fieldIncludes(haystack, needle) {
  const n = normLower(needle)
  if (!n) return true
  return normLower(haystack).includes(n)
}

function matchesMemberLevel(recLevel, selected) {
  const sel = String(selected || '').trim()
  if (!sel || sel === '所有等级') return true
  const rl = normLower(recLevel)
  if (sel === 'VIP等级') return rl.includes('vip')
  if (sel === '普通等级') return rl.includes('注册') || rl.includes('普通')
  if (sel === '金币等级') return rl.includes('金币')
  if (sel === '作者等级') return rl.includes('作者')
  return rl.includes(normLower(sel).replace(/等级/g, ''))
}

function readAtInBounds(readAt, startQ, endQ) {
  const r = String(readAt || '').trim()
  if (!r) return true
  const s = String(startQ || '').trim()
  const e = String(endQ || '').trim()
  if (s && r < s) return false
  if (e && r > e) return false
  return true
}

function fullTextKeywordMatch(rec, kw) {
  const k = normLower(kw)
  if (!k) return true
  const blob = [
    rec.memberName,
    rec.memberId,
    rec.memberAccount,
    rec.memberLevel,
    rec.memberOrder,
    rec.shelfTitle,
    rec.readChapter,
    rec.readAt,
  ].join('\u0000')
  return normLower(blob).includes(k)
}

/** @param {object[]} items @param {object} c 与 lists 筛选表单一致的快照 */
function filterReadingRecords(items, c) {
  return items.filter((rec) => {
    if (!fieldIncludes(rec.memberName, c.memberName)) return false
    if (!fieldIncludes(rec.memberId, c.memberId)) return false
    if (!fieldIncludes(rec.memberAccount, c.memberAccount)) return false
    if (!matchesMemberLevel(rec.memberLevel, c.memberLevel)) return false
    if (!fieldIncludes(rec.memberOrder, c.memberOrder)) return false
    if (!fieldIncludes(rec.shelfTitle, c.shelfTitle)) return false
    if (!fullTextKeywordMatch(rec, c.fullTextKeyword)) return false
    if (!readAtInBounds(rec.readAt, c.startDateTime, c.endDateTime)) return false
    return true
  })
}

function hasActiveReadingRecordCriteria(c) {
  if (!c || typeof c !== 'object') return false
  if (normLower(c.memberName)) return true
  if (normLower(c.memberId)) return true
  if (normLower(c.memberAccount)) return true
  if (normLower(c.memberOrder)) return true
  if (normLower(c.shelfTitle)) return true
  if (normLower(c.fullTextKeyword)) return true
  if (String(c.memberLevel || '').trim() && c.memberLevel !== '所有等级') return true
  if (String(c.startDateTime || '').trim()) return true
  if (String(c.endDateTime || '').trim()) return true
  return false
}

const READING_RECORDS_CSV_HEADERS = [
  '会员姓名',
  '会员ID',
  '会员账号',
  '会员等级',
  '会员订单',
  '书架题目',
  '章节',
  '日期',
]

function escapeCsvField(val) {
  const s = String(val ?? '')
  if (/[\r\n",]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function readingRecordsToCsv(rows) {
  const lines = [READING_RECORDS_CSV_HEADERS.map(escapeCsvField).join(',')]
  for (const rec of rows) {
    lines.push(
      [
        rec.memberName,
        rec.memberId,
        rec.memberAccount,
        rec.memberLevel,
        rec.memberOrder,
        rec.shelfTitle,
        rec.readChapter || '—',
        rec.readAt,
      ]
        .map(escapeCsvField)
        .join(','),
    )
  }
  return `\uFEFF${lines.join('\r\n')}`
}

function downloadReadingRecordsCsv(csvText) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Phnom_Penh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const v = (t) => parts.find((p) => p.type === t)?.value ?? '00'
  const stamp = `${v('year')}${v('month')}${v('day')}_${v('hour')}${v('minute')}${v('second')}`
  const filename = `阅读记录_${stamp}.csv`
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function getInitialAdminTab() {
  if (typeof window === 'undefined') return 'dashboard'
  const saved = window.sessionStorage.getItem(ADMIN_ACTIVE_TAB_KEY)
  if (!saved) return 'dashboard'
  return NAV.some((n) => n.id === saved) ? saved : 'dashboard'
}

export default function AdminPage() {
  const navigate = useNavigate()
  const userMenuRef = useRef(null)
  const levelMenuRef = useRef(null)
  const pageSizeMenuRef = useRef(null)
  const autoRefreshMenuRef = useRef(null)
  const startDateMenuRef = useRef(null)
  const endDateMenuRef = useRef(null)
  const listsFilterSnapshotRef = useRef({})
  const [activeId, setActiveId] = useState(getInitialAdminTab)
  const [sidebarWide, setSidebarWide] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [activeMembers, setActiveMembers] = useState({ android: 0, ios: 0, web: 0, admin: 0 })
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [memberName, setMemberName] = useState('')
  const [memberId, setMemberId] = useState('')
  const [memberAccount, setMemberAccount] = useState('')
  const [memberLevel, setMemberLevel] = useState('所有等级')
  const [memberOrder, setMemberOrder] = useState('')
  const [startDateTime, setStartDateTime] = useState(() => getPhnomPenhTodayStartText())
  const [endDateTime, setEndDateTime] = useState('')
  const [startMonthCursor, setStartMonthCursor] = useState(() => getYearMonthFromText(getPhnomPenhTodayStartText()))
  const [endMonthCursor, setEndMonthCursor] = useState(() => getYearMonthFromText(getPhnomPenhTodayStartText()))
  const [levelMenuOpen, setLevelMenuOpen] = useState(false)
  const [startDateMenuOpen, setStartDateMenuOpen] = useState(false)
  const [endDateMenuOpen, setEndDateMenuOpen] = useState(false)
  const [startTimePanelOpen, setStartTimePanelOpen] = useState(false)
  const [endTimePanelOpen, setEndTimePanelOpen] = useState(false)
  const [shelfTitle, setShelfTitle] = useState('')
  const [fullTextKeyword, setFullTextKeyword] = useState('')
  const [pageSize, setPageSize] = useState(15)
  const [listsAutoRefreshSec, setListsAutoRefreshSec] = useState(0)
  const [pageSizeMenuOpen, setPageSizeMenuOpen] = useState(false)
  const [autoRefreshMenuOpen, setAutoRefreshMenuOpen] = useState(false)
  /** 接口返回的全量阅读记录 */
  const [readRecordsSource, setReadRecordsSource] = useState([])
  /**
   * null：尚未点击过「搜索」，表格展示全量；
   * 对象：上次搜索时的筛选快照（字段可为空字符串，按字段逐一匹配）
   */
  const [appliedReadRecordsFilter, setAppliedReadRecordsFilter] = useState(null)

  const tgUser = useTelegramUser()
  /** 在 Telegram Mini App 内打开时，会员姓名 / ID / 账号来自 initDataUnsafe.user */
  const memberFromTelegram = Boolean(tgUser)

  const active = NAV.find((n) => n.id === activeId) ?? NAV[0]

  useEffect(() => {
    if (activeId !== 'lists' || !tgUser) return
    setMemberName(formatTelegramDisplayName(tgUser))
    setMemberId(String(tgUser.id))
    setMemberAccount(tgUser.username ? `@${tgUser.username}` : '')
  }, [activeId, tgUser])

  const fetchReadingRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/reading-records', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setReadRecordsSource(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setReadRecordsSource([])
    }
  }, [])

  const readingRecordsRows = useMemo(() => {
    const src = readRecordsSource
    if (appliedReadRecordsFilter == null) return src
    const filtered = filterReadingRecords(src, appliedReadRecordsFilter)
    if (!hasActiveReadingRecordCriteria(appliedReadRecordsFilter)) return filtered
    return filtered.slice(0, Math.max(1, pageSize))
  }, [readRecordsSource, appliedReadRecordsFilter, pageSize])

  useEffect(() => {
    if (activeId !== 'lists') return undefined
    void fetchReadingRecords()
    return undefined
  }, [activeId, fetchReadingRecords])

  useEffect(() => {
    const onRefresh = () => void fetchReadingRecords()
    window.addEventListener('tg-admin-records-changed', onRefresh)
    window.addEventListener('tg-admin-records-auto-refresh', onRefresh)
    return () => {
      window.removeEventListener('tg-admin-records-changed', onRefresh)
      window.removeEventListener('tg-admin-records-auto-refresh', onRefresh)
    }
  }, [fetchReadingRecords])

  listsFilterSnapshotRef.current = {
    pageSize,
    listsAutoRefreshSec,
    memberName,
    memberId,
    memberAccount,
    memberLevel,
    memberOrder,
    startDateTime,
    endDateTime,
    shelfTitle,
    fullTextKeyword,
  }

  useEffect(() => {
    if (!userMenuOpen) return
    const onDoc = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [userMenuOpen])

  useEffect(() => {
    if (!levelMenuOpen) return
    const onDoc = (e) => {
      if (levelMenuRef.current && !levelMenuRef.current.contains(e.target)) {
        setLevelMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [levelMenuOpen])

  useEffect(() => {
    if (!pageSizeMenuOpen) return
    const onDoc = (e) => {
      if (pageSizeMenuRef.current && !pageSizeMenuRef.current.contains(e.target)) {
        setPageSizeMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [pageSizeMenuOpen])

  useEffect(() => {
    if (!autoRefreshMenuOpen) return
    const onDoc = (e) => {
      if (autoRefreshMenuRef.current && !autoRefreshMenuRef.current.contains(e.target)) {
        setAutoRefreshMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [autoRefreshMenuOpen])

  useEffect(() => {
    if (!startDateMenuOpen) return
    const onDoc = (e) => {
      if (startDateMenuRef.current && !startDateMenuRef.current.contains(e.target)) {
        setStartDateMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [startDateMenuOpen])

  useEffect(() => {
    if (startDateMenuOpen) return
    setStartTimePanelOpen(false)
  }, [startDateMenuOpen])

  useEffect(() => {
    if (!endDateMenuOpen) return
    const onDoc = (e) => {
      if (endDateMenuRef.current && !endDateMenuRef.current.contains(e.target)) {
        setEndDateMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [endDateMenuOpen])

  useEffect(() => {
    if (endDateMenuOpen) return
    setEndTimePanelOpen(false)
  }, [endDateMenuOpen])

  useEffect(() => {
    const refresh = async () => {
      const next = await readActiveMembers5m()
      setActiveMembers(next)
    }
    refresh()
    const timer = window.setInterval(refresh, 5 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    window.sessionStorage.setItem(ADMIN_ACTIVE_TAB_KEY, activeId)
  }, [activeId])

  /** 阅读记录页：按所选间隔触发（列表接口未接时也可监听 `tg-admin-records-auto-refresh`） */
  useEffect(() => {
    if (activeId !== 'lists' || listsAutoRefreshSec <= 0) return undefined
    const tick = () => {
      window.dispatchEvent(
        new CustomEvent('tg-admin-records-auto-refresh', { detail: { ...listsFilterSnapshotRef.current } }),
      )
    }
    const id = window.setInterval(tick, listsAutoRefreshSec * 1000)
    return () => window.clearInterval(id)
  }, [activeId, listsAutoRefreshSec])

  const nowText = new Date(nowTick).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  /** 仅已登录进入本页时加锁：用 useLayoutEffect 避免刷新首帧闪烁 */
  useLayoutEffect(() => {
    document.body.classList.add('tg-desktop-admin-lock')
    return () => document.body.classList.remove('tg-desktop-admin-lock')
  }, [])

  const onLogout = () => {
    window.sessionStorage.removeItem(ADMIN_ACTIVE_TAB_KEY)
    logoutAdmin()
    navigate('/admin-login', { replace: true })
  }

  const fireRecordsSearch = () => {
    const detail = { ...listsFilterSnapshotRef.current }
    setAppliedReadRecordsFilter({
      memberName: detail.memberName,
      memberId: detail.memberId,
      memberAccount: detail.memberAccount,
      memberLevel: detail.memberLevel,
      memberOrder: detail.memberOrder,
      startDateTime: detail.startDateTime,
      endDateTime: detail.endDateTime,
      shelfTitle: detail.shelfTitle,
      fullTextKeyword: detail.fullTextKeyword,
    })
    window.dispatchEvent(new CustomEvent('tg-admin-records-search', { detail }))
    void fetchReadingRecords()
  }

  const fireRecordsExport = () => {
    const detail = { ...listsFilterSnapshotRef.current }
    window.dispatchEvent(new CustomEvent('tg-admin-records-export', { detail }))

    const src = readRecordsSource
    const rows =
      appliedReadRecordsFilter == null
        ? src
        : filterReadingRecords(src, appliedReadRecordsFilter)

    if (rows.length === 0) {
      window.alert('当前没有可导出的记录')
      return
    }
    downloadReadingRecordsCsv(readingRecordsToCsv(rows))
  }

  return (
    <div className="tg-admin-shell" lang="zh-Hans">
      <header className="tg-admin-shell__topbar">
        <div className="tg-admin-shell__topbar-left">
          <span className="tg-admin-shell__topbar-icon" aria-hidden>
            <Book size={24} strokeWidth={2.1} />
          </span>
          <span className="tg-admin-shell__topbar-title">𝟔𝟗𝐊𝐊𝐇</span>
        </div>

        <div className="tg-admin-shell__topbar-right">
          <span className="tg-admin-shell__clock" title="Phnom Penh 时间">
            {nowText}
          </span>
          <div className="tg-admin-userchip" ref={userMenuRef}>
            <button
              type="button"
              className="tg-admin-userchip__trigger"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
            >
              <span className="tg-admin-userchip__avatar-ring" aria-hidden>
                <img
                  className="tg-admin-userchip__avatar"
                  src="/admin-user-avatar.png"
                  alt=""
                  decoding="async"
                />
              </span>
              <span className="tg-admin-userchip__meta">
                <span className="tg-admin-userchip__welcome">欢迎光临</span>
                <span className="tg-admin-userchip__name">{ADMIN_DISPLAY_NAME}</span>
              </span>
              <span className="tg-admin-userchip__caret" aria-hidden />
            </button>
            {userMenuOpen ? (
              <div className="tg-admin-userchip__dropdown" role="menu">
                <button
                  type="button"
                  className="tg-admin-userchip__dropdown-item"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                >
                  修改密码
                </button>
                <button
                  type="button"
                  className="tg-admin-userchip__dropdown-item"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                >
                  安全验证设置
                </button>
                <div className="tg-admin-userchip__dropdown-sep" role="separator" />
                <button
                  type="button"
                  className="tg-admin-userchip__dropdown-item tg-admin-userchip__dropdown-item--logout"
                  role="menuitem"
                  onClick={onLogout}
                >
                  退出登录
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="tg-admin-shell__body">
      <aside
        className={
          sidebarWide ? 'tg-admin-shell__sidebar tg-admin-shell__sidebar--wide' : 'tg-admin-shell__sidebar'
        }
      >
        <nav className="tg-admin-shell__nav" aria-label="后台主导航">
          {NAV.map((item) => {
            const { id, label, icon: NavIcon } = item
            const isActive = id === activeId
            return (
              <button
                key={id}
                type="button"
                className={
                  isActive
                    ? 'tg-admin-shell__nav-btn tg-admin-shell__nav-btn--active'
                    : 'tg-admin-shell__nav-btn'
                }
                onClick={() => setActiveId(id)}
                title={label}
              >
                <NavIcon className="tg-admin-shell__nav-icon" size={22} strokeWidth={1.85} aria-hidden />
                {sidebarWide && <span className="tg-admin-shell__nav-label">{label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="tg-admin-shell__sidebar-foot">
          <button
            type="button"
            className="tg-admin-shell__expand"
            onClick={() => setSidebarWide((w) => !w)}
            title={sidebarWide ? '收起侧栏' : '展开侧栏'}
            aria-expanded={sidebarWide}
          >
            {sidebarWide ? (
              <ChevronsLeft size={20} strokeWidth={2} aria-hidden />
            ) : (
              <ChevronsRight size={20} strokeWidth={2} aria-hidden />
            )}
          </button>
        </div>
      </aside>

      <main className="tg-admin-shell__main">
        <header className="tg-admin-shell__main-head">
          <h1 className="tg-admin-shell__title">{active.label}</h1>
          <p className="tg-admin-shell__crumb">
            管理后台 / {active.label}
            {activeId === 'dashboard' ? (
              <span className="tg-admin-shell__active-members">
                {' '}
                | 当前在线会员：安卓 {activeMembers.android} 人，iOS {activeMembers.ios} 人，PC{' '}
                {activeMembers.web} 人，后台 {activeMembers.admin} 人
              </span>
            ) : null}
          </p>
        </header>
        <section
          className={
            activeId === 'dashboard'
              ? 'tg-admin-shell__panel tg-admin-shell__panel--console'
              : 'tg-admin-shell__panel'
          }
          aria-live="polite"
        >
          {activeId === 'dashboard' ? (
            <AdminDashboardConsole />
          ) : activeId === 'lists' ? (
            <div className="tg-admin-records-filter">
              <div className="tg-admin-records-filter__group">
                <label className="tg-admin-records-filter__label" htmlFor="member-name-input">
                  会员姓名：
                </label>
                <input
                  id="member-name-input"
                  className="tg-admin-records-filter__input"
                  type="text"
                  value={memberName}
                  readOnly={memberFromTelegram}
                  title={memberFromTelegram ? '由当前 Telegram 账号自动填入' : undefined}
                  onChange={(e) => setMemberName(e.target.value)}
                />
              </div>

              <div className="tg-admin-records-filter__group">
                <label className="tg-admin-records-filter__label" htmlFor="member-id-input">
                  会员ID：
                </label>
                <input
                  id="member-id-input"
                  className="tg-admin-records-filter__input"
                  type="text"
                  value={memberId}
                  readOnly={memberFromTelegram}
                  title={memberFromTelegram ? '由当前 Telegram 账号自动填入' : undefined}
                  onChange={(e) => setMemberId(e.target.value)}
                />
              </div>

              <div className="tg-admin-records-filter__group">
                <label className="tg-admin-records-filter__label" htmlFor="member-account-input">
                  会员账号：
                </label>
                <input
                  id="member-account-input"
                  className="tg-admin-records-filter__input"
                  type="text"
                  value={memberAccount}
                  readOnly={memberFromTelegram}
                  title={memberFromTelegram ? '由当前 Telegram 账号自动填入（@用户名）' : undefined}
                  onChange={(e) => setMemberAccount(e.target.value)}
                />
              </div>

              <div className="tg-admin-records-filter__group">
                <label className="tg-admin-records-filter__label" htmlFor="member-level-input">
                  会员等级：
                </label>
                <div className="tg-admin-records-filter__level-wrap" ref={levelMenuRef}>
                  <button
                    id="member-level-input"
                    className="tg-admin-records-filter__input tg-admin-records-filter__input--level"
                    type="button"
                    onClick={() => setLevelMenuOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={levelMenuOpen}
                  >
                    {memberLevel}
                  </button>
                  <span className="tg-admin-records-filter__level-caret" aria-hidden>
                    ▾
                  </span>
                  {levelMenuOpen ? (
                    <div className="tg-admin-records-filter__level-menu" role="listbox" aria-label="会员等级">
                      {LEVEL_OPTIONS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={
                            item === memberLevel
                              ? 'tg-admin-records-filter__level-item tg-admin-records-filter__level-item--active'
                              : 'tg-admin-records-filter__level-item'
                          }
                          onClick={() => {
                            setMemberLevel(item)
                            setLevelMenuOpen(false)
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="tg-admin-records-filter__group tg-admin-records-filter__group--order">
                <label className="tg-admin-records-filter__label" htmlFor="member-order-input">
                  会员订单：
                </label>
                <input
                  id="member-order-input"
                  className="tg-admin-records-filter__input tg-admin-records-filter__input--long"
                  type="text"
                  value={memberOrder}
                  onChange={(e) => setMemberOrder(e.target.value)}
                />
              </div>

              <div className="tg-admin-records-filter__group tg-admin-records-filter__group--datetime tg-admin-records-filter__group--datetime-records">
                <label className="tg-admin-records-filter__label" htmlFor="record-start-time">
                  日期：
                </label>
                <div className="tg-admin-records-filter__date-wrap" ref={startDateMenuRef}>
                  <input
                    id="record-start-time"
                    className="tg-admin-records-filter__input tg-admin-records-filter__input--datetime"
                    type="text"
                    inputMode="numeric"
                    value={startDateTime}
                    onChange={(e) => setStartDateTime(e.target.value)}
                    onClick={() => {
                      const ym = getYearMonthFromText(startDateTime)
                      if (ym) setStartMonthCursor(ym)
                      setStartDateMenuOpen(true)
                    }}
                  />
                  {startDateMenuOpen ? (
                    <AdminRecordsDateTimeMenu
                      yearMonth={startMonthCursor}
                      onPrevMonth={() => setStartMonthCursor((v) => shiftYearMonth(v, -1))}
                      onNextMonth={() => setStartMonthCursor((v) => shiftYearMonth(v, 1))}
                      onPickDate={(date) => {
                        const time = keepTimeOrDefault(startDateTime)
                        setStartDateTime(`${date} ${time}`)
                        setStartDateMenuOpen(false)
                      }}
                      timePanelOpen={startTimePanelOpen}
                      setTimePanelOpen={setStartTimePanelOpen}
                      currentDateTime={startDateTime}
                      onPickTime={(time) => {
                        const date = toDateOnly(startDateTime) || `${startMonthCursor}-01`
                        setStartDateTime(`${date} ${time}`)
                      }}
                    />
                  ) : null}
                </div>
                <span className="tg-admin-records-filter__dash" aria-hidden>
                  →
                </span>
                <div className="tg-admin-records-filter__date-wrap" ref={endDateMenuRef}>
                  <input
                    id="record-end-time"
                    className="tg-admin-records-filter__input tg-admin-records-filter__input--datetime"
                    type="text"
                    inputMode="numeric"
                    value={endDateTime}
                    onChange={(e) => setEndDateTime(e.target.value)}
                    onClick={() => {
                      const ym = getYearMonthFromText(endDateTime)
                      if (ym) setEndMonthCursor(ym)
                      setEndDateMenuOpen(true)
                    }}
                  />
                  {endDateMenuOpen ? (
                    <AdminRecordsDateTimeMenu
                      yearMonth={endMonthCursor}
                      onPrevMonth={() => setEndMonthCursor((v) => shiftYearMonth(v, -1))}
                      onNextMonth={() => setEndMonthCursor((v) => shiftYearMonth(v, 1))}
                      onPickDate={(date) => {
                        const time = keepTimeOrDefault(endDateTime)
                        setEndDateTime(`${date} ${time}`)
                        setEndDateMenuOpen(false)
                      }}
                      timePanelOpen={endTimePanelOpen}
                      setTimePanelOpen={setEndTimePanelOpen}
                      currentDateTime={endDateTime}
                      onPickTime={(time) => {
                        const date = toDateOnly(endDateTime) || `${endMonthCursor}-01`
                        setEndDateTime(`${date} ${time}`)
                      }}
                    />
                  ) : null}
                </div>
                <div className="tg-admin-records-filter__datetime-shelf-tail">
                  <label className="tg-admin-records-filter__label" htmlFor="record-shelf-title">
                    书架题目：
                  </label>
                  <input
                    id="record-shelf-title"
                    className="tg-admin-records-filter__input tg-admin-records-filter__input--shelf-title"
                    type="text"
                    value={shelfTitle}
                    onChange={(e) => setShelfTitle(e.target.value)}
                  />
                </div>
                <div className="tg-admin-records-filter__datetime-shelf-tail tg-admin-records-filter__datetime-shelf-tail--id">
                  <label className="tg-admin-records-filter__label" htmlFor="record-full-text-keyword">
                    全文章：
                  </label>
                  <input
                    id="record-full-text-keyword"
                    className="tg-admin-records-filter__input tg-admin-records-filter__input--shelf-id"
                    type="text"
                    autoComplete="off"
                    value={fullTextKeyword}
                    onChange={(e) => setFullTextKeyword(e.target.value)}
                  />
                </div>
                <div className="tg-admin-records-filter__datetime-shelf-tail tg-admin-records-filter__datetime-shelf-tail--select">
                  <span className="tg-admin-records-filter__label" id="record-page-size-label">
                    每页显示：
                  </span>
                  <div className="tg-admin-records-filter__level-wrap" ref={pageSizeMenuRef}>
                    <button
                      type="button"
                      className="tg-admin-records-filter__input tg-admin-records-filter__input--level tg-admin-records-filter__input--records-inline"
                      aria-labelledby="record-page-size-label"
                      aria-haspopup="listbox"
                      aria-expanded={pageSizeMenuOpen}
                      onClick={() => setPageSizeMenuOpen((o) => !o)}
                    >
                      {pageSize}条
                    </button>
                    <span className="tg-admin-records-filter__level-caret" aria-hidden>
                      ▾
                    </span>
                    {pageSizeMenuOpen ? (
                      <div className="tg-admin-records-filter__level-menu" role="listbox" aria-label="每页条数">
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            role="option"
                            aria-selected={n === pageSize}
                            className={
                              n === pageSize
                                ? 'tg-admin-records-filter__level-item tg-admin-records-filter__level-item--active'
                                : 'tg-admin-records-filter__level-item'
                            }
                            onClick={() => {
                              setPageSize(n)
                              setPageSizeMenuOpen(false)
                            }}
                          >
                            {n}条
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="tg-admin-records-filter__datetime-shelf-tail tg-admin-records-filter__datetime-shelf-tail--select">
                  <span className="tg-admin-records-filter__label" id="record-auto-refresh-label">
                    自动刷新：
                  </span>
                  <div className="tg-admin-records-filter__level-wrap" ref={autoRefreshMenuRef}>
                    <button
                      type="button"
                      className="tg-admin-records-filter__input tg-admin-records-filter__input--level tg-admin-records-filter__input--records-inline"
                      aria-labelledby="record-auto-refresh-label"
                      aria-haspopup="listbox"
                      aria-expanded={autoRefreshMenuOpen}
                      onClick={() => setAutoRefreshMenuOpen((o) => !o)}
                    >
                      {AUTO_REFRESH_OPTIONS.find((o) => o.seconds === listsAutoRefreshSec)?.label ?? '不刷新'}
                    </button>
                    <span className="tg-admin-records-filter__level-caret" aria-hidden>
                      ▾
                    </span>
                    {autoRefreshMenuOpen ? (
                      <div className="tg-admin-records-filter__level-menu" role="listbox" aria-label="自动刷新间隔">
                        {AUTO_REFRESH_OPTIONS.map((opt) => (
                          <button
                            key={opt.seconds}
                            type="button"
                            role="option"
                            aria-selected={opt.seconds === listsAutoRefreshSec}
                            className={
                              opt.seconds === listsAutoRefreshSec
                                ? 'tg-admin-records-filter__level-item tg-admin-records-filter__level-item--active'
                                : 'tg-admin-records-filter__level-item'
                            }
                            onClick={() => {
                              setListsAutoRefreshSec(opt.seconds)
                              setAutoRefreshMenuOpen(false)
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="tg-admin-records-filter__actions-row">
                <button
                  type="button"
                  className="tg-admin-records-filter__action-btn tg-admin-records-filter__action-btn--search"
                  onClick={fireRecordsSearch}
                >
                  <span className="tg-admin-records-filter__action-btn-icon" aria-hidden>
                    🔍
                  </span>
                  搜索
                </button>
                <button
                  type="button"
                  className="tg-admin-records-filter__action-btn tg-admin-records-filter__action-btn--export"
                  onClick={fireRecordsExport}
                >
                  导出
                </button>
              </div>

              <div className="tg-admin-records-filter__table-wrap">
                <table className="tg-admin-records-filter__table" aria-label="阅读记录列表">
                  <thead>
                    <tr>
                      <th scope="col">会员姓名</th>
                      <th scope="col">会员ID</th>
                      <th scope="col">会员账号</th>
                      <th scope="col">会员等级</th>
                      <th scope="col">会员订单</th>
                      <th scope="col">书架题目</th>
                      <th scope="col">章节</th>
                      <th scope="col">日期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readingRecordsRows.length === 0 ? (
                      <tr>
                        <td className="tg-admin-records-filter__table-empty" colSpan={8}>
                          {readRecordsSource.length === 0
                            ? '暂无数据'
                            : appliedReadRecordsFilter != null
                              ? '没有符合当前筛选条件的记录'
                              : '暂无数据'}
                        </td>
                      </tr>
                    ) : (
                      readingRecordsRows.map((rec, i) => (
                        <tr key={`${rec.memberOrder}-${rec.ts}-${i}`}>
                          <td>{rec.memberName}</td>
                          <td>{rec.memberId}</td>
                          <td>{rec.memberAccount}</td>
                          <td>{rec.memberLevel}</td>
                          <td>{rec.memberOrder}</td>
                          <td>{rec.shelfTitle}</td>
                          <td>{rec.readChapter || '—'}</td>
                          <td>{rec.readAt}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeId === 'orders' ? (
            <AdminOrdersFilterPanel />
          ) : (
            <p className="tg-admin-shell__panel-text">{PLACEHOLDER[activeId]}</p>
          )}
        </section>
      </main>
      </div>
    </div>
  )
}
