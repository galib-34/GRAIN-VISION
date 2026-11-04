export type AssessmentStatus = 'BUY' | 'BUY_WITH_CUT' | 'REJECT'

export interface DeductionItem {
  parameter: string
  observed_pct: number
  faq_limit: number
  excess_pct: number
  penalty_rate_per_kg: number
  total_deduction_val: number
}

export interface ValuationResult {
  status: AssessmentStatus
  grade: string
  base_rate_per_quintal: number
  base_rate_per_kg: number
  effective_rate_per_kg: number
  total_lot_weight_kg: number
  estimated_total_payout: number
  total_deduction_per_kg: number
  target_offer_rate_per_kg: number
  minimum_floor_rate_per_kg: number
  fair_market_payout_min: number
  fair_market_payout_max: number
  estimated_recovery_loss_per_kg: number
  gross_lot_weight_kg: number
  foreign_matter_weight_deduction_kg: number
  moisture_drying_weight_deduction_kg: number
  moisture_drying_cost_total: number
  moisture_excess_pct: number
  moisture_input_source: 'manual' | 'default'
  warnings: string[]
  total_defects_pct: number
  total_deduction_per_quintal: number
  total_deduction_pct_of_asking: number
  recommendation: 'BUY' | 'NEGOTIATE' | 'NEGOTIATE HARD' | 'REJECT'
  negotiation_band_min_per_quintal: number
  negotiation_band_max_per_quintal: number
  deduction_rates_per_pct_per_quintal: Record<string, number>
  rejection_reasons: string[]
  deductions: DeductionItem[]
  mass_percentages: Record<string, number>
}
