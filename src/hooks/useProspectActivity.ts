/**
 * T4.1/T4.6: Hook for fetching prospect activity with pagination
 * 
 * Fetches activity timeline from Railway with cursor-based pagination.
 * Falls back gracefully when Railway is unavailable.
 */

import { useState, useEffect, useCallback } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';
import { featureFlags } from '@/config/featureFlags';
import type { RailwayActivity, PaginatedActivityResponse } from '@/types/railway';

interface UseProspectActivityOptions {
  /** Number of activities per page */
  pageSize?: number;
  /** Auto-fetch on mount */
  autoFetch?: boolean;
}

interface UseProspectActivityReturn {
  activities: RailwayActivity[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  /** Fetch activities (resets to first page if reset=true) */
  fetchActivities: (reset?: boolean) => Promise<void>;
  /** Load next page of activities */
  loadMore: () => Promise<void>;
  /** Refresh activities (resets pagination) */
  refresh: () => Promise<void>;
}

export function useProspectActivity(
  prospectId: string | null,
  options: UseProspectActivityOptions = {}
): UseProspectActivityReturn {
  const { pageSize = 10, autoFetch = true } = options;

  const [activities, setActivities] = useState<RailwayActivity[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async (reset = false) => {
    if (!prospectId) {
      setActivities([]);
      setError(null);
      return;
    }

    // Check if Railway is enabled
    if (!featureFlags.RAILWAY_ENABLED) {
      setActivities([]);
      setError(null);
      return;
    }

    // Set loading state
    if (reset) {
      setIsLoading(true);
      setCursor(undefined);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const result = await railwayClient.activity.forProspect(prospectId, {
        limit: pageSize,
        cursor: reset ? undefined : cursor,
      });

      if (result.ok && result.data) {
        const data = result.data as PaginatedActivityResponse;
        
        if (reset) {
          setActivities(data.items);
        } else {
          setActivities(prev => [...prev, ...data.items]);
        }
        
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
        setError(null);
      } else {
        // Non-critical error - just show empty state
        if (reset) {
          setActivities([]);
        }
        setHasMore(false);
        // Only set error if it's not a 404 (no activities is not an error)
        if (result.statusCode !== 404) {
          setError(result.error || 'Failed to load activities');
        }
      }
    } catch (err) {
      console.warn('Failed to fetch activities:', err);
      if (reset) {
        setActivities([]);
      }
      setError('Failed to load activities');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [prospectId, cursor, pageSize]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    await fetchActivities(false);
  }, [hasMore, isLoadingMore, fetchActivities]);

  const refresh = useCallback(async () => {
    await fetchActivities(true);
  }, [fetchActivities]);

  // Auto-fetch on mount/prospectId change
  useEffect(() => {
    if (autoFetch && prospectId) {
      fetchActivities(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId, autoFetch]);

  return {
    activities,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    fetchActivities,
    loadMore,
    refresh,
  };
}

/**
 * Format activity type for display
 */
export function formatActivityType(type: RailwayActivity['type']): string {
  const labels: Record<RailwayActivity['type'], string> = {
    email_sent: 'Email Sent',
    email_opened: 'Email Opened',
    email_clicked: 'Link Clicked',
    email_bounced: 'Email Bounced',
    email_replied: 'Reply Received',
    meeting_booked: 'Meeting Booked',
    meeting_completed: 'Meeting Completed',
    sequence_enrolled: 'Enrolled in Sequence',
    sequence_completed: 'Sequence Completed',
    sequence_paused: 'Sequence Paused',
    note_added: 'Note Added',
    status_changed: 'Status Changed',
  };
  return labels[type] || type;
}

/**
 * Get icon for activity type
 */
export function getActivityIcon(type: RailwayActivity['type']): string {
  const icons: Record<RailwayActivity['type'], string> = {
    email_sent: '📤',
    email_opened: '👁️',
    email_clicked: '🔗',
    email_bounced: '⚠️',
    email_replied: '💬',
    meeting_booked: '📅',
    meeting_completed: '✅',
    sequence_enrolled: '📋',
    sequence_completed: '🏁',
    sequence_paused: '⏸️',
    note_added: '📝',
    status_changed: '🔄',
  };
  return icons[type] || '•';
}
