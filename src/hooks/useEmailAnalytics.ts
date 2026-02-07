/**
 * T96.2: Email Analytics Hook
 * Fetches email performance data with fallback to local Firestore endpoint
 * 
 * Priority:
 * 1. Railway /email/analytics (if available)
 * 2. Local /api/email/stats (Firestore-based fallback)
 */

import { useState, useEffect, useCallback } from 'react';
import { railwayClient } from '../services/RailwayApiClient';
import { featureFlags } from '../config/featureFlags';
import type { EmailAnalytics } from '../types/railway';
import { auth } from '@/lib/firebase';

export type AnalyticsPeriod = 'day' | 'week' | 'month';

export interface UseEmailAnalyticsOptions {
  period?: AnalyticsPeriod;
  startDate?: Date;
  endDate?: Date;
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
}

export interface EmailAnalyticsState {
  analytics: EmailAnalytics | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

const DEFAULT_OPTIONS: Required<UseEmailAnalyticsOptions> = {
  period: 'week',
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  endDate: new Date(),
  autoRefresh: false,
  refreshInterval: 5 * 60 * 1000, // 5 minutes
};

export function useEmailAnalytics(options: UseEmailAnalyticsOptions = {}): EmailAnalyticsState {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const [analytics, setAnalytics] = useState<EmailAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try Railway first if enabled
      if (featureFlags.RAILWAY_ENABLED) {
        const result = await railwayClient.email.analytics({
          period: mergedOptions.period,
          startDate: mergedOptions.startDate.toISOString().split('T')[0],
          endDate: mergedOptions.endDate.toISOString().split('T')[0],
        });

        if (result.ok && result.data) {
          setAnalytics(result.data);
          setLastUpdated(new Date());
          return;
        }
        // Railway failed, fall through to local endpoint
      }

      // Fallback: Use local /api/email/stats endpoint (Firestore-based)
      const token = await auth?.currentUser?.getIdToken();
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const params = new URLSearchParams({
        startDate: mergedOptions.startDate.toISOString(),
        endDate: mergedOptions.endDate.toISOString(),
        groupBy: mergedOptions.period,
      });

      const response = await fetch(`/api/email/stats?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Stats API returned ${response.status}`);
      }

      const data = await response.json();
      
      // Transform /api/email/stats response to EmailAnalytics format
      const transformed: EmailAnalytics = {
        period: {
          start: mergedOptions.startDate.toISOString(),
          end: mergedOptions.endDate.toISOString(),
          days: Math.ceil((mergedOptions.endDate.getTime() - mergedOptions.startDate.getTime()) / (24 * 60 * 60 * 1000)),
        },
        metrics: {
          sent: data.totals?.sent || 0,
          delivered: data.totals?.delivered || 0,
          opened: data.totals?.opened || 0,
          clicked: data.totals?.clicked || 0,
          replied: data.totals?.replied || 0,
          bounced: data.totals?.bounced || 0,
          unsubscribed: 0,
          deliveryRate: data.rates?.deliveryRate || 0,
          openRate: data.rates?.openRate || 0,
          clickRate: data.rates?.clickRate || 0,
          replyRate: data.rates?.replyRate || 0,
          bounceRate: data.rates?.bounceRate || 0,
        },
        timeline: data.timeline || [],
      };

      setAnalytics(transformed);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error fetching analytics');
    } finally {
      setIsLoading(false);
    }
  }, [mergedOptions.period, mergedOptions.startDate, mergedOptions.endDate]);

  // Initial fetch
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Auto-refresh
  useEffect(() => {
    if (!mergedOptions.autoRefresh) return;

    const interval = setInterval(fetchAnalytics, mergedOptions.refreshInterval);
    return () => clearInterval(interval);
  }, [mergedOptions.autoRefresh, mergedOptions.refreshInterval, fetchAnalytics]);

  return {
    analytics,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchAnalytics,
  };
}

/**
 * Get quick stats for today
 */
export function useTodayEmailStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return useEmailAnalytics({
    period: 'day',
    startDate: today,
    endDate: new Date(),
    autoRefresh: true,
    refreshInterval: 60 * 1000, // Every minute
  });
}

/**
 * Get weekly stats with daily breakdown
 */
export function useWeeklyEmailStats() {
  const endDate = new Date();
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  return useEmailAnalytics({
    period: 'week',
    startDate,
    endDate,
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000, // Every 5 minutes
  });
}

/**
 * Get monthly stats for reporting
 */
export function useMonthlyEmailStats() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);
  
  return useEmailAnalytics({
    period: 'month',
    startDate,
    endDate,
  });
}
