/**
 * useMeetingStats Hook
 * Sprint 204: Meeting Attribution Dashboard
 * 
 * Fetches meeting analytics from the /api/analytics/meetings endpoint.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface SequenceStat {
  id: string;
  name: string;
  count: number;
}

export interface TemplateStat {
  id: string;
  name: string;
  count: number;
}

export interface DayStat {
  date: string;
  count: number;
}

export interface MeetingAnalytics {
  bySequence: SequenceStat[];
  byTemplate: TemplateStat[];
  byDay: DayStat[];
  total: number;
  thisWeek: number;
  lastWeek: number;
  percentChange: number;
}

export interface UseMeetingStatsOptions {
  startDate?: Date;
  endDate?: Date;
  autoFetch?: boolean;
  refreshInterval?: number;
}

export interface UseMeetingStatsReturn {
  analytics: MeetingAnalytics | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useMeetingStats(
  options: UseMeetingStatsOptions = {}
): UseMeetingStatsReturn {
  const {
    startDate,
    endDate,
    autoFetch = true,
    refreshInterval = 0,
  } = options;

  const [analytics, setAnalytics] = useState<MeetingAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (startDate) {
        params.set('startDate', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        params.set('endDate', endDate.toISOString().split('T')[0]);
      }

      const url = `/api/analytics/meetings${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch meeting analytics: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch meeting analytics');
      }

      setAnalytics(data.data);
    } catch (err) {
      console.error('[useMeetingStats] Error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch) {
      fetchAnalytics();
    }
  }, [autoFetch, fetchAnalytics]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(fetchAnalytics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchAnalytics]);

  return {
    analytics,
    isLoading,
    error,
    refresh: fetchAnalytics,
  };
}

// =============================================================================
// Helper Hook: Quick Meeting KPIs
// =============================================================================

export interface MeetingKPIs {
  total: number;
  thisWeek: number;
  lastWeek: number;
  percentChange: number;
  trend: 'up' | 'down' | 'flat';
  topSequence: SequenceStat | null;
  topTemplate: TemplateStat | null;
}

export function useMeetingKPIs(options: UseMeetingStatsOptions = {}): MeetingKPIs & { isLoading: boolean; error: Error | null } {
  const { analytics, isLoading, error } = useMeetingStats(options);

  const kpis = useMemo((): MeetingKPIs => {
    if (!analytics) {
      return {
        total: 0,
        thisWeek: 0,
        lastWeek: 0,
        percentChange: 0,
        trend: 'flat',
        topSequence: null,
        topTemplate: null,
      };
    }

    const trend: MeetingKPIs['trend'] = 
      analytics.percentChange > 5 ? 'up' : 
      analytics.percentChange < -5 ? 'down' : 
      'flat';

    return {
      total: analytics.total,
      thisWeek: analytics.thisWeek,
      lastWeek: analytics.lastWeek,
      percentChange: analytics.percentChange,
      trend,
      topSequence: analytics.bySequence[0] || null,
      topTemplate: analytics.byTemplate[0] || null,
    };
  }, [analytics]);

  return {
    ...kpis,
    isLoading,
    error,
  };
}

export default useMeetingStats;
