export type GrainCategory = 'normal' | 'broken' | 'chalky' | 'discolored';

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GrainDetection {
  id: string;
  category: GrainCategory;
  rawClass: string;
  confidence: number;
  box: BoundingBox;
  normalizedBox?: BoundingBox;
}

export interface ClassMetricItem {
  className: string;
  category: GrainCategory;
  count: number;
  percentage: number;
  priority?: number;
  qualityWeight?: number;
  massPercentage?: number;
  pixelArea?: number;
}

export interface SampleMetrics {
  totalGrains: number;
  soundCount: number;
  brokenCount: number;
  chalkyCount: number;
  discoloredCount: number;
  foreignMatterCount?: number;
  soundPct: number;
  brokenPct: number;
  chalkyPct: number;
  discoloredPct: number;
  foreignMatterCountPct?: number;
  soundMassPct?: number;
  brokenMassPct?: number;
  chalkyMassPct?: number;
  discoloredMassPct?: number;
  foreignMatterMassPct?: number;
  qualityScore: number;
  grade?: string;
  classBreakdown: ClassMetricItem[];
  disclaimer?: string;
}

export interface ImageValidationResult {
  isValid: boolean;
  blurScore: number; // 0-100, > 60 is sharp
  lightingScore: number; // 0-100, 40-85 is optimal
  grainDensityScore: number; // Grains detected per unit area
  warnings: string[];
}

export interface SellerProfile {
  id: string;
  name: string;
  phone: string;
  location: string;
  sellerCode?: string;
  totalLotsCount?: number;
}

export type PricingSource = 'api' | 'manual';
export type ProcurementRecommendation = 'BUY' | 'NEGOTIATE' | 'REJECT';

export interface LineItemDeduction {
  name: string;
  tolerancePct: number;
  actualPct: number;
  excessPct: number;
  deductionPercentage: number;
  deductionPerKgInr: number;
  note?: string;
}

export interface ProcurementDecision {
  recommendation: ProcurementRecommendation;
  rejectionReasons: string[];
  baseRatePerQuintal: number;
  baseRatePerKg: number;
  totalDeductionPercentage: number;
  totalDeductionPerKgInr: number;
  qualityPremiumPercentage: number;
  qualityPremiumPerKgInr: number;
  estimatedRatePerKg: number;
  estimatedRatePerQuintal: number;
  targetNegotiationRatePerKg: number;
  lotWeightKg: number;
  lotWeightQuintals: number;
  totalEstimatedLotPrice: number;
  deductions: LineItemDeduction[];
  explanationLogs: string[];
  complianceDisclosure: string;
}

export interface PricingSummary {
  source: PricingSource;
  mandiMarket?: string;
  mandiDate?: string;
  baseRatePerQuintal: number;
  baseRatePerKg: number;
  qualityAdjustmentFactor: number; // e.g. 1.02 for +2%, 0.88 for -12%
  adjustmentPercentage: number;
  estimatedRatePerKg: number;
  agreedRatePerKg: number;
  totalEstimatedPrice: number;
  weightKg: number;
  weightQuintals: number;
  recommendation?: ProcurementRecommendation;
  deductions?: LineItemDeduction[];
  explanationLogs?: string[];
  rejectionReasons?: string[];
  disclaimer: string;
}

export type LotStatus = 'draft' | 'pending' | 'accepted' | 'rejected';

export interface LotRecord {
  id: string;
  lotId: string;
  seller: SellerProfile;
  variety: string;
  moisturePercentage?: number;
  weightKg: number;
  weightQuintals: number;
  qualityScore: number;
  metrics: SampleMetrics;
  pricing: PricingSummary;
  status: LotStatus;
  rejectionReason?: string;
  notes?: string;
  imageUri: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  role: string;
  orgName: string;
  phone?: string;
}
