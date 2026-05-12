import { Crown, Home, UserRound } from 'lucide-react'
import { createElement } from 'react'
import { NavLink } from 'react-router-dom'

function NavItem({ to, end, label, icon, lang = 'km' }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        ['tg-bottom-nav__link', isActive ? 'tg-bottom-nav__link--active' : ''].filter(Boolean).join(' ')
      }
    >
      {createElement(icon, {
        className: 'tg-bottom-nav__icon',
        strokeWidth: 2,
        size: 23,
        'aria-hidden': true,
      })}
      <span lang={lang} className="tg-bottom-nav__label">
        {label}
      </span>
    </NavLink>
  )
}

export default function BottomNav() {
  return (
    <nav className="tg-bottom-nav" role="navigation" aria-label="ម៉ឺនុយក្រោម">
      <div className="tg-bottom-nav__inner">
        <div className="tg-bottom-nav__bar">
          <NavItem to="/" end label="ទំព័រដើម" icon={Home} />
          <NavItem to="/vip" label="សមាជិកVIP" icon={Crown} lang="km" />
          <NavItem to="/account" label="គណនី" icon={UserRound} />
        </div>
      </div>
    </nav>
  )
}
