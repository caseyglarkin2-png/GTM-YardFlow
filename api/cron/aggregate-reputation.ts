import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { createLogger } from '../../lib/logger';
import { withSentry } from '../../lib/sentry-server';
import { getRequestId } from '../../lib/request-id';
import { sendAlert, AlertSeverity } from '../../lib/alerting';

const log = createLogger('cron-aggregate-reputation');

/**
 * Email Reputation Aggregation Cron Job
 * Sprint 39A.6: Daily aggregation of email metrics for trend analysis
 * 
 * Runs once daily to aggregate email events into daily_metrics collection.
 * This enables efficient trend analysis without scanning all events.
 * 
 * Security: Requires CRON_SECRET in Authorization header.
 */

interface DailyMetrics {
  date: string; // YYYY-MM-DD
  userId: string;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  replied: number;
  unsubscribed: number;
  deliverabilityRate: number;
  bounceRate: number;
  spamRate: number;
  openRate: number;
  clickRate: number;
  healthScore: number;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Calculate health score from daily metrics
 * Formula: 40% deliverability + 25% (1-bounce) + 25% (1-spam) + 10% opens
 */
function calculateHealthScore(metrics: {
  deliverabilityRate: number;
  bounceRate: number;
  spamRate: number;
  openRate: number;
}): number {
  const { deliverabilityRate, bounceRate, spamRate, openRate } = metrics;
  
  // Convert rates to scores (0-100)
  const deliveryScore = deliverabilityRate * 100;
  const bounceScore = Math.max(0, (1 - bounceRate * 10)) * 100; // 10% bounce = 0 score
  const spamScore = Math.max(0, (1 - spamRate * 100)) * 100; // 1% spam = 0 score
  const openScore = Math.min(openRate * 2, 1) * 100; // 50% open = full score
  
  // Weighted average
  const score = (
    deliveryScore * 0.40 +
    bounceScore * 0.25 +
    spamScore * 0.25 +
    openScore * 0.10
  );
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const requestId = getRequestId(req);
  const requestLog = log.withRequestId(requestId);

  // Only allow POST (from external) or GET (from Vercel native crons)
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed', requestId });
    return;
  }

  // Verify cron authentication
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  
  // Check for Vercel cron header (native crons don't need auth)
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  if (!isVercelCron) {
    // External caller - require bearer token
    if (!cronSecret) {
      requestLog.warn('CRON_SECRET not configured - rejecting external cron request');
      res.status(401).json({ error: 'Cron not configured', requestId });
      return;
    }
    
    const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (providedToken !== cronSecret) {
      requestLog.warn('Invalid cron authentication attempt');
      res.status(401).json({ error: 'Unauthorized', requestId });
      return;
    }
  }

  const startTime = Date.now();
  requestLog.info('Starting reputation aggregation');

  try {
    const db = await getAdminDb();
    if (!db) {
      throw new Error('Failed to initialize database');
    }

    // Determine date range to aggregate (yesterday by default)
    // Can pass ?date=YYYY-MM-DD for historical backfill
    const dateParam = typeof req.query.date === 'string' ? req.query.date : null;
    const targetDate = dateParam ? new Date(dateParam) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    // Start and end of the target date (UTC)
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
    
    requestLog.info('Aggregating metrics', { date: dateStr });

    // Get all unique user IDs with email events in the time range
    const eventsRef = db.collection('email_events');
    const eventsSnap = await eventsRef
      .where('timestamp', '>=', Timestamp.fromDate(dayStart))
      .where('timestamp', '<=', Timestamp.fromDate(dayEnd))
      .get();

    // Group events by user
    const userEvents: Map<string, { type: string }[]> = new Map();
    
    eventsSnap.docs.forEach(doc => {
      const data = doc.data();
      const userId = data.userId || 'unknown';
      if (!userEvents.has(userId)) {
        userEvents.set(userId, []);
      }
      userEvents.get(userId)!.push({ type: data.type });
    });

    requestLog.info('Found events to aggregate', { 
      users: userEvents.size, 
      total: eventsSnap.size 
    });

    // Also check sent_emails for sent count
    const sentRef = db.collection('sent_emails');
    const sentSnap = await sentRef
      .where('sentAt', '>=', Timestamp.fromDate(dayStart))
      .where('sentAt', '<=', Timestamp.fromDate(dayEnd))
      .get();

    // Group sent emails by user
    const userSentCount: Map<string, number> = new Map();
    sentSnap.docs.forEach(doc => {
      const data = doc.data();
      const userId = data.userId || 'unknown';
      userSentCount.set(userId, (userSentCount.get(userId) || 0) + 1);
    });

    // Merge user IDs
    const allUserIds = new Set([...userEvents.keys(), ...userSentCount.keys()]);
    
    let aggregated = 0;
    let updated = 0;
    let failed = 0;

    const batch = db.batch();
    const metricsRef = db.collection('daily_metrics');

    for (const userId of allUserIds) {
      try {
        const events = userEvents.get(userId) || [];
        const sentCount = userSentCount.get(userId) || 0;

        // Count event types
        const counts = {
          sent: sentCount,
          delivered: events.filter(e => e.type === 'delivered').length,
          bounced: events.filter(e => e.type === 'bounce' || e.type === 'hard_bounce').length,
          complained: events.filter(e => e.type === 'spamreport' || e.type === 'complaint').length,
          opened: events.filter(e => e.type === 'open').length,
          clicked: events.filter(e => e.type === 'click').length,
          replied: events.filter(e => e.type === 'reply').length,
          unsubscribed: events.filter(e => e.type === 'unsubscribe').length,
        };

        // Calculate rates (guard against division by zero)
        const sent = Math.max(counts.sent, 1);
        const delivered = counts.delivered || counts.sent; // Assume delivered if no events
        
        const rates = {
          deliverabilityRate: delivered / sent,
          bounceRate: counts.bounced / sent,
          spamRate: counts.complained / sent,
          openRate: delivered > 0 ? counts.opened / delivered : 0,
          clickRate: delivered > 0 ? counts.clicked / delivered : 0,
        };

        const healthScore = calculateHealthScore(rates);

        const docId = `${userId}_${dateStr}`;
        const existingDoc = await metricsRef.doc(docId).get();
        const now = Timestamp.now();

        const metricsData: DailyMetrics = {
          date: dateStr,
          userId,
          ...counts,
          ...rates,
          healthScore,
          createdAt: existingDoc.exists ? existingDoc.data()?.createdAt : now,
          updatedAt: now,
        };

        batch.set(metricsRef.doc(docId), metricsData, { merge: true });
        
        if (existingDoc.exists) {
          updated++;
        } else {
          aggregated++;
        }
      } catch (err) {
        requestLog.error('Failed to aggregate user metrics', err instanceof Error ? err : undefined, { userId });
        failed++;
      }
    }

    // Commit batch
    await batch.commit();

    const duration = Date.now() - startTime;
    requestLog.info('Reputation aggregation complete', {
      date: dateStr,
      aggregated,
      updated,
      failed,
      duration,
    });

    // Alert if high failure rate
    if (failed > 0 && failed / allUserIds.size > 0.2) {
      await sendAlert({
        severity: AlertSeverity.WARNING,
        title: 'Reputation aggregation partial failure',
        message: `${failed}/${allUserIds.size} users failed to aggregate for ${dateStr}`,
        data: { date: dateStr, aggregated, updated, failed, duration },
      });
    }

    res.status(200).json({
      success: true,
      date: dateStr,
      aggregated,
      updated,
      failed,
      duration,
      requestId,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    requestLog.error('Reputation aggregation failed', error instanceof Error ? error : undefined, { duration });

    await sendAlert({
      severity: AlertSeverity.ERROR,
      title: 'Reputation aggregation cron failed',
      message: errorMessage,
      data: { error: errorMessage, duration },
    });

    res.status(500).json({
      error: 'Aggregation failed',
      message: errorMessage,
      requestId,
    });
  }
}

export default withSentry(handler, 'cron-aggregate-reputation');
