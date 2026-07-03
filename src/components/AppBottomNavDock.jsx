import { useEffect, useRef, useState } from 'react'
import BottomNav from './BottomNav.jsx'

export default function AppBottomNavDock({ detailHidden = false }) {
  const [hideInstant, setHideInstant] = useState(false)
  const prevDetailHidden = useRef(detailHidden)

  useEffect(() => {
    if (detailHidden && !prevDetailHidden.current) {
      setHideInstant(true)
    } else if (!detailHidden && prevDetailHidden.current) {
      setHideInstant(false)
    }
    prevDetailHidden.current = detailHidden
  }, [detailHidden])

  return (
    <div
      className={[
        'tg-bottom-nav-dock',
        detailHidden ? 'tg-bottom-nav-dock--detail-hidden' : '',
        hideInstant && detailHidden ? 'tg-bottom-nav-dock--detail-hidden-instant' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="tg-bottom-nav-dock__plate" aria-hidden />
      <BottomNav />
    </div>
  )
}
