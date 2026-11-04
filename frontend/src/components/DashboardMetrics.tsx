import { AlertTriangle, CheckCircle2, ScanLine, Sprout } from 'lucide-react'
import type { DashboardMetrics as Metrics } from '@/services/api'
import './dashboard-metrics.css'

const cash = (value: number) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
export default function DashboardMetrics({ metrics }: { metrics: Metrics }) {
  const cards = [
    { label: 'Lots assessed', value: metrics.total_lots_assessed, Icon: ScanLine, tone: '' },
    { label: 'Accepted lots', value: metrics.total_lots_accepted, Icon: CheckCircle2, tone: 'green' },
    { label: 'Rejected lots', value: metrics.total_lots_rejected, Icon: AlertTriangle, tone: 'red' },
    { label: 'Procurement value', value: cash(metrics.total_procurement_value), Icon: Sprout, tone: 'accent' },
  ]
  return <section className="stats-grid">{cards.map(({ label, value, Icon, tone }) => <article className={`stat-card ${tone}`} key={label}><span className="stat-icon"><Icon/></span><span className="stat-label">{label}</span><strong>{value}</strong></article>)}</section>
}
