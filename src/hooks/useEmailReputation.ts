/**
 * useEmailReputation Hook
 * 
 * Sprint 39A.3: React hook for fetching and caching email reputation data
 * 
 * Provides:
 * - Reputation metrics with health scores
 * - Automatic refresh at configurable interval
 * - Loading and error states
 * - Helper methods for UI display
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '@/lib/firebase';

export interface ReputationMetrics {
  period: '24h' | '7d' | '30d';
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  replied: number;
  unsubscribed: number;
  deliverabilityRate: number;
  bounceRate: number;
  spamRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  healthScore: number;
  healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface ReputationTrendPoint {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  healthScore: number;
}

export interface ReputationIssue {
  type: 'critical' | 'warning' | 'info';
  metric: string;
  value: number;
  threshold: number;
  message: string;
}

export interface ReputationData {
  metrics: ReputationMetrics;
  trend: ReputationTrendPoint[];
  issues: ReputationIssue[];
  recommendations: string[];
  pauseRecommended: boolean;
  pauseReason?: string;
}

export interface UseEmailReputationOptions {
  /** Time period for metrics */
  period?: '24h' | '7d' | '30d';
  /** Auto-refresh interval in ms (0 = disabled) */
  refreshInterval?: number;
  /** Skip initial fetch (useful for conditional rendering) */
  skipInitialFetch?: boolean;
}

export interface UseEmailReputationReturn {
  /** Reputation data */
  data: ReputationData | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
  /** Last successful fetch timestamp */
  lastUpdated: Date | null;
  /** Health grade color for UI */
  gradeColor: string;
  /** Whether metrics indicate healthy state */
  isHealthy: boolean;
  /** Whether sending should be paused */
  shouldPauseSending: boolean;
}

/**
 * Get color class for health grade
 */
function getGradeColor(grade: ReputationMetrics['healthGrade'] | null): string {
  switch (grade) {
    case 'A': return 'text-green-600';
    case 'B': return 'text-blue-600';
    case 'C': return 'text-yellow-600';
    case 'D': return 'text-orange-600';
    case 'F': return 'text-red-600';
    default: return 'text-slate-400';
  }
}

/**
 * Hook for managing email reputation data
 */
export function useEmailReputation(
  options: UseEmailReputationOptions = {}
): UseEmailReputationReturn {
  const {
    period = '7d',
    refreshInterval = 0,
    skipInitialFetch = false,
  } = options;

  const [data, setData] = useState<ReputationData | null>(null);
  const [isLoading, setIsLoading] = useState(!skipInitialFetch);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch reputation data from API
   */
  const fetchReputation = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const token = await user.getIdToken();
      const response = await fetch(`/api/email/reputation?period=${period}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (mountedRef.current) {
        setData(result);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch reputation');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [period]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    await fetchReputation();
  }, [fetchReputation]);

  // Initial fetch
  useEffect(() => {
    if (!skipInitialFetch) {
      fetchReputation();
    }
  }, [fetchReputation, skipInitialFetch]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchReputation, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refreshInterval, fetchReputation]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Computed values
  const healthGrade = data?.metrics.healthGrade ?? null;
  const gradeColor = getGradeColor(healthGrade);
  const isHealthy = (data?.metrics.healthScore ?? 0) >= 70;
  const shouldPauseSending = data?.pauseRecommended ?? false;

  return {
    data,
    isLoading,
    error,
    refresh,
    lastUpdated,
    gradeColor,
    isHealthy,
    shouldPauseSending,
  };
}

export default useEmailReputation;
