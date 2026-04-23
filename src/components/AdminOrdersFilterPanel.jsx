import { Lock } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AdminRecordsDateTimeMenu } from './AdminDateTimePickerMenu.jsx'
import {
  getPhnomPenhTodayStartText,
  getYearMonthFromText,
  keepTimeOrDefault,
  shiftYearMonth,
  toDateOnly,
} from '../lib/adminDateTimePickerUtils.js'
import { formatTelegramDisplayName, useTelegramUser } from '../hooks/useTelegramUser.js'
import { buildOrderNo } from '../lib/orderNo.js'

const ORDER_STATUS_OPTIONS = ['全部状态', '待支付', '待确认', '支付成功', '支付失败']

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100, 200, 500]

const AUTO_REFRESH_OPTIONS = [
  { label: '不刷新', seconds: 0 },
  { label: '间隔10秒', seconds: 10 },
  { label: '间隔30秒', seconds: 30 },
  { label: '间隔60秒', seconds: 60 },
  { label: '间隔120秒', seconds: 120 },
  { label: '间隔180秒', seconds: 180 },
]

const DEMO_ORDER_NO = buildOrderNo(new Date(2026, 3, 18, 13, 57, 31), 1)
const DEMO_ORDER_NO_PENDING = buildOrderNo(new Date(2026, 3, 18, 14, 8, 22), 7)

/**
 * 待支付：红色「锁定」→ 系统提示弹窗 →「待确认」按钮；
 * 待确认：琥珀色按钮 → 系统提示弹窗 →「支付成功」/「支付失败」终态纯文本。
 */
function OrderStatusCell({ status, orderNo, onLockClick, onAwaitConfirmPaidClick }) {
  if (status === '待支付') {
    return (
      <button
        type="button"
        className="tg-admin-orders-status-lock"
        aria-label="待支付，点击打开锁定确认"
        onClick={() => onLockClick?.(orderNo)}
      >
        <Lock className="tg-admin-orders-status-lock__icon" size={14} strokeWidth={2.4} aria-hidden />
        锁定
      </button>
    )
  }
  if (status === '待确认') {
    return (
      <button
        type="button"
        className="tg-admin-orders-status-await"
        aria-label="待确认，收款后点击标记为支付成功"
        onClick={() => onAwaitConfirmPaidClick?.(orderNo)}
      >
        待确认
      </button>
    )
  }
  return <span>{status}</span>
}

export default function AdminOrdersFilterPanel() {
  const orderStatusMenuRef = useRef(null)
  const orderPageSizeMenuRef = useRef(null)
  const orderAutoRefreshMenuRef = useRef(null)
  const orderStartDateMenuRef = useRef(null)
  const orderEndDateMenuRef = useRef(null)
  const ordersFilterSnapshotRef = useRef({})

  const [memberName, setMemberName] = useState('')
  const [memberId, setMemberId] = useState('')
  const [memberAccount, setMemberAccount] = useState('')
  const [orderStatus, setOrderStatus] = useState('全部状态')
  const [orderNoKeyword, setOrderNoKeyword] = useState('')

  const [startDateTime, setStartDateTime] = useState(() => getPhnomPenhTodayStartText())
  const [endDateTime, setEndDateTime] = useState('')
  const [startMonthCursor, setStartMonthCursor] = useState(() => getYearMonthFromText(getPhnomPenhTodayStartText()))
  const [endMonthCursor, setEndMonthCursor] = useState(() => getYearMonthFromText(getPhnomPenhTodayStartText()))
  const [orderStatusMenuOpen, setOrderStatusMenuOpen] = useState(false)
  const [startDateMenuOpen, setStartDateMenuOpen] = useState(false)
  const [endDateMenuOpen, setEndDateMenuOpen] = useState(false)
  const [startTimePanelOpen, setStartTimePanelOpen] = useState(false)
  const [endTimePanelOpen, setEndTimePanelOpen] = useState(false)

  const [goodsName, setGoodsName] = useState('')
  const [goodsId, setGoodsId] = useState('')
  const [pageSize, setPageSize] = useState(15)
  const [ordersAutoRefreshSec, setOrdersAutoRefreshSec] = useState(0)
  const [pageSizeMenuOpen, setPageSizeMenuOpen] = useState(false)
  const [autoRefreshMenuOpen, setAutoRefreshMenuOpen] = useState(false)
  const [orderLockDialogOpen, setOrderLockDialogOpen] = useState(false)
  const [orderLockDialogOrderNo, setOrderLockDialogOrderNo] = useState('')
  const [orderAwaitPaidDialogOpen, setOrderAwaitPaidDialogOpen] = useState(false)
  const [orderAwaitPaidDialogOrderNo, setOrderAwaitPaidDialogOrderNo] = useState('')
  /** 已在弹窗中点击「确定」锁定的订单号（状态列显示「待确认」按钮） */
  const [lockConfirmedOrderNos, setLockConfirmedOrderNos] = useState(() => new Set())
  /** 弹窗中点击「支付成功」→ 状态列「支付成功」 */
  const [paidSuccessOrderNos, setPaidSuccessOrderNos] = useState(() => new Set())
  /** 弹窗中点击「支付失败」→ 状态列「支付失败」 */
  const [paidFailedOrderNos, setPaidFailedOrderNos] = useState(() => new Set())

  const tgUser = useTelegramUser()
  const memberFromTelegram = Boolean(tgUser)

  useEffect(() => {
    if (!tgUser) return
    setMemberName(formatTelegramDisplayName(tgUser))
    setMemberId(String(tgUser.id))
    setMemberAccount(tgUser.username ? `@${tgUser.username}` : '')
  }, [tgUser])

  ordersFilterSnapshotRef.current = {
    pageSize,
    ordersAutoRefreshSec,
    memberName,
    memberId,
    memberAccount,
    orderStatus,
    orderNoKeyword,
    startDateTime,
    endDateTime,
    goodsName,
    goodsId,
  }

  useEffect(() => {
    if (!orderStatusMenuOpen) return
    const onDoc = (e) => {
      if (orderStatusMenuRef.current && !orderStatusMenuRef.current.contains(e.target)) {
        setOrderStatusMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [orderStatusMenuOpen])

  useEffect(() => {
    if (!pageSizeMenuOpen) return
    const onDoc = (e) => {
      if (orderPageSizeMenuRef.current && !orderPageSizeMenuRef.current.contains(e.target)) {
        setPageSizeMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [pageSizeMenuOpen])

  useEffect(() => {
    if (!autoRefreshMenuOpen) return
    const onDoc = (e) => {
      if (orderAutoRefreshMenuRef.current && !orderAutoRefreshMenuRef.current.contains(e.target)) {
        setAutoRefreshMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [autoRefreshMenuOpen])

  useEffect(() => {
    if (!startDateMenuOpen) return
    const onDoc = (e) => {
      if (orderStartDateMenuRef.current && !orderStartDateMenuRef.current.contains(e.target)) {
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
      if (orderEndDateMenuRef.current && !orderEndDateMenuRef.current.contains(e.target)) {
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
    if (ordersAutoRefreshSec <= 0) return undefined
    const tick = () => {
      window.dispatchEvent(
        new CustomEvent('tg-admin-orders-auto-refresh', { detail: { ...ordersFilterSnapshotRef.current } }),
      )
    }
    const id = window.setInterval(tick, ordersAutoRefreshSec * 1000)
    return () => window.clearInterval(id)
  }, [ordersAutoRefreshSec])

  const fireOrdersSearch = () => {
    window.dispatchEvent(
      new CustomEvent('tg-admin-orders-search', { detail: { ...ordersFilterSnapshotRef.current } }),
    )
  }

  const fireOrdersExport = () => {
    window.dispatchEvent(
      new CustomEvent('tg-admin-orders-export', { detail: { ...ordersFilterSnapshotRef.current } }),
    )
  }

  const openOrderLockDialog = (orderNo) => {
    setOrderLockDialogOrderNo(String(orderNo ?? ''))
    setOrderLockDialogOpen(true)
  }

  const closeOrderLockDialog = useCallback(() => {
    setOrderLockDialogOpen(false)
    setOrderLockDialogOrderNo('')
  }, [])

  const confirmOrderLock = () => {
    const no = String(orderLockDialogOrderNo || '').trim()
    window.dispatchEvent(
      new CustomEvent('tg-admin-order-lock-confirm', {
        detail: { orderNo: no, ...ordersFilterSnapshotRef.current },
      }),
    )
    if (no) {
      setLockConfirmedOrderNos((prev) => new Set(prev).add(no))
    }
    closeOrderLockDialog()
  }

  useEffect(() => {
    if (!orderLockDialogOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeOrderLockDialog()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [orderLockDialogOpen, closeOrderLockDialog])

  const openAwaitPaidDialog = (orderNo) => {
    setOrderAwaitPaidDialogOrderNo(String(orderNo ?? ''))
    setOrderAwaitPaidDialogOpen(true)
  }

  const closeAwaitPaidDialog = useCallback(() => {
    setOrderAwaitPaidDialogOpen(false)
    setOrderAwaitPaidDialogOrderNo('')
  }, [])

  useEffect(() => {
    if (!orderAwaitPaidDialogOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeAwaitPaidDialog()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [orderAwaitPaidDialogOpen, closeAwaitPaidDialog])

  const markAwaitingOrderPaidSuccess = (orderNo) => {
    const no = String(orderNo ?? '').trim()
    if (!no) return
    setPaidSuccessOrderNos((prev) => new Set(prev).add(no))
    setPaidFailedOrderNos((prev) => {
      const next = new Set(prev)
      next.delete(no)
      return next
    })
    window.dispatchEvent(
      new CustomEvent('tg-admin-order-paid-success', {
        detail: { orderNo: no, ...ordersFilterSnapshotRef.current },
      }),
    )
  }

  const confirmAwaitPaid = () => {
    markAwaitingOrderPaidSuccess(orderAwaitPaidDialogOrderNo)
    closeAwaitPaidDialog()
  }

  const rejectAwaitPaid = () => {
    const no = String(orderAwaitPaidDialogOrderNo || '').trim()
    if (no) {
      setPaidFailedOrderNos((prev) => new Set(prev).add(no))
      setPaidSuccessOrderNos((prev) => {
        const next = new Set(prev)
        next.delete(no)
        return next
      })
      window.dispatchEvent(
        new CustomEvent('tg-admin-order-paid-failed', {
          detail: { orderNo: no, ...ordersFilterSnapshotRef.current },
        }),
      )
    }
    closeAwaitPaidDialog()
  }

  const demoPendingRowStatus = paidFailedOrderNos.has(DEMO_ORDER_NO_PENDING)
    ? '支付失败'
    : paidSuccessOrderNos.has(DEMO_ORDER_NO_PENDING)
      ? '支付成功'
      : lockConfirmedOrderNos.has(DEMO_ORDER_NO_PENDING)
        ? '待确认'
        : '待支付'

  return (
    <div className="tg-admin-records-filter">
      <div className="tg-admin-records-filter__group">
        <label className="tg-admin-records-filter__label" htmlFor="order-member-name-input">
          会员姓名：
        </label>
        <input
          id="order-member-name-input"
          className="tg-admin-records-filter__input"
          type="text"
          value={memberName}
          readOnly={memberFromTelegram}
          title={memberFromTelegram ? '由当前 Telegram 账号自动填入' : undefined}
          onChange={(e) => setMemberName(e.target.value)}
        />
      </div>

      <div className="tg-admin-records-filter__group">
        <label className="tg-admin-records-filter__label" htmlFor="order-member-id-input">
          会员ID：
        </label>
        <input
          id="order-member-id-input"
          className="tg-admin-records-filter__input"
          type="text"
          value={memberId}
          readOnly={memberFromTelegram}
          title={memberFromTelegram ? '由当前 Telegram 账号自动填入' : undefined}
          onChange={(e) => setMemberId(e.target.value)}
        />
      </div>

      <div className="tg-admin-records-filter__group">
        <label className="tg-admin-records-filter__label" htmlFor="order-member-account-input">
          会员账号：
        </label>
        <input
          id="order-member-account-input"
          className="tg-admin-records-filter__input"
          type="text"
          value={memberAccount}
          readOnly={memberFromTelegram}
          title={memberFromTelegram ? '由当前 Telegram 账号自动填入（@用户名）' : undefined}
          onChange={(e) => setMemberAccount(e.target.value)}
        />
      </div>

      <div className="tg-admin-records-filter__group">
        <label className="tg-admin-records-filter__label" htmlFor="order-status-input">
          订单状态：
        </label>
        <div className="tg-admin-records-filter__level-wrap" ref={orderStatusMenuRef}>
          <button
            id="order-status-input"
            className="tg-admin-records-filter__input tg-admin-records-filter__input--level"
            type="button"
            onClick={() => setOrderStatusMenuOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={orderStatusMenuOpen}
          >
            {orderStatus}
          </button>
          <span className="tg-admin-records-filter__level-caret" aria-hidden>
            ▾
          </span>
          {orderStatusMenuOpen ? (
            <div className="tg-admin-records-filter__level-menu" role="listbox" aria-label="订单状态">
              {ORDER_STATUS_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={
                    item === orderStatus
                      ? 'tg-admin-records-filter__level-item tg-admin-records-filter__level-item--active'
                      : 'tg-admin-records-filter__level-item'
                  }
                  onClick={() => {
                    setOrderStatus(item)
                    setOrderStatusMenuOpen(false)
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
        <label className="tg-admin-records-filter__label" htmlFor="order-no-keyword-input">
          订单号：
        </label>
        <input
          id="order-no-keyword-input"
          className="tg-admin-records-filter__input tg-admin-records-filter__input--long"
          type="text"
          value={orderNoKeyword}
          onChange={(e) => setOrderNoKeyword(e.target.value)}
        />
      </div>

      <div className="tg-admin-records-filter__group tg-admin-records-filter__group--datetime tg-admin-records-filter__group--datetime-records">
        <label className="tg-admin-records-filter__label" htmlFor="order-start-time">
          下单日期：
        </label>
        <div className="tg-admin-records-filter__date-wrap" ref={orderStartDateMenuRef}>
          <input
            id="order-start-time"
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
        <div className="tg-admin-records-filter__date-wrap" ref={orderEndDateMenuRef}>
          <input
            id="order-end-time"
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
          <label className="tg-admin-records-filter__label" htmlFor="order-goods-name-input">
            商品名称：
          </label>
          <input
            id="order-goods-name-input"
            className="tg-admin-records-filter__input tg-admin-records-filter__input--shelf-title"
            type="text"
            value={goodsName}
            onChange={(e) => setGoodsName(e.target.value)}
          />
        </div>
        <div className="tg-admin-records-filter__datetime-shelf-tail tg-admin-records-filter__datetime-shelf-tail--id">
          <label className="tg-admin-records-filter__label" htmlFor="order-goods-id-input">
            商品ID：
          </label>
          <input
            id="order-goods-id-input"
            className="tg-admin-records-filter__input tg-admin-records-filter__input--shelf-id"
            type="text"
            autoComplete="off"
            value={goodsId}
            onChange={(e) => setGoodsId(e.target.value)}
          />
        </div>
        <div className="tg-admin-records-filter__datetime-shelf-tail tg-admin-records-filter__datetime-shelf-tail--select">
          <span className="tg-admin-records-filter__label" id="order-page-size-label">
            每页显示：
          </span>
          <div className="tg-admin-records-filter__level-wrap" ref={orderPageSizeMenuRef}>
            <button
              type="button"
              className="tg-admin-records-filter__input tg-admin-records-filter__input--level tg-admin-records-filter__input--records-inline"
              aria-labelledby="order-page-size-label"
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
          <span className="tg-admin-records-filter__label" id="order-auto-refresh-label">
            自动刷新：
          </span>
          <div className="tg-admin-records-filter__level-wrap" ref={orderAutoRefreshMenuRef}>
            <button
              type="button"
              className="tg-admin-records-filter__input tg-admin-records-filter__input--level tg-admin-records-filter__input--records-inline"
              aria-labelledby="order-auto-refresh-label"
              aria-haspopup="listbox"
              aria-expanded={autoRefreshMenuOpen}
              onClick={() => setAutoRefreshMenuOpen((o) => !o)}
            >
              {AUTO_REFRESH_OPTIONS.find((o) => o.seconds === ordersAutoRefreshSec)?.label ?? '不刷新'}
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
                    aria-selected={opt.seconds === ordersAutoRefreshSec}
                    className={
                      opt.seconds === ordersAutoRefreshSec
                        ? 'tg-admin-records-filter__level-item tg-admin-records-filter__level-item--active'
                        : 'tg-admin-records-filter__level-item'
                    }
                    onClick={() => {
                      setOrdersAutoRefreshSec(opt.seconds)
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
          onClick={fireOrdersSearch}
        >
          <span className="tg-admin-records-filter__action-btn-icon" aria-hidden>
            🔍
          </span>
          搜索
        </button>
        <button
          type="button"
          className="tg-admin-records-filter__action-btn tg-admin-records-filter__action-btn--export"
          onClick={fireOrdersExport}
        >
          导出
        </button>
      </div>

      <div className="tg-admin-records-filter__table-wrap">
        <table className="tg-admin-records-filter__table" aria-label="订单列表">
          <thead>
            <tr>
              <th scope="col">订单号</th>
              <th scope="col">会员姓名</th>
              <th scope="col">会员ID</th>
              <th scope="col">会员账号</th>
              <th scope="col">商品名称</th>
              <th scope="col">商品ID</th>
              <th scope="col">金额</th>
              <th scope="col">状态</th>
              <th scope="col">日期</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{DEMO_ORDER_NO_PENDING}</td>
              <td>{tgUser ? formatTelegramDisplayName(tgUser) : '演示读者'}</td>
              <td>{tgUser ? String(tgUser.id) : '1000001'}</td>
              <td>{tgUser ? (tgUser.username ? `@${tgUser.username}` : '—') : 'demo_reader@69kk.com'}</td>
              <td>VIP 月卡 ×1</td>
              <td>vip_month_01</td>
              <td>US$ 9.99</td>
              <td>
                <OrderStatusCell
                  status={demoPendingRowStatus}
                  orderNo={DEMO_ORDER_NO_PENDING}
                  onLockClick={openOrderLockDialog}
                  onAwaitConfirmPaidClick={openAwaitPaidDialog}
                />
              </td>
              <td>2026-04-18 14:08:22</td>
              <td>
                <button type="button" className="tg-admin-records-filter__table-action">
                  详情
                </button>
              </td>
            </tr>
            <tr>
              <td>{DEMO_ORDER_NO}</td>
              <td>{tgUser ? formatTelegramDisplayName(tgUser) : '演示读者'}</td>
              <td>{tgUser ? String(tgUser.id) : '1000001'}</td>
              <td>{tgUser ? (tgUser.username ? `@${tgUser.username}` : '—') : 'demo_reader@69kk.com'}</td>
              <td>VIP 月卡 ×1</td>
              <td>vip_month_01</td>
              <td>US$ 9.99</td>
              <td>
                <OrderStatusCell
                  status="已支付"
                  orderNo={DEMO_ORDER_NO}
                  onLockClick={openOrderLockDialog}
                  onAwaitConfirmPaidClick={openAwaitPaidDialog}
                />
              </td>
              <td>2026-04-18 13:57:31</td>
              <td>
                <button type="button" className="tg-admin-records-filter__table-action">
                  详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {orderLockDialogOpen ? (
        <div
          className="tg-admin-order-lock-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tg-admin-order-lock-dialog-title"
        >
          <button
            type="button"
            className="tg-admin-order-lock-dialog__backdrop"
            onClick={closeOrderLockDialog}
            aria-label="关闭"
          />
          <div className="tg-admin-order-lock-dialog__panel">
            <h2 id="tg-admin-order-lock-dialog-title" className="tg-admin-order-lock-dialog__title">
              系统提示
            </h2>
            <p className="tg-admin-order-lock-dialog__subtitle">
              您确定要锁定此订单的操作吗？锁定后其他人将无法操作！
            </p>
            <div className="tg-admin-order-lock-dialog__actions">
              <button type="button" className="tg-admin-order-lock-dialog__btn tg-admin-order-lock-dialog__btn--ghost" onClick={closeOrderLockDialog}>
                取消
              </button>
              <button type="button" className="tg-admin-order-lock-dialog__btn tg-admin-order-lock-dialog__btn--primary" onClick={confirmOrderLock}>
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {orderAwaitPaidDialogOpen ? (
        <div
          className="tg-admin-order-lock-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tg-admin-order-await-paid-dialog-title"
        >
          <button
            type="button"
            className="tg-admin-order-lock-dialog__backdrop"
            onClick={closeAwaitPaidDialog}
            aria-label="关闭"
          />
          <div className="tg-admin-order-lock-dialog__panel">
            <h2 id="tg-admin-order-await-paid-dialog-title" className="tg-admin-order-lock-dialog__title">
              系统提示
            </h2>
            <p className="tg-admin-order-lock-dialog__subtitle">
              您确认已收到该订单款项吗？确认后订单状态将变为「支付成功」。
            </p>
            <div className="tg-admin-order-lock-dialog__actions">
              <button
                type="button"
                className="tg-admin-order-lock-dialog__btn tg-admin-order-lock-dialog__btn--ghost"
                onClick={rejectAwaitPaid}
              >
                支付失败
              </button>
              <button type="button" className="tg-admin-order-lock-dialog__btn tg-admin-order-lock-dialog__btn--primary" onClick={confirmAwaitPaid}>
                支付成功
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
