import { useEffect, useState } from 'react'
import { Bell, Download, LogOut, Settings as SettingsIcon, UserRound, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppRuntime } from './AppRuntimeContext'
import './header.css'

type HeaderProps = {
  price: number
  priceSource: string
  apiStatus: string
  pendingOfflineLots: number
}

type Operator = {
  username?: string
  full_name?: string
  name?: string
  email?: string
  role?: string
}

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

function readOperator(): Operator | null {
  try {
    const raw = localStorage.getItem('grainvision_user')
    return raw ? JSON.parse(raw) as Operator : null
  } catch {
    return null
  }
}

export default function Header({ price, priceSource, apiStatus, pendingOfflineLots }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [operator] = useState(readOperator)
  const { installAvailable, installApp } = useAppRuntime()

  useEffect(() => { setAlertsOpen(false) }, [location.pathname])

  const displayName = operator?.full_name || operator?.name || operator?.username || 'Procurement Officer'
  const operatorId = operator?.username || operator?.email || 'GV-FIELD'
  const role = (operator?.role || 'procurement officer').replaceAll('_', ' ')
  const ledgerView = location.pathname === '/' && new URLSearchParams(location.search).get('view') === 'ledger'

  function navActive(to: string) {
    if (to === '/') return location.pathname === '/' && !ledgerView ? 'active' : ''
    if (to === '/?view=ledger') return ledgerView ? 'active' : ''
    return location.pathname === to || location.pathname.startsWith(`${to}/`) ? 'active' : ''
  }

  async function logout() {
    const token = localStorage.getItem('grainvision_token')
    try { await fetch(`${API}/api/auth/logout`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} }) }
    catch { /* The local session must still end if the API is unavailable. */ }
    finally {
      localStorage.removeItem('grainvision_token')
      localStorage.removeItem('grainvision_session')
      localStorage.removeItem('grainvision_user')
      navigate('/login', { replace: true })
    }
  }

  return <header className="topbar app-header">
    <Link className="header-identity" to="/" aria-label="Grain Vision home">
      <span className="header-avatar"><UserRound size={20}/></span>
      <span className="header-user">
        <strong>{displayName}</strong>
        <small>{operatorId} · {role}</small>
      </span>
    </Link>
    <nav className="header-nav" aria-label="Primary navigation">
      <Link className={navActive('/')} to="/">Home</Link>
      <Link className={navActive('/?view=ledger')} to="/?view=ledger">History</Link>
      <Link className={navActive('/support')} to="/support">Support</Link>
      <Link className={navActive('/settings')} to="/settings">Settings</Link>
    </nav>
    <div className="header-utilities">
      <span className="header-price" title={priceSource}>
        <span>₹{price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/qtl</span>
        <small>{priceSource}</small>
      </span>
      <button type="button" className="header-icon-button" aria-label="Terminal notifications" aria-expanded={alertsOpen} onClick={() => setAlertsOpen(open => !open)}>
        <Bell size={18}/>
        {pendingOfflineLots > 0 && <i className="header-alert-dot"/>}
      </button>
      <Link className="header-icon-button" to="/settings" aria-label="Settings"><SettingsIcon size={18}/></Link>
      <button type="button" className="header-icon-button header-logout" onClick={() => void logout()} aria-label="Log out" title="Log out"><LogOut size={18}/></button>
    </div>
    {alertsOpen && <div className="header-alerts" role="dialog" aria-label="Terminal notifications">
      <div className="header-alerts-head"><strong>Terminal status</strong><button type="button" onClick={() => setAlertsOpen(false)} aria-label="Close notifications"><X size={15}/></button></div>
      <div className="header-alert-row"><span>API service</span><b className={`alert-${apiStatus}`}>{apiStatus.toUpperCase()}</b></div>
      <div className="header-alert-row"><span>Mandi reference</span><b>₹{price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/qtl</b></div>
      <div className="header-alert-row"><span>Offline queue</span><b>{pendingOfflineLots} pending</b></div>
      <p className="header-alert-note">{priceSource}</p>
      {installAvailable && <button type="button" className="button primary header-install" onClick={() => void installApp()}><Download size={15}/> Install app</button>}
    </div>}
  </header>
}
