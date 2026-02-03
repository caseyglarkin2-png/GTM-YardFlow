/**
 * useSequences Hook - Railway-backed sequence management
 * 
 * Sprint 94: T94.1 - Create useSequences Hook with Railway Backend
 * 
 * This hook provides CRUD operations for sequences using the Railway API.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';
import type { 
  RailwaySequence, 
  CreateSequenceRequest, 
  UpdateSequenceRequest,
  SequenceAnalytics 
} from '@/types/railway';
import { featureFlags } from '@/config/featureFlags';
import { MANIFEST_SEQUENCES } from '@/data/sequenceTemplates';
import type { SequenceTemplate } from '@/types/emailSequence';

// =============================================================================
// Default Sequences (Fallback when Railway is disabled)
// =============================================================================

function templateToRailwaySequence(t: SequenceTemplate): RailwaySequence {
  return {
    id: t.id,
    name: t.name,
    description: t.description || null,
    status: 'active' as const,
    steps: t.steps.map((s, stepIdx) => ({
      id: `${t.id}-step-${stepIdx}`,
      order: stepIdx + 1,
      type: 'email' as const,
      delayDays: s.delayDays,
      templateId: `${t.id}-template-${stepIdx}`,
      subject: s.subjectTemplate,
      body: s.bodyTemplate,
    })),
    enrollmentCount: 0,
    activeEnrollmentCount: 0,
    completedEnrollmentCount: 0,
    ownerId: 'local-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const DEFAULT_SEQUENCES: RailwaySequence[] = MANIFEST_SEQUENCES.map(templateToRailwaySequence);

// =============================================================================
// Types
// =============================================================================

export interface UseSequencesOptions {
  /** Auto-fetch sequences on mount */
  autoFetch?: boolean;
  /** Include archived sequences */
  includeArchived?: boolean;
  /** Poll interval in ms (0 = disabled) */
  pollInterval?: number;
}

export interface UseSequencesReturn {
  /** List of sequences */
  sequences: RailwaySequence[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Create a new sequence */
  createSequence: (data: CreateSequenceRequest) => Promise<RailwaySequence | null>;
  /** Update an existing sequence */
  updateSequence: (id: string, data: UpdateSequenceRequest) => Promise<boolean>;
  /** Delete a sequence */
  deleteSequence: (id: string) => Promise<boolean>;
  /** Duplicate a sequence */
  duplicateSequence: (id: string, newName: string) => Promise<RailwaySequence | null>;
  /** Get sequence analytics */
  getAnalytics: (id: string) => Promise<SequenceAnalytics | null>;
  /** Refresh sequences list */
  refresh: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useSequences(options: UseSequencesOptions = {}): UseSequencesReturn {
  const {
    autoFetch = true,
    includeArchived = false,
    pollInterval = 0,
  } = options;

  // State
  const [sequences, setSequences] = useState<RailwaySequence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const mountedRef = useRef(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch Sequences
  // ---------------------------------------------------------------------------

  const loadSequences = useCallback(async (): Promise<void> => {
    // Sprint 22B: Fallback to default sequences when Railway is disabled
    if (!featureFlags.RAILWAY_ENABLED) {
      console.log('[useSequences] Railway disabled, using default sequences');
      setSequences(DEFAULT_SEQUENCES);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await railwayClient.sequences.list();

      if (!mountedRef.current) return;

      if (result.ok && result.data) {
        let data = result.data;
        
        // Filter out archived if not included
        if (!includeArchived) {
          data = data.filter(s => s.status !== 'archived' as any);
        }
        
        setSequences(data);
      } else {
        setError(new Error(result.error || 'Failed to load sequences'));
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to load sequences'));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [includeArchived]);

  // ---------------------------------------------------------------------------
  // Create Sequence
  // ---------------------------------------------------------------------------

  const createSequence = useCallback(async (
    data: CreateSequenceRequest
  ): Promise<RailwaySequence | null> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      console.warn('[useSequences] Railway disabled, skipping createSequence');
      return null;
    }

    try {
      const result = await railwayClient.sequences.create(data);

      if (result.ok && result.data) {
        // Add to list
        setSequences(prev => [...prev, result.data!]);
        return result.data;
      } else {
        setError(new Error(result.error || 'Failed to create sequence'));
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create sequence'));
      return null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Update Sequence
  // ---------------------------------------------------------------------------

  const updateSequence = useCallback(async (
    id: string,
    data: UpdateSequenceRequest
  ): Promise<boolean> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      console.warn('[useSequences] Railway is disabled');
      return false;
    }

    // Store original for rollback
    const originalSequences = [...sequences];

    // Optimistic update - cast to maintain type safety
    setSequences(prev =>
      prev.map(s => (s.id === id ? { ...s, ...data } as RailwaySequence : s))
    );

    try {
      const result = await railwayClient.sequences.update(id, data);

      if (!result.ok) {
        // Rollback on failure
        setSequences(originalSequences);
        setError(new Error(result.error || 'Failed to update sequence'));
        return false;
      }

      return true;
    } catch (err) {
      // Rollback on error
      setSequences(originalSequences);
      setError(err instanceof Error ? err : new Error('Failed to update sequence'));
      return false;
    }
  }, [sequences]);

  // ---------------------------------------------------------------------------
  // Delete Sequence
  // ---------------------------------------------------------------------------

  const deleteSequence = useCallback(async (id: string): Promise<boolean> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      console.warn('[useSequences] Railway is disabled');
      return false;
    }

    // Store original for rollback
    const originalSequences = [...sequences];

    // Optimistic delete
    setSequences(prev => prev.filter(s => s.id !== id));

    try {
      const result = await railwayClient.sequences.delete(id);

      if (!result.ok) {
        // Rollback on failure
        setSequences(originalSequences);
        setError(new Error(result.error || 'Failed to delete sequence'));
        return false;
      }

      return true;
    } catch (err) {
      // Rollback on error
      setSequences(originalSequences);
      setError(err instanceof Error ? err : new Error('Failed to delete sequence'));
      return false;
    }
  }, [sequences]);

  // ---------------------------------------------------------------------------
  // Duplicate Sequence
  // ---------------------------------------------------------------------------

  const duplicateSequence = useCallback(async (
    id: string,
    newName: string
  ): Promise<RailwaySequence | null> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      console.warn('[useSequences] Railway is disabled');
      return null;
    }

    try {
      // Get the original sequence
      const result = await railwayClient.sequences.get(id);
      
      if (!result.ok || !result.data) {
        setError(new Error(result.error || 'Failed to fetch sequence'));
        return null;
      }

      const original = result.data;

      // Create a copy - use undefined for optional null fields
      const newSequence: CreateSequenceRequest = {
        name: newName,
        description: original.description ?? undefined,
        steps: original.steps.map(step => ({
          order: step.order,
          type: step.type,
          subject: step.subject,
          body: step.body,
          delayDays: step.delayDays,
          delayHours: step.delayHours,
        })),
      };

      return createSequence(newSequence);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to duplicate sequence'));
      return null;
    }
  }, [createSequence]);

  // ---------------------------------------------------------------------------
  // Get Analytics
  // ---------------------------------------------------------------------------

  const getAnalytics = useCallback(async (
    id: string
  ): Promise<SequenceAnalytics | null> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      console.warn('[useSequences] Railway is disabled');
      return null;
    }

    try {
      const result = await railwayClient.sequences.analytics(id);

      if (result.ok && result.data) {
        return result.data;
      } else {
        setError(new Error(result.error || 'Failed to fetch analytics'));
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch analytics'));
      return null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && featureFlags.RAILWAY_ENABLED) {
      loadSequences();
    }
  }, [autoFetch, loadSequences]);

  // Polling
  useEffect(() => {
    if (pollInterval > 0 && featureFlags.RAILWAY_ENABLED) {
      pollIntervalRef.current = setInterval(() => {
        loadSequences();
      }, pollInterval);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [pollInterval, loadSequences]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    sequences,
    isLoading,
    error,
    createSequence,
    updateSequence,
    deleteSequence,
    duplicateSequence,
    getAnalytics,
    refresh: loadSequences,
  };
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Hook for a single sequence by ID
 */
export function useSequence(id: string | null) {
  const [sequence, setSequence] = useState<RailwaySequence | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id || !featureFlags.RAILWAY_ENABLED) {
      setSequence(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    railwayClient.sequences.get(id)
      .then(result => {
        if (result.ok && result.data) {
          setSequence(result.data);
        } else {
          setError(new Error(result.error || 'Sequence not found'));
        }
      })
      .catch(err => {
        setError(err instanceof Error ? err : new Error('Failed to fetch sequence'));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  return { sequence, isLoading, error };
}

export default useSequences;
