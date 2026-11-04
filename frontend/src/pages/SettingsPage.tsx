import { Settings2 } from 'lucide-react'
import type { PropsWithChildren } from 'react'

export default function SettingsPage({ children }: PropsWithChildren) {
  return <section className="route-page settings-page"><div className="page-heading"><div><div className="eyebrow"><span className="pulse-dot"/> FIELD OPERATIONS / CONFIGURATION</div><h1>Valuation <span>settings</span></h1><p>Manage local market references, lot weight, moisture readings, and deduction rates.</p></div><span className="date-chip"><Settings2 size={16}/> OPERATOR SETTINGS</span></div>{children}</section>
}
