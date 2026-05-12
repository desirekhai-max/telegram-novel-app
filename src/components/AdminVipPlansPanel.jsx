import { useEffect, useMemo, useState } from 'react'
import {
  VIP_MEMBER_FOOTER_KM,
  VIP_PLANS_CATALOG,
  VIP_PLANS_CATALOG_AUTHOR,
  buildVipPlansPublicPayload,
} from '../data/vipPlansCatalog.js'
import { apiUrl } from '../lib/apiBase.js'

function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object') return null
  const plans = Array.isArray(raw.plans) ? raw.plans : null
  if (!plans || plans.length === 0) return null
  const footerKm =
    typeof raw.footerKm === 'string' && raw.footerKm.trim()
      ? raw.footerKm.trim()
      : VIP_MEMBER_FOOTER_KM
  const sorted = [...plans].sort(
    (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
  )
  const plansAuthorRaw = Array.isArray(raw.plansAuthor) ? raw.plansAuthor : null
  const plansAuthor =
    plansAuthorRaw && plansAuthorRaw.length > 0
      ? [...plansAuthorRaw].sort(
          (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
        )
      : null
  return {
    version: Number(raw.version) || 1,
    footerKm,
    plans: sorted,
    ...(plansAuthor ? { plansAuthor } : {}),
  }
}

/**
 * 后台 VIP 套餐：展示当前数据与接口 JSON，便于与新后台 API 对齐。
 */
export default function AdminVipPlansPanel() {
  const fallback = useMemo(() => buildVipPlansPublicPayload(), [])
  const [remote, setRemote] = useState(null)
  const [remoteError, setRemoteError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setRemoteError('')
      try {
        const res = await fetch(apiUrl('/api/vip-plans'), { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) setRemoteError(`HTTP ${res.status}`)
          return
        }
        const data = await res.json()
        const norm = normalizePayload(data)
        if (!cancelled) {
          if (norm) setRemote(norm)
          else setRemoteError('返回 JSON 结构无效')
        }
      } catch (e) {
        if (!cancelled) setRemoteError(String(e?.message || 'network'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const effective = remote ?? fallback
  const previewJson = useMemo(() => JSON.stringify(effective, null, 2), [effective])

  const catalogRows = useMemo(
    () => [...VIP_PLANS_CATALOG].sort((a, b) => a.sortOrder - b.sortOrder),
    [],
  )
  const catalogAuthorRows = useMemo(
    () => [...VIP_PLANS_CATALOG_AUTHOR].sort((a, b) => a.sortOrder - b.sortOrder),
    [],
  )

  return (
    <div className="tg-admin-vip-plans">
      <p className="tg-admin-shell__panel-text" style={{ marginBottom: 12 }}>
        以下为 VIP 套餐<strong>内置数据源</strong>（
        <code>src/data/vipPlansCatalog.js</code>）与 Node 服务文件{' '}
        <code>server/vip-plans.json</code>
        ；Mini App <code>VipPage</code>：<code>computeViewerMemberTier === 'author'</code>（当前默认已登录非 Premium）看{' '}
        <code>plansAuthor</code>，否则看 <code>plans</code>。接口就绪后使用{' '}
        <code>GET /api/vip-plans</code>
        返回同结构 JSON；保存草稿可扩展 <code>PUT /api/admin/vip-plans</code>（待实现）。
      </p>

      {loading ? (
        <p className="tg-admin-shell__panel-text">正在请求 GET /api/vip-plans …</p>
      ) : remoteError && !remote ? (
        <p className="tg-admin-shell__panel-text" style={{ color: '#fbbf24' }}>
          接口不可用（{remoteError}），下方表格为内置目录；本地启动 presence-server 且存在{' '}
          <code>server/vip-plans.json</code> 后将显示接口数据。
        </p>
      ) : remote ? (
        <p className="tg-admin-shell__panel-text" style={{ color: '#86efac' }}>
          已加载 GET /api/vip-plans（version {effective.version}）；底部 JSON 为当前生效载荷。
        </p>
      ) : null}

      <h2 className="tg-admin-vip-plans__subhead">普通会员目录（plans）</h2>
      <div className="tg-admin-records-filter__table-wrap">
        <table className="tg-admin-records-filter__table" aria-label="VIP 套餐目录">
          <thead>
            <tr>
              <th scope="col">planId</th>
              <th scope="col">顺序</th>
              <th scope="col">高亮</th>
              <th scope="col">标题 km</th>
              <th scope="col">副标题 km</th>
              <th scope="col">价格</th>
              <th scope="col">时长文案</th>
              <th scope="col">小时数</th>
            </tr>
          </thead>
          <tbody>
            {catalogRows.map((p) => (
              <tr key={p.planId}>
                <td>
                  <code>{p.planId}</code>
                </td>
                <td>{p.sortOrder}</td>
                <td>{p.featured ? '是' : '否'}</td>
                <td lang="km">{p.titleKm}</td>
                <td lang="km">{p.flagKm}</td>
                <td>{p.priceUsdLabel}</td>
                <td lang="km">{p.durationKm}</td>
                <td>{p.durationHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="tg-admin-vip-plans__subhead" style={{ marginTop: 20 }}>
        作者会员目录（plansAuthor）
      </h2>
      <div className="tg-admin-records-filter__table-wrap">
        <table className="tg-admin-records-filter__table" aria-label="VIP 作者会员套餐目录">
          <thead>
            <tr>
              <th scope="col">planId</th>
              <th scope="col">顺序</th>
              <th scope="col">高亮</th>
              <th scope="col">标题 km</th>
              <th scope="col">副标题 km</th>
              <th scope="col">价格</th>
              <th scope="col">时长文案</th>
              <th scope="col">小时数</th>
            </tr>
          </thead>
          <tbody>
            {catalogAuthorRows.map((p) => (
              <tr key={p.planId}>
                <td>
                  <code>{p.planId}</code>
                </td>
                <td>{p.sortOrder}</td>
                <td>{p.featured ? '是' : '否'}</td>
                <td lang="km">{p.titleKm}</td>
                <td lang="km">{p.flagKm}</td>
                <td>{p.priceUsdLabel}</td>
                <td lang="km">{p.durationKm}</td>
                <td>{p.durationHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="tg-admin-shell__panel-text" style={{ marginTop: 16 }} lang="km">
        共用底部文案 footerKm：<strong>{effective.footerKm}</strong>
      </p>

      <h2 className="tg-admin-vip-plans__subhead">接口载荷预览（POSTMAN / 新后台可对齐）</h2>
      <pre className="tg-admin-vip-plans__json" tabIndex={0}>
        {previewJson}
      </pre>
    </div>
  )
}
