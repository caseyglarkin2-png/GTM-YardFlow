/**
 * useProspects Hook - Railway-backed prospect management
 * 
 * Sprint 93: T93.1 - Create useProspects Hook with Railway Backend
 * 
 * This hook provides CRUD operations for prospects using the Railway API
 * instead of direct Firestore access.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { RailwayApiClient, railwayClient } from '@/services/RailwayApiClient';
import type { 
  RailwayProspect, 
  CreateProspectInput, 
  UpdateProspectInput,
  ProspectFilters 
} from '@/types/railway';
import { featureFlags } from '@/config/featureFlags';

// =============================================================================
// Types
// =============================================================================

export interface UseProspectsOptions {
  /** Auto-fetch prospects on mount */
  autoFetch?: boolean;
  /** Initial filters */
  filters?: ProspectFilters;
  /** Poll interval in ms (0 = disabled) */
  pollInterval?: number;
  /** Custom client instance */
  client?: RailwayApiClient;
}

export interface UseProspectsReturn {
  /** List of prospects */
  prospects: RailwayProspect[];
  /** Loading state */
  isLoading: boolean;
  /** Whether initial load has completed */
  isInitialized: boolean;
  /** Error state */
  error: Error | null;
  /** Total count for pagination */
  totalCount: number;
  /** Create a new prospect */
  createProspect: (data: CreateProspectInput) => Promise<RailwayProspect | null>;
  /** Update an existing prospect */
  updateProspect: (id: string, data: UpdateProspectInput) => Promise<boolean>;
  /** Delete a prospect */
  deleteProspect: (id: string) => Promise<boolean>;
  /** Update prospect status */
  updateStatus: (id: string, status: string) => Promise<boolean>;
  /** Refresh prospects list */
  refresh: () => Promise<void>;
  /** Search prospects */
  search: (query: string) => Promise<void>;
  /** Apply filters */
  setFilters: (filters: ProspectFilters) => void;
  /** Current filters */
  filters: ProspectFilters;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useProspects(options: UseProspectsOptions = {}): UseProspectsReturn {
  const {
    autoFetch = true,
    filters: initialFilters = {},
    pollInterval = 0,
    client = railwayClient,
  } = options;

  // State
  const [prospects, setProspects] = useState<RailwayProspect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<ProspectFilters>(initialFilters);
  const [searchQuery, setSearchQuery] = useState('');

  // Refs for cleanup
  const mountedRef = useRef(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch Prospects
  // ---------------------------------------------------------------------------

  const loadProspects = useCallback(async (): Promise<void> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      console.warn('[useProspects] Railway is disabled, skipping load');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let result;
      
      if (searchQuery) {
        result = await client.prospects.search(searchQuery);
      } else {
        result = await client.prospects.list(filters);
      }

      if (!mountedRef.current) return;

      if (result.ok && result.data) {
        // Handle paginated response
        const data = result.data;
        setProspects(data.data);
        setTotalCount(data.pagination?.total ?? data.data.length);
      } else {
        setError(new Error(result.error || 'Failed to load prospects'));
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to load prospects'));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }
  }, [client, filters, searchQuery]);

  // ---------------------------------------------------------------------------
  // Create Prospect
  // ---------------------------------------------------------------------------

  const createProspect = useCallback(async (
    data: CreateProspectInput
  ): Promise<RailwayProspect | null> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      console.warn('[useProspects] Railway is disabled');
      return null;
    }

    try {
      const result = await client.prospects.create(data);

      if (result.ok && result.data) {
        // Optimistically add to list
        setProspects(prev => [result.data!, ...prev]);
        setTotalCount(prev => prev + 1);
        return result.data;
      } else {
        setError(new Error(result.error || 'Failed to create prospect'));
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create prospect'));
      return null;
    }
  }, [client]);

  // ---------------------------------------------------------------------------
  // Update Prospect
  // ---------------------------------------------------------------------------

  const updateProspect = useCallback(async (
    id: string,
    data: UpdateProspectInput
  ): Promise<boolean> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      console.warn('[useProspects] Railway is disabled');
      return false;
    }

    // Store original for rollback
    const originalProspects = [...prospects];

    // Optimistic update
    setProspects(prev =>
      prev.map(p => (p.id === id ? { ...p, ...data } : p))
    );

    try {
      const result = await client.prospects.update(id, data);

      if (!result.ok) {
        // Rollback on failure
        setProspects(originalProspects);
        setError(new Error(result.error || 'Failed to update prospect'));
        return false;
      }

      return true;
    } catch (err) {
      // Rollback on error
      setProspects(originalProspects);
      setError(err instanceof Error ? err : new Error('Failed to update prospect'));
      return false;
    }
  }, [client, prospects]);

  // ---------------------------------------------------------------------------
  // Update Status
  // ---------------------------------------------------------------------------

  const updateStatus = useCallback(async (
    id: string,
    status: string
  ): Promise<boolean> => {
    return updateProspect(id, { status: status as UpdateProspectInput['status'] });
  }, [updateProspect]);

  // ---------------------------------------------------------------------------
  // Delete Prospect
  // ---------------------------------------------------------------------------

  const deleteProspect = useCallback(async (id: string): Promise<boolean> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      console.warn('[useProspects] Railway is disabled');
      return false;
    }

    // Store original for rollback
    const originalProspects = [...prospects];

    // Optimistic delete
    setProspects(prev => prev.filter(p => p.id !== id));
    setTotalCount(prev => prev - 1);

    try {
      const result = await client.prospects.delete(id);

      if (!result.ok) {
        // Rollback on failure
        setProspects(originalProspects);
        setTotalCount(prev => prev + 1);
        setError(new Error(result.error || 'Failed to delete prospect'));
        return false;
      }

      return true;
    } catch (err) {
      // Rollback on error
      setProspects(originalProspects);
      setTotalCount(prev => prev + 1);
      setError(err instanceof Error ? err : new Error('Failed to delete prospect'));
      return false;
    }
  }, [client, prospects]);

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  const search = useCallback(async (query: string): Promise<void> => {
    setSearchQuery(query);
  }, []);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && featureFlags.RAILWAY_ENABLED) {
      loadProspects();
    }
  }, [autoFetch, loadProspects]);

  // Refetch when search query changes
  useEffect(() => {
    if (isInitialized && searchQuery !== undefined) {
      loadProspects();
    }
  }, [searchQuery, loadProspects, isInitialized]);

  // Refetch when filters change
  useEffect(() => {
    if (isInitialized) {
      loadProspects();
    }
  }, [filters, loadProspects, isInitialized]);

  // Polling
  useEffect(() => {
    if (pollInterval > 0 && featureFlags.RAILWAY_ENABLED) {
      pollIntervalRef.current = setInterval(() => {
        loadProspects();
      }, pollInterval);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [pollInterval, loadProspects]);

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
    prospects,
    isLoading,
    isInitialized,
    error,
    totalCount,
    createProspect,
    updateProspect,
    deleteProspect,
    updateStatus,
    refresh: loadProspects,
    search,
    setFilters,
    filters,
  };
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Hook for a single prospect by ID
 */
export function useProspect(id: string | null) {
  const [prospect, setProspect] = useState<RailwayProspect | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id || !featureFlags.RAILWAY_ENABLED) {
      setProspect(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    railwayClient.prospects.get(id)
      .then((result: { ok: boolean; data?: RailwayProspect; error?: string }) => {
        if (result.ok && result.data) {
          setProspect(result.data);
        } else {
          setError(new Error(result.error || 'Prospect not found'));
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error('Failed to fetch prospect'));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  return { prospect, isLoading, error };
}

export default useProspects;
