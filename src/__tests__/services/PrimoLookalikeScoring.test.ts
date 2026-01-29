/**
 * Primo Lookalike Scoring Tests - YardFlow Hub
 * 
 * Tests for Sprint 53-54: Primo Lookalike scoring algorithm
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculatePrimoLookalikeScore,
  calculateFacilityScore,
  calculateIndustryScore,
  calculateOpsIntensityScore,
  calculateRevenueScore,
  calculateFootprintScore,
  generateFactors,
  batchCalculatePrimoScores,
  sortByPrimoScore,
  filterByMinimumPrimoScore,
  getPrimoTier,
  createPrimoBrandsFixture,
  DEFAULT_CONFIG,
  type IndustryCategory,
  type DistributionFootprint,
} from '../../services/PrimoLookalikeScoring';

describe('PrimoLookalikeScoring', () => {
  describe('calculateFacilityScore', () => {
    it('should return 0 for undefined facility count', () => {
      expect(calculateFacilityScore(undefined)).toBe(0);
    });

    it('should return 0 for zero facilities', () => {
      expect(calculateFacilityScore(0)).toBe(0);
    });

    it('should return 0 for negative facilities', () => {
      expect(calculateFacilityScore(-10)).toBe(0);
    });

    it('should return max 30 for 260 facilities (Primo benchmark)', () => {
      expect(calculateFacilityScore(260)).toBe(30);
    });

    it('should cap at 30 for more than 260 facilities', () => {
      expect(calculateFacilityScore(500)).toBe(30);
    });

    it('should scale proportionally for 130 facilities (50%)', () => {
      const score = calculateFacilityScore(130);
      expect(score).toBeCloseTo(15, 1);
    });

    it('should scale proportionally for 26 facilities (10%)', () => {
      const score = calculateFacilityScore(26);
      expect(score).toBeCloseTo(3, 1);
    });
  });

  describe('calculateIndustryScore', () => {
    it('should return 0 for undefined industry', () => {
      expect(calculateIndustryScore(undefined)).toBe(0);
    });

    it('should return 25 for beverage industry (Primo match)', () => {
      expect(calculateIndustryScore('beverage')).toBe(25);
    });

    it('should return 25 for cpg industry', () => {
      expect(calculateIndustryScore('cpg')).toBe(25);
    });

    it('should return 25 for food_manufacturing industry', () => {
      expect(calculateIndustryScore('food_manufacturing')).toBe(25);
    });

    it('should return 25 for cold_chain industry', () => {
      expect(calculateIndustryScore('cold_chain')).toBe(25);
    });

    it('should return 15 for distribution (partial match)', () => {
      expect(calculateIndustryScore('distribution')).toBe(15);
    });

    it('should return 15 for manufacturing (partial match)', () => {
      expect(calculateIndustryScore('manufacturing')).toBe(15);
    });

    it('should return 0 for other industry', () => {
      expect(calculateIndustryScore('other')).toBe(0);
    });
  });

  describe('calculateOpsIntensityScore', () => {
    it('should return 0 for undefined opsShare', () => {
      expect(calculateOpsIntensityScore(undefined)).toBe(0);
    });

    it('should return 0 for negative opsShare', () => {
      expect(calculateOpsIntensityScore(-0.5)).toBe(0);
    });

    it('should return 20 for 100% ops (opsShare = 1)', () => {
      expect(calculateOpsIntensityScore(1)).toBe(20);
    });

    it('should return 10 for 50% ops', () => {
      expect(calculateOpsIntensityScore(0.5)).toBe(10);
    });

    it('should cap at 20 for opsShare > 1', () => {
      expect(calculateOpsIntensityScore(1.5)).toBe(20);
    });

    it('should handle 75% ops correctly', () => {
      expect(calculateOpsIntensityScore(0.75)).toBe(15);
    });
  });

  describe('calculateRevenueScore', () => {
    it('should return 0 for undefined revenue', () => {
      expect(calculateRevenueScore(undefined)).toBe(0);
    });

    it('should return 15 for $10B+ numeric', () => {
      expect(calculateRevenueScore(10_000_000_000)).toBe(15);
    });

    it('should return 13 for $5B-$10B numeric', () => {
      expect(calculateRevenueScore(5_000_000_000)).toBe(13);
    });

    it('should return 11 for $1B-$5B numeric', () => {
      expect(calculateRevenueScore(1_000_000_000)).toBe(11);
    });

    it('should return 9 for $500M-$1B numeric', () => {
      expect(calculateRevenueScore(500_000_000)).toBe(9);
    });

    it('should return 7 for $100M-$500M numeric', () => {
      expect(calculateRevenueScore(100_000_000)).toBe(7);
    });

    it('should return 5 for $50M-$100M numeric', () => {
      expect(calculateRevenueScore(50_000_000)).toBe(5);
    });

    it('should return 3 for $10M-$50M numeric', () => {
      expect(calculateRevenueScore(10_000_000)).toBe(3);
    });

    it('should return 1 for under $10M numeric', () => {
      expect(calculateRevenueScore(5_000_000)).toBe(1);
    });

    it('should match string tier "$10B+"', () => {
      expect(calculateRevenueScore('$10B+')).toBe(15);
    });

    it('should match string tier "$1B-$5B"', () => {
      expect(calculateRevenueScore('$1B-$5B')).toBe(11);
    });
  });

  describe('calculateFootprintScore', () => {
    it('should return 0 for undefined footprint', () => {
      expect(calculateFootprintScore(undefined)).toBe(0);
    });

    it('should return 10 for national footprint', () => {
      expect(calculateFootprintScore('national')).toBe(10);
    });

    it('should return 10 for international footprint', () => {
      expect(calculateFootprintScore('international')).toBe(10);
    });

    it('should return 5 for regional footprint', () => {
      expect(calculateFootprintScore('regional')).toBe(5);
    });

    it('should return 2 for local footprint', () => {
      expect(calculateFootprintScore('local')).toBe(2);
    });
  });

  describe('generateFactors', () => {
    it('should generate factor for large facility network', () => {
      const factors = generateFactors({ facilityCount: 260 });
      expect(factors).toContain('Large facility network (260 sites)');
    });

    it('should generate factor for medium facility network', () => {
      const factors = generateFactors({ facilityCount: 100 });
      expect(factors).toContain('Medium facility network (100 sites)');
    });

    it('should generate factor for growing facility network', () => {
      const factors = generateFactors({ facilityCount: 50 });
      expect(factors).toContain('Growing facility network (50 sites)');
    });

    it('should generate factor for high-value industry', () => {
      const factors = generateFactors({ industryCategory: 'beverage' });
      expect(factors[0]).toContain('High-value industry');
    });

    it('should generate factor for ops-heavy organization', () => {
      const factors = generateFactors({ opsShare: 0.75 });
      expect(factors).toContain('Ops-heavy organization (75% ops)');
    });

    it('should generate factor for national footprint', () => {
      const factors = generateFactors({ distributionFootprint: 'national' });
      expect(factors).toContain('National/international distribution footprint');
    });

    it('should generate factor for yard-intensive operations', () => {
      const factors = generateFactors({ isYardIntensive: true });
      expect(factors).toContain('Yard-intensive operations');
    });

    it('should return empty array for company with no notable factors', () => {
      const factors = generateFactors({ facilityCount: 5 });
      expect(factors).toEqual([]);
    });
  });

  describe('calculatePrimoLookalikeScore', () => {
    it('should return complete breakdown', () => {
      const breakdown = calculatePrimoLookalikeScore({
        facilityCount: 130,
        industryCategory: 'beverage',
        opsShare: 0.5,
        maxRevenue: 1_000_000_000,
        distributionFootprint: 'national',
      });

      expect(breakdown).toHaveProperty('totalScore');
      expect(breakdown).toHaveProperty('facilityScore');
      expect(breakdown).toHaveProperty('industryScore');
      expect(breakdown).toHaveProperty('opsIntensityScore');
      expect(breakdown).toHaveProperty('revenueScore');
      expect(breakdown).toHaveProperty('footprintScore');
      expect(breakdown).toHaveProperty('factors');
    });

    it('should calculate correct total for Primo Brands fixture', () => {
      const primo = createPrimoBrandsFixture();
      const breakdown = calculatePrimoLookalikeScore(primo);

      // 260 facilities = 30, beverage = 25, 0.75 ops = 15, $5B = 13, national = 10
      // Total = 93
      expect(breakdown.totalScore).toBeGreaterThanOrEqual(90);
      expect(breakdown.totalScore).toBeLessThanOrEqual(100);
    });

    it('should cap total score at 100', () => {
      const breakdown = calculatePrimoLookalikeScore({
        facilityCount: 500, // 30 (capped)
        industryCategory: 'beverage', // 25
        opsShare: 1, // 20
        maxRevenue: 20_000_000_000, // 15
        distributionFootprint: 'international', // 10
      });

      expect(breakdown.totalScore).toBe(100);
    });

    it('should return 0 for empty company', () => {
      const breakdown = calculatePrimoLookalikeScore({});
      expect(breakdown.totalScore).toBe(0);
    });

    it('should breakdown scores correctly', () => {
      const breakdown = calculatePrimoLookalikeScore({
        facilityCount: 260, // 30
        industryCategory: 'distribution', // 15 (partial)
        opsShare: 0.5, // 10
        maxRevenue: 500_000_000, // 9
        distributionFootprint: 'regional', // 5
      });

      expect(breakdown.facilityScore).toBe(30);
      expect(breakdown.industryScore).toBe(15);
      expect(breakdown.opsIntensityScore).toBe(10);
      expect(breakdown.revenueScore).toBe(9);
      expect(breakdown.footprintScore).toBe(5);
      expect(breakdown.totalScore).toBe(69);
    });
  });

  describe('batchCalculatePrimoScores', () => {
    it('should calculate scores for multiple companies', () => {
      const companies = [
        { id: '1', company: 'Company A', facilityCount: 100 },
        { id: '2', company: 'Company B', facilityCount: 200 },
        { id: '3', company: 'Company C', facilityCount: 50 },
      ];

      const results = batchCalculatePrimoScores(companies);

      expect(results.size).toBe(3);
      expect(results.get('1')?.facilityScore).toBeCloseTo(11.5, 1);
      expect(results.get('2')?.facilityScore).toBeCloseTo(23.1, 1);
      expect(results.get('3')?.facilityScore).toBeCloseTo(5.8, 1);
    });

    it('should use company name as key if id missing', () => {
      const companies = [{ company: 'Test Company', facilityCount: 100 }];
      const results = batchCalculatePrimoScores(companies);

      expect(results.has('Test Company')).toBe(true);
    });

    it('should handle empty array', () => {
      const results = batchCalculatePrimoScores([]);
      expect(results.size).toBe(0);
    });
  });

  describe('sortByPrimoScore', () => {
    it('should sort companies by score descending', () => {
      const companies = [
        { company: 'Low', facilityCount: 10 },
        { company: 'High', facilityCount: 260, industryCategory: 'beverage' as IndustryCategory },
        { company: 'Medium', facilityCount: 100 },
      ];

      const sorted = sortByPrimoScore(companies);

      expect(sorted[0].company.company).toBe('High');
      expect(sorted[1].company.company).toBe('Medium');
      expect(sorted[2].company.company).toBe('Low');
    });
  });

  describe('filterByMinimumPrimoScore', () => {
    it('should filter companies by minimum score', () => {
      const companies = [
        { company: 'Low', facilityCount: 10 }, // ~1.2 score
        { company: 'High', facilityCount: 260, industryCategory: 'beverage' as IndustryCategory }, // ~55 score
        { company: 'Medium', facilityCount: 100 }, // ~11.5 score
      ];

      const filtered = filterByMinimumPrimoScore(companies, 50);

      expect(filtered.length).toBe(1);
      expect(filtered[0].company).toBe('High');
    });

    it('should return all companies for minScore 0', () => {
      const companies = [
        { company: 'A' },
        { company: 'B' },
      ];

      const filtered = filterByMinimumPrimoScore(companies, 0);
      expect(filtered.length).toBe(2);
    });
  });

  describe('getPrimoTier', () => {
    it('should return primo-match for score >= 80', () => {
      expect(getPrimoTier(80)).toBe('primo-match');
      expect(getPrimoTier(100)).toBe('primo-match');
    });

    it('should return high-potential for score 60-79', () => {
      expect(getPrimoTier(60)).toBe('high-potential');
      expect(getPrimoTier(79)).toBe('high-potential');
    });

    it('should return moderate for score 40-59', () => {
      expect(getPrimoTier(40)).toBe('moderate');
      expect(getPrimoTier(59)).toBe('moderate');
    });

    it('should return low for score < 40', () => {
      expect(getPrimoTier(0)).toBe('low');
      expect(getPrimoTier(39)).toBe('low');
    });
  });

  describe('createPrimoBrandsFixture', () => {
    it('should create valid Primo Brands fixture', () => {
      const fixture = createPrimoBrandsFixture();

      expect(fixture.company).toBe('Primo Brands');
      expect(fixture.facilityCount).toBe(260);
      expect(fixture.industryCategory).toBe('beverage');
      expect(fixture.distributionFootprint).toBe('national');
      expect(fixture.isYardIntensive).toBe(true);
    });

    it('should score 90+ as golden test case', () => {
      const fixture = createPrimoBrandsFixture();
      const breakdown = calculatePrimoLookalikeScore(fixture);

      expect(breakdown.totalScore).toBeGreaterThanOrEqual(90);
    });
  });

  describe('Performance', () => {
    it('should calculate 10,000 company scores in under 500ms', () => {
      const companies = Array.from({ length: 10000 }, (_, i) => ({
        id: `company-${i}`,
        company: `Company ${i}`,
        facilityCount: Math.floor(Math.random() * 300),
        industryCategory: ['beverage', 'cpg', 'distribution', 'other'][i % 4] as IndustryCategory,
        opsShare: Math.random(),
        distributionFootprint: ['local', 'regional', 'national'][i % 3] as DistributionFootprint,
      }));

      const start = performance.now();
      batchCalculatePrimoScores(companies);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
    });
  });
});
