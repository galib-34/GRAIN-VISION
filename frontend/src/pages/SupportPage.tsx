import { ClipboardCheck, LifeBuoy, ScanLine, WifiOff } from 'lucide-react'

type SupportPageProps = {
  apiStatus: string
  pendingOfflineLots: number
}

const guidance = [
  {
    title: 'Capture a clean sample',
    body: 'Spread the grains in a single layer on a matte surface. Avoid shadows, glare, and mixed lots so the detector can separate every grain.',
    Icon: ScanLine,
  },
  {
    title: 'Offline records',
    body: 'Lots saved without a connection stay on this device and sync automatically when the terminal reconnects. Keep the app open until the queue clears.',
    Icon: WifiOff,
  },
  {
    title: 'Moisture and pricing',
    body: 'Enter the digital meter reading before analysis. Blank entries fall back to the 13.0% safe baseline; price overrides live in Valuation settings.',
    Icon: ClipboardCheck,
  },
]

export default function SupportPage({ apiStatus, pendingOfflineLots }: SupportPageProps) {
  return <section className="route-page support-page">
    <div className="page-heading">
      <div>
        <div className="eyebrow"><span className="pulse-dot"/> SUPPORT / FIELD HELP DESK</div>
        <h1>Operator <span>support</span></h1>
        <p>Guidance for sample capture, offline records, and terminal diagnostics.</p>
      </div>
      <span className="date-chip"><LifeBuoy size={16}/> HELP DESK</span>
    </div>
    <div className="support-grid">
      <div className="support-guidance">
        {guidance.map(({ title, body, Icon }) => <article className="panel support-card" key={title}>
          <div className="support-card-head"><span className="support-icon"><Icon size={19}/></span><strong>{title}</strong></div>
          <p>{body}</p>
        </article>)}
      </div>
      <article className="panel support-card support-diagnostics-card">
        <div className="support-card-head"><span className="support-icon"><LifeBuoy size={19}/></span><div><strong>Terminal diagnostics</strong><small>Live status for this device</small></div></div>
        <div className="support-diagnostics">
          <div><span>API service</span><b className={`diag-${apiStatus}`}>{apiStatus.toUpperCase()}</b></div>
          <div><span>Offline queue</span><b>{pendingOfflineLots} pending</b></div>
          <div><span>Vision model</span><b>YOLOv8n · 8 classes</b></div>
          <div><span>Sample checks</span><b>On-device canvas</b></div>
        </div>
        <p className="support-note">For price escalations or disputed grades, contact your mandi procurement supervisor with the lot reference printed on the farmer slip.</p>
      </article>
    </div>
  </section>
}
