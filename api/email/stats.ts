import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth, getAdminDb } from '../../lib/firebaseAdmin';
import { logger } from '../../lib/logger';

const db = getAdminDb();
const auth = getAdminAuth();

/**
 * Email Statistics API
 * 
 * Provides aggregated email analytics with date range filtering.
 * Supports both authenticated user access and service-to-service calls.
 * 
 * GET /api/email/stats
 * 
 * Query params:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - groupBy: 'day' | 'week' | 'month' (default: 'day')
 */

export interface EmailStats {
  period: {
    start: string;
    end: string;
  };
  totals: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    spam: number;
  };
  rates: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
  };
  timeline: TimelinePoint[];
}

export interface TimelinePoint {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Authenticate user or service
  const authHeader = req.headers.authorization;
  const serviceKey = req.headers['x-service-key']?.toString();
  const expectedServiceKey = process.env.SERVICE_TO_SERVICE_SECRET;

  let userId: string | null = null;

  // Service-to-service auth
  if (serviceKey && expectedServiceKey && serviceKey === expectedServiceKey) {
    userId = req.headers['x-firebase-uid']?.toString() || 'service';
  } else if (authHeader?.startsWith('Bearer ')) {
    // Firebase auth
    const token = authHeader.split(' ')[1];
    try {
      const decoded = await auth.verifyIdToken(token);
      userId = decoded.uid;
    } catch {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
  }

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    // Parse query parameters
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string)
      : thirtyDaysAgo;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : now;
    const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || 'day';

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format. Use ISO 8601.' });
      return;
    }

    // Query email events from Firestore
    const eventsRef = db.collection('emailEvents');
    const snapshot = await eventsRef
      .where('timestamp', '>=', startDate.getTime())
      .where('timestamp', '<=', endDate.getTime())
      .orderBy('timestamp', 'asc')
      .get();

    // Aggregate events
    const totals = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      bounced: 0,
      spam: 0,
    };

    const timelineMap = new Map<string, TimelinePoint>();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const eventType = data.type as string;
      const timestamp = data.timestamp as number;
      const dateKey = getDateKey(new Date(timestamp), groupBy);

      // Update totals
      switch (eventType) {
        case 'sent':
        case 'processed':
          totals.sent++;
          break;
        case 'delivered':
          totals.delivered++;
          break;
        case 'open':
          totals.opened++;
          break;
        case 'click':
          totals.clicked++;
          break;
        case 'reply':
          totals.replied++;
          break;
        case 'bounce':
          totals.bounced++;
          break;
        case 'spamreport':
          totals.spam++;
          break;
      }

      // Update timeline
      if (!timelineMap.has(dateKey)) {
        timelineMap.set(dateKey, {
          date: dateKey,
          sent: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
        });
      }
      const point = timelineMap.get(dateKey)!;
      if (eventType === 'sent' || eventType === 'processed') point.sent++;
      if (eventType === 'open') point.opened++;
      if (eventType === 'click') point.clicked++;
      if (eventType === 'reply') point.replied++;
    });

    // Calculate rates (avoid division by zero)
    const rates = {
      deliveryRate: totals.sent > 0 ? Math.round((totals.delivered / totals.sent) * 100) : 0,
      openRate: totals.delivered > 0 ? Math.round((totals.opened / totals.delivered) * 100) : 0,
      clickRate: totals.opened > 0 ? Math.round((totals.clicked / totals.opened) * 100) : 0,
      replyRate: totals.sent > 0 ? Math.round((totals.replied / totals.sent) * 100) : 0,
      bounceRate: totals.sent > 0 ? Math.round((totals.bounced / totals.sent) * 100) : 0,
    };

    // Sort timeline by date
    const timeline = Array.from(timelineMap.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    const stats: EmailStats = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      totals,
      rates,
      timeline,
    };

    logger.info('Email stats fetched', { 
      userId, 
      period: stats.period,
      totalEvents: snapshot.size 
    });

    res.status(200).json(stats);
  } catch (error) {
    logger.error('Email stats error:', error instanceof Error ? error : undefined);
    res.status(500).json({ 
      error: 'Failed to fetch email statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Generate a date key for timeline grouping
 */
function getDateKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (groupBy) {
    case 'month':
      return `${year}-${month}`;
    case 'week':
      // Get Monday of the week
      const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diff));
      return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    case 'day':
    default:
      return `${year}-${month}-${day}`;
  }
}
