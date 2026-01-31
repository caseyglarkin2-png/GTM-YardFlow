/**
 * Sequence Analytics Service - YardFlow Hub
 * 
 * Sprint 4: Enhanced analytics for sequence performance
 * 
 * Features:
 * - T4.1: Funnel visualization data
 * - T4.2: Step-level drill-down
 * - T4.3: Time-of-day analysis
 * - T4.4: Comparative sequence analysis
 * - T4.5: CSV export utilities
 */

import { 
  collection, 
  query, 
  where, 
  getDocs,
  getFirestore,
  orderBy,
  limit as firestoreLimit
} from 'firebase/firestore';
import { getApp } from 'firebase/app';

// ============================================
// Types
// ============================================

/**
 * Funnel stage data for visualization
 */
export interface FunnelStage {
  name: string;
  count: number;
  rate: number;
  dropoff: number;
  color: string;
}

export interface SequenceFunnel {
  sequenceId: string;
  sequenceName: string;
  stages: FunnelStage[];
  totalEnrolled: number;
  overallConversionRate: number;
}

/**
 * Step-level performance metrics
 */
export interface StepMetrics {
  stepId: string;
  stepIndex: number;
  stepType: string;
  subject: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  avgOpenTimeHours: number | null;
}

export interface StepDrillDown {
  sequenceId: string;
  sequenceName: string;
  steps: StepMetrics[];
  bestPerformingStep: number;
  worstPerformingStep: number;
}

/**
 * Time-of-day analysis
 */
export interface HourlyStats {
  hour: number;
  label: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  openRate: number;
}

export interface TimeAnalysis {
  hourlyBreakdown: HourlyStats[];
  bestHour: number;
  bestDay: string;
  avgResponseTimeHours: number;
  weekdayVsWeekend: {
    weekday: { sent: number; openRate: number; replyRate: number };
    weekend: { sent: number; openRate: number; replyRate: number };
  };
}

/**
 * Comparative analysis between sequences
 */
export interface SequenceComparison {
  sequenceId: string;
  sequenceName: string;
  tier?: string;
  persona?: string;
  enrolled: number;
  completed: number;
  openRate: number;
  replyRate: number;
  meetingRate: number;
  avgTimeToReplyHours: number | null;
  score: number; // Weighted overall score
}

export interface ComparativeAnalysis {
  sequences: SequenceComparison[];
  bestOverall: string;
  bestOpenRate: string;
  bestReplyRate: string;
  bestMeetingRate: string;
  recommendations: string[];
}

/**
 * CSV export data format
 */
export interface AnalyticsExportRow {
  sequenceName: string;
  stepNumber: number;
  stepType: string;
  subject: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  openRate: string;
  clickRate: string;
  replyRate: string;
  bounceRate: string;
  dateRange: string;
}

// ============================================
// Analytics Service
// ============================================

export class SequenceAnalyticsService {
  private getDb() {
    return getFirestore(getApp());
  }

  /**
   * T4.1: Get funnel data for a sequence
   */
  async getSequenceFunnel(sequenceId: string): Promise<SequenceFunnel | null> {
    const db = this.getDb();
    
    // Get sequence details
    const sequencesRef = collection(db, 'sequences');
    const sequenceQuery = query(sequencesRef, where('id', '==', sequenceId));
    const sequenceSnap = await getDocs(sequenceQuery);
    
    if (sequenceSnap.empty) {
      return null;
    }

    const sequence = sequenceSnap.docs[0].data();
    
    // Get enrollment stats
    const enrollmentsRef = collection(db, 'sequenceEnrollments');
    const enrollmentQuery = query(enrollmentsRef, where('sequenceId', '==', sequenceId));
    const enrollmentSnap = await getDocs(enrollmentQuery);
    
    const totalEnrolled = enrollmentSnap.size;
    
    // Calculate funnel stages
    let sent = 0, opened = 0, clicked = 0, replied = 0, meetings = 0;
    
    enrollmentSnap.docs.forEach(doc => {
      const data = doc.data();
      const history = data.stepHistory || [];
      
      if (history.length > 0) sent++;
      if (history.some((h: Record<string, unknown>) => h.openedAt)) opened++;
      if (history.some((h: Record<string, unknown>) => h.clickedAt)) clicked++;
      if (data.status === 'replied') replied++;
      if (data.status === 'meeting') meetings++;
    });

    const stages: FunnelStage[] = [
      {
        name: 'Enrolled',
        count: totalEnrolled,
        rate: 100,
        dropoff: 0,
        color: '#6366f1', // indigo
      },
      {
        name: 'Received',
        count: sent,
        rate: totalEnrolled > 0 ? (sent / totalEnrolled) * 100 : 0,
        dropoff: totalEnrolled - sent,
        color: '#8b5cf6', // violet
      },
      {
        name: 'Opened',
        count: opened,
        rate: sent > 0 ? (opened / sent) * 100 : 0,
        dropoff: sent - opened,
        color: '#3b82f6', // blue
      },
      {
        name: 'Clicked',
        count: clicked,
        rate: opened > 0 ? (clicked / opened) * 100 : 0,
        dropoff: opened - clicked,
        color: '#10b981', // emerald
      },
      {
        name: 'Replied',
        count: replied,
        rate: sent > 0 ? (replied / sent) * 100 : 0,
        dropoff: clicked - replied,
        color: '#8b5cf6', // violet
      },
      {
        name: 'Meeting',
        count: meetings,
        rate: replied > 0 ? (meetings / replied) * 100 : 0,
        dropoff: replied - meetings,
        color: '#22c55e', // green
      },
    ];

    return {
      sequenceId,
      sequenceName: sequence.name,
      stages,
      totalEnrolled,
      overallConversionRate: totalEnrolled > 0 ? (meetings / totalEnrolled) * 100 : 0,
    };
  }

  /**
   * T4.2: Get step-level drill-down
   */
  async getStepDrillDown(sequenceId: string): Promise<StepDrillDown | null> {
    const db = this.getDb();
    
    // Get sequence with steps
    const sequencesRef = collection(db, 'sequences');
    const sequenceQuery = query(sequencesRef, where('id', '==', sequenceId));
    const sequenceSnap = await getDocs(sequenceQuery);
    
    if (sequenceSnap.empty) {
      return null;
    }

    const sequence = sequenceSnap.docs[0].data();
    const sequenceSteps = sequence.steps || [];

    // Get email events for this sequence
    const eventsRef = collection(db, 'email_events');
    const eventsQuery = query(
      eventsRef,
      where('metadata.sequenceId', '==', sequenceId)
    );
    const eventsSnap = await getDocs(eventsQuery);

    // Group events by step
    const stepStats: Map<string, {
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      replied: number;
      bounced: number;
      openTimes: number[];
    }> = new Map();

    eventsSnap.docs.forEach(doc => {
      const event = doc.data();
      const stepId = event.customArgs?.stepId || event.metadata?.stepId;
      
      if (!stepId) return;

      if (!stepStats.has(stepId)) {
        stepStats.set(stepId, {
          sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, openTimes: []
        });
      }

      const stats = stepStats.get(stepId)!;
      
      switch (event.type) {
        case 'sent':
          stats.sent++;
          break;
        case 'delivered':
          stats.delivered++;
          break;
        case 'open':
          stats.opened++;
          // Track time to open
          if (event.openedAt && event.sentAt) {
            const openTime = (new Date(event.openedAt).getTime() - new Date(event.sentAt).getTime()) / (1000 * 60 * 60);
            stats.openTimes.push(openTime);
          }
          break;
        case 'click':
          stats.clicked++;
          break;
        case 'reply':
          stats.replied++;
          break;
        case 'bounce':
          stats.bounced++;
          break;
      }
    });

    // Build step metrics
    const steps: StepMetrics[] = sequenceSteps.map((step: Record<string, unknown>, index: number) => {
      const stepId = step.id as string;
      const stats = stepStats.get(stepId) || {
        sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, openTimes: []
      };

      return {
        stepId,
        stepIndex: index,
        stepType: step.type as string,
        subject: step.subject as string,
        sent: stats.sent,
        delivered: stats.delivered,
        opened: stats.opened,
        clicked: stats.clicked,
        replied: stats.replied,
        bounced: stats.bounced,
        openRate: stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0,
        clickRate: stats.opened > 0 ? (stats.clicked / stats.opened) * 100 : 0,
        replyRate: stats.sent > 0 ? (stats.replied / stats.sent) * 100 : 0,
        bounceRate: stats.sent > 0 ? (stats.bounced / stats.sent) * 100 : 0,
        avgOpenTimeHours: stats.openTimes.length > 0 
          ? stats.openTimes.reduce((a, b) => a + b, 0) / stats.openTimes.length 
          : null,
      };
    });

    // Find best/worst performing steps
    const sortedByReply = [...steps].sort((a, b) => b.replyRate - a.replyRate);
    
    return {
      sequenceId,
      sequenceName: sequence.name,
      steps,
      bestPerformingStep: sortedByReply[0]?.stepIndex ?? 0,
      worstPerformingStep: sortedByReply[sortedByReply.length - 1]?.stepIndex ?? 0,
    };
  }

  /**
   * T4.3: Get time-of-day analysis
   */
  async getTimeAnalysis(sequenceId?: string): Promise<TimeAnalysis> {
    const db = this.getDb();
    
    // Build query
    let eventsQuery;
    const eventsRef = collection(db, 'email_events');
    
    if (sequenceId) {
      eventsQuery = query(
        eventsRef,
        where('metadata.sequenceId', '==', sequenceId),
        orderBy('timestamp', 'desc'),
        firestoreLimit(1000)
      );
    } else {
      eventsQuery = query(
        eventsRef,
        orderBy('timestamp', 'desc'),
        firestoreLimit(1000)
      );
    }

    const eventsSnap = await getDocs(eventsQuery);

    // Initialize hourly stats
    const hourlyStats: HourlyStats[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour.toString().padStart(2, '0')}:00`,
      sent: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      openRate: 0,
    }));

    let weekdaySent = 0, weekdayOpened = 0, weekdayReplied = 0;
    let weekendSent = 0, weekendOpened = 0, weekendReplied = 0;
    const responseTimes: number[] = [];
    const dayCount: Record<string, number> = {};

    eventsSnap.docs.forEach(doc => {
      const event = doc.data();
      const timestamp = new Date(event.timestamp);
      const hour = timestamp.getHours();
      const day = timestamp.toLocaleDateString('en-US', { weekday: 'long' });
      const isWeekend = day === 'Saturday' || day === 'Sunday';

      switch (event.type) {
        case 'sent':
          hourlyStats[hour].sent++;
          if (isWeekend) weekendSent++;
          else weekdaySent++;
          dayCount[day] = (dayCount[day] || 0) + 1;
          break;
        case 'open':
          hourlyStats[hour].opened++;
          if (isWeekend) weekendOpened++;
          else weekdayOpened++;
          break;
        case 'click':
          hourlyStats[hour].clicked++;
          break;
        case 'reply':
          hourlyStats[hour].replied++;
          if (isWeekend) weekendReplied++;
          else weekdayReplied++;
          // Calculate response time
          if (event.repliedAt && event.sentAt) {
            const responseTime = (new Date(event.repliedAt).getTime() - new Date(event.sentAt).getTime()) / (1000 * 60 * 60);
            if (responseTime > 0 && responseTime < 168) { // Within a week
              responseTimes.push(responseTime);
            }
          }
          break;
      }
    });

    // Calculate rates
    hourlyStats.forEach(stats => {
      stats.openRate = stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0;
    });

    // Find best hour (by open rate with minimum sends)
    const viableHours = hourlyStats.filter(h => h.sent >= 5);
    const bestHour = viableHours.length > 0
      ? viableHours.reduce((best, curr) => curr.openRate > best.openRate ? curr : best).hour
      : 9;

    // Find best day
    const bestDay = Object.entries(dayCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Tuesday';

    return {
      hourlyBreakdown: hourlyStats,
      bestHour,
      bestDay,
      avgResponseTimeHours: responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 24,
      weekdayVsWeekend: {
        weekday: {
          sent: weekdaySent,
          openRate: weekdaySent > 0 ? (weekdayOpened / weekdaySent) * 100 : 0,
          replyRate: weekdaySent > 0 ? (weekdayReplied / weekdaySent) * 100 : 0,
        },
        weekend: {
          sent: weekendSent,
          openRate: weekendSent > 0 ? (weekendOpened / weekendSent) * 100 : 0,
          replyRate: weekendSent > 0 ? (weekendReplied / weekendSent) * 100 : 0,
        },
      },
    };
  }

  /**
   * T4.4: Get comparative analysis between sequences
   */
  async getComparativeAnalysis(): Promise<ComparativeAnalysis> {
    const db = this.getDb();
    
    // Get all sequences
    const sequencesRef = collection(db, 'sequences');
    const sequencesSnap = await getDocs(sequencesRef);

    const comparisons: SequenceComparison[] = [];

    for (const seqDoc of sequencesSnap.docs) {
      const sequence = seqDoc.data();
      
      // Get enrollments for this sequence
      const enrollmentsRef = collection(db, 'sequenceEnrollments');
      const enrollmentQuery = query(enrollmentsRef, where('sequenceId', '==', sequence.id));
      const enrollmentSnap = await getDocs(enrollmentQuery);

      let opened = 0, replied = 0, meetings = 0;
      const replyTimes: number[] = [];
      
      enrollmentSnap.docs.forEach(doc => {
        const data = doc.data();
        const history = data.stepHistory || [];
        
        if (history.some((h: Record<string, unknown>) => h.openedAt)) opened++;
        if (data.status === 'replied') {
          replied++;
          // Track reply time
          if (data.completedAt && data.enrolledAt) {
            const time = (new Date(data.completedAt).getTime() - new Date(data.enrolledAt).getTime()) / (1000 * 60 * 60);
            if (time > 0 && time < 720) replyTimes.push(time); // Within 30 days
          }
        }
        if (data.status === 'meeting') meetings++;
      });

      const enrolled = enrollmentSnap.size;
      const completed = enrollmentSnap.docs.filter(d => d.data().status === 'completed').length;

      const openRate = enrolled > 0 ? (opened / enrolled) * 100 : 0;
      const replyRate = enrolled > 0 ? (replied / enrolled) * 100 : 0;
      const meetingRate = enrolled > 0 ? (meetings / enrolled) * 100 : 0;

      // Calculate weighted score (meetings weight highest)
      const score = (openRate * 0.1) + (replyRate * 0.3) + (meetingRate * 0.6);

      comparisons.push({
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        tier: sequence.tier,
        persona: sequence.persona,
        enrolled,
        completed,
        openRate,
        replyRate,
        meetingRate,
        avgTimeToReplyHours: replyTimes.length > 0
          ? replyTimes.reduce((a, b) => a + b, 0) / replyTimes.length
          : null,
        score,
      });
    }

    // Sort by score
    comparisons.sort((a, b) => b.score - a.score);

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (comparisons.length >= 2) {
      const best = comparisons[0];
      const worst = comparisons[comparisons.length - 1];
      
      if (best.meetingRate > worst.meetingRate * 2) {
        recommendations.push(`"${best.sequenceName}" converts ${(best.meetingRate / worst.meetingRate).toFixed(1)}x better than "${worst.sequenceName}". Consider pausing underperforming sequence.`);
      }

      const lowOpenRates = comparisons.filter(c => c.openRate < 20);
      if (lowOpenRates.length > 0) {
        recommendations.push(`${lowOpenRates.length} sequence(s) have open rates below 20%. Consider A/B testing subject lines.`);
      }

      const highReplySeq = comparisons.find(c => c.replyRate > 10);
      if (highReplySeq) {
        recommendations.push(`"${highReplySeq.sequenceName}" has strong reply rates (${highReplySeq.replyRate.toFixed(1)}%). Analyze its messaging for best practices.`);
      }
    }

    return {
      sequences: comparisons,
      bestOverall: comparisons[0]?.sequenceId || '',
      bestOpenRate: [...comparisons].sort((a, b) => b.openRate - a.openRate)[0]?.sequenceId || '',
      bestReplyRate: [...comparisons].sort((a, b) => b.replyRate - a.replyRate)[0]?.sequenceId || '',
      bestMeetingRate: [...comparisons].sort((a, b) => b.meetingRate - a.meetingRate)[0]?.sequenceId || '',
      recommendations,
    };
  }

  /**
   * T4.5: Generate CSV export data
   */
  async generateExportData(
    sequenceId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AnalyticsExportRow[]> {
    const rows: AnalyticsExportRow[] = [];
    const dateRange = startDate && endDate
      ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      : 'All time';

    if (sequenceId) {
      const drillDown = await this.getStepDrillDown(sequenceId);
      if (drillDown) {
        drillDown.steps.forEach((step, index) => {
          rows.push({
            sequenceName: drillDown.sequenceName,
            stepNumber: index + 1,
            stepType: step.stepType,
            subject: step.subject,
            sent: step.sent,
            opened: step.opened,
            clicked: step.clicked,
            replied: step.replied,
            bounced: step.bounced,
            openRate: `${step.openRate.toFixed(1)}%`,
            clickRate: `${step.clickRate.toFixed(1)}%`,
            replyRate: `${step.replyRate.toFixed(1)}%`,
            bounceRate: `${step.bounceRate.toFixed(1)}%`,
            dateRange,
          });
        });
      }
    } else {
      // Export all sequences summary
      const comparative = await this.getComparativeAnalysis();
      comparative.sequences.forEach(seq => {
        rows.push({
          sequenceName: seq.sequenceName,
          stepNumber: 0,
          stepType: 'summary',
          subject: `Tier: ${seq.tier || 'N/A'}, Persona: ${seq.persona || 'N/A'}`,
          sent: seq.enrolled,
          opened: Math.round(seq.enrolled * seq.openRate / 100),
          clicked: 0,
          replied: Math.round(seq.enrolled * seq.replyRate / 100),
          bounced: 0,
          openRate: `${seq.openRate.toFixed(1)}%`,
          clickRate: 'N/A',
          replyRate: `${seq.replyRate.toFixed(1)}%`,
          bounceRate: 'N/A',
          dateRange,
        });
      });
    }

    return rows;
  }

  /**
   * Convert export data to CSV string
   */
  exportToCsv(rows: AnalyticsExportRow[]): string {
    const headers = [
      'Sequence Name',
      'Step #',
      'Step Type',
      'Subject',
      'Sent',
      'Opened',
      'Clicked',
      'Replied',
      'Bounced',
      'Open Rate',
      'Click Rate',
      'Reply Rate',
      'Bounce Rate',
      'Date Range',
    ];

    const csvRows = [
      headers.join(','),
      ...rows.map(row => [
        `"${row.sequenceName}"`,
        row.stepNumber,
        row.stepType,
        `"${row.subject.replace(/"/g, '""')}"`,
        row.sent,
        row.opened,
        row.clicked,
        row.replied,
        row.bounced,
        row.openRate,
        row.clickRate,
        row.replyRate,
        row.bounceRate,
        `"${row.dateRange}"`,
      ].join(','))
    ];

    return csvRows.join('\n');
  }

  /**
   * Trigger CSV download in browser
   */
  downloadCsv(rows: AnalyticsExportRow[], filename = 'sequence-analytics.csv'): void {
    const csv = this.exportToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}

// Singleton instance
export const sequenceAnalyticsService = new SequenceAnalyticsService();

// Convenience exports
export async function getSequenceFunnel(sequenceId: string): Promise<SequenceFunnel | null> {
  return sequenceAnalyticsService.getSequenceFunnel(sequenceId);
}

export async function getStepDrillDown(sequenceId: string): Promise<StepDrillDown | null> {
  return sequenceAnalyticsService.getStepDrillDown(sequenceId);
}

export async function getTimeAnalysis(sequenceId?: string): Promise<TimeAnalysis> {
  return sequenceAnalyticsService.getTimeAnalysis(sequenceId);
}

export async function getComparativeAnalysis(): Promise<ComparativeAnalysis> {
  return sequenceAnalyticsService.getComparativeAnalysis();
}

export async function exportAnalyticsToCsv(
  sequenceId?: string,
  filename?: string
): Promise<void> {
  const rows = await sequenceAnalyticsService.generateExportData(sequenceId);
  sequenceAnalyticsService.downloadCsv(rows, filename);
}
