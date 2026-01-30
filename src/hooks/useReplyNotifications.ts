/**
 * useReplyNotifications Hook - YardFlow Hub
 * 
 * Sprint 83.6: Real-time notifications when prospects reply.
 * Listens to reply events and shows toast notifications.
 */

import { useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  doc,
  getDoc,
  getFirestore
} from 'firebase/firestore';
import { getApp } from 'firebase/app';

// ============================================
// Types
// ============================================

export interface ReplyEvent {
  id: string;
  enrollmentId: string;
  prospectEmail: string;
  prospectName?: string;
  subject: string;
  textSnippet?: string;
  receivedAt: string;
}

export interface UseReplyNotificationsOptions {
  onNewReply?: (reply: ReplyEvent) => void;
  showToast?: (type: 'success' | 'info', title: string, message: string) => void;
  enabled?: boolean;
}

// ============================================
// Helper
// ============================================

function getDb() {
  try {
    const app = getApp();
    return getFirestore(app);
  } catch {
    return null;
  }
}

// ============================================
// Hook
// ============================================

export function useReplyNotifications({
  onNewReply,
  showToast,
  enabled = true,
}: UseReplyNotificationsOptions = {}): void {
  // Track seen reply IDs to avoid duplicate notifications
  const seenRepliesRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  const handleNewReply = useCallback(async (reply: ReplyEvent) => {
    // Skip if we've already seen this reply
    if (seenRepliesRef.current.has(reply.id)) return;
    seenRepliesRef.current.add(reply.id);

    // Skip notifications during initial load
    if (isInitialLoadRef.current) return;

    // Call custom handler
    onNewReply?.(reply);

    // Show toast notification
    if (showToast) {
      const prospectName = reply.prospectName || reply.prospectEmail.split('@')[0];
      showToast(
        'success',
        '💬 New Reply!',
        `${prospectName} replied: "${reply.subject}"`
      );
    }
  }, [onNewReply, showToast]);

  useEffect(() => {
    if (!enabled) return;

    const db = getDb();
    if (!db) return;

    // Query for recent reply events (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const repliesRef = collection(db, 'email_events');
    const q = query(
      repliesRef,
      where('type', '==', 'reply'),
      where('receivedAt', '>=', oneDayAgo),
      orderBy('receivedAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Process each reply
      for (const docChange of snapshot.docChanges()) {
        if (docChange.type === 'added') {
          const data = docChange.doc.data();
          
          // Get prospect name from enrollment if available
          let prospectName = data.prospectName;
          if (!prospectName && data.enrollmentId) {
            try {
              const enrollmentDoc = await getDoc(doc(db, 'sequenceEnrollments', data.enrollmentId));
              if (enrollmentDoc.exists()) {
                prospectName = enrollmentDoc.data()?.prospectName;
              }
            } catch {
              // Ignore errors fetching enrollment
            }
          }

          const reply: ReplyEvent = {
            id: docChange.doc.id,
            enrollmentId: data.enrollmentId,
            prospectEmail: data.prospectEmail,
            prospectName,
            subject: data.subject || '(no subject)',
            textSnippet: data.textSnippet,
            receivedAt: data.receivedAt,
          };

          handleNewReply(reply);
        }
      }

      // After initial load, enable notifications
      isInitialLoadRef.current = false;
    }, (error) => {
      console.error('Error listening for replies:', error);
    });

    return () => unsubscribe();
  }, [enabled, handleNewReply]);
}
