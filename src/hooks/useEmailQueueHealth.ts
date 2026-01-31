/**
 * useEmailQueueHealth Hook
 * 
 * Sprint 95: T95.5 - Email Queue Status UI
 * Sprint 2: T2.1 - Enhanced with bounce rate and retry statistics
 * 
 * Provides real-time email queue health information from Railway.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';
import { featureFlags } from '@/config/featureFlags';
import type { EmailQueueStatusResponse } from '@/types/railway';

// =============================================================================
// Types
// =============================================================================

export interface EmailQueueHealth {
  /** Overall health status */
  health: 'healthy' | 'degraded' | 'critical' | 'unknown';
  /** Number of pending emails in queue */
  pending: number;
  /** Number of emails currently being processed */
  processing: number;
  /** Number of emails sent today (UTC) */
  sentToday: number;
  /** Number of failed emails in dead letter queue */
  failed: number;
  /** Number of bounced emails today */
  bounced: number;
  /** Bounce rate as percentage (0-100) */
  bounceRate: number;
  /** Number of emails currently being retried */
  retrying: number;
  /** Retry rate as percentage of failed that are being retried */
  retryRate: number;
  /** Oldest job age in seconds (null if queue is empty) */
  oldestJobAgeSeconds: number | null;
  /** Processing rate (emails per minute) */
  processingRate: number;
  /** Last update timestamp */
  lastUpdated: Date;
  /** Error message if health check failed */
  error: string | null;
}

export interface UseEmailQueueHealthOptions {
  /** Poll interval in ms (default: 30000 = 30 seconds) */
  pollInterval?: number;
  /** Auto-start polling (default: true) */
  autoStart?: boolean;
}

export interface UseEmailQueueHealthReturn {
  data: EmailQueueHealth;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

const DEFAULT_HEALTH: EmailQueueHealth = {
  health: 'unknown',
  pending: 0,
  processing: 0,
  sentToday: 0,
  failed: 0,
  bounced: 0,
  bounceRate: 0,
  retrying: 0,
  retryRate: 0,
  oldestJobAgeSeconds: null,
  processingRate: 0,
  lastUpdated: new Date(),
  error: null,
};

/**
 * Determine health status based on queue metrics
 */
function calculateHealth(status: EmailQueueStatusResponse): EmailQueueHealth['health'] {
  const emailQueue = status.queues.emails;
  
  // Critical: Too many failures
  if (status.deadLetterCount > 10) {
    return 'critical';
  }

  // Degraded: Queue is backing up
  if (emailQueue.waiting > 100 || emailQueue.delayed > 50) {
    return 'degraded';
  }

  return 'healthy';
}

export function useEmailQueueHealth(
  options: UseEmailQueueHealthOptions = {}
): UseEmailQueueHealthReturn {
  const { pollInterval = 30000, autoStart = true } = options;

  const [data, setData] = useState<EmailQueueHealth>(DEFAULT_HEALTH);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchHealth = useCallback(async (): Promise<void> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      setData({
        ...DEFAULT_HEALTH,
        health: 'unknown',
        error: 'Railway is disabled',
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch queue status and analytics in parallel
      const [queueResult, analyticsResult] = await Promise.all([
        railwayClient.email.queue.status(),
        railwayClient.email.analytics({ period: 'day' }),
      ]);

      if (!mountedRef.current) return;

      if (queueResult.ok && queueResult.data) {
        const status = queueResult.data;
        const emailQueue = status.queues.emails;
        
        // Extract analytics data if available
        const analytics = analyticsResult.ok ? analyticsResult.data : null;
        const bounced = analytics?.metrics?.bounced ?? 0;
        const sent = analytics?.metrics?.sent ?? emailQueue.completed;
        const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0;
        
        // Calculate retry rate (delayed emails vs failed)
        const retrying = emailQueue.delayed;
        const totalFailed = emailQueue.failed + status.deadLetterCount;
        const retryRate = totalFailed > 0 ? (retrying / totalFailed) * 100 : 0;
        
        setData({
          health: calculateHealth(status),
          pending: emailQueue.waiting + emailQueue.delayed,
          processing: emailQueue.active,
          sentToday: emailQueue.completed,
          failed: status.deadLetterCount,
          bounced,
          bounceRate: Math.round(bounceRate * 10) / 10,
          retrying,
          retryRate: Math.round(retryRate * 10) / 10,
          oldestJobAgeSeconds: null,
          processingRate: 0,
          lastUpdated: new Date(),
          error: null,
        });
      } else {
        throw new Error(queueResult.error || 'Failed to fetch queue status');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(err instanceof Error ? err : new Error(errorMessage));
      setData(prev => ({
        ...prev,
        health: 'unknown',
        error: errorMessage,
        lastUpdated: new Date(),
      }));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;

    // Initial fetch
    fetchHealth();

    // Set up polling
    pollRef.current = setInterval(fetchHealth, pollInterval);
  }, [fetchHealth, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Auto-start polling on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoStart) {
      startPolling();
    }

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [autoStart, startPolling, stopPolling]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchHealth,
    startPolling,
    stopPolling,
  };
}

export default useEmailQueueHealth;
