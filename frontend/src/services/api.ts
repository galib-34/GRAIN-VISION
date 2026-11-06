import type { ValuationResult } from '@/types/procurement'

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export interface SaveLotPayload {
  farmer_id?: string
  farmer_name: string
  grain_type?: string
  net_weight_kg: number
  fci_valuation: ValuationResult
}
export interface HistoryFilterParams { limit?: number; offset?: number; farmer_id?: string; status?: string }
export interface LotTransaction extends Omit<SaveLotPayload, 'fci_valuation'> {
  id: string; timestamp: string; status: ValuationResult['status']; grade: string
  base_rate_per_quintal: number; effective_rate_per_kg: number; total_payout: number
  total_deduction_per_kg: number; mass_percentages: Record<string, number>
  deductions: ValuationResult['deductions']; rejection_reasons: string[]
}
export interface DashboardMetrics {
  total_lots_assessed: number; total_lots_accepted: number; total_lots_rejected: number
  total_procurement_value: number; total_procured_weight_quintals: number
}
async function apiFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const token = localStorage.getItem('grainvision_token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API}${path}`, { ...init, headers })
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || `${response.status} ${response.statusText}`)
  return response
}
export async function saveLotTransaction(payload: SaveLotPayload): Promise<{ id: string; success: boolean }> {
  return (await apiFetch('/api/v1/lots/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).json()
}
export async function fetchLotHistory(params: HistoryFilterParams = {}): Promise<LotTransaction[]> {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))
  return (await apiFetch(`/api/v1/lots/history?${query}`)).json()
}
export async function fetchDashboardSummary(): Promise<DashboardMetrics> {
  return (await apiFetch('/api/v1/lots/summary')).json()
}
