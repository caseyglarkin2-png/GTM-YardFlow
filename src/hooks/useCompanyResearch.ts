/**
 * useCompanyResearch Hook - YardFlow Hub
 * 
 * React hook for AI-powered company research.
 * Provides on-demand research functionality for the UI.
 * 
 * Sprint 58: Company research integration
 */

import { useState, useCallback, useMemo } from 'react';
import {
  researchCompany,
  batchResearchCompanies,
  createResearchQueue,
  researchFromQueue,
  getResearchSummary,
  estimateResearchTime,
  needsResearch,
  type CompanyResearchRequest,
  type CompanyResearchResult,
  type BatchResearchResult,
  type ResearchQueueItem,
  type ResearchedCompanyData,
} from '../services/CompanyResearchService';
import {
  setEnrichmentData,
  type CompanyEnrichmentData,
} from '../services/CompanyEnrichmentService';
import type { EnrichedCompany } from '../types/marketing';

// ============================================
// Types
// ============================================

export interface UseCompanyResearchState {
  // Single research state
  isResearching: boolean;
  lastResult: CompanyResearchResult | null;
  error: string | null;
  
  // Batch research state
  isBatchResearching: boolean;
  batchProgress: { completed: number; total: number };
  batchResults: BatchResearchResult | null;
  
  // Queue state
  queue: ResearchQueueItem[];
  queueProgress: { completed: number; total: number };
}

export interface UseCompanyResearchActions {
  // Single company research
  research: (request: CompanyResearchRequest) => Promise<CompanyResearchResult>;
  researchAndSave: (companyId: string, companyName: string) => Promise<CompanyResearchResult>;
  
  // Batch operations
  researchBatch: (companies: CompanyResearchRequest[]) => Promise<BatchResearchResult>;
  
  // Queue operations
  buildQueue: (companies: Partial<EnrichedCompany>[], filter?: (c: Partial<EnrichedCompany>) => boolean) => void;
  runQueue: (maxItems?: number) => Promise<BatchResearchResult>;
  clearQueue: () => void;
  
  // Utilities
  reset: () => void;
}

export interface UseCompanyResearchResult extends UseCompanyResearchState, UseCompanyResearchActions {
  // Computed values
  summary: ReturnType<typeof getResearchSummary> | null;
  estimate: ReturnType<typeof estimateResearchTime>;
}

// ============================================
// Initial State
// ============================================

const initialState: UseCompanyResearchState = {
  isResearching: false,
  lastResult: null,
  error: null,
  isBatchResearching: false,
  batchProgress: { completed: 0, total: 0 },
  batchResults: null,
  queue: [],
  queueProgress: { completed: 0, total: 0 },
};

// ============================================
// Hook Implementation
// ============================================

export function useCompanyResearch(
  companies?: Partial<EnrichedCompany>[]
): UseCompanyResearchResult {
  const [state, setState] = useState<UseCompanyResearchState>(initialState);

  // ============================================
  // Single Company Research
  // ============================================

  const research = useCallback(async (
    request: CompanyResearchRequest
  ): Promise<CompanyResearchResult> => {
    setState(prev => ({ ...prev, isResearching: true, error: null }));

    try {
      const result = await researchCompany(request);
      
      setState(prev => ({
        ...prev,
        isResearching: false,
        lastResult: result,
        error: result.success ? null : result.error || 'Research failed',
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isResearching: false,
        error: errorMessage,
      }));

      return {
        success: false,
        companyName: request.companyName,
        researchedAt: new Date(),
        error: errorMessage,
      };
    }
  }, []);

  /**
   * Research a company and automatically save the results to enrichment store
   */
  const researchAndSave = useCallback(async (
    companyId: string,
    companyName: string
  ): Promise<CompanyResearchResult> => {
    const result = await research({ companyName });

    if (result.success && result.data) {
      // Convert research data to enrichment data and save
      const enrichmentData: CompanyEnrichmentData = {
        facilityCount: result.data.facilityCount,
        industryCategory: result.data.industryCategory,
        distributionFootprint: result.data.distributionFootprint,
        isYardIntensive: result.data.isYardIntensive,
        estimatedTruckVolume: result.data.estimatedTruckVolume,
      };

      setEnrichmentData(companyId, enrichmentData);
    }

    return result;
  }, [research]);

  // ============================================
  // Batch Research
  // ============================================

  const researchBatch = useCallback(async (
    companiesToResearch: CompanyResearchRequest[]
  ): Promise<BatchResearchResult> => {
    setState(prev => ({
      ...prev,
      isBatchResearching: true,
      batchProgress: { completed: 0, total: companiesToResearch.length },
      error: null,
    }));

    try {
      const result = await batchResearchCompanies(companiesToResearch, {
        onProgress: (completed, total) => {
          setState(prev => ({
            ...prev,
            batchProgress: { completed, total },
          }));
        },
      });

      setState(prev => ({
        ...prev,
        isBatchResearching: false,
        batchResults: result,
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch research failed';
      setState(prev => ({
        ...prev,
        isBatchResearching: false,
        error: errorMessage,
      }));

      return {
        total: companiesToResearch.length,
        successful: 0,
        failed: companiesToResearch.length,
        results: [],
      };
    }
  }, []);

  // ============================================
  // Queue Operations
  // ============================================

  const buildQueue = useCallback((
    companiesToQueue: Partial<EnrichedCompany>[],
    filter?: (c: Partial<EnrichedCompany>) => boolean
  ) => {
    const queue = createResearchQueue(companiesToQueue, { filterFn: filter });
    setState(prev => ({
      ...prev,
      queue,
      queueProgress: { completed: 0, total: queue.length },
    }));
  }, []);

  const runQueue = useCallback(async (
    maxItems?: number
  ): Promise<BatchResearchResult> => {
    setState(prev => ({
      ...prev,
      isBatchResearching: true,
      error: null,
    }));

    try {
      const result = await researchFromQueue(state.queue, {
        maxItems,
        onProgress: (item, index, total) => {
          setState(prev => ({
            ...prev,
            queue: prev.queue.map(q => 
              q.companyName === item.companyName ? item : q
            ),
            queueProgress: { completed: index + 1, total },
          }));
        },
      });

      setState(prev => ({
        ...prev,
        isBatchResearching: false,
        batchResults: result,
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Queue processing failed';
      setState(prev => ({
        ...prev,
        isBatchResearching: false,
        error: errorMessage,
      }));

      return {
        total: 0,
        successful: 0,
        failed: 0,
        results: [],
      };
    }
  }, [state.queue]);

  const clearQueue = useCallback(() => {
    setState(prev => ({
      ...prev,
      queue: [],
      queueProgress: { completed: 0, total: 0 },
    }));
  }, []);

  // ============================================
  // Utilities
  // ============================================

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // ============================================
  // Computed Values
  // ============================================

  const summary = useMemo(() => {
    if (!companies) return null;
    return getResearchSummary(companies);
  }, [companies]);

  const estimate = useMemo(() => {
    return estimateResearchTime(state.queue.filter(q => q.status === 'pending').length);
  }, [state.queue]);

  // ============================================
  // Return Hook Result
  // ============================================

  return {
    // State
    ...state,
    
    // Actions
    research,
    researchAndSave,
    researchBatch,
    buildQueue,
    runQueue,
    clearQueue,
    reset,
    
    // Computed
    summary,
    estimate,
  };
}

// ============================================
// Export Types
// ============================================

export type {
  CompanyResearchRequest,
  CompanyResearchResult,
  BatchResearchResult,
  ResearchQueueItem,
  ResearchedCompanyData,
};

// Re-export utility functions for direct use
export { needsResearch, getResearchSummary, estimateResearchTime };
