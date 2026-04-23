import {
  Banknote,
  BellRing,
  BookOpen,
  CircleX,
  Coins,
  CircleCheckBig,
  Crown,
  Eye,
  ListChecks,
  ShoppingCart,
  UserPen,
  User,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AdminRecordsDateTimeMenu } from './AdminDateTimePickerMenu.jsx'
import {
  getPhnomPenhTodayStartText,
  getYearMonthFromText,
  keepTimeOrDefault,
  shiftYearMonth,
  toDateOnly,
} from '../lib/adminDateTimePickerUtils.js'
import { novels } from '../data/novels.js'
import { apiUrl } from '../lib/apiBase.js'

/**
 * 后台「控制台」总览：演示数据 + 与书架 novels 数量联动一项
 */
export default function AdminDashboardConsole() {
  const shelfCount = novels.length
  const authorTotal = new Set(
    novels.map((n) => String(n?.author || '').trim()).filter(Boolean),
  ).size
  const [registeredToday, setRegisteredToday] = useState(0)
  const [paidToday, setPaidToday] = useState(0)
  const [readToday, setReadToday] = useState(0)
  const [orderToday, setOrderToday] = useState(0)
  const [successToday, setSuccessToday] = useState(0)
  const [failedToday, setFailedToday] = useState(0)
  const [manualToday, setManualToday] = useState(0)
  const [coinBuyMemberToday, setCoinBuyMemberToday] = useState(0)
  const [firstDepositMemberToday, setFirstDepositMemberToday] = useState(0)
  const [payoutSuccessUsdToday, setPayoutSuccessUsdToday] = useState(0)
  const [sellUsdToday, setSellUsdToday] = useState(0)
  const [payUsdToday, setPayUsdToday] = useState(0)
  const [consoleStartDateTime, setConsoleStartDateTime] = useState(() => getPhnomPenhTodayStartText())
  const [consoleEndDateTime, setConsoleEndDateTime] = useState('')
  const [consoleStartMonthCursor, setConsoleStartMonthCursor] = useState(() =>
    getYearMonthFromText(getPhnomPenhTodayStartText()),
  )
  const [consoleEndMonthCursor, setConsoleEndMonthCursor] = useState(() =>
    getYearMonthFromText(getPhnomPenhTodayStartText()),
  )
  const [consoleStartDateMenuOpen, setConsoleStartDateMenuOpen] = useState(false)
  const [consoleEndDateMenuOpen, setConsoleEndDateMenuOpen] = useState(false)
  const [consoleStartTimePanelOpen, setConsoleStartTimePanelOpen] = useState(false)
  const [consoleEndTimePanelOpen, setConsoleEndTimePanelOpen] = useState(false)
  const consoleStartDateMenuRef = useRef(null)
  const consoleEndDateMenuRef = useRef(null)
  const [queryStartStr, setQueryStartStr] = useState(() => getPhnomPenhTodayStartText())
  const [queryEndStr, setQueryEndStr] = useState('')
  const [queryNonce, setQueryNonce] = useState(0)
  const [isQuerying, setIsQuerying] = useState(false)
  const [cardsBump, setCardsBump] = useState(false)
  const bumpTimerRef = useRef(null)

  useEffect(() => {
    if (!consoleStartDateMenuOpen) return
    const onDoc = (e) => {
      if (consoleStartDateMenuRef.current && !consoleStartDateMenuRef.current.contains(e.target)) {
        setConsoleStartDateMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [consoleStartDateMenuOpen])

  useEffect(() => {
    if (consoleStartDateMenuOpen) return
    setConsoleStartTimePanelOpen(false)
  }, [consoleStartDateMenuOpen])

  useEffect(() => {
    if (!consoleEndDateMenuOpen) return
    const onDoc = (e) => {
      if (consoleEndDateMenuRef.current && !consoleEndDateMenuRef.current.contains(e.target)) {
        setConsoleEndDateMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [consoleEndDateMenuOpen])

  useEffect(() => {
    if (consoleEndDateMenuOpen) return
    setConsoleEndTimePanelOpen(false)
  }, [consoleEndDateMenuOpen])

  useEffect(() => {
    const pull = async () => {
      setIsQuerying(true)
      try {
        const qs = new URLSearchParams()
        const startTrim = String(queryStartStr || '').trim()
        const endTrim = String(queryEndStr || '').trim()
        if (endTrim && startTrim) {
          qs.set('start', startTrim)
          qs.set('end', endTrim)
        } else {
          const d = toDateOnly(startTrim)
          if (d) qs.set('date', d)
        }
        const res = await fetch(apiUrl(`/api/presence/online?${qs}`), { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        setReadToday(Number(data?.counts?.readToday || 0))
        setRegisteredToday(Number(data?.counts?.registeredToday || 0))
        setPaidToday(Number(data?.counts?.paidToday || 0))
        setOrderToday(Number(data?.counts?.orderToday || 0))
        setSuccessToday(Number(data?.counts?.successToday || 0))
        setFailedToday(Number(data?.counts?.failedToday || 0))
        setManualToday(Number(data?.counts?.manualToday || 0))
        setCoinBuyMemberToday(Number(data?.counts?.coinBuyMemberToday || 0))
        setFirstDepositMemberToday(Number(data?.counts?.firstDepositMemberToday || 0))
        setPayoutSuccessUsdToday(
          Number(data?.counts?.payoutSuccessUsdToday || data?.counts?.withdrawalUsdToday || 0),
        )
        setSellUsdToday(Number(data?.counts?.sellUsdToday || 0))
        setPayUsdToday(Number(data?.counts?.payUsdToday || 0))
      } catch {
        /* ignore network failure */
      } finally {
        setIsQuerying(false)
      }
    }
    pull()
    const timer = window.setInterval(pull, 60 * 1000)
    return () => window.clearInterval(timer)
  }, [queryStartStr, queryEndStr, queryNonce])

  useEffect(() => {
    return () => {
      if (bumpTimerRef.current) window.clearTimeout(bumpTimerRef.current)
    }
  }, [])

  const registeredMembersToday = Math.max(0, registeredToday)
  const paidMembersToday = Math.max(0, paidToday)
  const normalMembersToday = Math.max(0, registeredMembersToday - paidMembersToday)

  const stats = [
    {
      label: '今日阅读人次',
      value: readToday.toLocaleString('en-US'),
      hint: '用户点击含正文的章节目录时计次（同日可多次）',
      trend: 'neutral',
      icon: Eye,
      tone: 'blue',
    },
    {
      label: '在库小说',
      value: String(shelfCount),
      hint: '演示书架总数',
      trend: 'neutral',
      icon: BookOpen,
      tone: 'indigo',
    },
    {
      label: '注册会员',
      value: registeredMembersToday.toLocaleString('en-US'),
      hint: '今日新增注册会员总数',
      trend: 'neutral',
      icon: Users,
      tone: 'violet',
    },
    {
      label: '普通会员',
      value: normalMembersToday.toLocaleString('en-US'),
      hint: '今日免费用户总数',
      trend: 'neutral',
      icon: User,
      tone: 'cyan',
    },
    {
      label: '付费会员',
      value: paidMembersToday.toLocaleString('en-US'),
      hint: '今日付费会员总数',
      trend: 'neutral',
      icon: Crown,
      tone: 'amber',
    },
    {
      label: '交易订单',
      value: orderToday.toLocaleString('en-US'),
      hint: '今日交易订单总量',
      trend: 'neutral',
      icon: ShoppingCart,
      tone: 'pink',
    },
    {
      label: '交易成功',
      value: successToday.toLocaleString('en-US'),
      hint: '今日成功交易订单总量',
      trend: 'neutral',
      icon: CircleCheckBig,
      tone: 'sky',
    },
    {
      label: '交易失败',
      value: failedToday.toLocaleString('en-US'),
      hint: '今日交易失败订单总量',
      trend: 'neutral',
      icon: CircleX,
      tone: 'teal',
    },
    {
      label: '人工存提',
      value: manualToday.toLocaleString('en-US'),
      hint: '今日成功存提总数',
      trend: 'neutral',
      icon: Banknote,
      tone: 'slate',
    },
    {
      label: '作者会员',
      value: authorTotal.toLocaleString('en-US'),
      hint: '作者用户总数',
      trend: 'neutral',
      icon: UserPen,
      tone: 'pink',
    },
    {
      label: '买币会员',
      value: coinBuyMemberToday.toLocaleString('en-US'),
      hint: '买币会员总数',
      trend: 'neutral',
      icon: Coins,
      tone: 'amber',
    },
    {
      label: '首充会员',
      value: firstDepositMemberToday.toLocaleString('en-US'),
      hint: '首次VIP会员总数',
      trend: 'neutral',
      icon: CircleCheckBig,
      tone: 'teal',
    },
    {
      label: '提款预估流水',
      value: `$${payoutSuccessUsdToday.toLocaleString('en-US')}`,
      hint: '今日系统成功出款余额',
      trend: 'neutral',
      icon: Banknote,
      tone: 'sky',
    },
    {
      label: '预估流水',
      value: `$${sellUsdToday.toLocaleString('en-US')}`,
      hint: '今日卖币累计',
      trend: 'neutral',
      icon: Wallet,
      tone: 'slate',
    },
    {
      label: '预估流水',
      value: `$${payUsdToday.toLocaleString('en-US')}`,
      hint: '今日付费累计',
      trend: 'neutral',
      icon: Wallet,
      tone: 'emerald',
    },
  ]

  return (
    <div className="tg-admin-console">
      <div className={`tg-admin-console__stats${cardsBump ? ' tg-admin-console__stats--bump' : ''}`}>
        {stats.map((row) => {
          const { label, value, hint, icon, tone, trend } = row
          const StatIcon = icon
          return (
          <article key={`${label}-${tone}`} className={`tg-admin-console__stat tg-admin-console__stat--${tone}`}>
            <div className="tg-admin-console__stat-icon" aria-hidden>
              <StatIcon size={22} strokeWidth={1.85} />
            </div>
            <div className="tg-admin-console__stat-body">
              <p className="tg-admin-console__stat-label">{label}</p>
              <p className="tg-admin-console__stat-value">{value}</p>
              <p
                className={
                  trend === 'up'
                    ? 'tg-admin-console__stat-hint tg-admin-console__stat-hint--up'
                    : trend === 'down'
                      ? 'tg-admin-console__stat-hint tg-admin-console__stat-hint--down'
                      : 'tg-admin-console__stat-hint'
                }
              >
                {hint}
              </p>
            </div>
          </article>
          )
        })}
      </div>

      <div className="tg-admin-console__filters tg-admin-console__filters--datetime-inline">
        <div className="tg-admin-records-filter tg-admin-console__records-datetime-bar">
          <div className="tg-admin-records-filter__group tg-admin-records-filter__group--datetime tg-admin-console__datetime-group">
            <label className="tg-admin-records-filter__label" htmlFor="admin-console-start-time">
              日期：
            </label>
            <div className="tg-admin-records-filter__date-wrap" ref={consoleStartDateMenuRef}>
              <input
                id="admin-console-start-time"
                className="tg-admin-records-filter__input tg-admin-records-filter__input--datetime"
                type="text"
                inputMode="numeric"
                value={consoleStartDateTime}
                onChange={(e) => setConsoleStartDateTime(e.target.value)}
                onClick={() => {
                  const ym = getYearMonthFromText(consoleStartDateTime)
                  if (ym) setConsoleStartMonthCursor(ym)
                  setConsoleStartDateMenuOpen(true)
                }}
              />
              {consoleStartDateMenuOpen ? (
                <AdminRecordsDateTimeMenu
                  yearMonth={consoleStartMonthCursor}
                  onPrevMonth={() => setConsoleStartMonthCursor((v) => shiftYearMonth(v, -1))}
                  onNextMonth={() => setConsoleStartMonthCursor((v) => shiftYearMonth(v, 1))}
                  onPickDate={(date) => {
                    const time = keepTimeOrDefault(consoleStartDateTime)
                    setConsoleStartDateTime(`${date} ${time}`)
                    setConsoleStartDateMenuOpen(false)
                  }}
                  timePanelOpen={consoleStartTimePanelOpen}
                  setTimePanelOpen={setConsoleStartTimePanelOpen}
                  currentDateTime={consoleStartDateTime}
                  onPickTime={(time) => {
                    const date = toDateOnly(consoleStartDateTime) || `${consoleStartMonthCursor}-01`
                    setConsoleStartDateTime(`${date} ${time}`)
                  }}
                />
              ) : null}
            </div>
            <span className="tg-admin-records-filter__dash" aria-hidden>
              →
            </span>
            <div className="tg-admin-records-filter__date-wrap" ref={consoleEndDateMenuRef}>
              <input
                id="admin-console-end-time"
                className="tg-admin-records-filter__input tg-admin-records-filter__input--datetime"
                type="text"
                inputMode="numeric"
                value={consoleEndDateTime}
                onChange={(e) => setConsoleEndDateTime(e.target.value)}
                onClick={() => {
                  const ym = getYearMonthFromText(consoleEndDateTime || consoleStartDateTime)
                  if (ym) setConsoleEndMonthCursor(ym)
                  setConsoleEndDateMenuOpen(true)
                }}
              />
              {consoleEndDateMenuOpen ? (
                <AdminRecordsDateTimeMenu
                  yearMonth={consoleEndMonthCursor}
                  onPrevMonth={() => setConsoleEndMonthCursor((v) => shiftYearMonth(v, -1))}
                  onNextMonth={() => setConsoleEndMonthCursor((v) => shiftYearMonth(v, 1))}
                  onPickDate={(date) => {
                    const time = keepTimeOrDefault(consoleEndDateTime || consoleStartDateTime)
                    setConsoleEndDateTime(`${date} ${time}`)
                    setConsoleEndDateMenuOpen(false)
                  }}
                  timePanelOpen={consoleEndTimePanelOpen}
                  setTimePanelOpen={setConsoleEndTimePanelOpen}
                  currentDateTime={consoleEndDateTime || consoleStartDateTime}
                  onPickTime={(time) => {
                    const base = consoleEndDateTime || consoleStartDateTime
                    const date = toDateOnly(base) || `${consoleEndMonthCursor}-01`
                    setConsoleEndDateTime(`${date} ${time}`)
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          className={`tg-admin-console__date-btn tg-admin-console__date-btn--toolbar${isQuerying ? ' is-loading' : ''}`}
          disabled={isQuerying}
          onClick={() => {
            setCardsBump(true)
            if (bumpTimerRef.current) window.clearTimeout(bumpTimerRef.current)
            bumpTimerRef.current = window.setTimeout(() => setCardsBump(false), 520)
            setQueryStartStr(consoleStartDateTime.trim())
            setQueryEndStr(consoleEndDateTime.trim())
            setQueryNonce((v) => v + 1)
          }}
        >
          查询
        </button>
      </div>
    </div>
  )
}
