import { create } from 'zustand';
import { LotRecord, LotStatus, PricingSource, PricingSummary, SampleMetrics, SellerProfile } from '../types';
import { procurementService } from '../services/procurementService';
import { MOCK_INITIAL_LOTS, MOCK_SELLERS } from '../services/mockData';

interface LotState {
  // Sellers
  sellers: SellerProfile[];
  selectedSeller: SellerProfile | null;
  isLoadingSellers: boolean;

  // Active Assessment & Lot Workflow
  activeLotId: string;
  variety: string;
  moisturePercentage: number;
  weightKg: number;
  weightUnit: 'kg' | 'quintal';
  pricing: PricingSummary | null;

  // Lots Ledger
  lots: LotRecord[];
  filterStatus: LotStatus | 'all';
  searchQuery: string;

  // Actions
  loadInitialData: () => Promise<void>;
  selectSeller: (seller: SellerProfile | null) => void;
  createSeller: (seller: Omit<SellerProfile, 'id'>) => Promise<SellerProfile>;
  setLotWeight: (weight: number, unit: 'kg' | 'quintal') => void;
  setVariety: (variety: string) => void;
  setMoisture: (pct: number) => void;
  calculateLotPricing: (qualityScoreOrMetrics: SampleMetrics | number, source?: PricingSource, agreedRateOverride?: number) => Promise<PricingSummary>;
  commitLotDecision: (
    decision: 'accepted' | 'rejected',
    metrics: SampleMetrics,
    imageUri: string,
    rejectionReason?: string,
    notes?: string
  ) => LotRecord;
  setFilterStatus: (status: LotStatus | 'all') => void;
  setSearchQuery: (query: string) => void;
  resetActiveLot: () => void;
}

function generateLotId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LOT-${dateStr}-${randomSuffix}`;
}

export const useLotStore = create<LotState>((set, get) => ({
  sellers: MOCK_SELLERS,
  selectedSeller: MOCK_SELLERS[0],
  isLoadingSellers: false,

  activeLotId: generateLotId(),
  variety: 'Swarna (MTU 7029)',
  moisturePercentage: 14.0,
  weightKg: 500,
  weightUnit: 'kg',
  pricing: null,

  lots: MOCK_INITIAL_LOTS,
  filterStatus: 'all',
  searchQuery: '',

  loadInitialData: async () => {
    set({ isLoadingSellers: true });
    try {
      const sellers = await procurementService.getSellers();
      const lots = await procurementService.getLots();
      set({ sellers, lots, isLoadingSellers: false });
    } catch {
      set({ isLoadingSellers: false });
    }
  },

  selectSeller: (seller) => {
    set({ selectedSeller: seller });
  },

  createSeller: async (sellerData) => {
    const newSeller = await procurementService.addSeller(sellerData);
    set((state) => ({
      sellers: [newSeller, ...state.sellers],
      selectedSeller: newSeller,
    }));
    return newSeller;
  },

  setLotWeight: (weight, unit) => {
    const normalizedKg = unit === 'quintal' ? weight * 100 : weight;
    set({ weightKg: normalizedKg, weightUnit: unit });
  },

  setVariety: (variety) => set({ variety }),
  setMoisture: (moisturePercentage) => set({ moisturePercentage }),

  calculateLotPricing: async (qualityScoreOrMetrics, source = 'api', agreedRateOverride) => {
    const { weightKg } = get();
    let baseRate = 2320.0; // Default baseline

    if (source === 'api') {
      try {
        const mandiData = await procurementService.fetchMandiPrice();
        baseRate = mandiData.baseRatePerQuintal;
      } catch {
        baseRate = 2320.0;
      }
    }

    const calculated = procurementService.calculatePricing(
      qualityScoreOrMetrics,
      baseRate,
      weightKg,
      source,
      agreedRateOverride
    );

    set({ pricing: calculated });
    return calculated;
  },

  commitLotDecision: (decision, metrics, imageUri, rejectionReason, notes) => {
    const { activeLotId, selectedSeller, variety, moisturePercentage, weightKg, pricing } = get();

    const fallbackPricing: PricingSummary = pricing || {
      source: 'api',
      baseRatePerQuintal: 2320.0,
      baseRatePerKg: 23.2,
      qualityAdjustmentFactor: 1.0,
      adjustmentPercentage: 0,
      estimatedRatePerKg: 23.2,
      agreedRatePerKg: 23.2,
      totalEstimatedPrice: 23.2 * weightKg,
      weightKg,
      weightQuintals: weightKg / 100,
      disclaimer: 'Advisory estimate for procurement decision support only.',
    };

    const newLotRecord: LotRecord = {
      id: `lot-rec-${Date.now()}`,
      lotId: activeLotId,
      seller: selectedSeller || {
        id: 's-unknown',
        name: 'Unassigned Farmer',
        phone: 'N/A',
        location: 'Field Intake',
      },
      variety,
      moisturePercentage,
      weightKg,
      weightQuintals: Number((weightKg / 100).toFixed(2)),
      qualityScore: metrics.qualityScore,
      metrics,
      pricing: fallbackPricing,
      status: decision,
      rejectionReason: decision === 'rejected' ? rejectionReason : undefined,
      notes,
      imageUri,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      lots: [newLotRecord, ...state.lots],
      activeLotId: generateLotId(), // Cycle new lot ID for subsequent intake
      pricing: null,
    }));

    return newLotRecord;
  },

  setFilterStatus: (filterStatus) => set({ filterStatus }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  resetActiveLot: () => {
    set({
      activeLotId: generateLotId(),
      pricing: null,
    });
  },
}));
