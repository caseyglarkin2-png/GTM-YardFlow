/**
 * Meeting Analytics API Endpoint
 * Sprint 204: Meeting Attribution Dashboard
 * 
 * Returns meeting analytics aggregated by:
 * - Sequence
 * - Template  
 * - Time period
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';

// Types
interface MeetingDoc {
  attributedSequenceId?: string;
  attributedSequenceName?: string;
  attributedTemplateId?: string;
  attributedTemplateName?: string;
  meetingBookedAt?: string;
  createdAt?: string;
  prospectId?: string;
  prospectName?: string;
  companyName?: string;
  userId?: string;
}

interface SequenceStat {
  id: string;
  name: string;
  count: number;
}

interface TemplateStat {
  id: string;
  name: string;
  count: number;
}

interface MeetingAnalytics {
  bySequence: SequenceStat[];
  byTemplate: TemplateStat[];
  byDay: { date: string; count: number }[];
  total: number;
  thisWeek: number;
  lastWeek: number;
  percentChange: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow GET
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const db = getAdminDb();
    if (!db) {
      res.status(503).json({ success: false, error: 'Database not available' });
      return;
    }

    // Parse query params
    const { startDate, endDate, userId } = req.query;
    
    // Default to last 30 days
    const now = Date.now();
    const start = startDate 
      ? new Date(startDate as string).getTime() 
      : now - 30 * MS_PER_DAY;
    const end = endDate 
      ? new Date(endDate as string).getTime() 
      : now;

    // Query meetings
    let meetingsQuery = db.collection('meetings')
      .orderBy('createdAt', 'desc');

    if (userId) {
      meetingsQuery = meetingsQuery.where('userId', '==', userId);
    }

    const meetingsSnapshot = await meetingsQuery.get();

    // Filter by date range (Firestore doesn't support multiple orderBy with range)
    const meetings: MeetingDoc[] = meetingsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as MeetingDoc)
      .filter((m) => {
        const createdAt = m.createdAt 
          ? new Date(m.createdAt).getTime() 
          : m.meetingBookedAt 
            ? new Date(m.meetingBookedAt).getTime() 
            : 0;
        return createdAt >= start && createdAt <= end;
      });

    // Aggregate by sequence
    const bySequenceMap = new Map<string, SequenceStat>();
    meetings.forEach((m) => {
      if (m.attributedSequenceId) {
        const existing = bySequenceMap.get(m.attributedSequenceId);
        if (existing) {
          existing.count++;
        } else {
          bySequenceMap.set(m.attributedSequenceId, {
            id: m.attributedSequenceId,
            name: m.attributedSequenceName || 'Unknown Sequence',
            count: 1,
          });
        }
      }
    });

    // Aggregate by template
    const byTemplateMap = new Map<string, TemplateStat>();
    meetings.forEach((m) => {
      if (m.attributedTemplateId) {
        const existing = byTemplateMap.get(m.attributedTemplateId);
        if (existing) {
          existing.count++;
        } else {
          byTemplateMap.set(m.attributedTemplateId, {
            id: m.attributedTemplateId,
            name: m.attributedTemplateName || 'Unknown Template',
            count: 1,
          });
        }
      }
    });

    // Aggregate by day
    const byDayMap = new Map<string, number>();
    meetings.forEach((m) => {
      const timestamp = m.meetingBookedAt || m.createdAt;
      if (timestamp) {
        const date = new Date(timestamp).toISOString().split('T')[0];
        byDayMap.set(date, (byDayMap.get(date) || 0) + 1);
      }
    });

    // Count this week vs last week
    const thisWeekStart = now - MS_PER_WEEK;
    const lastWeekStart = now - 2 * MS_PER_WEEK;

    const thisWeek = meetings.filter((m) => {
      const createdAt = m.createdAt 
        ? new Date(m.createdAt).getTime() 
        : m.meetingBookedAt 
          ? new Date(m.meetingBookedAt).getTime() 
          : 0;
      return createdAt >= thisWeekStart;
    }).length;

    const lastWeek = meetings.filter((m) => {
      const createdAt = m.createdAt 
        ? new Date(m.createdAt).getTime() 
        : m.meetingBookedAt 
          ? new Date(m.meetingBookedAt).getTime() 
          : 0;
      return createdAt >= lastWeekStart && createdAt < thisWeekStart;
    }).length;

    const percentChange = lastWeek > 0 
      ? ((thisWeek - lastWeek) / lastWeek) * 100 
      : thisWeek > 0 ? 100 : 0;

    // Build response
    const analytics: MeetingAnalytics = {
      bySequence: Array.from(bySequenceMap.values())
        .sort((a, b) => b.count - a.count),
      byTemplate: Array.from(byTemplateMap.values())
        .sort((a, b) => b.count - a.count),
      byDay: Array.from(byDayMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      total: meetings.length,
      thisWeek,
      lastWeek,
      percentChange: Math.round(percentChange),
    };

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('[Meeting Analytics API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch meeting analytics',
    });
  }
}
