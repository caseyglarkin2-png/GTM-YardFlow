/**
 * MeetingAttributionService - YardFlow Hub
 * 
 * Sprint 84.2: Track when replies lead to meetings
 * and attribute to the sequence/template that caused them.
 */

import { 
  collection, 
  doc, 
  setDoc, 
  query, 
  where, 
  getDocs,
  getFirestore,
  orderBy,
  limit
} from 'firebase/firestore';
import { getApp } from 'firebase/app';

// ============================================
// Types
// ============================================

export interface MeetingAttribution {
  id: string;
  prospectId: string;
  prospectName: string;
  prospectEmail: string;
  companyName: string;
  
  // Attribution chain
  sequenceId?: string;
  sequenceName?: string;
  enrollmentId?: string;
  stepIndex?: number;
  templateId?: string;
  emailSentAt?: string;
  replyReceivedAt?: string;
  
  // First-touch attribution (T84.5)
  firstTouchEmailId?: string;
  firstTouchTemplateId?: string;
  
  // Meeting details
  meetingBookedAt: string;
  meetingScheduledFor?: string;
  meetingType?: 'discovery' | 'demo' | 'follow_up' | 'other';
  notes?: string;
  
  // Tracking
  attributedBy: string;
  createdAt: string;
}

export interface MeetingStats {
  thisWeek: number;
  lastWeek: number;
  thisMonth: number;
  total: number;
  bySequence: Record<string, number>;
  weekOverWeekChange: number;
}

export interface SequencePerformance {
  sequenceId: string;
  sequenceName: string;
  enrolled: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  meetings: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  conversionRate: number;
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

function getStartOfWeek(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// ============================================
// Service Functions
// ============================================

interface RecordMeetingParams {
  prospectId: string;
  prospectName: string;
  prospectEmail?: string;
  companyName: string;
  meetingDate?: Date;
  meetingScheduledFor?: string;
  meetingType?: MeetingAttribution['meetingType'];
  notes?: string;
  attributedBy?: string;
  // Pre-computed attribution (from caller)
  sequenceId?: string;
  sequenceName?: string;
  enrollmentId?: string;
  stepNumber?: number;
  firstTouchEmailId?: string;
  firstTouchTemplateId?: string;
}

/**
 * Record a meeting booked, with attribution to sequence if available
 */
export async function recordMeeting(params: RecordMeetingParams): Promise<MeetingAttribution | null> {
  const db = getDb();
  if (!db) return null;

  const {
    prospectId,
    prospectName,
    prospectEmail = '',
    companyName,
    meetingDate,
    meetingScheduledFor,
    meetingType,
    notes,
    attributedBy = 'user',
    sequenceId: providedSequenceId,
    sequenceName: providedSequenceName,
    enrollmentId,
    stepNumber,
    firstTouchEmailId,
    firstTouchTemplateId,
  } = params;

  const now = new Date().toISOString();
  const meetingId = `meeting_${Date.now()}_${prospectId}`;

  // Use provided attribution or try to find it
  let sequenceAttribution: Partial<MeetingAttribution> = {};
  
  if (providedSequenceId) {
    // Use the provided attribution
    sequenceAttribution = {
      sequenceId: providedSequenceId,
      sequenceName: providedSequenceName || providedSequenceId,
      stepIndex: stepNumber,
      templateId: firstTouchTemplateId,
    };
  } else {
    // Try to find attribution from sequence enrollment
    try {
      // Look for the most recent enrollment for this prospect
      const enrollmentsRef = collection(db, 'sequenceEnrollments');
      const enrollmentQuery = query(
        enrollmentsRef,
        where('prospectId', '==', prospectId),
        where('status', 'in', ['replied', 'active', 'paused', 'completed']),
        orderBy('enrolledAt', 'desc'),
        limit(1)
      );
      
      const enrollmentSnap = await getDocs(enrollmentQuery);
      
      if (!enrollmentSnap.empty) {
        const enrollment = enrollmentSnap.docs[0].data();
        
        // Get sequence name
        let seqName = '';
        try {
          const sequenceDoc = await getDocs(
            query(collection(db, 'sequences'), where('__name__', '==', enrollment.sequenceId))
          );
          if (!sequenceDoc.empty) {
            seqName = sequenceDoc.docs[0].data().name;
          }
        } catch {
          // Ignore errors fetching sequence name
        }

        sequenceAttribution = {
          sequenceId: enrollment.sequenceId,
          sequenceName: seqName || enrollment.sequenceId,
          stepIndex: enrollment.currentStepIndex,
          emailSentAt: enrollment.lastSentAt,
        };

        // Look for reply event
        const replyQuery = query(
          collection(db, 'email_events'),
          where('type', '==', 'reply'),
          where('enrollmentId', '==', enrollmentSnap.docs[0].id),
          limit(1)
        );
        const replySnap = await getDocs(replyQuery);
        if (!replySnap.empty) {
          sequenceAttribution.replyReceivedAt = replySnap.docs[0].data().receivedAt;
        }
      }
    } catch (err) {
      console.error('Error finding sequence attribution:', err);
    }
  }

  const meeting: MeetingAttribution = {
    id: meetingId,
    prospectId,
    prospectName,
    prospectEmail,
    companyName,
    ...sequenceAttribution,
    enrollmentId,
    firstTouchEmailId,
    firstTouchTemplateId,
    meetingBookedAt: now,
    meetingScheduledFor: meetingScheduledFor || (meetingDate ? meetingDate.toISOString() : undefined),
    meetingType,
    notes,
    attributedBy,
    createdAt: now,
  };

  await setDoc(doc(db, 'meetings', meetingId), meeting);

  return meeting;
}

/**
 * Get meeting statistics for dashboard
 */
export async function getMeetingStats(): Promise<MeetingStats> {
  const db = getDb();
  if (!db) {
    return { thisWeek: 0, lastWeek: 0, thisMonth: 0, total: 0, bySequence: {}, weekOverWeekChange: 0 };
  }

  const meetingsRef = collection(db, 'meetings');
  const startOfWeek = getStartOfWeek().toISOString();
  const startOfMonth = getStartOfMonth().toISOString();
  const startOfLastWeek = new Date(getStartOfWeek().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Get all meetings
    const allMeetingsSnap = await getDocs(meetingsRef);
    const meetings = allMeetingsSnap.docs.map(d => d.data() as MeetingAttribution);

    const thisWeek = meetings.filter(m => m.meetingBookedAt >= startOfWeek).length;
    const lastWeek = meetings.filter(m => 
      m.meetingBookedAt >= startOfLastWeek && m.meetingBookedAt < startOfWeek
    ).length;
    const thisMonth = meetings.filter(m => m.meetingBookedAt >= startOfMonth).length;

    // Group by sequence
    const bySequence: Record<string, number> = {};
    for (const meeting of meetings) {
      if (meeting.sequenceId) {
        const key = meeting.sequenceName || meeting.sequenceId;
        bySequence[key] = (bySequence[key] || 0) + 1;
      }
    }

    // Calculate week-over-week change
    const weekOverWeekChange = lastWeek === 0 
      ? (thisWeek > 0 ? 100 : 0)
      : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);

    return {
      thisWeek,
      lastWeek,
      thisMonth,
      total: meetings.length,
      bySequence,
      weekOverWeekChange,
    };
  } catch (err) {
    console.error('Error fetching meeting stats:', err);
    return { thisWeek: 0, lastWeek: 0, thisMonth: 0, total: 0, bySequence: {}, weekOverWeekChange: 0 };
  }
}

/**
 * Get sequence performance data with full email stats
 */
export async function getSequencePerformance(): Promise<SequencePerformance[]> {
  const db = getDb();
  if (!db) return [];

  try {
    // Get all enrollments grouped by sequence
    const enrollmentsSnap = await getDocs(collection(db, 'sequenceEnrollments'));
    const enrollments = enrollmentsSnap.docs.map(d => d.data());

    // Get all email events for opens, clicks, replies
    const emailEventsSnap = await getDocs(collection(db, 'email_events'));
    const emailEvents = emailEventsSnap.docs.map(d => d.data());

    // Get all meetings
    const meetingsSnap = await getDocs(collection(db, 'meetings'));
    const meetings = meetingsSnap.docs.map(d => d.data() as MeetingAttribution);

    // Get sequences
    const sequencesSnap = await getDocs(collection(db, 'sequences'));
    const sequences = sequencesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Build performance data
    const performance = sequences.map(seq => {
      const seqEnrollments = enrollments.filter(e => e.sequenceId === seq.id);
      const enrolled = seqEnrollments.length;
      
      // Filter email events by sequenceId
      const seqEvents = emailEvents.filter(e => e.sequenceId === seq.id);
      const sent = seqEvents.filter(e => e.type === 'sent').length;
      const opened = seqEvents.filter(e => e.type === 'open' || e.type === 'opened').length;
      const clicked = seqEvents.filter(e => e.type === 'click' || e.type === 'clicked').length;
      const replied = seqEnrollments.filter(e => e.status === 'replied').length;
      const seqMeetings = meetings.filter(m => m.sequenceId === seq.id).length;
      
      return {
        sequenceId: seq.id,
        sequenceName: (seq as { name?: string }).name || seq.id,
        enrolled,
        sent: sent || enrolled, // Fallback to enrolled count if no events
        opened,
        clicked,
        replied,
        meetings: seqMeetings,
        openRate: sent > 0 ? (opened / sent) * 100 : 0,
        clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
        replyRate: sent > 0 ? (replied / sent) * 100 : 0,
        conversionRate: enrolled > 0 ? Math.round((seqMeetings / enrolled) * 100 * 10) / 10 : 0,
      };
    });

    // Sort by meetings descending, then by conversion rate
    return performance
      .filter(p => p.enrolled > 0) // Only show sequences with enrollments
      .sort((a, b) => b.meetings - a.meetings || b.conversionRate - a.conversionRate);
  } catch (err) {
    console.error('Error fetching sequence performance:', err);
    return [];
  }
}
