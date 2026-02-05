import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Email Reputation API
 * 
 * Sprint 39A.2: Returns reputation metrics, health score, and recommendations
 * 
 * GET /api/email/reputation
 * 
 * Query params:
 * - period: '24h' | '7d' | '30d' (default: '7d')
 * 
 * Response:
 * - metrics: ReputationMetrics with health score
 * - recommendations: Array of actionable suggestions
 * - issues: Array of identified problems
 */

export interface ReputationResponse {
  metrics: {
    period: '24h' | '7d' | '30d';
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
    replyRate: number;
    healthScore: number;
    healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  trend: Array<{
    date: string;
    sent: number;
    delivered: number;
    bounced: number;
    opened: number;
    healthScore: number;
  }>;
  issues: Array<{
    type: 'critical' | 'warning' | 'info';
    metric: string;
    value: number;
    threshold: number;
    message: string;
  }>;
  recommendations: string[];
  pauseRecommended: boolean;
  pauseReason?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Dynamic imports - only load when needed
  const { getAdminAuth, getAdminDb } = await import('../../lib/firebaseAdmin');
  const { logger } = await import('../../lib/logger');
  
  const db = getAdminDb();
  const auth = getAdminAuth();

  // Authenticate user
  const authHeader = req.headers.authorization;
  const serviceKey = req.headers['x-service-key']?.toString();
  const expectedServiceKey = process.env.SERVICE_TO_SERVICE_SECRET;

  let userId: string | null = null;

  // S2S auth
  if (serviceKey && expectedServiceKey && serviceKey === expectedServiceKey) {
    userId = req.headers['x-user-id']?.toString() || 'service:reputation';
    logger.info('[reputation] S2S auth', { userId });
  } 
  // Firebase token auth
  else if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded = await auth.verifyIdToken(token);
      userId = decoded.uid;
    } catch (error) {
      logger.error('[reputation] Invalid token', error instanceof Error ? error : undefined);
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
  }

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Parse query params
  const periodParam = req.query.period?.toString();
  const period: '24h' | '7d' | '30d' = 
    periodParam === '24h' || periodParam === '7d' || periodParam === '30d' 
      ? periodParam 
      : '7d';

  try {
    // Calculate date range
    const periodMs = period === '24h' ? 86400000 : period === '7d' ? 604800000 : 2592000000;
    const startDate = new Date(Date.now() - periodMs);

    // Query email events from Firestore
    const eventsRef = db.collection('email_events');
    const snapshot = await eventsRef
      .where('userId', '==', userId)
      .where('timestamp', '>=', startDate)
      .orderBy('timestamp', 'desc')
      .get();

    // Aggregate events
    const counts = {
      sent: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      unsubscribed: 0,
    };

    for (const doc of snapshot.docs) {
      const type = doc.data().type;
      switch (type) {
        case 'sent':
        case 'processed':
          counts.sent++;
          break;
        case 'delivered':
          counts.delivered++;
          break;
        case 'bounce':
        case 'bounced':
          counts.bounced++;
          break;
        case 'spamreport':
        case 'spam':
        case 'complained':
          counts.complained++;
          break;
        case 'open':
        case 'opened':
          counts.opened++;
          break;
        case 'click':
        case 'clicked':
          counts.clicked++;
          break;
        case 'reply':
        case 'replied':
          counts.replied++;
          break;
        case 'unsubscribe':
        case 'unsubscribed':
          counts.unsubscribed++;
          break;
      }
    }

    // Calculate rates (avoid division by zero)
    const sent = counts.sent || 1; // Prevent div/0
    const delivered = counts.delivered > 0 ? counts.delivered : counts.sent - counts.bounced;
    const deliveredForRates = delivered > 0 ? delivered : 1;

    const rates = {
      deliverabilityRate: counts.sent > 0 ? delivered / counts.sent : 0,
      bounceRate: counts.sent > 0 ? counts.bounced / counts.sent : 0,
      spamRate: counts.sent > 0 ? counts.complained / counts.sent : 0,
      openRate: counts.delivered > 0 ? counts.opened / deliveredForRates : 0,
      clickRate: counts.delivered > 0 ? counts.clicked / deliveredForRates : 0,
      replyRate: counts.delivered > 0 ? counts.replied / deliveredForRates : 0,
    };

    // Calculate health score
    const deliverabilityScore = rates.deliverabilityRate * 100;
    const bounceScore = Math.max(0, 100 - (rates.bounceRate * 1000));
    const spamScore = Math.max(0, 100 - (rates.spamRate * 10000));
    const openScore = Math.min(100, (rates.openRate / 0.30) * 100);

    const healthScore = Math.round(
      deliverabilityScore * 0.40 +
      bounceScore * 0.25 +
      spamScore * 0.25 +
      openScore * 0.10
    );

    const healthGrade = 
      healthScore >= 90 ? 'A' :
      healthScore >= 80 ? 'B' :
      healthScore >= 70 ? 'C' :
      healthScore >= 60 ? 'D' : 'F';

    // Identify issues
    const issues: ReputationResponse['issues'] = [];
    const thresholds = {
      bounceRatePause: 0.05,
      spamRatePause: 0.001,
      bounceRateWarn: 0.02,
      spamRateWarn: 0.0005,
      deliverabilityWarn: 0.90,
    };

    if (rates.bounceRate > thresholds.bounceRatePause) {
      issues.push({
        type: 'critical',
        metric: 'bounceRate',
        value: rates.bounceRate,
        threshold: thresholds.bounceRatePause,
        message: `Bounce rate is critically high (${(rates.bounceRate * 100).toFixed(2)}%). Sending should be paused.`,
      });
    } else if (rates.bounceRate > thresholds.bounceRateWarn) {
      issues.push({
        type: 'warning',
        metric: 'bounceRate',
        value: rates.bounceRate,
        threshold: thresholds.bounceRateWarn,
        message: `Bounce rate is elevated (${(rates.bounceRate * 100).toFixed(2)}%). Review your email list.`,
      });
    }

    if (rates.spamRate > thresholds.spamRatePause) {
      issues.push({
        type: 'critical',
        metric: 'spamRate',
        value: rates.spamRate,
        threshold: thresholds.spamRatePause,
        message: `Spam rate is critically high (${(rates.spamRate * 100).toFixed(3)}%). Sending should be paused.`,
      });
    } else if (rates.spamRate > thresholds.spamRateWarn) {
      issues.push({
        type: 'warning',
        metric: 'spamRate',
        value: rates.spamRate,
        threshold: thresholds.spamRateWarn,
        message: `Spam rate is elevated (${(rates.spamRate * 100).toFixed(3)}%). Review email content.`,
      });
    }

    if (counts.sent > 0 && rates.deliverabilityRate < thresholds.deliverabilityWarn) {
      issues.push({
        type: 'warning',
        metric: 'deliverabilityRate',
        value: rates.deliverabilityRate,
        threshold: thresholds.deliverabilityWarn,
        message: `Deliverability is below target (${(rates.deliverabilityRate * 100).toFixed(1)}%). Check domain authentication.`,
      });
    }

    // Generate recommendations
    const recommendations: string[] = [];
    const hasBounceIssue = issues.some(i => i.metric === 'bounceRate');
    const hasSpamIssue = issues.some(i => i.metric === 'spamRate');
    const hasDeliverabilityIssue = issues.some(i => i.metric === 'deliverabilityRate');

    if (hasBounceIssue) {
      recommendations.push('Clean your email list by removing invalid addresses');
      recommendations.push('Verify email addresses before importing');
    }

    if (hasSpamIssue) {
      recommendations.push('Review your email content for spam triggers');
      recommendations.push('Ensure clear unsubscribe links are present');
    }

    if (hasDeliverabilityIssue) {
      recommendations.push('Check your domain authentication settings');
      recommendations.push('Verify SPF, DKIM, and DMARC records are configured');
    }

    if (recommendations.length === 0 && counts.sent > 0) {
      recommendations.push('Your email reputation looks healthy! Keep it up.');
    } else if (counts.sent === 0) {
      recommendations.push('No emails sent yet. Get started to see reputation metrics.');
    }

    // Check if pause is recommended
    const pauseRecommended = 
      rates.bounceRate > thresholds.bounceRatePause ||
      rates.spamRate > thresholds.spamRatePause ||
      healthScore < 50;

    const pauseReason = pauseRecommended
      ? issues.find(i => i.type === 'critical')?.message || 'Health score critically low'
      : undefined;

    // Get trend data from daily_metrics
    const trend: ReputationResponse['trend'] = [];
    try {
      const days = period === '24h' ? 1 : period === '7d' ? 7 : 30;
      const metricsRef = db.collection('daily_metrics');
      const trendSnapshot = await metricsRef
        .where('userId', '==', userId)
        .where('date', '>=', startDate)
        .orderBy('date', 'asc')
        .limit(days)
        .get();

      for (const doc of trendSnapshot.docs) {
        const data = doc.data();
        trend.push({
          date: data.date.toDate().toISOString().split('T')[0],
          sent: data.sent || 0,
          delivered: data.delivered || 0,
          bounced: data.bounced || 0,
          opened: data.opened || 0,
          healthScore: data.healthScore || 0,
        });
      }
    } catch {
      // Trend data optional, continue without it
    }

    const response: ReputationResponse = {
      metrics: {
        period,
        ...counts,
        ...rates,
        healthScore,
        healthGrade,
      },
      trend,
      issues,
      recommendations,
      pauseRecommended,
      pauseReason,
    };

    logger.info('[reputation] Metrics retrieved', { userId, period, healthScore });
    res.status(200).json(response);

  } catch (error) {
    logger.error('[reputation] Error', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Failed to retrieve reputation metrics' });
  }
}
