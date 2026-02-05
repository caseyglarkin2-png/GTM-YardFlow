/**
 * useWarmupStatus Hook
 * 
 * Sprint 38F: Display email warmup limits and daily send quotas
 * 
 * Shows users their current warmup stage and how many emails they can send today.
 * Helps prevent hitting rate limits during bulk sends.
 */

import { useState, useEffect, useCallback } from 'react';
import { featureFlags } from '../config/featureFlags';

/**
 * Warmup schedule - conservative limits to protect sender reputation
 * 
 * Note: Set BYPASS_EMAIL_WARMUP=true in env to skip limits for verified domains
 */
const WARMUP_SCHEDULE = [
  { week: 1, dailyLimit: 50 },
  { week: 2, dailyLimit: 100 },
  { week: 3, dailyLimit: 250 },
  { week: 4, dailyLimit: 500 },
  { week: 5, dailyLimit: 1000 },  // Mature sender
] as const;

export interface WarmupStatus {
  /** Current warmup week (1-5+) */
  week: number;
  /** Daily send limit for current week */
  dailyLimit: number;
  /** Emails sent today */
  sentToday: number;
  /** Remaining sends allowed today */
  remaining: number;
  /** Can user send more emails today? */
  canSend: boolean;
  /** Is warmup bypassed (for verified domains)? */
  isBypassed: boolean;
  /** Percentage of daily limit used */
  usagePercent: number;
  /** Human-readable status message */
  message: string;
}

export interface UseWarmupStatusOptions {
  /** Auto-refresh interval in ms (default: 60000 = 1 min) */
  refreshInterval?: number;
  /** Whether to auto-refresh */
  autoRefresh?: boolean;
}

export interface UseWarmupStatusReturn {
  status: WarmupStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Calculate warmup week based on account creation date
 */
function calculateWarmupWeek(accountCreatedAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - accountCreatedAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return Math.min(week, 5); // Cap at week 5 (mature)
}

/**
 * Get daily limit for a given warmup week
 */
function getDailyLimit(week: number): number {
  const schedule = WARMUP_SCHEDULE.find(s => s.week === week);
  return schedule?.dailyLimit ?? WARMUP_SCHEDULE[WARMUP_SCHEDULE.length - 1].dailyLimit;
}

export function useWarmupStatus(options: UseWarmupStatusOptions = {}): UseWarmupStatusReturn {
  const { refreshInterval = 60000, autoRefresh = true } = options;
  
  const [status, setStatus] = useState<WarmupStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if warmup is bypassed via feature flag or env
      const isBypassed = featureFlags.BYPASS_EMAIL_WARMUP ?? false;
      
      // Fetch today's send count from local stats endpoint
      const response = await fetch('/api/email/stats?period=today');
      
      if (!response.ok) {
        throw new Error('Failed to fetch email stats');
      }
      
      const data = await response.json();
      const sentToday = data.sent ?? data.total ?? 0;
      
      // For now, assume account is 2 weeks old (Week 2 = 100/day)
      // TODO: Get actual account creation date from user profile
      const week = 2;
      const dailyLimit = isBypassed ? Infinity : getDailyLimit(week);
      const remaining = Math.max(0, dailyLimit - sentToday);
      const usagePercent = dailyLimit === Infinity ? 0 : Math.round((sentToday / dailyLimit) * 100);
      
      const statusMessage = isBypassed 
        ? 'Warmup bypassed - unlimited sending'
        : remaining === 0
          ? `Daily limit reached (${dailyLimit}/day)`
          : `${remaining} of ${dailyLimit} remaining today`;

      setStatus({
        week,
        dailyLimit,
        sentToday,
        remaining,
        canSend: remaining > 0 || isBypassed,
        isBypassed,
        usagePercent,
        message: statusMessage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Set default status on error
      setStatus({
        week: 1,
        dailyLimit: 50,
        sentToday: 0,
        remaining: 50,
        canSend: true,
        isBypassed: false,
        usagePercent: 0,
        message: 'Unable to fetch status',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchStatus]);

  return {
    status,
    isLoading,
    error,
    refresh: fetchStatus,
  };
}

/**
 * Get warmup schedule for display
 */
export function getWarmupSchedule(): typeof WARMUP_SCHEDULE {
  return WARMUP_SCHEDULE;
}

/**
 * Check if a send count would exceed limits
 */
export function wouldExceedLimit(
  currentSent: number, 
  toSend: number, 
  dailyLimit: number,
  isBypassed: boolean
): boolean {
  if (isBypassed) return false;
  return (currentSent + toSend) > dailyLimit;
}
