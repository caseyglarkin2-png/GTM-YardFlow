/**
 * useSequenceEnrollment Hook - YardFlow Hub
 * 
 * Provides functions to enroll prospects in email sequences.
 * Connects UI to SequenceSchedulerService backend.
 * 
 * Sprint 81: Enroll-in-Sequence UI
 * Sprint 94: T94.3a - Add Railway Enrollment API Calls
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  serverTimestamp,
  getFirestore,
  onSnapshot,
  updateDoc,
  doc
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import type { Prospect } from '../types';
import type { EmailSequence, EnrollmentStatus } from '../types/emailSequence';
import { v4 as uuidv4 } from 'uuid';
import { railwayClient } from '@/services/RailwayApiClient';
import { featureFlags } from '@/config/featureFlags';

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

/**
 * Lightweight enrollment info for display in prospect rows
 */
export interface ProspectEnrollmentInfo {
  enrollmentId: string;
  sequenceId: string;
  sequenceName?: string;
  status: EnrollmentStatus;
  currentStepIndex: number;
  totalSteps: number;
  nextSendAt?: string;
}

export interface UseSequenceEnrollmentReturn {
  // Available sequences
  sequences: SequenceOption[];
  isLoadingSequences: boolean;
  sequencesError: string | null;
  refreshSequences: () => Promise<void>;
  
  // Enrollment tracking
  enrollments: Map<string, ProspectEnrollmentInfo>;
  getEnrollmentForProspect: (prospectId: string) => ProspectEnrollmentInfo | null;
  
  // Enrollment actions
  enrollProspect: (prospect: Prospect, sequenceId: string) => Promise<EnrollmentResult>;
  enrollProspects: (prospects: Prospect[], sequenceId: string) => Promise<EnrollmentResult[]>;
  pauseEnrollment: (enrollmentId: string, reason?: string) => Promise<void>;
  resumeEnrollment: (enrollmentId: string) => Promise<void>;
  cancelEnrollment: (enrollmentId: string) => Promise<void>;
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
  const [enrollments, setEnrollments] = useState<Map<string, ProspectEnrollmentInfo>>(new Map());
  
  // Ref for Railway polling interval
  const railwayPollRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Poll Railway for enrollment updates (T94.3b)
   */
  useEffect(() => {
    if (!featureFlags.RAILWAY_ENABLED) return;

    const pollEnrollments = async () => {
      try {
        const result = await railwayClient.enrollments.list({ 
          status: 'active' 
        });

        if (result.ok && result.data) {
          const newEnrollments = new Map<string, ProspectEnrollmentInfo>();

          for (const enrollment of result.data) {
            const sequenceDoc = sequences.find(s => s.id === enrollment.sequenceId);

            newEnrollments.set(enrollment.prospectId, {
              enrollmentId: enrollment.id,
              sequenceId: enrollment.sequenceId,
              sequenceName: sequenceDoc?.name,
              status: enrollment.status as EnrollmentStatus,
              currentStepIndex: enrollment.currentStepIndex,
              totalSteps: enrollment.totalSteps ?? sequenceDoc?.stepCount ?? 4,
              nextSendAt: enrollment.nextSendAt ?? enrollment.nextStepAt ?? undefined,
            });
          }

          setEnrollments(newEnrollments);
        }
      } catch (err) {
        console.error('Failed to poll enrollments from Railway:', err);
      }
    };

    // Initial poll
    pollEnrollments();

    // Poll every 5 seconds
    railwayPollRef.current = setInterval(pollEnrollments, 5000);

    return () => {
      if (railwayPollRef.current) {
        clearInterval(railwayPollRef.current);
      }
    };
  }, [sequences]);

  /**
   * Set up real-time listener for active enrollments (Firestore fallback)
   */
  useEffect(() => {
    // Skip Firestore listener if Railway is enabled and not in dual-write mode
    if (featureFlags.RAILWAY_ENABLED && !featureFlags.DUAL_WRITE_ENABLED) return;

    const db = getDb();
    if (!db) return;

    const enrollmentsRef = collection(db, 'sequenceEnrollments');
    const activeQuery = query(
      enrollmentsRef,
      where('status', 'in', ['active', 'paused'])
    );

    const unsubscribe = onSnapshot(activeQuery, async (snapshot) => {
      const newEnrollments = new Map<string, ProspectEnrollmentInfo>();
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const sequenceDoc = sequences.find(s => s.id === data.sequenceId);
        
        newEnrollments.set(data.prospectId, {
          enrollmentId: docSnap.id,
          sequenceId: data.sequenceId,
          sequenceName: sequenceDoc?.name,
          status: data.status,
          currentStepIndex: data.currentStepIndex || 0,
          totalSteps: sequenceDoc?.stepCount || 4,
          nextSendAt: data.nextSendAt,
        });
      }
      
      setEnrollments(newEnrollments);
    }, (error) => {
      console.error('Error listening to enrollments:', error);
    });

    return () => unsubscribe();
  }, [sequences]);

  /**
   * Get enrollment info for a specific prospect
   */
  const getEnrollmentForProspect = useCallback((prospectId: string): ProspectEnrollmentInfo | null => {
    return enrollments.get(prospectId) || null;
  }, [enrollments]);

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
    
    // Try Railway first if enabled
    if (featureFlags.RAILWAY_ENABLED) {
      try {
        const result = await railwayClient.enrollments.create({
          prospectId: prospect.id,
          sequenceId,
        });

        if (result.ok && result.data) {
          // Update local state with new enrollment
          setEnrollments(prev => {
            const updated = new Map(prev);
            updated.set(prospect.id, {
              enrollmentId: result.data!.id,
              sequenceId,
              sequenceName: sequences.find(s => s.id === sequenceId)?.name,
              status: result.data!.status as EnrollmentStatus,
              currentStepIndex: result.data!.currentStepIndex,
              totalSteps: result.data!.totalSteps ?? 4,
              nextSendAt: result.data!.nextSendAt ?? result.data!.nextStepAt ?? undefined,
            });
            return updated;
          });

          return {
            prospectId: prospect.id,
            prospectName: prospect.name,
            success: true,
            enrollmentId: result.data.id,
          };
        } else {
          // Railway call failed, fall through to Firestore if dual-write
          console.warn('Railway enrollment failed:', result.error);
          if (!featureFlags.DUAL_WRITE_ENABLED) {
            return {
              prospectId: prospect.id,
              prospectName: prospect.name,
              success: false,
              error: result.error || 'Railway enrollment failed',
            };
          }
        }
      } catch (err) {
        console.error('Railway enrollment error:', err);
        if (!featureFlags.DUAL_WRITE_ENABLED) {
          return {
            prospectId: prospect.id,
            prospectName: prospect.name,
            success: false,
            error: err instanceof Error ? err.message : 'Railway enrollment failed',
          };
        }
      }
    }

    // Firestore fallback
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

  /**
   * Pause an enrollment (manual pause)
   */
  const pauseEnrollment = useCallback(async (enrollmentId: string, reason?: string): Promise<void> => {
    // Try Railway first if enabled
    if (featureFlags.RAILWAY_ENABLED) {
      const result = await railwayClient.enrollments.pause(enrollmentId, reason);
      if (result.ok) {
        // Update local state
        setEnrollments(prev => {
          const updated = new Map(prev);
          for (const [prospectId, enrollment] of updated) {
            if (enrollment.enrollmentId === enrollmentId) {
              updated.set(prospectId, { ...enrollment, status: 'paused' });
              break;
            }
          }
          return updated;
        });
        if (!featureFlags.DUAL_WRITE_ENABLED) return;
      } else if (!featureFlags.DUAL_WRITE_ENABLED) {
        throw new Error(result.error || 'Failed to pause enrollment');
      }
    }

    // Firestore fallback
    const db = getDb();
    if (!db) throw new Error('Firebase not configured');
    
    const enrollmentRef = doc(db, 'sequenceEnrollments', enrollmentId);
    await updateDoc(enrollmentRef, {
      status: 'paused',
      pausedAt: new Date().toISOString(),
      pauseReason: reason || 'manual',
      nextSendAt: null,
    });
  }, []);

  /**
   * Resume a paused enrollment
   */
  const resumeEnrollment = useCallback(async (enrollmentId: string): Promise<void> => {
    // Try Railway first if enabled
    if (featureFlags.RAILWAY_ENABLED) {
      const result = await railwayClient.enrollments.resume(enrollmentId);
      if (result.ok) {
        // Update local state
        setEnrollments(prev => {
          const updated = new Map(prev);
          for (const [prospectId, enrollment] of updated) {
            if (enrollment.enrollmentId === enrollmentId) {
              updated.set(prospectId, { ...enrollment, status: 'active' });
              break;
            }
          }
          return updated;
        });
        if (!featureFlags.DUAL_WRITE_ENABLED) return;
      } else if (!featureFlags.DUAL_WRITE_ENABLED) {
        throw new Error(result.error || 'Failed to resume enrollment');
      }
    }

    // Firestore fallback
    const db = getDb();
    if (!db) throw new Error('Firebase not configured');
    
    // Calculate next send at (resume immediately or next business day)
    const nextSendAt = new Date();
    nextSendAt.setHours(9, 15, 0, 0);
    if (nextSendAt <= new Date()) {
      nextSendAt.setDate(nextSendAt.getDate() + 1);
    }
    // Skip weekends
    if (nextSendAt.getDay() === 0) nextSendAt.setDate(nextSendAt.getDate() + 1);
    if (nextSendAt.getDay() === 6) nextSendAt.setDate(nextSendAt.getDate() + 2);
    
    const enrollmentRef = doc(db, 'sequenceEnrollments', enrollmentId);
    await updateDoc(enrollmentRef, {
      status: 'active',
      pausedAt: null,
      pauseReason: null,
      nextSendAt: nextSendAt.toISOString(),
    });
  }, []);

  /**
   * Cancel an enrollment (stops sequence permanently)
   */
  const cancelEnrollment = useCallback(async (enrollmentId: string): Promise<void> => {
    // Try Railway first if enabled
    if (featureFlags.RAILWAY_ENABLED) {
      const result = await railwayClient.enrollments.cancel(enrollmentId);
      if (result.ok) {
        // Remove from local state
        setEnrollments(prev => {
          const updated = new Map(prev);
          for (const [prospectId, enrollment] of updated) {
            if (enrollment.enrollmentId === enrollmentId) {
              updated.delete(prospectId);
              break;
            }
          }
          return updated;
        });
        if (!featureFlags.DUAL_WRITE_ENABLED) return;
      } else if (!featureFlags.DUAL_WRITE_ENABLED) {
        throw new Error(result.error || 'Failed to cancel enrollment');
      }
    }

    // Firestore fallback
    const db = getDb();
    if (!db) throw new Error('Firebase not configured');
    
    const enrollmentRef = doc(db, 'sequenceEnrollments', enrollmentId);
    await updateDoc(enrollmentRef, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      pauseReason: 'cancelled_by_user',
      nextSendAt: null,
    });
  }, []);

  return {
    sequences,
    isLoadingSequences,
    sequencesError,
    refreshSequences,
    enrollments,
    getEnrollmentForProspect,
    enrollProspect,
    enrollProspects,
    pauseEnrollment,
    resumeEnrollment,
    cancelEnrollment,
    isEnrolling,
    enrollmentProgress,
  };
}
