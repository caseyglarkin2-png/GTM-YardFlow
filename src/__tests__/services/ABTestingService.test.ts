/**
 * Tests for ABTestingService
 * Sprint 205: Template A/B Testing Framework
 */

import { describe, it, expect } from 'vitest';
import {
  hashCode,
  assignVariant,
  validateVariantTraffic,
  calculateSignificance,
  analyzeABTest,
  aggregateVariantStats,
  createEmptyVariantStats,
  type VariantStats,
} from '@/services/ABTestingService';
import type { EmailTemplateVariant } from '@/types/emailSequence';

describe('ABTestingService', () => {
  describe('hashCode', () => {
    it('returns consistent hash for same string', () => {
      const hash1 = hashCode('test@example.com');
      const hash2 = hashCode('test@example.com');
      expect(hash1).toBe(hash2);
    });

    it('returns different hash for different strings', () => {
      const hash1 = hashCode('test1@example.com');
      const hash2 = hashCode('test2@example.com');
      expect(hash1).not.toBe(hash2);
    });

    it('returns 0 for empty string', () => {
      expect(hashCode('')).toBe(0);
    });

    it('handles special characters', () => {
      const hash = hashCode('test+special@example.com');
      expect(typeof hash).toBe('number');
    });
  });

  describe('assignVariant', () => {
    const variants: EmailTemplateVariant[] = [
      { id: 'v1', name: 'Variant A', body: 'Body A', traffic: 50 },
      { id: 'v2', name: 'Variant B', body: 'Body B', traffic: 50 },
    ];

    it('returns null for empty variants array', () => {
      const result = assignVariant('template1', [], 'test@example.com');
      expect(result).toBeNull();
    });

    it('returns only variant when single variant exists', () => {
      const singleVariant: EmailTemplateVariant[] = [
        { id: 'v1', name: 'Variant A', body: 'Body A', traffic: 100 },
      ];
      const result = assignVariant('template1', singleVariant, 'test@example.com');
      expect(result?.id).toBe('v1');
    });

    it('assigns same variant to same email consistently', () => {
      const result1 = assignVariant('template1', variants, 'test@example.com');
      const result2 = assignVariant('template1', variants, 'test@example.com');
      expect(result1?.id).toBe(result2?.id);
    });

    it('distributes variants roughly according to traffic split', () => {
      // Test with many emails to verify distribution
      const assignments: Record<string, number> = { v1: 0, v2: 0 };
      
      for (let i = 0; i < 1000; i++) {
        const email = `test${i}@example.com`;
        const variant = assignVariant('template1', variants, email);
        if (variant) {
          assignments[variant.id]++;
        }
      }
      
      // With 50/50 split, each should be roughly 500 (allow 10% variance)
      expect(assignments.v1).toBeGreaterThan(400);
      expect(assignments.v1).toBeLessThan(600);
      expect(assignments.v2).toBeGreaterThan(400);
      expect(assignments.v2).toBeLessThan(600);
    });

    it('handles uneven traffic splits', () => {
      const unevenVariants: EmailTemplateVariant[] = [
        { id: 'v1', name: 'Variant A', body: 'Body A', traffic: 80 },
        { id: 'v2', name: 'Variant B', body: 'Body B', traffic: 20 },
      ];
      
      const assignments: Record<string, number> = { v1: 0, v2: 0 };
      
      for (let i = 0; i < 1000; i++) {
        const email = `test${i}@example.com`;
        const variant = assignVariant('template2', unevenVariants, email);
        if (variant) {
          assignments[variant.id]++;
        }
      }
      
      // 80/20 split should give roughly 800/200
      expect(assignments.v1).toBeGreaterThan(700);
      expect(assignments.v2).toBeLessThan(300);
    });

    it('uses templateId in assignment key', () => {
      const result1 = assignVariant('template1', variants, 'same@example.com');
      const result2 = assignVariant('template2', variants, 'same@example.com');
      // Different template IDs may give different assignments
      // This just verifies it doesn't crash - actual distribution may vary
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
    });
  });

  describe('validateVariantTraffic', () => {
    it('returns valid for empty variants', () => {
      const result = validateVariantTraffic([]);
      expect(result.valid).toBe(true);
    });

    it('returns valid when traffic sums to 100', () => {
      const variants: EmailTemplateVariant[] = [
        { id: 'v1', name: 'A', body: 'A', traffic: 50 },
        { id: 'v2', name: 'B', body: 'B', traffic: 50 },
      ];
      const result = validateVariantTraffic(variants);
      expect(result.valid).toBe(true);
    });

    it('returns invalid when traffic sums to less than 100', () => {
      const variants: EmailTemplateVariant[] = [
        { id: 'v1', name: 'A', body: 'A', traffic: 30 },
        { id: 'v2', name: 'B', body: 'B', traffic: 30 },
      ];
      const result = validateVariantTraffic(variants);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('60%');
    });

    it('returns invalid when traffic sums to more than 100', () => {
      const variants: EmailTemplateVariant[] = [
        { id: 'v1', name: 'A', body: 'A', traffic: 60 },
        { id: 'v2', name: 'B', body: 'B', traffic: 60 },
      ];
      const result = validateVariantTraffic(variants);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('120%');
    });
  });

  describe('calculateSignificance', () => {
    it('returns not significant with insufficient sample size', () => {
      const variantA: VariantStats = { id: 'v1', name: 'A', sends: 10, opens: 5, clicks: 2, replies: 1, meetings: 0 };
      const variantB: VariantStats = { id: 'v2', name: 'B', sends: 10, opens: 3, clicks: 1, replies: 0, meetings: 0 };
      
      const result = calculateSignificance(variantA, variantB, 'opens');
      expect(result.significant).toBe(false);
      expect(result.winner).toBeNull();
    });

    it('detects significant difference with large sample', () => {
      // Clear winner: A has 60% open rate, B has 20% open rate
      const variantA: VariantStats = { id: 'v1', name: 'A', sends: 100, opens: 60, clicks: 10, replies: 5, meetings: 1 };
      const variantB: VariantStats = { id: 'v2', name: 'B', sends: 100, opens: 20, clicks: 5, replies: 2, meetings: 0 };
      
      const result = calculateSignificance(variantA, variantB, 'opens');
      expect(result.significant).toBe(true);
      expect(result.winner).toBe('A');
      expect(result.confidence).toBeGreaterThanOrEqual(95);
    });

    it('detects B as winner when B performs better', () => {
      const variantA: VariantStats = { id: 'v1', name: 'A', sends: 100, opens: 20, clicks: 5, replies: 1, meetings: 0 };
      const variantB: VariantStats = { id: 'v2', name: 'B', sends: 100, opens: 60, clicks: 20, replies: 10, meetings: 2 };
      
      const result = calculateSignificance(variantA, variantB, 'opens');
      expect(result.significant).toBe(true);
      expect(result.winner).toBe('B');
    });

    it('returns not significant for similar performance', () => {
      const variantA: VariantStats = { id: 'v1', name: 'A', sends: 100, opens: 50, clicks: 10, replies: 5, meetings: 1 };
      const variantB: VariantStats = { id: 'v2', name: 'B', sends: 100, opens: 48, clicks: 9, replies: 5, meetings: 1 };
      
      const result = calculateSignificance(variantA, variantB, 'opens');
      expect(result.significant).toBe(false);
    });

    it('handles zero values gracefully', () => {
      const variantA: VariantStats = { id: 'v1', name: 'A', sends: 50, opens: 0, clicks: 0, replies: 0, meetings: 0 };
      const variantB: VariantStats = { id: 'v2', name: 'B', sends: 50, opens: 0, clicks: 0, replies: 0, meetings: 0 };
      
      const result = calculateSignificance(variantA, variantB, 'opens');
      expect(result.significant).toBe(false);
      expect(result.zScore).toBe(0);
    });
  });

  describe('analyzeABTest', () => {
    it('returns insufficient_data status when samples too small', () => {
      const variantA: VariantStats = { id: 'v1', name: 'A', sends: 10, opens: 5, clicks: 2, replies: 1, meetings: 0 };
      const variantB: VariantStats = { id: 'v2', name: 'B', sends: 20, opens: 10, clicks: 3, replies: 1, meetings: 0 };
      
      const result = analyzeABTest('test1', variantA, variantB);
      expect(result.status).toBe('insufficient_data');
      expect(result.recommendation).toContain('more sends');
    });

    it('returns running status when no significant results yet', () => {
      const variantA: VariantStats = { id: 'v1', name: 'A', sends: 50, opens: 25, clicks: 10, replies: 5, meetings: 1 };
      const variantB: VariantStats = { id: 'v2', name: 'B', sends: 50, opens: 24, clicks: 9, replies: 5, meetings: 1 };
      
      const result = analyzeABTest('test1', variantA, variantB);
      expect(result.status).toBe('running');
      expect(result.recommendation).toContain('No significant difference');
    });

    it('returns concluded status when significant difference found', () => {
      const variantA: VariantStats = { id: 'v1', name: 'A', sends: 100, opens: 60, clicks: 20, replies: 10, meetings: 3 };
      const variantB: VariantStats = { id: 'v2', name: 'B', sends: 100, opens: 20, clicks: 5, replies: 2, meetings: 0 };
      
      const result = analyzeABTest('test1', variantA, variantB);
      expect(result.status).toBe('concluded');
      expect(result.recommendation).toContain('Variant A');
    });

    it('prioritizes reply significance in recommendation', () => {
      const variantA: VariantStats = { id: 'v1', name: 'A', sends: 100, opens: 50, clicks: 20, replies: 30, meetings: 5 };
      const variantB: VariantStats = { id: 'v2', name: 'B', sends: 100, opens: 48, clicks: 18, replies: 5, meetings: 1 };
      
      const result = analyzeABTest('test1', variantA, variantB);
      expect(result.recommendation).toContain('reply rate');
    });
  });

  describe('aggregateVariantStats', () => {
    it('aggregates events for a specific variant', () => {
      const events = [
        { type: 'sent' as const, variantId: 'v1' },
        { type: 'delivered' as const, variantId: 'v1' },
        { type: 'opened' as const, variantId: 'v1' },
        { type: 'clicked' as const, variantId: 'v1' },
        { type: 'replied' as const, variantId: 'v1' },
        { type: 'sent' as const, variantId: 'v2' }, // Different variant
      ];
      
      const stats = aggregateVariantStats('v1', 'Variant A', events);
      
      expect(stats.id).toBe('v1');
      expect(stats.name).toBe('Variant A');
      expect(stats.sends).toBe(2); // sent + delivered
      expect(stats.opens).toBe(1);
      expect(stats.clicks).toBe(1);
      expect(stats.replies).toBe(1);
    });

    it('returns zeros for variant with no events', () => {
      const events = [
        { type: 'sent' as const, variantId: 'v2' },
      ];
      
      const stats = aggregateVariantStats('v1', 'Variant A', events);
      expect(stats.sends).toBe(0);
      expect(stats.opens).toBe(0);
    });
  });

  describe('createEmptyVariantStats', () => {
    it('creates stats object with all zeros', () => {
      const stats = createEmptyVariantStats('v1', 'Test Variant');
      
      expect(stats).toEqual({
        id: 'v1',
        name: 'Test Variant',
        sends: 0,
        opens: 0,
        clicks: 0,
        replies: 0,
        meetings: 0,
      });
    });
  });
});
