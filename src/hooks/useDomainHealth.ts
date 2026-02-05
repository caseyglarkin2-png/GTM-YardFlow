/**
 * useDomainHealth Hook
 * 
 * Sprint 39B.3: React hook for domain authentication health status
 * 
 * Fetches SPF, DKIM, and DMARC configuration status for a domain.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '@/lib/firebase';

// Record status types
type RecordStatus = 'valid' | 'invalid' | 'missing' | 'warning' | 'unknown';

export interface DnsRecordResult {
  type: 'SPF' | 'DKIM' | 'DMARC';
  status: RecordStatus;
  value?: string;
  expected?: string;
  message: string;
  details?: string[];
}

export interface DomainHealthData {
  domain: string;
  isHealthy: boolean;
  score: number;
  records: {
    spf: DnsRecordResult;
    dkim: DnsRecordResult;
    dmarc: DnsRecordResult;
  };
  recommendations: string[];
  lastChecked: string;
  cacheExpiry: string;
}

export interface UseDomainHealthOptions {
  /** Domain to check (required) */
  domain: string;
  /** Force refresh, bypass cache */
  forceRefresh?: boolean;
  /** Specific DKIM selector to check */
  dkimSelector?: string;
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number;
  /** Enable the hook (can be used to conditionally skip) */
  enabled?: boolean;
}

export interface UseDomainHealthResult {
  data: DomainHealthData | null;
  isLoading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
  /** Color class for score badge */
  scoreColor: string;
  /** Color class for each record status */
  getStatusColor: (status: RecordStatus) => string;
  /** True if all records are valid */
  isFullyConfigured: boolean;
  /** True if any record is invalid (not just missing) */
  hasInvalidRecord: boolean;
}

/**
 * Get color class for a domain health score
 */
function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-lime-600';
  if (score >= 50) return 'text-yellow-600';
  if (score >= 30) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Get color class for a record status
 */
function getStatusColor(status: RecordStatus): string {
  switch (status) {
    case 'valid':
      return 'text-green-600';
    case 'warning':
      return 'text-yellow-600';
    case 'invalid':
      return 'text-red-600';
    case 'missing':
      return 'text-slate-400';
    case 'unknown':
    default:
      return 'text-slate-500';
  }
}

/**
 * React hook for fetching domain authentication health
 */
export function useDomainHealth(options: UseDomainHealthOptions): UseDomainHealthResult {
  const {
    domain,
    forceRefresh = false,
    dkimSelector,
    refreshInterval = 0,
    enabled = true,
  } = options;

  const [data, setData] = useState<DomainHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch domain health from API
   */
  const fetchDomainHealth = useCallback(async (force?: boolean) => {
    // Skip if no domain or disabled
    if (!domain || !enabled) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Get auth token
    if (!auth) {
      setError('Auth not initialized');
      setIsLoading(false);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setError(null);

      const token = await user.getIdToken();

      // Build URL with query params
      const params = new URLSearchParams({ domain });
      if (force || forceRefresh) {
        params.set('refresh', 'true');
      }
      if (dkimSelector) {
        params.set('selector', dkimSelector);
      }

      const response = await fetch(`/api/domain/check?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to check domain');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [domain, forceRefresh, dkimSelector, enabled]);

  // Initial fetch
  useEffect(() => {
    if (enabled && domain) {
      fetchDomainHealth();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDomainHealth, enabled, domain]);

  // Auto-refresh interval
  useEffect(() => {
    if (!enabled || !domain || refreshInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchDomainHealth();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [fetchDomainHealth, enabled, domain, refreshInterval]);

  // Computed values
  const scoreColor = data ? getScoreColor(data.score) : 'text-slate-400';

  const isFullyConfigured = data
    ? data.records.spf.status === 'valid' &&
      data.records.dkim.status === 'valid' &&
      data.records.dmarc.status === 'valid'
    : false;

  const hasInvalidRecord = data
    ? data.records.spf.status === 'invalid' ||
      data.records.dkim.status === 'invalid' ||
      data.records.dmarc.status === 'invalid'
    : false;

  return {
    data,
    isLoading,
    error,
    refresh: fetchDomainHealth,
    scoreColor,
    getStatusColor,
    isFullyConfigured,
    hasInvalidRecord,
  };
}

export default useDomainHealth;
