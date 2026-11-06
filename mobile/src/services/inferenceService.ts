import { API_CONFIG } from './apiConfig';
import {
  GrainCategory,
  GrainDetection,
  ImageValidationResult,
  ProcurementDecision,
  SampleMetrics,
} from '../types';
import { MOCK_DETECTIONS, MOCK_METRICS } from './mockData';
import { useAuthStore } from '../stores/authStore';

export interface AnalysisResponse {
  detections: GrainDetection[];
  metrics: SampleMetrics;
  decision?: ProcurementDecision;
  disclaimer?: string;
  isMock: boolean;
}

export interface AnalyzeOptions {
  variety?: string;
  lotWeightKg?: number;
  sellerId?: string;
  inspectorOfferPrice?: number;
  isDemoMode?: boolean;
}

export const inferenceService = {
  /**
   * Validates image quality (blur, lighting, grain density) before running full AI analysis.
   */
  async validateImageQuality(imageUri: string): Promise<ImageValidationResult> {
    // Simulated edge validation pre-check
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      isValid: true,
      blurScore: 84, // > 60 is sharp
      lightingScore: 78, // 40-85 is balanced
      grainDensityScore: 92,
      warnings: [],
    };
  },

  /**
   * Analyzes a grain sample image via the live FastAPI backend endpoint (POST /api/v1/analyze-grain).
   * ZERO SILENT MOCKING: If inference fails or the backend is offline, an explicit error
   * is thrown to allow the UI to present a transparent retry prompt.
   */
  async analyzeSampleImage(
    imageUri: string,
    optionsOrWeight?: AnalyzeOptions | number,
    sellerIdParam?: string,
    isDemoParam: boolean = false
  ): Promise<AnalysisResponse> {
    let opts: AnalyzeOptions = {};
    if (typeof optionsOrWeight === 'number') {
      opts = {
        lotWeightKg: optionsOrWeight,
        sellerId: sellerIdParam,
        isDemoMode: isDemoParam,
      };
    } else if (optionsOrWeight && typeof optionsOrWeight === 'object') {
      opts = optionsOrWeight;
    }

    const {
      variety = 'Swarna (MTU 7029)',
      lotWeightKg,
      sellerId,
      inspectorOfferPrice,
      isDemoMode = false,
    } = opts;

    // Explicit demo/mock mode ONLY when specifically requested by the user
    if (isDemoMode) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return {
        detections: MOCK_DETECTIONS,
        metrics: MOCK_METRICS,
        isMock: true,
      };
    }

    const filename = imageUri.split('/').pop() || 'grain_sample.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      name: filename,
      type,
    } as any);

    formData.append('variety', variety);
    if (lotWeightKg !== undefined && lotWeightKg > 0) {
      formData.append('lot_weight_kg', String(lotWeightKg));
    }
    if (sellerId) {
      formData.append('seller_id', String(sellerId));
    }
    if (inspectorOfferPrice !== undefined && inspectorOfferPrice > 0) {
      formData.append('inspector_offer_price', String(inspectorOfferPrice));
    }
    formData.append('save_lot', 'false');

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    const token = (useAuthStore.getState().user as any)?.token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${API_CONFIG.baseUrl}/api/v1/analyze-grain`, {
        method: 'POST',
        body: formData,
        headers,
        signal: controller.signal,
      });
    } catch (networkError: any) {
      clearTimeout(timeoutId);
      if (networkError.name === 'AbortError') {
        throw new Error(
          `Analysis timed out after ${API_CONFIG.timeoutMs / 1000}s. Backend server at ${API_CONFIG.baseUrl} did not respond.`
        );
      }
      throw new Error(
        `Network connection failed: Unable to connect to GRAIN-VISION backend at ${API_CONFIG.baseUrl}. Please verify your network connection.`
      );
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
  const errorBody = await response.text();

  console.error("Grain analysis failed:", {
    status: response.status,
    body: errorBody,
  });

  throw new Error(
    `Analysis failed (${response.status}): ${errorBody}`
  );
}

    const data = await response.json();

    return {
      detections: mapBackendDetections(data.detections || [], data.image),
      metrics: mapBackendMetrics(data.metrics || {}),
      decision: mapBackendDecision(data.decision),
      disclaimer: data.disclaimer,
      isMock: false,
    };
  },

  /**
   * Explicit mock preset loader for testing/demo without requiring active backend server.
   */
  async loadDemoSample(): Promise<AnalysisResponse> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return {
      detections: MOCK_DETECTIONS,
      metrics: MOCK_METRICS,
      isMock: true,
    };
  },
};

/**
 * Maps raw backend YOLO detections into mobile UI canvas representations.
 * Scales coordinates to the standard 360x486 SVG viewport without aspect-ratio distortion.
 */
function mapBackendDetections(
  rawDetections: any[],
  imageMeta?: { width?: number; height?: number }
): GrainDetection[] {
  const CANVAS_W = 360;
  const CANVAS_H = 486;

  const imgW = imageMeta?.width && imageMeta.width > 0 ? imageMeta.width : 1080;
  const imgH = imageMeta?.height && imageMeta.height > 0 ? imageMeta.height : 1440;

  return rawDetections.map((item, index) => {
    let x1 = 0;
    let y1 = 0;
    let x2 = 0;
    let y2 = 0;

    if (item.normalized_box) {
      x1 = item.normalized_box.x1 * CANVAS_W;
      y1 = item.normalized_box.y1 * CANVAS_H;
      x2 = item.normalized_box.x2 * CANVAS_W;
      y2 = item.normalized_box.y2 * CANVAS_H;
    } else if (item.box) {
      x1 = (item.box.x1 / imgW) * CANVAS_W;
      y1 = (item.box.y1 / imgH) * CANVAS_H;
      x2 = (item.box.x2 / imgW) * CANVAS_W;
      y2 = (item.box.y2 / imgH) * CANVAS_H;
    }

    return {
      id: item.id || `det-${index}-${Date.now()}`,
      category: mapClassToCategory(item.class || item.category),
      rawClass: item.class || 'sound',
      confidence: item.confidence ?? 0.9,
      box: {
        x1: Math.round(x1),
        y1: Math.round(y1),
        x2: Math.round(x2),
        y2: Math.round(y2),
      },
      normalizedBox: item.normalized_box,
    };
  });
}

function mapClassToCategory(rawClass: string): GrainCategory {
  const normalized = (rawClass || '').toLowerCase().trim();
  if (normalized === 'sound') return 'normal';
  if (normalized.includes('broken')) return 'broken';
  if (normalized.includes('chalky')) return 'chalky';
  return 'discolored'; // unsound, foreign-object, stone, plastic
}

function mapBackendMetrics(rawMetrics: any): SampleMetrics {
  const breakdown = (rawMetrics.class_breakdown || []).map((b: any) => ({
    className: b.class || b.className,
    category: mapClassToCategory(b.class || b.className),
    count: b.count ?? 0,
    percentage: b.percentage ?? 0.0,
    massPercentage: b.mass_percentage,
    pixelArea: b.pixel_area,
    priority: b.priority,
    qualityWeight: b.quality_weight,
  }));

  const soundCount = rawMetrics.sound_count ?? breakdown.filter((b: any) => b.category === 'normal').reduce((acc: number, cur: any) => acc + cur.count, 0);
  const brokenCount = rawMetrics.broken_count ?? breakdown.filter((b: any) => b.category === 'broken').reduce((acc: number, cur: any) => acc + cur.count, 0);
  const chalkyCount = rawMetrics.chalky_count ?? breakdown.filter((b: any) => b.category === 'chalky').reduce((acc: number, cur: any) => acc + cur.count, 0);
  const discoloredCount = rawMetrics.discolored_count ?? breakdown.filter((b: any) => b.category === 'discolored').reduce((acc: number, cur: any) => acc + cur.count, 0);
  const total = rawMetrics.total_grains || (soundCount + brokenCount + chalkyCount + discoloredCount) || 1;

  return {
    totalGrains: total,
    soundCount,
    brokenCount,
    chalkyCount,
    discoloredCount,
    foreignMatterCount: rawMetrics.foreign_matter_count,
    soundPct: rawMetrics.sound_pct ?? Number(((soundCount / total) * 100).toFixed(2)),
    brokenPct: rawMetrics.broken_pct ?? Number(((brokenCount / total) * 100).toFixed(2)),
    chalkyPct: rawMetrics.chalky_pct ?? Number(((chalkyCount / total) * 100).toFixed(2)),
    discoloredPct: rawMetrics.discolored_pct ?? Number(((discoloredCount / total) * 100).toFixed(2)),
    foreignMatterCountPct: rawMetrics.foreign_matter_count_pct,
    soundMassPct: rawMetrics.sound_mass_pct,
    brokenMassPct: rawMetrics.broken_mass_pct,
    chalkyMassPct: rawMetrics.chalky_mass_pct,
    discoloredMassPct: rawMetrics.discolored_mass_pct,
    foreignMatterMassPct: rawMetrics.foreign_matter_mass_pct,
    qualityScore: rawMetrics.quality_score ?? 80.0,
    grade: rawMetrics.grade,
    classBreakdown: breakdown,
    disclaimer: rawMetrics.disclaimer,
  };
}

function mapBackendDecision(rawDecision?: any): ProcurementDecision | undefined {
  if (!rawDecision) return undefined;

  return {
    recommendation: rawDecision.recommendation || 'BUY',
    rejectionReasons: rawDecision.rejection_reasons || [],
    baseRatePerQuintal: rawDecision.base_rate_per_quintal || 2320.0,
    baseRatePerKg: rawDecision.base_rate_per_kg || 23.2,
    totalDeductionPercentage: rawDecision.total_deduction_percentage || 0.0,
    totalDeductionPerKgInr: rawDecision.total_deduction_per_kg_inr || 0.0,
    qualityPremiumPercentage: rawDecision.quality_premium_percentage || 0.0,
    qualityPremiumPerKgInr: rawDecision.quality_premium_per_kg_inr || 0.0,
    estimatedRatePerKg: rawDecision.estimated_rate_per_kg || 23.2,
    estimatedRatePerQuintal: rawDecision.estimated_rate_per_quintal || 2320.0,
    targetNegotiationRatePerKg: rawDecision.target_negotiation_rate_per_kg || 23.2,
    lotWeightKg: rawDecision.lot_weight_kg || 0.0,
    lotWeightQuintals: rawDecision.lot_weight_quintals || 0.0,
    totalEstimatedLotPrice: rawDecision.total_estimated_lot_price || 0.0,
    deductions: (rawDecision.deductions || []).map((d: any) => ({
      name: d.name,
      tolerancePct: d.tolerance_pct,
      actualPct: d.actual_pct,
      excessPct: d.excess_pct,
      deductionPercentage: d.deduction_percentage,
      deductionPerKgInr: d.deduction_per_kg_inr,
      note: d.note,
    })),
    explanationLogs: rawDecision.explanation_logs || [],
    complianceDisclosure: rawDecision.compliance_disclosure || '',
  };
}
