import { useEffect, useMemo, useState } from 'react'
import { novels } from '../data/novels.js'
import { buildNovelsCatalogPayload } from '../lib/novelsCatalog.js'
import { apiUrl } from '../lib/apiBase.js'

function normalizeCatalogPayload(raw) {
  if (!raw || typeof raw !== 'object') return null
  const list = Array.isArray(raw.novels) ? raw.novels : null
  if (!list) return null
  return {
    version: Number(raw.version) || 1,
    novels: list,
  }
}

/**
 * 后台 · 本书卡片 / 列表目录：与 `novelsCatalog`、HomeNovelCard 字段对齐（无 chapters 正文）。
 */
export default function AdminNovelCatalogPanel() {
  const localPayload = useMemo(() => buildNovelsCatalogPayload(novels), [])
  const [remote, setRemote] = useState(null)
  const [remoteError, setRemoteError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setRemoteError('')
      try {
        const res = await fetch(apiUrl('/api/novels-catalog'), { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) setRemoteError(`HTTP ${res.status}`)
          return
        }
        const data = await res.json()
        const norm = normalizeCatalogPayload(data)
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

  const effective = remote ?? localPayload
  const previewJson = useMemo(() => JSON.stringify(effective, null, 2), [effective])

  const rows = effective.novels ?? []

  return (
    <div className="tg-admin-vip-plans">
      <p className="tg-admin-shell__panel-text" style={{ marginBottom: 12 }}>
        以下为首页<strong>书籍卡片</strong>所用目录字段（不含章节 <code>body</code>）；完整正文仍在{' '}
        <code>src/data/novels.js</code>
        。更新书目后请执行 <code>npm run export:novels-catalog</code> 同步{' '}
        <code>server/novels-catalog.json</code>
        ，或由新后台 <code>PUT /api/admin/novels-catalog</code> 写入（待实现）。
      </p>
      <p className="tg-admin-shell__panel-text" style={{ marginBottom: 12 }}>
        Mini App 当前仍从内嵌 <code>novels</code> 数组读取；接口就绪后可将首页改为{' '}
        <code>GET /api/novels-catalog</code> 合并服务端统计字段。
      </p>

      {loading ? (
        <p className="tg-admin-shell__panel-text">正在请求 GET /api/novels-catalog …</p>
      ) : remoteError && !remote ? (
        <p className="tg-admin-shell__panel-text" style={{ color: '#fbbf24' }}>
          接口不可用（{remoteError}），表格与 JSON 为本地 <code>buildNovelsCatalogPayload(novels)</code>
          ；本地启动 API 并运行 <code>npm run export:novels-catalog</code> 后可对齐文件。
        </p>
      ) : remote ? (
        <p className="tg-admin-shell__panel-text" style={{ color: '#86efac' }}>
          已加载 GET /api/novels-catalog（version {effective.version}）。
        </p>
      ) : null}

      <h2 className="tg-admin-vip-plans__subhead">书目摘要（chapterCount = 章节数，无正文）</h2>
      <div className="tg-admin-records-filter__table-wrap">
        <table className="tg-admin-records-filter__table" aria-label="小说目录">
          <thead>
            <tr>
              <th scope="col">id</th>
              <th scope="col">标题</th>
              <th scope="col">作者</th>
              <th scope="col">genreId</th>
              <th scope="col">status</th>
              <th scope="col">万字</th>
              <th scope="col">章节数</th>
              <th scope="col">tags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id}>
                <td>
                  <code>{n.id}</code>
                </td>
                <td className="max-w-[180px] truncate" title={n.title}>
                  {n.title}
                </td>
                <td>{n.author}</td>
                <td>{n.genreId ?? '—'}</td>
                <td>{n.status ?? '—'}</td>
                <td>{n.wordCountWan ?? '—'}</td>
                <td>{n.chapterCount ?? 0}</td>
                <td className="max-w-[200px] truncate" title={(n.tags ?? []).join('、')}>
                  {(n.tags ?? []).join('、') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="tg-admin-vip-plans__subhead">接口载荷预览（POSTMAN / 新后台）</h2>
      <pre className="tg-admin-vip-plans__json" tabIndex={0}>
        {previewJson}
      </pre>
    </div>
  )
}
