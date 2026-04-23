import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const STORAGE_KEY = 'tg_premium_preview'

/**
 * 本地预览 Premium 头像样式（不改 Telegram 真实订阅）。
 * 打开账户页：`/account?premium_preview=1`
 * 关闭：`/account?premium_preview=0`
 */
export function usePremiumPreview() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const q = searchParams.get('premium_preview')

  const on = useMemo(() => {
    if (q === '1') return true
    if (q === '0') return false
    if (typeof window === 'undefined') return false
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  }, [q])

  useEffect(() => {
    if (q !== '1' && q !== '0') return
    if (q === '1') sessionStorage.setItem(STORAGE_KEY, '1')
    else sessionStorage.removeItem(STORAGE_KEY)
    const next = new URLSearchParams(searchParams)
    next.delete('premium_preview')
    const s = next.toString()
    navigate(s ? { pathname: '/account', search: `?${s}` } : { pathname: '/account' }, { replace: true })
  }, [q, searchParams, navigate])

  return on
}
