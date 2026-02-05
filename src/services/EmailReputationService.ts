/**
 * Email Reputation Service
 * 
 * Sprint 39A.1: Health score and reputation tracking for email sendability
 * 
 * Calculates deliverability metrics, health scores, and provides
 * recommendations based on email performance data.
 */

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';

export interface ReputationMetrics {
  period: '24h' | '7d' | '30d';
  sent: number;
  delivered: number;
  bounced: number;
  complained: number; // spam reports
  opened: number;
  clicked: number;
  replied: number;
  unsubscribed: number;
  // Calculated rates (0-1)
  deliverabilityRate: number;
  bounceRate: number;
  spamRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  // Overall health (0-100)
  healthScore: number;
  healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  // Trend data for charts
  trend: ReputationTrendPoint[];
  // Issues and recommendations
  issues: ReputationIssue[];
  recommendations: string[];
}

export interface ReputationTrendPoint {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  healthScore: number;
}

export interface ReputationIssue {
  type: 'critical' | 'warning' | 'info';
  metric: string;
  value: number;
  threshold: number;
  message: string;
}

/**
 * Configurable thresholds via environment variables
 */
export const REPUTATION_THRESHOLDS = {
  // Critical thresholds - pause sending if exceeded
  bounceRatePause: parseFloat(import.meta.env.VITE_BOUNCE_RATE_PAUSE || '0.05'), // 5%
  spamRatePause: parseFloat(import.meta.env.VITE_SPAM_RATE_PAUSE || '0.001'), // 0.1%
  
  // Warning thresholds
  deliverabilityWarn: parseFloat(import.meta.env.VITE_DELIVERABILITY_WARN || '0.90'), // 90%
  bounceRateWarn: 0.02, // 2%
  spamRateWarn: 0.0005, // 0.05%
  
  // Health score boundaries
  healthScoreCritical: parseInt(import.meta.env.VITE_HEALTH_SCORE_CRITICAL || '50', 10),
};

export class EmailReputationService {
  /**
   * Get reputation metrics for a given period
   */
  async getMetrics(
    userId: string,
    period: '24h' | '7d' | '30d' = '7d'
  ): Promise<ReputationMetrics> {
    const periodMs = this.getPeriodMs(period);
    const startDate = new Date(Date.now() - periodMs);
    
    // Query email events from Firestore
    const events = await this.queryEmailEvents(userId, startDate);
    
    // Aggregate metrics
    const aggregated = this.aggregateEvents(events);
    
    // Calculate rates
    const rates = this.calculateRates(aggregated);
    
    // Calculate health score
    const healthScore = this.calculateHealthScore(rates);
    const healthGrade = this.getHealthGrade(healthScore);
    
    // Get trend data
    const trend = await this.getTrendData(userId, period);
    
    // Identify issues
    const issues = this.identifyIssues(rates);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(issues, rates);
    
    return {
      period,
      ...aggregated,
      ...rates,
      healthScore,
      healthGrade,
      trend,
      issues,
      recommendations,
    };
  }

  /**
   * Check if sending should be paused based on reputation
   */
  shouldPauseSending(metrics: ReputationMetrics): { pause: boolean; reason?: string } {
    if (metrics.bounceRate > REPUTATION_THRESHOLDS.bounceRatePause) {
      return {
        pause: true,
        reason: `Bounce rate (${(metrics.bounceRate * 100).toFixed(2)}%) exceeds threshold (${REPUTATION_THRESHOLDS.bounceRatePause * 100}%)`,
      };
    }
    
    if (metrics.spamRate > REPUTATION_THRESHOLDS.spamRatePause) {
      return {
        pause: true,
        reason: `Spam rate (${(metrics.spamRate * 100).toFixed(3)}%) exceeds threshold (${REPUTATION_THRESHOLDS.spamRatePause * 100}%)`,
      };
    }
    
    if (metrics.healthScore < REPUTATION_THRESHOLDS.healthScoreCritical) {
      return {
        pause: true,
        reason: `Health score (${metrics.healthScore}) is critically low (threshold: ${REPUTATION_THRESHOLDS.healthScoreCritical})`,
      };
    }
    
    return { pause: false };
  }

  /**
   * Get warmup schedule info based on account age
   */
  getWarmupSchedule(accountCreatedAt: Date): {
    week: number;
    dailyLimit: number;
    nextIncrease?: { week: number; limit: number };
  } {
    const weeksSinceCreation = Math.floor(
      (Date.now() - accountCreatedAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    
    const schedule = [
      { week: 1, limit: 50 },
      { week: 2, limit: 100 },
      { week: 3, limit: 250 },
      { week: 4, limit: 500 },
      { week: 5, limit: 1000 },
    ];
    
    const currentWeek = Math.min(weeksSinceCreation + 1, 5);
    const currentLimit = schedule.find(s => s.week === currentWeek)?.limit || 1000;
    const nextSchedule = schedule.find(s => s.week === currentWeek + 1);
    
    return {
      week: currentWeek,
      dailyLimit: currentLimit,
      nextIncrease: nextSchedule,
    };
  }

  // Private helper methods

  private getPeriodMs(period: '24h' | '7d' | '30d'): number {
    switch (period) {
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '30d': return 30 * 24 * 60 * 60 * 1000;
    }
  }

  private async queryEmailEvents(
    userId: string,
    startDate: Date
  ): Promise<Array<{ type: string; timestamp: Date }>> {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    try {
      const eventsRef = collection(db, 'email_events');
      const q = query(
        eventsRef,
        where('userId', '==', userId),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        orderBy('timestamp', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        type: doc.data().type,
        timestamp: doc.data().timestamp.toDate(),
      }));
    } catch (error) {
      console.error('Failed to query email events:', error);
      return [];
    }
  }

  private aggregateEvents(events: Array<{ type: string; timestamp: Date }>): {
    sent: number;
    delivered: number;
    bounced: number;
    complained: number;
    opened: number;
    clicked: number;
    replied: number;
    unsubscribed: number;
  } {
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
    
    for (const event of events) {
      switch (event.type) {
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
    
    return counts;
  }

  private calculateRates(aggregated: {
    sent: number;
    delivered: number;
    bounced: number;
    complained: number;
    opened: number;
    clicked: number;
    replied: number;
  }): {
    deliverabilityRate: number;
    bounceRate: number;
    spamRate: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
  } {
    const { sent, delivered, bounced, complained, opened, clicked, replied } = aggregated;
    
    // Avoid division by zero
    if (sent === 0) {
      return {
        deliverabilityRate: 0,
        bounceRate: 0,
        spamRate: 0,
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
      };
    }
    
    const deliveredCount = delivered > 0 ? delivered : sent - bounced;
    
    return {
      deliverabilityRate: deliveredCount / sent,
      bounceRate: bounced / sent,
      spamRate: complained / sent,
      openRate: deliveredCount > 0 ? opened / deliveredCount : 0,
      clickRate: deliveredCount > 0 ? clicked / deliveredCount : 0,
      replyRate: deliveredCount > 0 ? replied / deliveredCount : 0,
    };
  }

  /**
   * Calculate health score (0-100)
   * 
   * Weighted formula:
   * - Deliverability: 40%
   * - Bounce rate: 25% (inverted)
   * - Spam rate: 25% (inverted)
   * - Open rate: 10%
   */
  private calculateHealthScore(rates: {
    deliverabilityRate: number;
    bounceRate: number;
    spamRate: number;
    openRate: number;
  }): number {
    const { deliverabilityRate, bounceRate, spamRate, openRate } = rates;
    
    // Deliverability component (0-100, higher is better)
    const deliverabilityScore = deliverabilityRate * 100;
    
    // Bounce component (0-100, inverted - 0% bounce = 100 score)
    const bounceScore = Math.max(0, 100 - (bounceRate * 1000)); // 10% bounce = 0 score
    
    // Spam component (0-100, inverted - 0% spam = 100 score)  
    const spamScore = Math.max(0, 100 - (spamRate * 10000)); // 1% spam = 0 score
    
    // Open rate component (0-100, scaled for realistic expectations)
    // 30%+ open rate = 100 score
    const openScore = Math.min(100, (openRate / 0.30) * 100);
    
    // Weighted average
    const score = (
      deliverabilityScore * 0.40 +
      bounceScore * 0.25 +
      spamScore * 0.25 +
      openScore * 0.10
    );
    
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private getHealthGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private async getTrendData(
    userId: string,
    period: '24h' | '7d' | '30d'
  ): Promise<ReputationTrendPoint[]> {
    // For now, return empty - will be populated by aggregation cron
    // This will query from the daily_metrics collection
    if (!db) {
      return [];
    }
    try {
      const days = period === '24h' ? 1 : period === '7d' ? 7 : 30;
      const metricsRef = collection(db, 'daily_metrics');
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const q = query(
        metricsRef,
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(startDate)),
        orderBy('date', 'asc'),
        limit(days)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          date: data.date.toDate().toISOString().split('T')[0],
          sent: data.sent || 0,
          delivered: data.delivered || 0,
          bounced: data.bounced || 0,
          opened: data.opened || 0,
          healthScore: data.healthScore || 0,
        };
      });
    } catch {
      return [];
    }
  }

  private identifyIssues(rates: {
    deliverabilityRate: number;
    bounceRate: number;
    spamRate: number;
    openRate: number;
  }): ReputationIssue[] {
    const issues: ReputationIssue[] = [];
    
    // Critical: High bounce rate
    if (rates.bounceRate > REPUTATION_THRESHOLDS.bounceRatePause) {
      issues.push({
        type: 'critical',
        metric: 'bounceRate',
        value: rates.bounceRate,
        threshold: REPUTATION_THRESHOLDS.bounceRatePause,
        message: `Bounce rate is critically high (${(rates.bounceRate * 100).toFixed(2)}%). Sending should be paused.`,
      });
    } else if (rates.bounceRate > REPUTATION_THRESHOLDS.bounceRateWarn) {
      issues.push({
        type: 'warning',
        metric: 'bounceRate',
        value: rates.bounceRate,
        threshold: REPUTATION_THRESHOLDS.bounceRateWarn,
        message: `Bounce rate is elevated (${(rates.bounceRate * 100).toFixed(2)}%). Review your email list.`,
      });
    }
    
    // Critical: High spam rate
    if (rates.spamRate > REPUTATION_THRESHOLDS.spamRatePause) {
      issues.push({
        type: 'critical',
        metric: 'spamRate',
        value: rates.spamRate,
        threshold: REPUTATION_THRESHOLDS.spamRatePause,
        message: `Spam rate is critically high (${(rates.spamRate * 100).toFixed(3)}%). Sending should be paused.`,
      });
    } else if (rates.spamRate > REPUTATION_THRESHOLDS.spamRateWarn) {
      issues.push({
        type: 'warning',
        metric: 'spamRate',
        value: rates.spamRate,
        threshold: REPUTATION_THRESHOLDS.spamRateWarn,
        message: `Spam rate is elevated (${(rates.spamRate * 100).toFixed(3)}%). Review email content.`,
      });
    }
    
    // Warning: Low deliverability
    if (rates.deliverabilityRate < REPUTATION_THRESHOLDS.deliverabilityWarn && rates.deliverabilityRate > 0) {
      issues.push({
        type: 'warning',
        metric: 'deliverabilityRate',
        value: rates.deliverabilityRate,
        threshold: REPUTATION_THRESHOLDS.deliverabilityWarn,
        message: `Deliverability is below target (${(rates.deliverabilityRate * 100).toFixed(1)}%). Check domain authentication.`,
      });
    }
    
    // Info: Low open rate
    if (rates.openRate < 0.15 && rates.openRate > 0) {
      issues.push({
        type: 'info',
        metric: 'openRate',
        value: rates.openRate,
        threshold: 0.15,
        message: `Open rate is low (${(rates.openRate * 100).toFixed(1)}%). Consider improving subject lines.`,
      });
    }
    
    return issues;
  }

  private generateRecommendations(
    issues: ReputationIssue[],
    rates: { bounceRate: number; spamRate: number; openRate: number }
  ): string[] {
    const recommendations: string[] = [];
    
    const hasBounceIssue = issues.some(i => i.metric === 'bounceRate');
    const hasSpamIssue = issues.some(i => i.metric === 'spamRate');
    const hasDeliverabilityIssue = issues.some(i => i.metric === 'deliverabilityRate');
    const hasOpenRateIssue = issues.some(i => i.metric === 'openRate');
    
    if (hasBounceIssue) {
      recommendations.push('Clean your email list by removing invalid addresses');
      recommendations.push('Verify email addresses before importing');
      recommendations.push('Remove addresses that have bounced previously');
    }
    
    if (hasSpamIssue) {
      recommendations.push('Review your email content for spam triggers');
      recommendations.push('Ensure clear unsubscribe links are present');
      recommendations.push('Avoid using excessive capitalization or exclamation marks');
      recommendations.push('Make sure your domain authentication (SPF/DKIM/DMARC) is correct');
    }
    
    if (hasDeliverabilityIssue) {
      recommendations.push('Check your domain authentication settings');
      recommendations.push('Verify SPF, DKIM, and DMARC records are configured');
      recommendations.push('Consider using a dedicated sending IP if volume is high');
    }
    
    if (hasOpenRateIssue) {
      recommendations.push('Test different subject lines');
      recommendations.push('Send emails during business hours in recipient time zones');
      recommendations.push('Personalize your subject lines with recipient name or company');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Your email reputation looks healthy! Keep it up.');
    }
    
    return recommendations;
  }
}

export const emailReputationService = new EmailReputationService();
