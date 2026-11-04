import { Children, type PropsWithChildren } from 'react'
import { ArrowRight, ClipboardList, Download, LayoutDashboard } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAppRuntime } from '@/components/AppRuntimeContext'
import './dashboard-page.css'

export default function DashboardPage({ children }: PropsWithChildren) {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'ledger' ? 'ledger' : 'overview'
  const { installAvailable, installApp } = useAppRuntime()
  const content = Children.toArray(children)
  const overview = content[0]
  const ledger = content.slice(1)

  function setView(next: 'overview' | 'ledger') {
    setSearchParams(next === 'ledger' ? { view: 'ledger' } : {}, { replace: true })
  }

  return <section className="route-page dashboard-page"><div className="page-heading"><div><div className="eyebrow"><span className="pulse-dot"/> FIELD OPERATIONS</div><h1>Procurement <span>dashboard</span></h1><p>Live lot activity, saved assessments, and market reference.</p></div>{view === 'overview' && <div className="dashboard-quick-actions">{installAvailable && <button className="button subtle dashboard-install" onClick={() => void installApp()}><Download size={16}/> Install App</button>}<Link className="button primary quick-inspection" to="/inspect"><ArrowRight size={17}/> New inspection</Link></div>}</div>
    <div className="dashboard-tabs" role="tablist" aria-label="Dashboard views"><button id="dashboard-overview-tab" type="button" role="tab" aria-controls="dashboard-overview-panel" aria-selected={view === 'overview'} className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}><LayoutDashboard size={17}/> Overview &amp; Metrics</button><button id="dashboard-ledger-tab" type="button" role="tab" aria-controls="dashboard-ledger-panel" aria-selected={view === 'ledger'} className={view === 'ledger' ? 'active' : ''} onClick={() => setView('ledger')}><ClipboardList size={17}/> Transaction Ledger</button></div>
    {view === 'overview' ? <div id="dashboard-overview-panel" className="dashboard-overview" role="tabpanel" aria-labelledby="dashboard-overview-tab">{overview}</div> : <div id="dashboard-ledger-panel" className="dashboard-ledger" role="tabpanel" aria-labelledby="dashboard-ledger-tab"><div className="route-section-heading"><div><ClipboardList size={17}/><strong>Saved lot ledger</strong></div><small>SQLite procurement history</small></div>{ledger}</div>}
  </section>
}
