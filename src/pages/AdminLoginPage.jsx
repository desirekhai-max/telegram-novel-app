import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loginAdmin } from '../lib/adminAuth.js'

const LOGIN_PAGE_TIMEOUT_MS = 5 * 60 * 1000

function makeCaptcha() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const chars = []
  for (let i = 0; i < 4; i += 1) {
    chars.push(letters[Math.floor(Math.random() * letters.length)])
  }
  for (let i = 0; i < 2; i += 1) {
    chars.push(digits[Math.floor(Math.random() * digits.length)])
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [captchaCode, setCaptchaCode] = useState(() => makeCaptcha())
  const [otpOpen, setOtpOpen] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pageIssuedAt] = useState(() => Date.now())

  const redirectTo = new URLSearchParams(location.search).get('redirect') || '/admin'

  const onSubmit = (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim() || !captcha.trim()) {
      setError('请输入账号、密码和验证码')
      return
    }
    if (captcha.trim().toUpperCase() !== captchaCode) {
      setError('验证码不正确')
      setCaptcha('')
      setCaptchaCode(makeCaptcha())
      return
    }
    setError('')
    setOtpCode('')
    setOtpError('')
    setOtpOpen(true)
  }

  const onSubmitOtp = async () => {
    if (Date.now() - pageIssuedAt > LOGIN_PAGE_TIMEOUT_MS) {
      setOtpError('请求校验失败，请刷新页面重试')
      return
    }
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setOtpError('请输入 6 位数字验证码')
      return
    }
    setSubmitting(true)
    const result = await loginAdmin(username, password, otpCode)
    setSubmitting(false)
    if (!result.ok) {
      setOtpError(result.error || '账号、密码或动态码错误')
      return
    }
    setOtpOpen(false)
    navigate(redirectTo, { replace: true })
  }

  return (
    <main className="tg-admin-login" lang="zh-Hans">
      <header className="tg-admin-login__hero">
        <p className="tg-admin-login__hero-code">
          <span className="tg-admin-login__hero-code-main">𝟔𝟗𝐊𝐊𝐇</span>
          <span className="tg-admin-login__hero-code-sub">_𝐍𝐎𝐕𝐄𝐋</span>
        </p>
        <p className="tg-admin-login__hero-sub">管理系统</p>
      </header>
      <form className="tg-admin-login__card" onSubmit={onSubmit}>
        <p className="tg-admin-login__card-tip">请输入您的账号和密码</p>
        <input
          className="tg-admin-login__field"
          value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              if (error) setError('')
            }}
          autoComplete="username"
          placeholder="请输入账号"
        />
        <input
          className="tg-admin-login__field"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (error) setError('')
          }}
          autoComplete="current-password"
          placeholder="请输入密码"
        />
        <div className="tg-admin-login__captcha-row">
          <input
            className="tg-admin-login__field tg-admin-login__field--captcha"
            value={captcha}
            onChange={(e) => {
              setCaptcha(e.target.value)
              if (error) setError('')
            }}
            placeholder="图片验证码"
          />
          <button
            type="button"
            className="tg-admin-login__captcha-box"
            aria-label="刷新验证码"
            onClick={() => {
              setCaptchaCode(makeCaptcha())
              setCaptcha('')
              if (error) setError('')
            }}
          >
            {captchaCode}
          </button>
        </div>
        {error ? <p className="tg-admin-login__error">{error}</p> : null}
        <button type="submit" className="tg-admin-login__submit">
          <LogIn size={16} />
          提交登录
        </button>
      </form>
      {otpOpen ? (
        <div className="tg-admin-otp" role="dialog" aria-modal="true" aria-label="Google 二次验证">
          <button
            type="button"
            className="tg-admin-otp__backdrop"
            onClick={() => {
              setOtpOpen(false)
              setOtpCode('')
              setOtpError('')
            }}
            aria-label="关闭验证弹窗"
          />
          <div className="tg-admin-otp__panel">
            <h3>Google 验证器</h3>
            <p>请输入 Google Authenticator 的 6 位数字</p>
            <input
              className="tg-admin-otp__input"
              value={otpCode}
              onChange={(e) => {
                setOtpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))
                if (otpError) setOtpError('')
              }}
              maxLength={6}
              inputMode="numeric"
              autoFocus
              placeholder="请输入 6 位数字"
            />
            {otpError ? <p className="tg-admin-otp__error">{otpError}</p> : null}
            <div className="tg-admin-otp__actions">
              <button
                type="button"
                className="tg-admin-otp__btn tg-admin-otp__btn--cancel"
                onClick={() => {
                  setOtpOpen(false)
                  setOtpCode('')
                  setOtpError('')
                }}
              >
                取消
              </button>
              <button
                type="button"
                className="tg-admin-otp__btn tg-admin-otp__btn--submit"
                onClick={onSubmitOtp}
                disabled={submitting}
              >
                {submitting ? '校验中...' : '登录'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
