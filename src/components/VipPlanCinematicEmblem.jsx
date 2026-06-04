/**
 * VIP 套餐 · 小说阅读主题立体书（纯 CSS 3D，透明底，无白块）
 */
export default function VipPlanCinematicEmblem({ planId, className = '' }) {
  const tier =
    planId === 'vip_standard' ? 'standard' : planId === 'vip_premium' ? 'premium' : 'entry'

  return (
    <div
      className={[`tg-vip-cine`, `tg-vip-cine--${tier}`, className].filter(Boolean).join(' ')}
      aria-hidden
    >
      <div className="tg-vip-cine__lamp" />
      {tier === 'premium' ? (
        <div className="tg-vip-cine__stack">
          <div className="tg-vip-cine__vol tg-vip-cine__vol--3" />
          <div className="tg-vip-cine__vol tg-vip-cine__vol--2" />
          <div className="tg-vip-cine__vol tg-vip-cine__vol--1" />
        </div>
      ) : null}
      {tier === 'standard' ? (
        <div className="tg-vip-cine__open">
          <div className="tg-vip-cine__leaf tg-vip-cine__leaf--left" />
          <div className="tg-vip-cine__leaf tg-vip-cine__leaf--right" />
          <div className="tg-vip-cine__open-lines" />
        </div>
      ) : null}
      {tier === 'entry' ? (
        <div className="tg-vip-cine__closed">
          <div className="tg-vip-cine__spine" />
          <div className="tg-vip-cine__cover">
            <div className="tg-vip-cine__cover-lines" />
          </div>
          <div className="tg-vip-cine__bookmark" />
        </div>
      ) : null}
    </div>
  )
}
