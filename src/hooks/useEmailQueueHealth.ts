/**
 * useEmailQueueHealth Hook
 * 
 * Sprint 95: T95.5 - Email Queue Status UI
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
      const result = await railwayClient.email.queue.status();

      if (!mountedRef.current) return;

      if (result.ok && result.data) {
        const status = result.data;
        const emailQueue = status.queues.emails;
        
        setData({
          health: calculateHealth(status),
          pending: emailQueue.waiting + emailQueue.delayed,
          processing: emailQueue.active,
          sentToday: emailQueue.completed, // Best approximation
          failed: status.deadLetterCount,
          oldestJobAgeSeconds: null, // Not in current type
          processingRate: 0, // Not in current type
          lastUpdated: new Date(),
          error: null,
        });
      } else {
        throw new Error(result.error || 'Failed to fetch queue status');
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
