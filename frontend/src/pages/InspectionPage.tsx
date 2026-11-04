import { Activity, Printer } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import type { ValuationResult } from '@/types/procurement'

type PrintSlipData = { lotId: string; farmerName: string; grainType: string; weightKg: number; moisturePct: string; valuation: ValuationResult }
type Props = PropsWithChildren<{ online?: boolean; pendingOfflineLots?: number; printData?: PrintSlipData }>

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export default function InspectionPage({ children, online = true, pendingOfflineLots = 0, printData }: Props) {
  return <section className="route-page inspection-page">
    <div className="page-heading"><div><div className="eyebrow"><span className="pulse-dot"/> FIELD OPERATIONS</div><h1>Grain intake <span>workspace</span></h1><p>Inspect a sample, review the estimate, and record the lot decision.</p></div>
      <div className="inspection-heading-actions"><div className={`connectivity-pill ${online ? 'online' : 'offline'}`} role="status"><i/><span>{online ? 'ONLINE' : 'OFFLINE'} · {pendingOfflineLots} QUEUED</span></div>{printData && <button className="button subtle print-slip-action" onClick={() => window.print()}><Printer size={16}/> Print farmer slip</button>}<div className="date-chip"><Activity size={16}/><span>LIVE TERMINAL</span></div></div>
    </div>{children}
    {printData && <article className="print-slip" aria-label="Farmer procurement estimate slip">
      <header><strong>GRAIN-VISION</strong><span>PROCUREMENT ESTIMATE SLIP</span></header>
      <div className="print-slip-divider"/>
      <p><span>Reference</span><b>{printData.lotId}</b></p><p><span>Date / time</span><b>{new Date().toLocaleString('en-IN')}</b></p>
      <p><span>Farmer</span><b>{printData.farmerName || 'Unassigned'}</b></p><p><span>Grain</span><b>{printData.grainType}</b></p>
      <p><span>Net payable weight</span><b>{printData.weightKg.toFixed(2)} kg / {(printData.weightKg / 100).toFixed(3)} qtl</b></p>
      <p><span>Moisture reading</span><b>{printData.moisturePct.trim() || '13.0'}%{printData.moisturePct.trim() ? '' : ' (default)'}</b></p>
      <div className="print-slip-divider"/><p><span>Assessment</span><b>{printData.valuation.status.replaceAll('_', ' ')}</b></p>
      <p><span>Base MSP</span><b>{money(printData.valuation.base_rate_per_quintal)} / qtl</b></p><p><span>Effective rate</span><b>{money(printData.valuation.effective_rate_per_kg)} / kg</b></p>
      <strong className="print-slip-payout">ESTIMATED PAYOUT<br/>{money(printData.valuation.estimated_total_payout)}</strong>
      <small>Decision support estimate. Final procurement amount is subject to physical verification and mill-gate terms.</small>
    </article>}
  </section>
}
