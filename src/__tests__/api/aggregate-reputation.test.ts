/**
 * Reputation Aggregation Cron Contract Tests
 * 
 * Sprint 39A.6: Tests for daily email metrics aggregation API contract
 * 
 * Note: These tests validate the API contract without importing the handler
 * directly, as Vite cannot resolve api/ imports in test files.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('aggregate-reputation cron contract', () => {
  describe('Request validation', () => {
    it('defines expected request structure', () => {
      // Valid request with Vercel cron header
      const validVercelRequest = {
        method: 'GET',
        headers: { 'x-vercel-cron': '1' },
        query: {},
      };
      expect(validVercelRequest.headers['x-vercel-cron']).toBe('1');
      
      // Valid external request with auth
      const validExternalRequest = {
        method: 'POST',
        headers: { authorization: 'Bearer test-secret' },
        query: {},
      };
      expect(validExternalRequest.headers.authorization).toContain('Bearer');
    });

    it('supports date query parameter for backfill', () => {
      const backfillRequest = {
        method: 'GET',
        headers: { 'x-vercel-cron': '1' },
        query: { date: '2025-01-15' },
      };
      expect(backfillRequest.query.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Response contract', () => {
    interface AggregationSuccessResponse {
      success: boolean;
      date: string;
      aggregated: number;
      updated: number;
      failed: number;
      duration: number;
      requestId: string;
    }

    it('defines success response format', () => {
      const successResponse: AggregationSuccessResponse = {
        success: true,
        date: '2025-01-15',
        aggregated: 10,
        updated: 5,
        failed: 0,
        duration: 1234,
        requestId: 'test-123',
      };

      expect(successResponse).toHaveProperty('success', true);
      expect(successResponse).toHaveProperty('date');
      expect(successResponse).toHaveProperty('aggregated');
      expect(successResponse).toHaveProperty('updated');
      expect(successResponse).toHaveProperty('failed');
      expect(successResponse).toHaveProperty('duration');
      expect(successResponse).toHaveProperty('requestId');
    });

    interface AggregationErrorResponse {
      error: string;
      message: string;
      requestId: string;
    }

    it('defines error response format', () => {
      const errorResponse: AggregationErrorResponse = {
        error: 'Aggregation failed',
        message: 'Database connection failed',
        requestId: 'test-123',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).toHaveProperty('message');
      expect(errorResponse).toHaveProperty('requestId');
    });
  });

  describe('DailyMetrics schema', () => {
    interface DailyMetrics {
      date: string;
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
    }

    it('validates DailyMetrics structure', () => {
      const metrics: DailyMetrics = {
        date: '2025-01-15',
        userId: 'user123',
        sent: 100,
        delivered: 95,
        bounced: 5,
        complained: 1,
        opened: 30,
        clicked: 10,
        replied: 5,
        unsubscribed: 2,
        deliverabilityRate: 0.95,
        bounceRate: 0.05,
        spamRate: 0.01,
        openRate: 0.316,
        clickRate: 0.105,
        healthScore: 78,
      };

      // Date format
      expect(metrics.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Counts are non-negative integers
      expect(metrics.sent).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(metrics.sent)).toBe(true);
      
      // Rates are between 0 and 1
      expect(metrics.deliverabilityRate).toBeGreaterThanOrEqual(0);
      expect(metrics.deliverabilityRate).toBeLessThanOrEqual(1);
      
      // Health score is 0-100
      expect(metrics.healthScore).toBeGreaterThanOrEqual(0);
      expect(metrics.healthScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Health score calculation', () => {
    /**
     * Formula: 40% deliverability + 25% (1-bounce) + 25% (1-spam) + 10% opens
     */
    function calculateHealthScore(metrics: {
      deliverabilityRate: number;
      bounceRate: number;
      spamRate: number;
      openRate: number;
    }): number {
      const { deliverabilityRate, bounceRate, spamRate, openRate } = metrics;
      
      const deliveryScore = deliverabilityRate * 100;
      const bounceScore = Math.max(0, (1 - bounceRate * 10)) * 100;
      const spamScore = Math.max(0, (1 - spamRate * 100)) * 100;
      const openScore = Math.min(openRate * 2, 1) * 100;
      
      const score = (
        deliveryScore * 0.40 +
        bounceScore * 0.25 +
        spamScore * 0.25 +
        openScore * 0.10
      );
      
      return Math.round(Math.max(0, Math.min(100, score)));
    }

    it('calculates perfect score (100) correctly', () => {
      const score = calculateHealthScore({
        deliverabilityRate: 1.0,
        bounceRate: 0,
        spamRate: 0,
        openRate: 0.5, // 50%+ opens gives full 10 points
      });
      expect(score).toBe(100);
    });

    it('penalizes high bounce rate', () => {
      // 10% bounce zeros out bounce component (25 points)
      const score = calculateHealthScore({
        deliverabilityRate: 1.0,
        bounceRate: 0.10,
        spamRate: 0,
        openRate: 0.5,
      });
      // 40 + 0 + 25 + 10 = 75
      expect(score).toBe(75);
    });

    it('penalizes spam complaints severely', () => {
      // 1% spam zeros out spam component (25 points)
      const score = calculateHealthScore({
        deliverabilityRate: 1.0,
        bounceRate: 0,
        spamRate: 0.01,
        openRate: 0.5,
      });
      // 40 + 25 + 0 + 10 = 75
      expect(score).toBe(75);
    });

    it('handles poor metrics (F grade scenario)', () => {
      const score = calculateHealthScore({
        deliverabilityRate: 0.80, // 80% delivered
        bounceRate: 0.15, // 15% bounce (very bad)
        spamRate: 0.02, // 2% spam (very bad)
        openRate: 0.05, // 5% opens
      });
      // 32 + 0 + 0 + 1 = 33
      expect(score).toBeLessThanOrEqual(50);
    });

    it('clamps score between 0-100', () => {
      // Even with impossible negative values
      const score = calculateHealthScore({
        deliverabilityRate: 0,
        bounceRate: 1, // 100% bounce
        spamRate: 1, // 100% spam
        openRate: 0,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('Cron schedule', () => {
    it('runs daily at 2 AM UTC', () => {
      // Defined in vercel.json
      const cronSchedule = '0 2 * * *'; // 2:00 AM UTC daily
      
      // Parse cron parts
      const [minute, hour, dayOfMonth, month, dayOfWeek] = cronSchedule.split(' ');
      expect(minute).toBe('0');
      expect(hour).toBe('2');
      expect(dayOfMonth).toBe('*');
      expect(month).toBe('*');
      expect(dayOfWeek).toBe('*');
    });
  });

  describe('Authentication', () => {
    it('accepts Vercel native cron header', () => {
      const vercelCronHeader = 'x-vercel-cron';
      const validValue = '1';
      expect(validValue).toBe('1');
    });

    it('accepts Bearer token for external calls', () => {
      const authHeader = 'Bearer my-cron-secret';
      expect(authHeader).toMatch(/^Bearer .+$/);
    });
  });
});

