import { useState, type PropsWithChildren } from 'react'
import { AlertTriangle, CheckCircle2, CircleDollarSign, ScanLine } from 'lucide-react'
import type { ValuationResult } from '@/types/procurement'
import './inspection-output.css'
import './inspection-views.css'
import './negotiation-note.css'
import './farmer-summary.css'

type InspectionOutputProps = PropsWithChildren<{
  valuation?: ValuationResult
  qualityScore?: number | string
  grade?: string
  loading: boolean
  saving?: boolean
  onConfirmRecord?: () => void
  detectionCount?: number
  detectionCounts?: Record<string, number>
}>

const money = (value?: number) => value == null || !Number.isFinite(Number(value))
  ? '—'
  : `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (value?: number) => value == null || !Number.isFinite(Number(value)) ? '—' : `${Number(value).toFixed(2)}%`
const labels = {
  BUY: { title: 'APPROVED FOR PROCUREMENT', tone: 'buy', Icon: CheckCircle2 },
  BUY_WITH_CUT: { title: 'PROCURE WITH SLAB DEDUCTIONS', tone: 'cut', Icon: CircleDollarSign },
  REJECT: { title: 'MANDATORY REJECTION', tone: 'reject', Icon: AlertTriangle },
} as const
const pretty = (name: string) => name.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase())
const farmerTerm = (parameter: string) => {
  const key = parameter.toLowerCase()
  if (key.includes('moisture')) return 'moisture level'
  if (key.includes('chalky') || key.includes('damaged') || key.includes('discolored')) return 'grain appearance'
  if (key.includes('broken')) return 'grain condition'
  if (key.includes('foreign')) return 'sample cleanliness'
  if (key.includes('sound')) return 'sound grain share'
  return 'grain quality'
}
const farmerRejectionReason = (reason: string) => {
  const key = reason.toLowerCase()
  if (key.includes('no grain') || key.includes('detections were available')) return 'We could not clearly identify enough grains in this image. Please spread the sample and capture it again.'
  if (key.includes('moisture')) return 'The moisture level is above the accepted intake limit.'
  if (key.includes('foreign')) return 'The sample contains more visible foreign material than the intake limit allows.'
  if (key.includes('chalky')) return 'Too many grains have a pale or chalky appearance.'
  if (key.includes('damaged') || key.includes('discolored')) return 'Too many grains appear damaged or discolored.'
  if (key.includes('broken')) return 'The broken grain level is above the accepted intake limit.'
  return 'This lot is outside the intake quality limits. Please review it with the procurement officer.'
}

export default function InspectionOutput({ valuation, qualityScore, grade, loading, saving = false, onConfirmRecord, detectionCount = 0, detectionCounts = {}, children }: InspectionOutputProps) {
  const [view, setView] = useState<'farmer' | 'audit'>('farmer')
  return <>
    {loading ? <div className="empty-result"><div className="empty-icon"><ScanLine size={25}/></div><strong>Analyzing grain sample…</strong><p>Running image assessment and procurement valuation.</p></div>
      : !valuation ? <div className="empty-result"><div className="empty-icon"><ScanLine size={25}/></div><strong>Inspection results will appear here</strong><p>Complete the sample capture and analysis to view grain classes, quality score, and valuation.</p></div>
        : <div className="inspection-output">
          <div className="inspection-view-tabs" role="tablist" aria-label="Inspection result view"><button id="farmer-summary-tab" type="button" role="tab" aria-controls="farmer-summary-panel" aria-selected={view === 'farmer'} className={view === 'farmer' ? 'selected' : ''} onClick={() => setView('farmer')}>Farmer summary</button><button id="inspector-audit-tab" type="button" role="tab" aria-controls="inspector-audit-panel" aria-selected={view === 'audit'} className={view === 'audit' ? 'selected' : ''} onClick={() => setView('audit')}>Inspector Technical Audit</button></div>
          {(() => { const status = labels[valuation.status]; const Icon = status.Icon; const farmerTitles = { BUY: 'Ready for purchase', BUY_WITH_CUT: valuation.recommendation === 'NEGOTIATE HARD' ? 'Price needs careful discussion' : 'Ready with a price adjustment', REJECT: 'Not recommended for purchase' }; const gradeLabel = valuation.grade?.includes('Grade A') ? 'Grade A · Premium' : valuation.grade?.includes('Grade B') ? 'Grade B · Standard' : valuation.grade?.includes('Grade C') ? 'Grade C · Below standard' : 'Grade D · Poor'; return <div className={`assessment-banner ${status.tone}`}><Icon size={21}/><div><span>{view === 'farmer' ? 'LOT STATUS' : 'ASSESSMENT VERDICT'}</span><strong>{view === 'farmer' ? farmerTitles[valuation.status] : status.title}</strong></div><b>{view === 'farmer' ? gradeLabel : valuation.grade || grade || 'UNGRADED'}</b></div> })()}
          <div className="result-hero"><div><small>COMPOSITE QUALITY SCORE</small><strong>{qualityScore ?? '—'}<i>/100</i></strong><span className="grade-pill">{valuation.grade || grade || 'ASSESSMENT READY'}</span></div></div>
          {view === 'farmer' ? <section id="farmer-summary-panel" role="tabpanel" aria-labelledby="farmer-summary-tab" className="farmer-summary-card">{valuation.status === 'REJECT' && valuation.rejection_reasons.length > 0 ? <div className="farmer-adjustment reject-copy"><strong>Why this lot needs review</strong><p>{Array.from(new Set(valuation.rejection_reasons.map(farmerRejectionReason))).join(' ')}</p></div> : valuation.warnings.length > 0 ? <div className="farmer-adjustment moisture-risk"><strong>High moisture: drying is recommended</strong><p>This lot is above 17% moisture. The estimate includes water-weight removal and a drying charge; dry promptly before storage.</p></div> : valuation.moisture_drying_cost_total > 0 ? <div className="farmer-adjustment"><strong>Moisture adjustment</strong><p>Excess water is removed from payable weight, and a drying charge is included in the estimate.</p></div> : valuation.deductions.length > 0 ? <div className="farmer-adjustment"><strong>Why the offer is adjusted</strong><p>The offer reflects {Array.from(new Set(valuation.deductions.map(item => farmerTerm(item.parameter)))).join(' and ')}.</p></div> : <div className="farmer-adjustment"><strong>Quality feedback</strong><p>The sample meets the current screening checks, so no quality adjustment was applied.</p></div>}<div className="fair-range"><div><span>FAIR-MARKET PAYOUT RANGE · ±₹30 / QUINTAL</span><strong>{valuation.status === 'REJECT' ? 'No payable range' : valuation.fair_market_payout_min == null || valuation.fair_market_payout_max == null ? 'Range unavailable' : `${money(valuation.fair_market_payout_min)} – ${money(valuation.fair_market_payout_max)}`}</strong><div className="recommended-offer"><span>RECOMMENDED OFFER</span><b>{valuation.status === 'REJECT' ? '—' : `${money(valuation.estimated_total_payout)} total · ${money(valuation.effective_rate_per_kg)} / kg`}</b></div><small>{valuation.status === 'REJECT' ? 'Review the lot before discussing a price.' : 'The range is an estimate to support a clear discussion between farmer and officer.'}</small><small className="negotiation-note">Project estimate based on the configured Swarna mill-gate deduction schedule.</small></div><b>LOT TOTAL</b></div></section>
            : <div id="inspector-audit-panel" role="tabpanel" aria-labelledby="inspector-audit-tab" className="technical-audit">
              {valuation.status === 'REJECT' && valuation.rejection_reasons.length > 0 && <section className="rejection-alert"><div><AlertTriangle size={18}/><strong>Mandatory rejection reasons</strong></div><ul>{valuation.rejection_reasons.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}</ul></section>}
              <section className="financial-summary"><div className="financial-heading"><div><span>FINANCIAL SUMMARY</span><small>Estimated procurement valuation</small></div><b>{money(valuation.estimated_total_payout)}</b></div><div className="financial-grid"><div><span>Effective rate</span><strong>{money(valuation.effective_rate_per_kg)}<small> / kg</small></strong></div><div><span>Base market price</span><strong>{money(valuation.base_rate_per_kg)}<small> / kg</small></strong><small>{money(valuation.base_rate_per_quintal)} / quintal</small></div><div><span>Negotiation floor</span><strong>{money(valuation.minimum_floor_rate_per_kg)}<small> / kg</small></strong></div><div><span>Net payable weight</span><strong>{valuation.total_lot_weight_kg.toLocaleString('en-IN')}<small> kg</small></strong></div><div><span>Quality rate cuts</span><strong>{money(valuation.total_deduction_per_kg)}<small> / kg</small></strong></div></div></section>
              <section className="audit-counts"><div className="valuation-section-head"><div><strong>Swarna grade & deduction summary</strong><span>Project mill-gate framework</span></div></div><div className="mass-chips"><span className="mass-chip"><small>Sound grain</small><b>{pct(valuation.mass_percentages.sound)}</b></span><span className="mass-chip"><small>Total defects</small><b>{pct(valuation.total_defects_pct)}</b></span><span className="mass-chip"><small>Deduction vs asking</small><b>{pct(valuation.total_deduction_pct_of_asking)}</b></span><span className="mass-chip"><small>Rate cut</small><b>{money(valuation.total_deduction_per_quintal)} / qtl</b></span><span className="mass-chip"><small>Foreign matter weight removed</small><b>{valuation.foreign_matter_weight_deduction_kg.toFixed(2)} kg</b></span><span className="mass-chip"><small>Input moisture · {valuation.moisture_input_source}</small><b>{pct(valuation.mass_percentages.moisture)}</b></span><span className="mass-chip"><small>Excess water removed</small><b>{valuation.moisture_drying_weight_deduction_kg.toFixed(2)} kg</b></span><span className="mass-chip"><small>Drying cost deducted</small><b>{money(valuation.moisture_drying_cost_total)}</b></span><span className="mass-chip"><small>Negotiation band</small><b>{money(valuation.negotiation_band_min_per_quintal)}–{money(valuation.negotiation_band_max_per_quintal)} / qtl</b></span><span className="mass-chip"><small>Recommendation</small><b>{valuation.recommendation}</b></span></div>{valuation.warnings.length > 0 && <div className="farmer-adjustment moisture-risk"><strong>High-moisture storage warning</strong><ul>{valuation.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}</section>
          <section className="deductions-section"><div className="valuation-section-head"><div><strong>Linear quality deductions</strong><span>{valuation.deductions.length} itemized {valuation.deductions.length === 1 ? 'adjustment' : 'adjustments'}</span></div></div>{valuation.deductions.length ? <div className="deductions-scroll"><table className="deductions-table"><thead><tr><th>Parameter</th><th>Observed</th><th>Swarna baseline</th><th>Excess / shortfall</th><th>Deduction / kg</th><th>Total deduction</th></tr></thead><tbody>{valuation.deductions.map((item, index) => <tr key={`${item.parameter}-${index}`}><td>{pretty(item.parameter)}</td><td>{pct(item.observed_pct)}</td><td>{pct(item.faq_limit)}</td><td>{pct(item.excess_pct)}</td><td>{money(item.penalty_rate_per_kg)}</td><td>{money(item.total_deduction_val)}</td></tr>)}</tbody></table></div> : <p className="no-deductions">No quality rate cuts applied.</p>}</section>
              <section className="mass-section"><div className="valuation-section-head"><div><strong>Heuristic mass composition</strong><span>Image-derived estimates for visual verification</span></div></div><div className="mass-chips">{Object.entries(valuation.mass_percentages).filter(([key, value]) => key !== 'total_detected_count' && Number.isFinite(Number(value))).map(([key, value]) => <span className="mass-chip" key={key}><small>{pretty(key)}</small><b>{pct(value)}</b></span>)}</div></section>
              <section className="audit-counts"><div className="valuation-section-head"><div><strong>YOLOv8 detection counts</strong><span>{detectionCount} bounding boxes returned</span></div></div><div className="mass-chips">{Object.entries(detectionCounts).map(([key, value]) => <span className="mass-chip" key={key}><small>{pretty(key)}</small><b>{value}</b></span>)}</div></section>
              {children}
            </div>}
          {onConfirmRecord && <button className="button primary confirm-lot" disabled={saving || valuation.status === 'REJECT'} onClick={onConfirmRecord}>{saving ? 'Recording transaction…' : valuation.status === 'REJECT' ? 'Rejected lots cannot be confirmed' : 'Confirm & Record Lot'}</button>}
        </div>}
  </>
}
