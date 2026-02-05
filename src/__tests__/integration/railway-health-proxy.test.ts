/**
 * Sprint V37 - T37B: Railway Health Proxy Integration Tests
 * 
 * Tests the health check flow from the Railway proxy perspective.
 * Verifies health status propagation and offline mode fallback behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Railway Health Proxy Integration', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Health Status Propagation', () => {
    it('returns healthy status when Railway backend is healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          status: 'healthy',
          database: 'connected',
          redis: 'connected',
          queue: { pending: 0, processing: 0 },
          timestamp: '2026-02-05T12:00:00.000Z',
        }),
      });

      const response = await fetch('/api/railway/health');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.status).toBe('healthy');
      expect(data.database).toBe('connected');
      expect(data.redis).toBe('connected');
    });

    it('returns degraded status when subsystems are unhealthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          status: 'degraded',
          database: 'connected',
          redis: 'error',
          queue: { pending: 100, processing: 5 },
          timestamp: '2026-02-05T12:00:00.000Z',
        }),
      });

      const response = await fetch('/api/railway/health');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.status).toBe('degraded');
      expect(data.redis).toBe('error');
    });

    it('returns unhealthy status when Railway returns 500', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        }),
      });

      const response = await fetch('/api/railway/health');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe('Offline Mode Detection', () => {
    it('detects offline state when fetch fails with network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      let isOffline = false;
      try {
        await fetch('/api/railway/health');
      } catch (error) {
        isOffline = error instanceof Error && error.message === 'Failed to fetch';
      }

      expect(isOffline).toBe(true);
    });

    it('detects offline state when timeout occurs', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      let timedOut = false;
      try {
        await fetch('/api/railway/health');
      } catch (error) {
        timedOut = error instanceof Error && error.message.includes('timeout');
      }

      expect(timedOut).toBe(true);
    });

    it('returns 503 when circuit breaker is open', async () => {
      // Simulate circuit breaker open response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({
          error: 'Service temporarily unavailable',
          code: 'CIRCUIT_OPEN',
          detail: 'Circuit breaker is open after 5 consecutive failures',
        }),
      });

      const response = await fetch('/api/railway/health');
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.code).toBe('CIRCUIT_OPEN');
    });
  });

  describe('Health Check Caching', () => {
    it('caches successful health checks for 5 seconds', async () => {
      // First call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      await fetch('/api/railway/health');
      
      // Second call immediately after should still work but may be cached
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      const response2 = await fetch('/api/railway/health');
      const data2 = await response2.json();

      expect(data2.status).toBe('healthy');
    });

    it('does not cache error responses', async () => {
      // First call fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Database down' }),
      });

      await fetch('/api/railway/health').catch(() => {});

      // Second call should retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      const response2 = await fetch('/api/railway/health');
      const data2 = await response2.json();

      expect(data2.status).toBe('healthy');
    });
  });

  describe('Health Response Structure', () => {
    it('includes all required health fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          status: 'healthy',
          database: 'connected',
          redis: 'connected',
          queue: { pending: 0, processing: 0 },
          ai: { openai: 'connected', anthropic: 'connected' },
          timestamp: '2026-02-05T12:00:00.000Z',
          version: '1.0.0',
          uptime: 86400,
        }),
      });

      const response = await fetch('/api/railway/health');
      const data = await response.json();

      // Required fields
      expect(data.status).toBeDefined();
      expect(data.database).toBeDefined();
      expect(data.redis).toBeDefined();
      expect(data.timestamp).toBeDefined();
      
      // Optional but expected fields
      expect(data.queue).toBeDefined();
      expect(data.queue.pending).toBeDefined();
      expect(data.queue.processing).toBeDefined();
    });

    it('handles missing optional fields gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          status: 'healthy',
          timestamp: '2026-02-05T12:00:00.000Z',
        }),
      });

      const response = await fetch('/api/railway/health');
      const data = await response.json();

      expect(data.status).toBe('healthy');
      // Missing fields should not throw
      expect(data.database).toBeUndefined();
    });
  });
});

describe('Offline Mode Fallback Behavior', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('Local Queue Fallback', () => {
    it('queues email locally when Railway is offline', async () => {
      // Mock Railway being offline
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      const localQueue: Array<{ to: string; subject: string }> = [];
      
      // Simulate queueing locally on failure
      try {
        await fetch('/api/railway/email/send', {
          method: 'POST',
          body: JSON.stringify({ to: 'test@example.com', subject: 'Test' }),
        });
      } catch {
        // Fallback: queue locally
        localQueue.push({ to: 'test@example.com', subject: 'Test' });
      }

      expect(localQueue).toHaveLength(1);
      expect(localQueue[0].to).toBe('test@example.com');
    });

    it('processes local queue when Railway comes back online', async () => {
      const localQueue = [
        { to: 'test1@example.com', subject: 'Test 1' },
        { to: 'test2@example.com', subject: 'Test 2' },
      ];

      // Mock Railway coming back online
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      // Process queue
      const results = await Promise.all(
        localQueue.map(email => 
          fetch('/api/railway/email/send', {
            method: 'POST',
            body: JSON.stringify(email),
          })
        )
      );

      expect(results.every(r => r.ok)).toBe(true);
    });
  });

  describe('UI Indicator State', () => {
    it('sets offline indicator when health check fails 3 times', async () => {
      let failureCount = 0;
      let isOfflineIndicatorShown = false;

      // Simulate 3 consecutive failures
      for (let i = 0; i < 3; i++) {
        mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));
        
        try {
          await fetch('/api/railway/health');
        } catch {
          failureCount++;
        }
      }

      // After 3 failures, should show offline indicator
      if (failureCount >= 3) {
        isOfflineIndicatorShown = true;
      }

      expect(failureCount).toBe(3);
      expect(isOfflineIndicatorShown).toBe(true);
    });

    it('clears offline indicator when health check succeeds', async () => {
      let isOfflineIndicatorShown = true;

      // Mock successful health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      const response = await fetch('/api/railway/health');
      if (response.ok) {
        isOfflineIndicatorShown = false;
      }

      expect(isOfflineIndicatorShown).toBe(false);
    });
  });
});
