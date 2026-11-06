import { create } from 'zustand';
import { GrainDetection, ImageValidationResult, ProcurementDecision, SampleMetrics } from '../types';
import { inferenceService } from '../services/inferenceService';

interface InspectionState {
  capturedImageUri: string | null;
  imageDimensions: { width: number; height: number };
  validationResult: ImageValidationResult | null;
  isValidating: boolean;
  detections: GrainDetection[];
  metrics: SampleMetrics | null;
  decision: ProcurementDecision | null;
  isAnalyzing: boolean;
  analysisError: string | null;

  // Actions
  setCapturedImage: (uri: string, width?: number, height?: number) => void;
  runValidation: () => Promise<boolean>;
  runAnalysis: (lotWeightKg?: number, sellerId?: string, isDemoMode?: boolean) => Promise<boolean>;
  loadDemoSample: () => Promise<void>;
  clearImage: () => void;
  resetInspection: () => void;
}

export const useInspectionStore = create<InspectionState>((set, get) => ({
  capturedImageUri: null,
  imageDimensions: { width: 1080, height: 1920 },
  validationResult: null,
  isValidating: false,
  detections: [],
  metrics: null,
  decision: null,
  isAnalyzing: false,
  analysisError: null,

  setCapturedImage: (uri, width = 1080, height = 1920) => {
    set({
      capturedImageUri: uri,
      imageDimensions: { width, height },
      validationResult: null,
      detections: [],
      metrics: null,
      decision: null,
      analysisError: null,
    });
  },

  runValidation: async () => {
    const { capturedImageUri } = get();
    if (!capturedImageUri) return false;

    set({ isValidating: true });
    try {
      const result = await inferenceService.validateImageQuality(capturedImageUri);
      set({ validationResult: result, isValidating: false });
      return result.isValid;
    } catch {
      set({
        isValidating: false,
        validationResult: {
          isValid: true,
          blurScore: 75,
          lightingScore: 70,
          grainDensityScore: 80,
          warnings: [],
        },
      });
      return true;
    }
  },

  runAnalysis: async (lotWeightKg, sellerId, isDemoMode = false) => {
    const { capturedImageUri } = get();
    if (!capturedImageUri) return false;

    set({ isAnalyzing: true, analysisError: null });
    try {
      const response = await inferenceService.analyzeSampleImage(
        capturedImageUri,
        lotWeightKg,
        sellerId,
        isDemoMode
      );
      set({
        detections: response.detections,
        metrics: response.metrics,
        decision: response.decision ?? null,
        isAnalyzing: false,
      });
      return true;
    } catch (err: any) {
      set({
        isAnalyzing: false,
        analysisError: err?.message || 'AI inference encountered an error.',
      });
      return false;
    }
  },

  loadDemoSample: async () => {
    set({ isAnalyzing: true, analysisError: null });
    try {
      const demo = await inferenceService.loadDemoSample();
      set({
        detections: demo.detections,
        metrics: demo.metrics,
        decision: demo.decision ?? null,
        isAnalyzing: false,
      });
    } catch (err: any) {
      set({
        isAnalyzing: false,
        analysisError: err?.message || 'Could not load demo sample.',
      });
    }
  },

  clearImage: () => {
    set({
      capturedImageUri: null,
      validationResult: null,
      detections: [],
      metrics: null,
      decision: null,
      analysisError: null,
    });
  },

  resetInspection: () => {
    set({
      capturedImageUri: null,
      validationResult: null,
      detections: [],
      metrics: null,
      decision: null,
      isAnalyzing: false,
      isValidating: false,
      analysisError: null,
    });
  },
}));
