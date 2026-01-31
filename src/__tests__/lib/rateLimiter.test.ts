/**
 * Rate Limiter Tests
 * Sprint 300 - T300.1 (Enhanced from Sprint 200)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  rateLimit, 
  checkRateLimit,
  clearRateLimitStore, 
  getClientIp, 
  getRateLimitHeaders,
  RATE_LIMIT_CONFIGS 
} from '../../../lib/rateLimiter';

describe('rateLimiter', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  describe('rateLimit', () => {
    it('allows requests under the limit', () => {
      const result = rateLimit('test-ip', 5, 60000);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    it('decrements remaining count on each request', () => {
      const limit = 5;
      
      for (let i = 0; i < limit; i++) {
        const result = rateLimit('test-ip-2', limit, 60000);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(limit - i - 1);
      }
    });

    it('blocks requests when limit is exceeded', () => {
      const limit = 3;
      
      // Use up the limit
      for (let i = 0; i < limit; i++) {
        rateLimit('test-ip-3', limit, 60000);
      }
      
      // Next request should be blocked
      const result = rateLimit('test-ip-3', limit, 60000);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('isolates rate limits by identifier', () => {
      const limit = 2;
      
      // Exhaust limit for IP1
      rateLimit('ip-1', limit, 60000);
      rateLimit('ip-1', limit, 60000);
      const blocked = rateLimit('ip-1', limit, 60000);
      
      // IP2 should still be allowed
      const allowed = rateLimit('ip-2', limit, 60000);
      
      expect(blocked.allowed).toBe(false);
      expect(allowed.allowed).toBe(true);
    });

    it('resets after window expires', async () => {
      const limit = 2;
      const windowMs = 50; // 50ms window for testing
      
      // Exhaust limit
      rateLimit('test-ip-4', limit, windowMs);
      rateLimit('test-ip-4', limit, windowMs);
      const blocked = rateLimit('test-ip-4', limit, windowMs);
      expect(blocked.allowed).toBe(false);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 60));
      
      // Should be allowed again
      const result = rateLimit('test-ip-4', limit, windowMs);
      expect(result.allowed).toBe(true);
    });

    it('returns correct resetAt timestamp', () => {
      const windowMs = 60000;
      const beforeTime = Date.now();
      
      const result = rateLimit('test-ip-5', 100, windowMs);
      
      const afterTime = Date.now();
      expect(result.resetAt).toBeGreaterThanOrEqual(beforeTime + windowMs);
      expect(result.resetAt).toBeLessThanOrEqual(afterTime + windowMs);
    });
  });

  describe('getClientIp', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const request = new Request('http://test.com', {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      });
      
      expect(getClientIp(request)).toBe('192.168.1.1');
    });

    it('extracts IP from x-real-ip header', () => {
      const request = new Request('http://test.com', {
        headers: { 'x-real-ip': '192.168.1.2' },
      });
      
      expect(getClientIp(request)).toBe('192.168.1.2');
    });

    it('returns unknown when no IP headers present', () => {
      const request = new Request('http://test.com');
      
      expect(getClientIp(request)).toBe('unknown');
    });

    it('prefers x-forwarded-for over x-real-ip', () => {
      const request = new Request('http://test.com', {
        headers: {
          'x-forwarded-for': '10.0.0.1',
          'x-real-ip': '192.168.1.1',
        },
      });
      
      expect(getClientIp(request)).toBe('10.0.0.1');
    });
  });

  describe('RATE_LIMIT_CONFIGS', () => {
    it('has default config', () => {
      expect(RATE_LIMIT_CONFIGS.default).toEqual({
        limit: 100,
        windowMs: 60000,
      });
    });

    it('has stricter config for email endpoints', () => {
      expect(RATE_LIMIT_CONFIGS.email.limit).toBeLessThan(RATE_LIMIT_CONFIGS.default.limit);
    });

    it('has stricter config for auth endpoints', () => {
      expect(RATE_LIMIT_CONFIGS.auth.limit).toBeLessThan(RATE_LIMIT_CONFIGS.default.limit);
    });

    it('has higher limit for webhooks', () => {
      expect(RATE_LIMIT_CONFIGS.webhook.limit).toBeGreaterThan(RATE_LIMIT_CONFIGS.default.limit);
    });

    it('has ai config', () => {
      expect(RATE_LIMIT_CONFIGS.ai.limit).toBe(30);
    });
  });

  describe('checkRateLimit (async)', () => {
    it('allows requests under the limit', async () => {
      const result = await checkRateLimit('async-ip-1', 5, 60000);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.limit).toBe(5);
    });

    it('blocks requests when limit exceeded', async () => {
      const limit = 3;
      const ip = 'async-ip-2';
      
      // Use up the limit
      for (let i = 0; i < limit; i++) {
        await checkRateLimit(ip, limit, 60000);
      }
      
      // Next request should be blocked
      const result = await checkRateLimit(ip, limit, 60000);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('uses in-memory fallback when Upstash not configured', async () => {
      // Without UPSTASH_REDIS_REST_URL, should use in-memory
      const result = await checkRateLimit('async-ip-3');
      
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
    });
  });

  describe('getRateLimitHeaders', () => {
    it('returns correct header format', () => {
      const result = {
        allowed: true,
        remaining: 50,
        resetAt: 1706745600000,
        limit: 100,
      };
      
      const headers = getRateLimitHeaders(result);
      
      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('50');
      expect(headers['X-RateLimit-Reset']).toBe('1706745600');
    });

    it('converts resetAt from ms to seconds', () => {
      const result = {
        allowed: false,
        remaining: 0,
        resetAt: 1706745612345,
        limit: 10,
      };
      
      const headers = getRateLimitHeaders(result);
      
      expect(headers['X-RateLimit-Reset']).toBe('1706745613'); // Rounded up
    });
  });
});
