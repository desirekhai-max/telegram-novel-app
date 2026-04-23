import { Link } from 'react-router-dom'
import { refreshAppFromLogo } from '../lib/refreshAppFromLogo.js'

/** 任务 / VIP / 账户：左 LOGO（回首页）或返回「&lt;」、中间标题 */
export default function BrandTabToolbar({ title, titleLang = 'km', backTo }) {
  const left = backTo ? (
    <Link
      to={backTo}
      className="tg-toolbar__brand-tab-logo tg-toolbar__brand-tab-back m-0 flex h-10 min-w-10 shrink-0 items-center justify-center leading-none text-white/90 transition-colors active:text-white"
      aria-label="返回"
    >
      <span
        className="select-none font-sans text-[1.2rem] font-light leading-none tracking-tight text-white/80"
        aria-hidden
      >
        {'<'}
      </span>
    </Link>
  ) : (
    <button
      type="button"
      className="tg-toolbar__logo tg-toolbar__brand-tab-logo m-0 shrink-0 cursor-pointer leading-none"
      aria-label="刷新界面"
      onClick={() => refreshAppFromLogo()}
    >
      <img
        src="/logo.png"
        alt=""
        className="tg-toolbar__logo-img tg-toolbar__logo-img--tab"
        width="120"
        height="32"
        decoding="async"
      />
    </button>
  )

  return (
    <header className="tg-toolbar tg-toolbar--large tg-toolbar--no-divider tg-toolbar--brand-tab">
      {left}
      <div className="tg-toolbar__tab-center">
        <h1 className="tg-toolbar__title tg-toolbar__title--tab m-0" lang={titleLang}>
          {title}
        </h1>
      </div>
      <div className="tg-toolbar__tab-end" aria-hidden="true" />
    </header>
  )
}
