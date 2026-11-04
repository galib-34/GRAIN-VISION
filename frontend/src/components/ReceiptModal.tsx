import { Printer, X } from 'lucide-react'
import type { LotTransaction } from '@/services/api'
import './receipt-modal.css'

const amount = (value: number) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const percent = (value: number) => `${Number(value).toFixed(2)}%`
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase())
function verificationCode(lot: LotTransaction) {
  const source = `${lot.id}:${lot.timestamp}:${lot.total_payout}`
  let hash = 2166136261
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619)
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0')
}

export default function ReceiptModal({ lot, close }: { lot: LotTransaction; close: () => void }) {
  const mass = Object.entries(lot.mass_percentages).filter(([key, value]) => key !== 'total_detected_count' && Number.isFinite(Number(value)))
  return <div className="modal-backdrop receipt-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <section className="receipt-modal" role="dialog" aria-modal="true" aria-label="Official procurement receipt">
      <div className="receipt-actions"><button className="button primary" onClick={() => window.print()}><Printer size={16}/> Print / Download PDF</button><button className="icon-button" onClick={close} aria-label="Close receipt"><X size={18}/></button></div>
      <article className="receipt-paper">
        <header className="receipt-header"><div className="receipt-emblem">GV</div><div><span>GRAIN-VISION · PROCUREMENT RECORD</span><h1>GOVERNMENT / AGENCY PROCUREMENT</h1><p>Digital lot assessment slip · Decision support record</p></div></header>
        <div className="receipt-id-row"><div><small>UNIQUE LOT ID</small><strong>{lot.id}</strong></div><span className={`receipt-status ${lot.status.toLowerCase()}`}>{lot.status.replaceAll('_', ' ')}</span></div>
        <div className="receipt-meta"><span>Official timestamp<b>{new Date(lot.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} IST</b></span><span>Farmer name<b>{lot.farmer_name || 'Not provided'}</b></span><span>Farmer ID<b>{lot.farmer_id || 'Not provided'}</b></span><span>Grain classification<b>{lot.grain_type}</b></span><span>Net weight<b>{lot.net_weight_kg.toLocaleString('en-IN')} kg · {(lot.net_weight_kg / 100).toFixed(3)} quintals</b></span><span>Assessed grade<b>{lot.grade}</b></span></div>
        {lot.rejection_reasons.length > 0 && <section className="receipt-rejections"><strong>Assessment notes</strong><ul>{lot.rejection_reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></section>}
        <h2>Financial ledger</h2><div className="receipt-rates"><div><span>Base MSP</span><b>{amount(lot.base_rate_per_quintal)} / quintal</b><small>{amount(lot.base_rate_per_quintal / 100)} / kg</small></div><div><span>Effective final rate</span><b>{amount(lot.effective_rate_per_kg)} / kg</b></div></div>
        <h3>Itemized slab deductions</h3><table className="receipt-deductions"><thead><tr><th>Parameter</th><th>Observed</th><th>Excess</th><th>Penalty rate</th><th>Deduction</th></tr></thead><tbody>{lot.deductions.length ? lot.deductions.map((item, index) => <tr key={`${item.parameter}-${index}`}><td>{label(item.parameter)}</td><td>{percent(item.observed_pct)}</td><td>{percent(item.excess_pct)}</td><td>{amount(item.penalty_rate_per_kg)} / kg</td><td>{amount(item.total_deduction_val)}</td></tr>) : <tr><td colSpan={5}>No slab deductions recorded.</td></tr>}</tbody></table>
        <div className="receipt-total"><span>TOTAL ESTIMATED PAYOUT</span><strong>{amount(lot.total_payout)}</strong></div>
        <h3>Heuristic mass composition · YOLOv8</h3><div className="receipt-mass">{mass.map(([key, value]) => <div key={key}><span>{label(key)}</span><b>{percent(Number(value))}</b></div>)}</div>
        <footer className="receipt-footer"><div className="receipt-verification"><div className="receipt-qr" aria-label="Digital verification placeholder">{Array.from({ length: 49 }, (_, index) => <i key={index} className={(index * 13 + verificationCode(lot).charCodeAt(index % 8)) % 3 ? 'filled' : ''}/>)}</div><span>Digital verification placeholder<strong>{verificationCode(lot)}</strong><small>Generated from saved transaction data</small></span></div><div className="receipt-signatures"><span>Procurement officer<small>Signature / date</small></span><span>Farmer<small>Signature / date</small></span></div></footer>
        <p className="receipt-disclaimer">This slip records an estimated procurement assessment. Final purchase terms remain subject to physical verification and applicable agency rules.</p>
      </article>
    </section>
  </div>
}
