/**
 * useInboxReplies Hook
 * Sprint 201: Reply Inbox Feature
 * 
 * Provides access to prospects that need a response (received email replies).
 * Queries prospects where needsResponse=true and provides mark-as-handled action.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  getFirestore,
  type DocumentData,
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import type { Prospect } from '@/types/firestore';

// =============================================================================
// Types
// =============================================================================

export interface InboxReply {
  id: string;
  prospectId: string;
  prospectName: string;
  prospectEmail: string;
  company: string;
  lastReplyAt: number;
  lastReplyType: 'human_reply' | 'out_of_office' | 'unsubscribe' | 'bounce';
  lastReplyId?: string;
  prospect: Prospect;
}

export interface UseInboxRepliesOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  /** Poll interval in ms (0 = disabled) */
  pollInterval?: number;
  /** Max results to fetch */
  limit?: number;
}

export interface UseInboxRepliesReturn {
  /** List of prospects needing response */
  replies: InboxReply[];
  /** Total count of unhandled replies */
  unhandledCount: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Mark a reply as handled */
  markAsHandled: (prospectId: string) => Promise<boolean>;
  /** Mark all replies as handled */
  markAllAsHandled: () => Promise<boolean>;
  /** Refresh the list */
  refresh: () => Promise<void>;
}

// =============================================================================
// Helper
// =============================================================================

function getDb() {
  try {
    const app = getApp();
    return getFirestore(app);
  } catch {
    return null;
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useInboxReplies(options: UseInboxRepliesOptions = {}): UseInboxRepliesReturn {
  const {
    autoFetch = true,
    pollInterval = 60000, // 1 minute default
    limit: maxResults = 50,
  } = options;

  // State
  const [replies, setReplies] = useState<InboxReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);

  /**
   * Fetch prospects that need a response
   */
  const fetchReplies = useCallback(async () => {
    const db = getDb();
    if (!db) {
      setError(new Error('Firestore not available'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const prospectsRef = collection(db, 'prospects');
      const q = query(
        prospectsRef,
        where('needsResponse', '==', true),
        orderBy('lastReplyAt', 'desc'),
        limit(maxResults)
      );

      const snapshot = await getDocs(q);

      if (!isMounted.current) return;

      const inboxReplies: InboxReply[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as DocumentData;
        const prospect = { id: docSnap.id, ...data } as Prospect;
        
        return {
          id: docSnap.id,
          prospectId: docSnap.id,
          prospectName: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown',
          prospectEmail: data.email || '',
          company: data.company || 'Unknown',
          lastReplyAt: data.lastReplyAt || Date.now(),
          lastReplyType: (data.lastReplyType as InboxReply['lastReplyType']) || 'human_reply',
          lastReplyId: data.lastReplyId,
          prospect,
        };
      });

      setReplies(inboxReplies);
    } catch (err) {
      if (!isMounted.current) return;
      setError(err instanceof Error ? err : new Error('Failed to fetch replies'));
      console.error('[useInboxReplies] Failed to fetch:', err);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [maxResults]);

  /**
   * Mark a single reply as handled
   */
  const markAsHandled = useCallback(async (prospectId: string): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;

    try {
      const prospectRef = doc(db, 'prospects', prospectId);
      await updateDoc(prospectRef, {
        needsResponse: false,
        responseHandledAt: Date.now(),
      });

      // Optimistic update
      setReplies(prev => prev.filter(r => r.prospectId !== prospectId));
      return true;
    } catch (err) {
      console.error('[useInboxReplies] Failed to mark as handled:', err);
      return false;
    }
  }, []);

  /**
   * Mark all replies as handled
   */
  const markAllAsHandled = useCallback(async (): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;

    try {
      if (replies.length === 0) return true;

      const batch = writeBatch(db);
      const now = Date.now();

      replies.forEach(reply => {
        const prospectRef = doc(db, 'prospects', reply.prospectId);
        batch.update(prospectRef, {
          needsResponse: false,
          responseHandledAt: now,
        });
      });

      await batch.commit();
      setReplies([]);
      return true;
    } catch (err) {
      console.error('[useInboxReplies] Failed to mark all as handled:', err);
      return false;
    }
  }, [replies]);

  /**
   * Refresh function
   */
  const refresh = useCallback(async () => {
    await fetchReplies();
  }, [fetchReplies]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchReplies();
    }
  }, [autoFetch, fetchReplies]);

  // Poll for updates
  useEffect(() => {
    if (!pollInterval) return;

    const interval = setInterval(fetchReplies, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval, fetchReplies]);

  // Cleanup
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    replies,
    unhandledCount: replies.length,
    isLoading,
    error,
    markAsHandled,
    markAllAsHandled,
    refresh,
  };
}

export default useInboxReplies;
