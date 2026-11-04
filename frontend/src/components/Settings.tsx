import './pricing-settings.css'
import './moisture-input.css'
import './market-price.css'
import { RefreshCw } from 'lucide-react'

export interface DeductionRateSettings {
  chalky: number
  broken: number
  damaged_discolored: number
  sound_shortfall: number
}
interface SettingsProps {
  baseline: string
  onBaselineChange: (value: string) => void
  weight: string
  onWeightChange: (value: string) => void
  weightUnit: 'kg' | 'qtl'
  onWeightUnitChange: (value: 'kg' | 'qtl') => void
  manualMoisture: string
  onManualMoistureChange: (value: string) => void
  deductionRates: DeductionRateSettings
  onDeductionRatesChange: (rates: DeductionRateSettings) => void
  priceReference: { modal_price_per_quintal: number; source: string; warning?: string; status?: string }
  manualPriceOverride: boolean
  onManualPriceOverrideChange: (enabled: boolean) => void
  onRefreshPrice: () => void
  refreshingPrice: boolean
  showMoisture?: boolean
}

export default function Settings({ baseline, onBaselineChange, weight, onWeightChange, weightUnit, onWeightUnitChange, manualMoisture, onManualMoistureChange, deductionRates, onDeductionRatesChange, priceReference, manualPriceOverride, onManualPriceOverrideChange, onRefreshPrice, refreshingPrice, showMoisture = true }: SettingsProps) {
  const setRate = (key: keyof DeductionRateSettings, value: string) => onDeductionRatesChange({ ...deductionRates, [key]: Number(value) })
  const sourceLabel = manualPriceOverride ? 'Manual operator override' : priceReference.source === 'Live Agmarknet AP Mandi' ? 'Live Agmarknet AP Mandi' : 'Default MSP Baseline (₹2,441/qtl)'
  const activePrice = manualPriceOverride ? Number(baseline) || priceReference.modal_price_per_quintal : priceReference.modal_price_per_quintal
  return <section className="valuation-settings"><div className="valuation-settings-heading"><strong>Valuation settings</strong><small>Applied to this and future inspections</small></div><div className="active-price-card"><div><span>Active base procurement price</span><strong>₹{activePrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })} <small>/ quintal</small></strong><em className={manualPriceOverride ? 'manual' : priceReference.status === 'live' || priceReference.status === 'live_cached' ? 'live' : 'baseline'}>{sourceLabel}</em></div><button type="button" className="button subtle" onClick={onRefreshPrice} disabled={refreshingPrice}><RefreshCw size={15} className={refreshingPrice ? 'spin' : ''}/>{refreshingPrice ? 'Refreshing…' : 'Refresh mandi price'}</button>{priceReference.warning && <small className="price-warning">{priceReference.warning}</small>}</div><div className="price-override-row"><label><input type="checkbox" checked={manualPriceOverride} onChange={event => onManualPriceOverrideChange(event.target.checked)}/> Use manual local spot price</label><small>Overrides the live or MSP reference for new inspections.</small></div><div className="settings-fields">
    {manualPriceOverride && <label className="field"><span>Manual base price · ₹ / quintal</span><input type="number" min="1" max="1000000" step="any" value={baseline} onChange={event => onBaselineChange(event.target.value)} placeholder="Enter local spot price"/></label>}
    <label className="field"><span>Lot weight</span><div className="input-unit"><input type="number" min="0" step="any" value={weight} onChange={event => onWeightChange(event.target.value)} placeholder="e.g. 500"/><div className="unit-switch"><button type="button" className={weightUnit === 'kg' ? 'selected' : ''} onClick={() => onWeightUnitChange('kg')}>kg</button><button type="button" className={weightUnit === 'qtl' ? 'selected' : ''} onClick={() => onWeightUnitChange('qtl')}>qtl</button></div></div></label>
    {showMoisture && <label className="field moisture-meter-field"><span>Moisture % · digital meter reading <b className="required-mark">Required check</b></span><input type="number" min="0" max="100" step="0.1" value={manualMoisture} onChange={event => onManualMoistureChange(event.target.value)} placeholder="Leave blank to use 13.0%"/>{!manualMoisture.trim() && <small className="moisture-default-warning" role="status">Moisture not entered. Defaulting to safe baseline (13.0%). Ensure physical check.</small>}</label>}
  </div><details className="deduction-rate-settings"><summary>Adjust deduction rates</summary><p>Rate per 1% deviation, in ₹ / quintal. Swarna quality baselines remain fixed.</p><div className="settings-fields settings-rates">
    <label className="field"><span>Chalky grains · ₹ / qtl / 1%</span><input type="number" min="0" step="any" value={deductionRates.chalky} onChange={event => setRate('chalky', event.target.value)}/></label>
    <label className="field"><span>Broken grains · ₹ / qtl / 1%</span><input type="number" min="0" step="any" value={deductionRates.broken} onChange={event => setRate('broken', event.target.value)}/></label>
    <label className="field"><span>Damaged / discoloured · ₹ / qtl / 1%</span><input type="number" min="0" step="any" value={deductionRates.damaged_discolored} onChange={event => setRate('damaged_discolored', event.target.value)}/></label>
    <label className="field"><span>Sound shortfall · ₹ / qtl / 1%</span><input type="number" min="0" step="any" value={deductionRates.sound_shortfall} onChange={event => setRate('sound_shortfall', event.target.value)}/></label>
  </div></details></section>
}
