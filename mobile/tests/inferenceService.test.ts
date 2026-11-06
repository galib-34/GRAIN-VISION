/**
 * Test specification for inferenceService & procurementService.
 * Validates zero silent mocking behavior, multipart pipeline, and response mapping.
 */
import { inferenceService } from '../src/services/inferenceService';
import { procurementService } from '../src/services/procurementService';
import { SampleMetrics } from '../src/types';

describe('inferenceService', () => {
  it('throws an explicit error when server returns an error or is offline (zero silent mocking)', async () => {
    // Mock global fetch to return 503
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ detail: 'YOLO model not loaded on backend' }),
    } as any);

    await expect(
      inferenceService.analyzeSampleImage('file:///test/image.jpg', { isDemoMode: false })
    ).rejects.toThrow('YOLO model not loaded on backend');

    global.fetch = originalFetch;
  });

  it('only returns mock data when isDemoMode is explicitly set to true', async () => {
    const response = await inferenceService.analyzeSampleImage('file:///test/image.jpg', {
      isDemoMode: true,
    });
    expect(response.isMock).toBe(true);
    expect(response.detections.length).toBeGreaterThan(0);
    expect(response.metrics.totalGrains).toBeGreaterThan(0);
  });
});

describe('procurementService', () => {
  it('calculates tiered slab deductions on excess broken grains', () => {
    const mockMetrics: SampleMetrics = {
      totalGrains: 100,
      soundCount: 75,
      brokenCount: 18,
      chalkyCount: 5,
      discoloredCount: 2,
      soundPct: 75.0,
      brokenPct: 18.0, // 13% excess over 5% tolerance
      chalkyPct: 5.0,  // 2% excess over 3% tolerance
      discoloredPct: 2.0, // 1% excess over 1% tolerance
      qualityScore: 78.0,
      classBreakdown: [],
    };

    const result = procurementService.calculatePricing(mockMetrics, 2300.0, 500.0);
    expect(result.deductions).toBeDefined();

if (!result.deductions) {
  throw new Error('Expected procurement deductions to be defined');
}

expect(result.deductions.length).toBeGreaterThan(0);

const brokenDed = result.deductions.find(
  (d) => d.name === 'Broken Grains Deduction'
);

expect(brokenDed).toBeDefined();
expect(brokenDed?.deductionPercentage).toBe(8.0);
  });

  it('triggers REJECT recommendation when foreign contamination exceeds 1.5%', () => {
    const contaminationMetrics: SampleMetrics = {
      totalGrains: 100,
      soundCount: 80,
      brokenCount: 10,
      chalkyCount: 5,
      discoloredCount: 5,
      foreignMatterCountPct: 2.5, // > 1.5% limit!
      soundPct: 80.0,
      brokenPct: 10.0,
      chalkyPct: 5.0,
      discoloredPct: 5.0,
      qualityScore: 72.0,
      classBreakdown: [],
    };

    const result = procurementService.calculatePricing(contaminationMetrics, 2300.0, 500.0);
    expect(result.recommendation).toBe('REJECT');
    expect(result.rejectionReasons?.length).toBeGreaterThan(0);
    expect(result.agreedRatePerKg).toBe(0);
  });
});
