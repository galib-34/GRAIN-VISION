import { API_CONFIG } from './apiConfig';
import {
  LineItemDeduction,
  LotRecord,
  PricingSource,
  PricingSummary,
  ProcurementRecommendation,
  SampleMetrics,
  SellerProfile,
} from '../types';
import { MOCK_INITIAL_LOTS, MOCK_MANDI_REFERENCE, MOCK_SELLERS } from './mockData';
import { useAuthStore } from '../stores/authStore';

const COMPLIANCE_DISCLOSURE =
  'UNCERTIFIED_ESTIMATION_DEVICE — Ratios and mass values are uncertified mathematical approximations for screening purposes only.';

export const procurementService = {
  /**
   * Fetches latest Mandi reference quote from GET /api/prices.
   */
  async fetchMandiPrice(): Promise<{
    baseRatePerQuintal: number;
    market: string;
    date: string;
    source: string;
    disclaimer: string;
  }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const token = (useAuthStore.getState().user as any)?.token;
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_CONFIG.baseUrl}/api/prices`, {
        signal: controller.signal,
        headers,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const ref = data.andhra_pradesh_paddy_reference || {};
        if (ref.modal_price_per_quintal) {
          return {
            baseRatePerQuintal: ref.modal_price_per_quintal,
            market: ref.market || 'Regional Mandi Reference',
            date: ref.date || new Date().toISOString().split('T')[0],
            source: ref.source || 'AGMARKNET (data.gov.in)',
            disclaimer: ref.disclaimer || MOCK_MANDI_REFERENCE.disclaimer,
          };
        }
      }
      throw new Error(`Failed to retrieve live prices: HTTP ${res.status}`);
    } catch (err: any) {
      if (API_CONFIG.enableMockFallback) {
        return {
          baseRatePerQuintal: MOCK_MANDI_REFERENCE.modal_price_per_quintal,
          market: MOCK_MANDI_REFERENCE.market,
          date: MOCK_MANDI_REFERENCE.date,
          source: MOCK_MANDI_REFERENCE.source,
          disclaimer: MOCK_MANDI_REFERENCE.disclaimer,
        };
      }
      throw err;
    }
  },

  /**
   * Optimized Procurement Decision Engine:
   * Calculates tiered slab deductions, tolerance allowances, and hard-stop rejection recommendations.
   */
  calculatePricing(
    metricsOrScore: SampleMetrics | number,
    baseRatePerQuintal: number,
    weightKg: number,
    source: PricingSource = 'api',
    customAgreedRate?: number
  ): PricingSummary {
    const baseRatePerKg = Number((baseRatePerQuintal / 100.0).toFixed(2));
    const weightQuintals = Number((weightKg / 100.0).toFixed(2));

    const isMetricsObj = typeof metricsOrScore === 'object' && metricsOrScore !== null;
    const qualityScore = isMetricsObj ? metricsOrScore.qualityScore : Number(metricsOrScore);
    const brokenPct = isMetricsObj ? (metricsOrScore.brokenPct ?? 0) : 0;
    const chalkyPct = isMetricsObj ? (metricsOrScore.chalkyPct ?? 0) : 0;
    const discoloredPct = isMetricsObj ? (metricsOrScore.discoloredPct ?? 0) : 0;
    const foreignMatterPct = isMetricsObj ? (metricsOrScore.foreignMatterCountPct ?? 0) : 0;

    const deductions: LineItemDeduction[] = [];
    const explanationLogs: string[] = [];
    const rejectionReasons: string[] = [];

    // 1. Hard-Stop Rejection Guardrails
    if (foreignMatterPct > 1.5) {
      rejectionReasons.push(`Foreign matter / contamination (${foreignMatterPct}%) exceeds statutory threshold of 1.5%.`);
    }
    if (brokenPct > 35.0) {
      rejectionReasons.push(`Broken grain ratio (${brokenPct}%) exceeds commercial intake ceiling of 35.0%.`);
    }
    if (qualityScore < 50.0) {
      rejectionReasons.push(`Composite quality score (${qualityScore}/100) is below minimum procurement baseline.`);
    }

    // 2. Broken Tiered Slab Deduction (5.0% tolerance)
    let brokenDedPct = 0;
    if (brokenPct > 5.0) {
      const excess = brokenPct - 5.0;
      const s1 = Math.min(excess, 10.0) * 0.5;
      const s2 = excess > 10.0 ? Math.min(excess - 10.0, 10.0) * 1.0 : 0;
      const s3 = excess > 20.0 ? (excess - 20.0) * 1.5 : 0;
      brokenDedPct = Number((s1 + s2 + s3).toFixed(2));
      const inrDed = Number((baseRatePerKg * (brokenDedPct / 100)).toFixed(2));
      deductions.push({
        name: 'Broken Grains Deduction',
        tolerancePct: 5.0,
        actualPct: brokenPct,
        excessPct: Number(excess.toFixed(2)),
        deductionPercentage: brokenDedPct,
        deductionPerKgInr: inrDed,
        note: 'Tiered slab deduction for broken grains exceeding 5.0% tolerance.',
      });
      explanationLogs.push(`Broken grain excess: ${excess.toFixed(1)}% -> -${brokenDedPct}% deduction.`);
    } else {
      explanationLogs.push(`Broken grain ratio (${brokenPct}%) within 5.0% tolerance.`);
    }

    // 3. Chalky Tiered Slab Deduction (3.0% tolerance)
    let chalkyDedPct = 0;
    if (chalkyPct > 3.0) {
      const excess = chalkyPct - 3.0;
      const s1 = Math.min(excess, 7.0) * 0.4;
      const s2 = excess > 7.0 ? (excess - 7.0) * 0.8 : 0;
      chalkyDedPct = Number((s1 + s2).toFixed(2));
      const inrDed = Number((baseRatePerKg * (chalkyDedPct / 100)).toFixed(2));
      deductions.push({
        name: 'Chalkiness Deduction',
        tolerancePct: 3.0,
        actualPct: chalkyPct,
        excessPct: Number(excess.toFixed(2)),
        deductionPercentage: chalkyDedPct,
        deductionPerKgInr: inrDed,
        note: 'Tiered slab deduction for chalky grains exceeding 3.0% tolerance.',
      });
      explanationLogs.push(`Chalky grain excess: ${excess.toFixed(1)}% -> -${chalkyDedPct}% deduction.`);
    } else {
      explanationLogs.push(`Chalky grain ratio (${chalkyPct}%) within 3.0% tolerance.`);
    }

    // 4. Discolored / Unsound Deduction (1.0% tolerance)
    let discoloredDedPct = 0;
    if (discoloredPct > 1.0) {
      const excess = discoloredPct - 1.0;
      discoloredDedPct = Number((excess * 1.5).toFixed(2));
      const inrDed = Number((baseRatePerKg * (discoloredDedPct / 100)).toFixed(2));
      deductions.push({
        name: 'Discolored / Unsound Deduction',
        tolerancePct: 1.0,
        actualPct: discoloredPct,
        excessPct: Number(excess.toFixed(2)),
        deductionPercentage: discoloredDedPct,
        deductionPerKgInr: inrDed,
        note: 'Penalty for discolored grains exceeding 1.0% tolerance.',
      });
      explanationLogs.push(`Discolored grain excess: ${excess.toFixed(1)}% -> -${discoloredDedPct}% deduction.`);
    }

    const totalDeductionPct = Number((brokenDedPct + chalkyDedPct + discoloredDedPct).toFixed(2));
    const adjustmentFactor = Number((1.0 - totalDeductionPct / 100.0).toFixed(4));
    const estimatedRatePerKg = Number(Math.max(baseRatePerKg * 0.5, baseRatePerKg * adjustmentFactor).toFixed(2));

    let recommendation: ProcurementRecommendation = 'BUY';
    if (rejectionReasons.length > 0) {
      recommendation = 'REJECT';
    } else if (totalDeductionPct > 5.0 || qualityScore < 75.0) {
      recommendation = 'NEGOTIATE';
    }

    const finalAgreedRate =
      customAgreedRate !== undefined && customAgreedRate > 0
        ? customAgreedRate
        : recommendation === 'REJECT'
        ? 0
        : estimatedRatePerKg;

    const totalEstimatedPrice = Number((finalAgreedRate * weightKg).toFixed(2));

    return {
      source,
      baseRatePerQuintal,
      baseRatePerKg,
      qualityAdjustmentFactor: adjustmentFactor,
      adjustmentPercentage: -totalDeductionPct,
      estimatedRatePerKg,
      agreedRatePerKg: finalAgreedRate,
      totalEstimatedPrice,
      weightKg,
      weightQuintals,
      recommendation,
      deductions,
      explanationLogs,
      rejectionReasons,
      disclaimer: COMPLIANCE_DISCLOSURE,
    };
  },

  /**
   * Fetches saved seller profiles.
   */
  async getSellers(): Promise<SellerProfile[]> {
    try {
      const token = (useAuthStore.getState().user as any)?.token;
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_CONFIG.baseUrl}/api/sellers`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.sellers && data.sellers.length > 0) {
          return data.sellers.map((s: any) => ({
            id: String(s.id),
            name: s.name,
            phone: s.phone,
            location: s.location || '',
            sellerCode: s.seller_code || '',
            totalLotsCount: s.total_lots_count || 1,
          }));
        }
      }
    } catch {
      // Offline fallback
    }
    return MOCK_SELLERS;
  },

  /**
   * Creates a new seller profile.
   */
  async addSeller(seller: Omit<SellerProfile, 'id'>): Promise<SellerProfile> {
    try {
      const token = (useAuthStore.getState().user as any)?.token;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_CONFIG.baseUrl}/api/sellers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: seller.name,
          phone: seller.phone,
          location: seller.location,
          seller_code: seller.sellerCode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          id: String(data.seller.id),
          name: data.seller.name,
          phone: data.seller.phone,
          location: data.seller.location || '',
          sellerCode: data.seller.seller_code,
        };
      }
    } catch {
      // Offline mock creation
    }

    const newId = `s-${Date.now()}`;
    return {
      id: newId,
      ...seller,
      totalLotsCount: 0,
    };
  },

  /**
   * Fetches saved lots ledger from backend /api/lots.
   */
  async getLots(): Promise<LotRecord[]> {
    try {
      const token = (useAuthStore.getState().user as any)?.token;
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_CONFIG.baseUrl}/api/lots`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.lots && data.lots.length > 0) {
          return data.lots.map((l: any) => ({
            id: String(l.id),
            lotId: l.lot_id,
            seller: {
              id: String(l.seller_id || '0'),
              name: l.seller_name || 'Farmer',
              phone: '',
              location: '',
            },
            variety: l.variety || 'Swarna',
            weightKg: l.weight_kg || 0,
            weightQuintals: l.weight_quintals || 0,
            qualityScore: l.quality_score || 0,
            metrics: l.metrics_json ? JSON.parse(l.metrics_json) : ({} as any),
            pricing: {
              source: 'api',
              baseRatePerQuintal: l.base_price_per_quintal || 2320.0,
              baseRatePerKg: (l.base_price_per_quintal || 2320.0) / 100.0,
              qualityAdjustmentFactor: 1.0,
              adjustmentPercentage: 0,
              estimatedRatePerKg: l.estimated_rate_per_kg || 0,
              agreedRatePerKg: l.estimated_rate_per_kg || 0,
              totalEstimatedPrice: l.total_estimated_price || 0,
              weightKg: l.weight_kg || 0,
              weightQuintals: l.weight_quintals || 0,
              disclaimer: COMPLIANCE_DISCLOSURE,
            },
            status: l.status === 'assessed' ? 'pending' : (l.status as any),
            imageUri: l.image_filename || '',
            createdAt: l.created_at,
          }));
        }
      }
    } catch {
      // Fall back to initial mock set
    }
    return MOCK_INITIAL_LOTS;
  },
};
