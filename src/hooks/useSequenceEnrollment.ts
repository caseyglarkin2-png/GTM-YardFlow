/**
 * useSequenceEnrollment Hook - YardFlow Hub
 * 
 * Provides functions to enroll prospects in email sequences.
 * Connects UI to SequenceSchedulerService backend.
 * 
 * Sprint 81: Enroll-in-Sequence UI
 */

import { useState, useCallback } from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  serverTimestamp,
  getFirestore
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import type { Prospect } from '../types';
import type { EmailSequence } from '../types/emailSequence';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types
// ============================================

export interface SequenceOption {
  id: string;
  name: string;
  description?: string;
  stepCount: number;
  activeProspects: number;
  status: 'active' | 'paused' | 'draft';
}

export interface EnrollmentResult {
  prospectId: string;
  prospectName: string;
  success: boolean;
  enrollmentId?: string;
  error?: string;
}

export interface UseSequenceEnrollmentReturn {
  // Available sequences
  sequences: SequenceOption[];
  isLoadingSequences: boolean;
  sequencesError: string | null;
  refreshSequences: () => Promise<void>;
  
  // Enrollment actions
  enrollProspect: (prospect: Prospect, sequenceId: string) => Promise<EnrollmentResult>;
  enrollProspects: (prospects: Prospect[], sequenceId: string) => Promise<EnrollmentResult[]>;
  isEnrolling: boolean;
  enrollmentProgress: { current: number; total: number } | null;
}

// ============================================
// Hook Implementation
// ============================================

// Get Firestore instance lazily
function getDb() {
  try {
    const app = getApp();
    return getFirestore(app);
  } catch {
    return null;
  }
}

export function useSequenceEnrollment(): UseSequenceEnrollmentReturn {
  const [sequences, setSequences] = useState<SequenceOption[]>([]);
  const [isLoadingSequences, setIsLoadingSequences] = useState(false);
  const [sequencesError, setSequencesError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentProgress, setEnrollmentProgress] = useState<{ current: number; total: number } | null>(null);

  /**
   * Fetch available sequences from Firestore
   */
  const refreshSequences = useCallback(async () => {
    setIsLoadingSequences(true);
    setSequencesError(null);
    
    try {
      const db = getDb();
      if (!db) {
        throw new Error('Firebase not configured');
      }
      const sequencesRef = collection(db, 'sequences');
      const q = query(sequencesRef, where('status', 'in', ['active', 'draft']));
      const snapshot = await getDocs(q);
      
      const loadedSequences: SequenceOption[] = snapshot.docs.map(doc => {
        const data = doc.data() as EmailSequence;
        return {
          id: doc.id,
          name: data.name,
          description: data.description,
          stepCount: data.steps?.length || 0,
          activeProspects: data.enrolledCount || 0,
          status: data.status as 'active' | 'paused' | 'draft',
        };
      });
      
      setSequences(loadedSequences);
    } catch (err) {
      console.error('Failed to load sequences:', err);
      setSequencesError(err instanceof Error ? err.message : 'Failed to load sequences');
    } finally {
      setIsLoadingSequences(false);
    }
  }, []);

  /**
   * Calculate next send time (client-side for immediate feedback)
   */
  const calculateNextSendAt = (delayDays: number = 0): Date => {
    const now = new Date();
    const sendDate = new Date(now);
    sendDate.setDate(sendDate.getDate() + delayDays);
    
    // Skip weekends
    const dayOfWeek = sendDate.getDay();
    if (dayOfWeek === 0) sendDate.setDate(sendDate.getDate() + 1);
    if (dayOfWeek === 6) sendDate.setDate(sendDate.getDate() + 2);
    
    // Set to 9:15 AM
    sendDate.setHours(9, 15, 0, 0);
    
    // If in the past, push to next business day
    if (sendDate <= now) {
      sendDate.setDate(sendDate.getDate() + 1);
      const nextDay = sendDate.getDay();
      if (nextDay === 0) sendDate.setDate(sendDate.getDate() + 1);
      if (nextDay === 6) sendDate.setDate(sendDate.getDate() + 2);
    }
    
    return sendDate;
  };

  /**
   * Enroll a single prospect in a sequence
   */
  const enrollProspect = useCallback(async (
    prospect: Prospect,
    sequenceId: string
  ): Promise<EnrollmentResult> => {
    const enrollmentId = uuidv4();
    const db = getDb();
    
    if (!db) {
      return {
        prospectId: prospect.id,
        prospectName: prospect.name,
        success: false,
        error: 'Firebase not configured',
      };
    }
    
    try {
      // Check if already enrolled
      const enrollmentsRef = collection(db, 'sequenceEnrollments');
      const existingQuery = query(
        enrollmentsRef,
        where('prospectId', '==', prospect.id),
        where('sequenceId', '==', sequenceId),
        where('status', 'in', ['active', 'paused'])
      );
      const existing = await getDocs(existingQuery);
      
      if (!existing.empty) {
        return {
          prospectId: prospect.id,
          prospectName: prospect.name,
          success: false,
          error: 'Already enrolled in this sequence',
        };
      }

      // Get first step delay
      const nextSendAt = calculateNextSendAt(0);

      // Create enrollment
      const enrollment = {
        id: enrollmentId,
        sequenceId,
        prospectId: prospect.id,
        prospectEmail: prospect.email,
        prospectName: prospect.name,
        companyName: prospect.company,
        status: 'active',
        currentStepIndex: 0,
        enrolledAt: new Date().toISOString(),
        nextSendAt: nextSendAt.toISOString(),
        stepHistory: [],
        customFields: {
          enrolledBy: 'user', // TODO: Get actual user ID
          firstName: prospect.name.split(' ')[0],
          company: prospect.company,
          title: prospect.title || '',
        },
        createdAt: serverTimestamp(),
      };

      await addDoc(enrollmentsRef, enrollment);

      return {
        prospectId: prospect.id,
        prospectName: prospect.name,
        success: true,
        enrollmentId,
      };
    } catch (err) {
      console.error('Failed to enroll prospect:', err);
      return {
        prospectId: prospect.id,
        prospectName: prospect.name,
        success: false,
        error: err instanceof Error ? err.message : 'Enrollment failed',
      };
    }
  }, []);

  /**
   * Enroll multiple prospects in a sequence (bulk operation)
   */
  const enrollProspects = useCallback(async (
    prospects: Prospect[],
    sequenceId: string
  ): Promise<EnrollmentResult[]> => {
    setIsEnrolling(true);
    setEnrollmentProgress({ current: 0, total: prospects.length });
    
    const results: EnrollmentResult[] = [];
    
    try {
      for (let i = 0; i < prospects.length; i++) {
        const prospect = prospects[i];
        const result = await enrollProspect(prospect, sequenceId);
        results.push(result);
        setEnrollmentProgress({ current: i + 1, total: prospects.length });
      }
      
      return results;
    } finally {
      setIsEnrolling(false);
      setEnrollmentProgress(null);
    }
  }, [enrollProspect]);

  return {
    sequences,
    isLoadingSequences,
    sequencesError,
    refreshSequences,
    enrollProspect,
    enrollProspects,
    isEnrolling,
    enrollmentProgress,
  };
}
