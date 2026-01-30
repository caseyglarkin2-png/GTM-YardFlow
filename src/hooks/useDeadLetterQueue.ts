/**
 * useDeadLetterQueue Hook
 * 
 * Sprint 95: T95.6 - Dead Letter Queue UI
 * 
 * Manages failed emails in the dead letter queue.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';
import { featureFlags } from '@/config/featureFlags';
import type { DeadLetterItem } from '@/types/railway';

// =============================================================================
// Types
// =============================================================================

export interface UseDeadLetterQueueOptions {
  /** Poll interval in ms (default: 60000 = 1 minute) */
  pollInterval?: number;
  /** Auto-start polling (default: true) */
  autoStart?: boolean;
}

export interface UseDeadLetterQueueReturn {
  /** List of failed emails */
  failedEmails: DeadLetterItem[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Retry a specific failed email */
  retryEmail: (jobId: string) => Promise<boolean>;
  /** Retry all failed emails */
  retryAll: () => Promise<{ retried: number }>;
  /** Discard a failed email (remove from queue) */
  discardEmail: (jobId: string) => Promise<boolean>;
  /** Refresh the dead letter queue */
  refresh: () => Promise<void>;
  /** Processing state for retry operations */
  isRetrying: boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useDeadLetterQueue(
  options: UseDeadLetterQueueOptions = {}
): UseDeadLetterQueueReturn {
  const { pollInterval = 60000, autoStart = true } = options;

  const [failedEmails, setFailedEmails] = useState<DeadLetterItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // ---------------------------------------------------------------------------
  // Fetch dead letter queue
  // ---------------------------------------------------------------------------

  const fetchDeadLetter = useCallback(async (): Promise<void> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await railwayClient.email.queue.deadLetter();

      if (!mountedRef.current) return;

      if (result.ok && result.data) {
        setFailedEmails(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch dead letter queue');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Retry operations
  // ---------------------------------------------------------------------------

  const retryEmail = useCallback(async (jobId: string): Promise<boolean> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      return false;
    }

    setIsRetrying(true);

    try {
      const result = await railwayClient.email.queue.retry(jobId);

      if (result.ok) {
        // Remove from local list (optimistic)
        setFailedEmails(prev => prev.filter(e => e.id !== jobId));
        return true;
      } else {
        console.error('Failed to retry email:', result.error);
        return false;
      }
    } catch (err) {
      console.error('Error retrying email:', err);
      return false;
    } finally {
      setIsRetrying(false);
    }
  }, []);

  const retryAll = useCallback(async (): Promise<{ retried: number }> => {
    if (!featureFlags.RAILWAY_ENABLED) {
      return { retried: 0 };
    }

    setIsRetrying(true);

    try {
      const result = await railwayClient.email.queue.retryAll();

      if (result.ok && result.data) {
        // Clear local list
        setFailedEmails([]);
        return { retried: result.data.retried };
      } else {
        console.error('Failed to retry all emails:', result.error);
        return { retried: 0 };
      }
    } catch (err) {
      console.error('Error retrying all emails:', err);
      return { retried: 0 };
    } finally {
      setIsRetrying(false);
      // Refresh to get accurate state
      fetchDeadLetter();
    }
  }, [fetchDeadLetter]);

  const discardEmail = useCallback(async (jobId: string): Promise<boolean> => {
    // Note: This would need a discard endpoint in Railway API
    // For now, we just remove from local state
    setFailedEmails(prev => prev.filter(e => e.id !== jobId));
    return true;
  }, []);

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    if (autoStart && featureFlags.RAILWAY_ENABLED) {
      // Initial fetch
      fetchDeadLetter();

      // Set up polling
      pollRef.current = setInterval(fetchDeadLetter, pollInterval);
    }

    return () => {
      mountedRef.current = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [autoStart, pollInterval, fetchDeadLetter]);

  return {
    failedEmails,
    isLoading,
    error,
    retryEmail,
    retryAll,
    discardEmail,
    refresh: fetchDeadLetter,
    isRetrying,
  };
}

export default useDeadLetterQueue;
