import { History, Home, LifeBuoy, Settings } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import './mobile-bottom-nav.css'

const destinations = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/?view=ledger', label: 'History', Icon: History },
  { to: '/support', label: 'Support', Icon: LifeBuoy },
  { to: '/settings', label: 'Settings', Icon: Settings },
]

export default function MobileBottomNav() {
  const { pathname, search } = useLocation()
  const ledgerView = pathname === '/' && new URLSearchParams(search).get('view') === 'ledger'

  function isActive(to: string) {
    if (to === '/') return pathname === '/' && !ledgerView
    if (to === '/?view=ledger') return ledgerView
    return pathname === to || pathname.startsWith(`${to}/`)
  }

  return <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{destinations.map(({ to, label, Icon }) => <Link key={to} to={to} className={isActive(to) ? 'active' : ''} aria-current={isActive(to) ? 'page' : undefined}><Icon size={21} strokeWidth={2}/><span>{label}</span></Link>)}</nav>
}
