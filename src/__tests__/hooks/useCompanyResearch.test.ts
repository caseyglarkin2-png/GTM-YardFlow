/**
 * useCompanyResearch Hook Tests - YardFlow Hub
 * 
 * Tests for Sprint 58: Company research React hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useCompanyResearch,
  needsResearch,
  getResearchSummary,
  estimateResearchTime,
} from '../../hooks/useCompanyResearch';
import type { EnrichedCompany } from '../../types/marketing';

describe('useCompanyResearch', () => {
  // ============================================
  // Initial State Tests
  // ============================================
  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useCompanyResearch());

      expect(result.current.isResearching).toBe(false);
      expect(result.current.lastResult).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isBatchResearching).toBe(false);
      expect(result.current.queue).toHaveLength(0);
    });

    it('should compute summary when companies provided', () => {
      const companies: Partial<EnrichedCompany>[] = [
        { company: 'Test', tier: 'Tier 1' },
      ];

      const { result } = renderHook(() => useCompanyResearch(companies));

      expect(result.current.summary).not.toBeNull();
      expect(result.current.summary?.total).toBe(1);
    });

    it('should compute estimate for empty queue', () => {
      const { result } = renderHook(() => useCompanyResearch());

      expect(result.current.estimate.estimatedMinutes).toBe(0);
      expect(result.current.estimate.estimatedTokens).toBe(0);
    });
  });

  // ============================================
  // research Function Tests
  // ============================================
  describe('research', () => {
    it('should complete research and set isResearching to false', async () => {
      const { result } = renderHook(() => useCompanyResearch());

      await act(async () => {
        await result.current.research({ companyName: 'Test Company' });
      });

      expect(result.current.isResearching).toBe(false);
    });

    it('should set lastResult after successful research', async () => {
      const { result } = renderHook(() => useCompanyResearch());

      await act(async () => {
        await result.current.research({ companyName: 'Test Company' });
      });

      expect(result.current.lastResult).not.toBeNull();
      expect(result.current.lastResult?.success).toBe(true);
      expect(result.current.lastResult?.companyName).toBe('Test Company');
    });

    it('should set error for failed research', async () => {
      const { result } = renderHook(() => useCompanyResearch());

      await act(async () => {
        await result.current.research({ companyName: '' });
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.lastResult?.success).toBe(false);
    });

    it('should clear error on new research', async () => {
      const { result } = renderHook(() => useCompanyResearch());

      // First, cause an error
      await act(async () => {
        await result.current.research({ companyName: '' });
      });
      expect(result.current.error).not.toBeNull();

      // Then, do successful research
      await act(async () => {
        await result.current.research({ companyName: 'Valid Company' });
      });
      expect(result.current.error).toBeNull();
    });
  });

  // ============================================
  // researchAndSave Function Tests
  // ============================================
  describe('researchAndSave', () => {
    it('should research and return result', async () => {
      const { result } = renderHook(() => useCompanyResearch());

      let researchResult: any;
      await act(async () => {
        researchResult = await result.current.researchAndSave('company-1', 'Test Company');
      });

      expect(researchResult.success).toBe(true);
      expect(researchResult.companyName).toBe('Test Company');
    });

    it('should update lastResult', async () => {
      const { result } = renderHook(() => useCompanyResearch());

      await act(async () => {
        await result.current.researchAndSave('company-1', 'Test Company');
      });

      expect(result.current.lastResult?.companyName).toBe('Test Company');
    });
  });

  // ============================================
  // researchBatch Function Tests
  // ============================================
  describe('researchBatch', () => {
    it('should complete batch and set isBatchResearching to false', async () => {
      const { result } = renderHook(() => useCompanyResearch());

      await act(async () => {
        await result.current.researchBatch([
          { companyName: 'Company A' },
          { companyName: 'Company B' },
        ]);
      });

      expect(result.current.isBatchResearching).toBe(false);
    });

    it('should update batchProgress', async () => {
      const { result } = renderHook(() => useCompanyResearch());

      await act(async () => {
        await result.current.researchBatch([
          { companyName: 'Company A' },
          { companyName: 'Company B' },
        ]);
      });

      expect(result.current.batchProgress.completed).toBe(2);
      expect(result.current.batchProgress.total).toBe(2);
    });

    it('should set batchResults', async () => {
      const { result } = renderHook(() => useCompanyResearch());

      await act(async () => {
        await result.current.researchBatch([
          { companyName: 'Company A' },
        ]);
      });

      expect(result.current.batchResults).not.toBeNull();
      expect(result.current.batchResults?.total).toBe(1);
      expect(result.current.batchResults?.successful).toBe(1);
    });
  });

  // ============================================
  // Queue Operations Tests
  // ============================================
  describe('buildQueue', () => {
    it('should build queue from companies', () => {
      const companies: Partial<EnrichedCompany>[] = [
        { id: '1', company: 'Company A', tier: 'Tier 1' },
        { id: '2', company: 'Company B', tier: 'Tier 2' },
      ];

      const { result } = renderHook(() => useCompanyResearch());

      act(() => {
        result.current.buildQueue(companies);
      });

      expect(result.current.queue).toHaveLength(2);
      expect(result.current.queueProgress.total).toBe(2);
    });

    it('should apply filter when building queue', () => {
      const companies: Partial<EnrichedCompany>[] = [
        { id: '1', company: 'Company A', tier: 'Tier 1', attendees: 20 },
        { id: '2', company: 'Company B', tier: 'Tier 1', attendees: 5 },
      ];

      const { result } = renderHook(() => useCompanyResearch());

      act(() => {
        result.current.buildQueue(companies, c => (c.attendees || 0) >= 10);
      });

      expect(result.current.queue).toHaveLength(1);
      expect(result.current.queue[0].companyName).toBe('Company A');
    });

    it('should exclude already enriched companies', () => {
      const companies: Partial<EnrichedCompany>[] = [
        { id: '1', company: 'Needs Research' },
        { id: '2', company: 'Already Done', facilityCount: 100, industryCategory: 'beverage', distributionFootprint: 'national' },
      ];

      const { result } = renderHook(() => useCompanyResearch());

      act(() => {
        result.current.buildQueue(companies);
      });

      expect(result.current.queue).toHaveLength(1);
      expect(result.current.queue[0].companyName).toBe('Needs Research');
    });
  });

  describe('runQueue', () => {
    it('should process queue items', async () => {
      const companies: Partial<EnrichedCompany>[] = [
        { id: '1', company: 'Company A' },
        { id: '2', company: 'Company B' },
      ];

      const { result } = renderHook(() => useCompanyResearch());

      act(() => {
        result.current.buildQueue(companies);
      });

      await act(async () => {
        await result.current.runQueue();
      });

      expect(result.current.batchResults?.total).toBe(2);
      expect(result.current.batchResults?.successful).toBe(2);
    });

    it('should respect maxItems limit', async () => {
      const companies: Partial<EnrichedCompany>[] = [
        { id: '1', company: 'Company A' },
        { id: '2', company: 'Company B' },
        { id: '3', company: 'Company C' },
      ];

      const { result } = renderHook(() => useCompanyResearch());

      act(() => {
        result.current.buildQueue(companies);
      });

      await act(async () => {
        await result.current.runQueue(2);
      });

      expect(result.current.batchResults?.total).toBe(2);
    });

    it('should update queue item status', async () => {
      const companies: Partial<EnrichedCompany>[] = [
        { id: '1', company: 'Company A' },
      ];

      const { result } = renderHook(() => useCompanyResearch());

      act(() => {
        result.current.buildQueue(companies);
      });

      await act(async () => {
        await result.current.runQueue();
      });

      expect(result.current.queue[0].status).toBe('completed');
      expect(result.current.queue[0].result).toBeDefined();
    });
  });

  describe('clearQueue', () => {
    it('should clear the queue', () => {
      const companies: Partial<EnrichedCompany>[] = [
        { id: '1', company: 'Company A' },
      ];

      const { result } = renderHook(() => useCompanyResearch());

      act(() => {
        result.current.buildQueue(companies);
      });
      expect(result.current.queue).toHaveLength(1);

      act(() => {
        result.current.clearQueue();
      });
      expect(result.current.queue).toHaveLength(0);
    });
  });

  // ============================================
  // reset Function Tests
  // ============================================
  describe('reset', () => {
    it('should reset all state to initial values', async () => {
      const { result } = renderHook(() => useCompanyResearch());

      // First, do some operations
      await act(async () => {
        await result.current.research({ companyName: 'Test' });
      });
      expect(result.current.lastResult).not.toBeNull();

      // Then reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.lastResult).toBeNull();
      expect(result.current.isResearching).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.queue).toHaveLength(0);
    });
  });

  // ============================================
  // estimate Computed Value Tests
  // ============================================
  describe('estimate', () => {
    it('should update when queue changes', () => {
      const companies: Partial<EnrichedCompany>[] = [
        { id: '1', company: 'Company A' },
        { id: '2', company: 'Company B' },
      ];

      const { result } = renderHook(() => useCompanyResearch());

      const emptyEstimate = result.current.estimate;
      expect(emptyEstimate.estimatedMinutes).toBe(0);

      act(() => {
        result.current.buildQueue(companies);
      });

      expect(result.current.estimate.estimatedMinutes).toBeGreaterThan(0);
      expect(result.current.estimate.estimatedTokens).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Re-exported Utility Tests
  // ============================================
  describe('utility functions', () => {
    describe('needsResearch', () => {
      it('should correctly identify companies needing research', () => {
        expect(needsResearch({ company: 'Test' })).toBe(true);
        expect(needsResearch({
          company: 'Test',
          facilityCount: 100,
          industryCategory: 'beverage',
          distributionFootprint: 'national',
        })).toBe(false);
      });
    });

    describe('getResearchSummary', () => {
      it('should summarize research status', () => {
        const companies: Partial<EnrichedCompany>[] = [
          { company: 'Done', facilityCount: 100, industryCategory: 'beverage', distributionFootprint: 'national' },
          { company: 'Not Done' },
        ];

        const summary = getResearchSummary(companies);

        expect(summary.total).toBe(2);
        expect(summary.fullyResearched).toBe(1);
        expect(summary.notResearched).toBe(1);
      });
    });

    describe('estimateResearchTime', () => {
      it('should estimate time', () => {
        const estimate = estimateResearchTime(10);

        expect(estimate.estimatedMinutes).toBeGreaterThan(0);
        expect(estimate.estimatedCost).toMatch(/^\$/);
      });
    });
  });
});
