import { Crown, Home, ListTodo, UserRound } from 'lucide-react'
import { createElement } from 'react'
import { NavLink } from 'react-router-dom'

const linkBase =
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[0.68rem] font-medium leading-tight transition-[transform,color] duration-200 ease-out motion-reduce:transition-none'

function NavItem({ to, end, label, icon }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          linkBase,
          isActive
            ? 'scale-[1.08] text-tg-blue motion-reduce:scale-100'
            : 'scale-100 text-white/45 hover:text-white/65',
        ].join(' ')
      }
    >
      {createElement(icon, {
        className: 'size-[22px] shrink-0',
        strokeWidth: 2,
        'aria-hidden': true,
      })}
      <span lang="km" className="max-w-full truncate px-0.5">
        {label}
      </span>
    </NavLink>
  )
}

export default function BottomNav() {
  return (
    <nav
      className="pointer-events-none relative z-0 flex w-full justify-center pt-1"
      role="navigation"
      aria-label="ម៉ឺនុយក្រោម"
    >
      <div className="pointer-events-auto w-full max-w-[520px] px-2">
        <div className="flex items-stretch justify-around rounded-2xl border border-white/24 bg-[rgba(6,8,18,0.72)] px-0.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_0_1px_rgba(255,255,255,0.06),0_-14px_48px_rgba(2,3,10,0.55)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[rgba(5,7,16,0.52)]">
          <NavItem to="/" end label="ទំព័រដើម" icon={Home} />
          <NavItem to="/tasks" label="ភារកិច្ច" icon={ListTodo} />
          <NavItem to="/vip" label="សមាជិក VIP" icon={Crown} />
          <NavItem to="/account" label="គណនី" icon={UserRound} />
        </div>
      </div>
    </nav>
  )
}
