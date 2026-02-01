/**
 * Gate Bottleneck Inference Service Tests
 * 
 * Sprint 72: T72.0 - Gate Bottleneck Strategy
 */

import { describe, it, expect } from 'vitest';
import {
  inferGateBottleneck,
  isGateIntensiveIndustry,
  getGateLikelihoodLabel,
  GATE_INTENSIVE_INDUSTRIES,
  VOLUME_THRESHOLDS,
} from '../../services/GateBottleneckInference';
import type { EnrichedCompany } from '../../types/marketing';

describe('GateBottleneckInference', () => {
  describe('inferGateBottleneck', () => {
    it('should return likely=true for Primo Brands profile', () => {
      const primoBrands: Partial<EnrichedCompany> = {
        company: 'Primo Brands',
        industryCategory: 'beverage',
        facilityCount: 260,
        estimatedTruckVolume: 500,
        distributionFootprint: 'national',
      };

      const result = inferGateBottleneck(primoBrands);

      expect(result.isLikelyBottleneck).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.signals.length).toBeGreaterThanOrEqual(3);
    });

    it('should return likely=false for tech company', () => {
      const techCompany: Partial<EnrichedCompany> = {
        company: 'TechCorp',
        industryCategory: 'other',
        facilityCount: 2,
        estimatedTruckVolume: 5,
        distributionFootprint: 'local',
      };

      const result = inferGateBottleneck(techCompany);

      expect(result.isLikelyBottleneck).toBe(false);
      expect(result.signals.some(s => s.type === 'industry' && s.impact === 'negative')).toBe(true);
    });

    it('should return null for empty company data', () => {
      const emptyCompany: Partial<EnrichedCompany> = {
        company: 'Unknown Corp',
      };

      const result = inferGateBottleneck(emptyCompany);

      expect(result.isLikelyBottleneck).toBe(null);
      expect(result.confidence).toBe('unknown');
      expect(result.signals).toHaveLength(0);
    });

    it('should handle high truck volume as strong positive signal', () => {
      const highVolume: Partial<EnrichedCompany> = {
        company: 'High Volume Inc',
        estimatedTruckVolume: 150,
      };

      const result = inferGateBottleneck(highVolume);

      expect(result.signals.some(s => 
        s.type === 'volume' && 
        s.impact === 'positive' && 
        s.value === 150
      )).toBe(true);
    });

    it('should handle medium truck volume correctly', () => {
      const mediumVolume: Partial<EnrichedCompany> = {
        company: 'Medium Volume Inc',
        estimatedTruckVolume: 75,
      };

      const result = inferGateBottleneck(mediumVolume);

      expect(result.signals.some(s => 
        s.type === 'volume' && 
        s.impact === 'positive' && 
        s.value === 75
      )).toBe(true);
    });

    it('should handle low truck volume as neutral signal', () => {
      const lowVolume: Partial<EnrichedCompany> = {
        company: 'Low Volume Inc',
        estimatedTruckVolume: 30,
      };

      const result = inferGateBottleneck(lowVolume);

      expect(result.signals.some(s => 
        s.type === 'volume' && 
        s.impact === 'neutral' && 
        s.value === 30
      )).toBe(true);
    });

    it('should consider facility count 60+ as positive signal', () => {
      const manyFacilities: Partial<EnrichedCompany> = {
        company: 'Many Facilities Inc',
        facilityCount: 80,
      };

      const result = inferGateBottleneck(manyFacilities);

      expect(result.signals.some(s => 
        s.type === 'facilities' && 
        s.impact === 'positive' && 
        s.value === 80
      )).toBe(true);
    });

    it('should consider facility count 20-59 as partial positive signal', () => {
      const someFacilities: Partial<EnrichedCompany> = {
        company: 'Some Facilities Inc',
        facilityCount: 40,
      };

      const result = inferGateBottleneck(someFacilities);

      const facilitySignal = result.signals.find(s => s.type === 'facilities');
      expect(facilitySignal).toBeDefined();
      expect(facilitySignal?.impact).toBe('positive');
      expect(facilitySignal?.weight).toBeLessThan(0.2); // Less than full weight
    });

    it('should consider national footprint as positive signal', () => {
      const nationalFootprint: Partial<EnrichedCompany> = {
        company: 'National Inc',
        distributionFootprint: 'national',
      };

      const result = inferGateBottleneck(nationalFootprint);

      expect(result.signals.some(s => 
        s.type === 'footprint' && 
        s.impact === 'positive'
      )).toBe(true);
    });

    it('should combine multiple signals correctly', () => {
      const multiSignal: Partial<EnrichedCompany> = {
        company: 'Multi Signal Inc',
        industryCategory: 'cpg',
        facilityCount: 100,
        estimatedTruckVolume: 200,
      };

      const result = inferGateBottleneck(multiSignal);

      expect(result.isLikelyBottleneck).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.signals.length).toBe(3); // industry, facilities, volume
    });

    it('should generate reasoning with signals', () => {
      const company: Partial<EnrichedCompany> = {
        company: 'Test Inc',
        industryCategory: 'beverage',
        facilityCount: 50,
      };

      const result = inferGateBottleneck(company);

      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning.length).toBeGreaterThan(10);
    });
  });

  describe('isGateIntensiveIndustry', () => {
    it.each(GATE_INTENSIVE_INDUSTRIES)('should return true for %s', (industry) => {
      expect(isGateIntensiveIndustry(industry)).toBe(true);
    });

    it('should return true for case-insensitive match', () => {
      expect(isGateIntensiveIndustry('BEVERAGE')).toBe(true);
      expect(isGateIntensiveIndustry('Food_Manufacturing')).toBe(true);
    });

    it('should return true for partial match', () => {
      expect(isGateIntensiveIndustry('beverage manufacturing')).toBe(true);
    });

    it('should return false for non-gate industries', () => {
      expect(isGateIntensiveIndustry('technology')).toBe(false);
      expect(isGateIntensiveIndustry('software')).toBe(false);
    });
  });

  describe('getGateLikelihoodLabel', () => {
    it('should return "Yes ✓" for high confidence likely', () => {
      const result = getGateLikelihoodLabel({
        isLikelyBottleneck: true,
        confidence: 'high',
        reasoning: '',
        signals: [],
      });

      expect(result.label).toBe('Yes ✓');
      expect(result.color).toBe('green');
    });

    it('should return "Likely" for medium confidence likely', () => {
      const result = getGateLikelihoodLabel({
        isLikelyBottleneck: true,
        confidence: 'medium',
        reasoning: '',
        signals: [],
      });

      expect(result.label).toBe('Likely');
    });

    it('should return "Unknown" for null likelihood', () => {
      const result = getGateLikelihoodLabel({
        isLikelyBottleneck: null,
        confidence: 'unknown',
        reasoning: '',
        signals: [],
      });

      expect(result.label).toBe('Unknown');
      expect(result.color).toBe('gray');
    });

    it('should return "No" for high confidence unlikely', () => {
      const result = getGateLikelihoodLabel({
        isLikelyBottleneck: false,
        confidence: 'high',
        reasoning: '',
        signals: [],
      });

      expect(result.label).toBe('No');
      expect(result.color).toBe('red');
    });
  });

  describe('VOLUME_THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(VOLUME_THRESHOLDS.HIGH).toBe(100);
      expect(VOLUME_THRESHOLDS.MEDIUM).toBe(50);
      expect(VOLUME_THRESHOLDS.LOW).toBe(20);
    });
  });
});
