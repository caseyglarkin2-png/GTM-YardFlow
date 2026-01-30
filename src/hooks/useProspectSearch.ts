/**
 * useProspectSearch - Railway-powered prospect search
 * 
 * Sprint 93: T93.7 - Add Prospect Search via Railway
 * 
 * Provides server-side full-text search instead of client-side filtering.
 * Includes debouncing, caching, and proper loading states.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';
import type { RailwayProspect, ProspectSearchParams } from '@/types/railway';
import { featureFlags } from '@/config/featureFlags';

// =============================================================================
// Types
// =============================================================================

export interface SearchFilters {
  status?: string[];
  tier?: string[];
  minScore?: number;
  maxScore?: number;
  tags?: string[];
  companyId?: string;
}

export interface UseProspectSearchOptions {
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Minimum query length to trigger search */
  minQueryLength?: number;
  /** Initial filters */
  initialFilters?: SearchFilters;
  /** Auto-clear results when query is empty */
  autoClear?: boolean;
}

export interface UseProspectSearchReturn {
  /** Search results */
  results: RailwayProspect[];
  /** Whether search is in progress */
  isSearching: boolean;
  /** Error state */
  error: Error | null;
  /** Total result count */
  totalCount: number;
  /** Current search query */
  query: string;
  /** Perform search */
  search: (query: string) => void;
  /** Clear search results */
  clear: () => void;
  /** Current filters */
  filters: SearchFilters;
  /** Update filters */
  setFilters: (filters: SearchFilters) => void;
  /** Has more results (for pagination) */
  hasMore: boolean;
  /** Load more results */
  loadMore: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useProspectSearch(options: UseProspectSearchOptions = {}): UseProspectSearchReturn {
  const {
    debounceMs = 300,
    minQueryLength = 2,
    initialFilters = {},
    autoClear = true,
  } = options;

  // State
  const [results, setResults] = useState<RailwayProspect[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Refs
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchCacheRef = useRef<Map<string, { results: RailwayProspect[]; total: number; timestamp: number }>>(new Map());
  const CACHE_TTL = 30000; // 30 seconds

  // ---------------------------------------------------------------------------
  // Cache Management
  // ---------------------------------------------------------------------------

  const getCacheKey = useCallback((q: string, f: SearchFilters, p: number): string => {
    return JSON.stringify({ q, f, p });
  }, []);

  const getCachedResults = useCallback((key: string): { results: RailwayProspect[]; total: number } | null => {
    const cached = searchCacheRef.current.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { results: cached.results, total: cached.total };
    }
    return null;
  }, []);

  const setCachedResults = useCallback((key: string, results: RailwayProspect[], total: number): void => {
    searchCacheRef.current.set(key, { results, total, timestamp: Date.now() });
    
    // Limit cache size
    if (searchCacheRef.current.size > 50) {
      const firstKey = searchCacheRef.current.keys().next().value;
      if (firstKey) searchCacheRef.current.delete(firstKey);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Search Execution
  // ---------------------------------------------------------------------------

  const executeSearch = useCallback(async (
    searchQuery: string,
    searchFilters: SearchFilters,
    pageNum: number,
    append: boolean = false
  ): Promise<void> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      console.warn('[useProspectSearch] Railway is disabled');
      return;
    }

    // Check cache
    const cacheKey = getCacheKey(searchQuery, searchFilters, pageNum);
    const cached = getCachedResults(cacheKey);
    
    if (cached) {
      if (append) {
        setResults(prev => [...prev, ...cached.results]);
      } else {
        setResults(cached.results);
      }
      setTotalCount(cached.total);
      setHasMore(cached.results.length === 20);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    setError(null);

    try {
      const params: ProspectSearchParams = {
        query: searchQuery || undefined,
        page: pageNum,
        pageSize: 20,
      };

      // Apply filters
      if (searchFilters.status?.length) {
        params.status = searchFilters.status as any;
      }
      if (searchFilters.tier?.length) {
        params.tier = searchFilters.tier as any;
      }
      if (searchFilters.minScore !== undefined) {
        params.minScore = searchFilters.minScore;
      }
      if (searchFilters.maxScore !== undefined) {
        params.maxScore = searchFilters.maxScore;
      }
      if (searchFilters.tags?.length) {
        params.tags = searchFilters.tags;
      }
      if (searchFilters.companyId) {
        params.companyId = searchFilters.companyId;
      }

      const result = await railwayClient.prospects.search(searchQuery, params);

      if (result.ok && result.data) {
        // Handle paginated response
        const paginatedData = result.data;
        const newResults = paginatedData.data;
        
        if (append) {
          setResults(prev => [...prev, ...newResults]);
        } else {
          setResults(newResults);
        }

        // Use pagination info if available
        const total = paginatedData.pagination?.total ?? (
          newResults.length < 20 
            ? (pageNum - 1) * 20 + newResults.length 
            : pageNum * 20 + 10
        );
        
        setTotalCount(total);
        setHasMore(newResults.length === 20);
        
        // Cache results
        setCachedResults(cacheKey, newResults, total);
      } else {
        setError(new Error(result.error || 'Search failed'));
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err : new Error('Search failed'));
    } finally {
      setIsSearching(false);
    }
  }, [getCacheKey, getCachedResults, setCachedResults]);

  // ---------------------------------------------------------------------------
  // Public Methods
  // ---------------------------------------------------------------------------

  const search = useCallback((newQuery: string): void => {
    setQuery(newQuery);

    // Clear debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Auto-clear if empty
    if (!newQuery && autoClear) {
      setResults([]);
      setTotalCount(0);
      setPage(1);
      setHasMore(false);
      return;
    }

    // Check minimum length
    if (newQuery.length < minQueryLength) {
      return;
    }

    // Debounce search
    debounceTimeoutRef.current = setTimeout(() => {
      setPage(1);
      executeSearch(newQuery, filters, 1, false);
    }, debounceMs);
  }, [debounceMs, minQueryLength, autoClear, filters, executeSearch]);

  const clear = useCallback((): void => {
    setQuery('');
    setResults([]);
    setTotalCount(0);
    setPage(1);
    setHasMore(false);
    setError(null);
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const loadMore = useCallback(async (): Promise<void> => {
    if (isSearching || !hasMore) return;
    
    const nextPage = page + 1;
    setPage(nextPage);
    await executeSearch(query, filters, nextPage, true);
  }, [isSearching, hasMore, page, query, filters, executeSearch]);

  const updateFilters = useCallback((newFilters: SearchFilters): void => {
    setFilters(newFilters);
    setPage(1);
    
    // Re-search if we have a query
    if (query) {
      executeSearch(query, newFilters, 1, false);
    }
  }, [query, executeSearch]);

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    results,
    isSearching,
    error,
    totalCount,
    query,
    search,
    clear,
    filters,
    setFilters: updateFilters,
    hasMore,
    loadMore,
  };
}

export default useProspectSearch;
