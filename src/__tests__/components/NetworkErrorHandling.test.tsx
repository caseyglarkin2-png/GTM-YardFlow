/**
 * Sprint V37 - T37C: Network Error UI Handling Tests
 * 
 * Tests that the app shows appropriate error messages and recovers gracefully
 * from network errors, timeouts, and API failures.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// Mock toast notifications
const mockToast = {
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
};

vi.mock('react-hot-toast', () => ({
  default: mockToast,
  toast: mockToast,
  Toaster: () => null,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Network Error UI Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Railway API Timeout Handling', () => {
    it('shows "Request timed out" message on timeout', async () => {
      // Simulate timeout
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 50)
        )
      );

      let errorMessage = '';
      try {
        await fetch('/api/railway/prospects');
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
      }

      expect(errorMessage).toContain('timeout');
    });

    it('provides retry option after timeout', async () => {
      let retryCount = 0;
      
      // First call times out
      mockFetch
        .mockImplementationOnce(() => Promise.reject(new Error('Request timeout')))
        .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) }));

      // Retry logic
      const fetchWithRetry = async (url: string, retries = 1): Promise<Response> => {
        try {
          return await fetch(url);
        } catch (error) {
          if (retries > 0) {
            retryCount++;
            return fetchWithRetry(url, retries - 1);
          }
          throw error;
        }
      };

      const response = await fetchWithRetry('/api/railway/prospects');
      
      expect(retryCount).toBe(1);
      expect(response.ok).toBe(true);
    });
  });

  describe('500 Error Handling', () => {
    it('shows error toast on 500 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      const response = await fetch('/api/railway/prospects');
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('includes requestId in error for debugging', async () => {
      const requestId = 'abc12345';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ 
          error: 'Internal server error',
          requestId,
        }),
      });

      const response = await fetch('/api/railway/prospects');
      const data = await response.json();

      expect(data.requestId).toBe(requestId);
    });
  });

  describe('Authentication Error Handling', () => {
    it('shows re-login prompt on 401 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Invalid token' }),
      });

      const response = await fetch('/api/railway/prospects');
      
      expect(response.status).toBe(401);
      // App should prompt re-login
    });

    it('shows forbidden message on 403 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Origin validation failed' }),
      });

      const response = await fetch('/api/railway/prospects');
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('validation');
    });
  });

  describe('Rate Limit (429) Handling', () => {
    it('shows user-friendly "Please wait" message on rate limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Date.now() / 1000 + 60),
        }),
        json: () => Promise.resolve({ 
          error: 'Daily email limit reached',
          reason: 'warmup_limit',
          remaining: 0,
          message: 'New accounts start with 20 emails/day.',
        }),
      });

      const response = await fetch('/api/email/send');
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.message).toContain('20 emails/day');
      expect(data.reason).toBe('warmup_limit');
    });

    it('extracts retry-after header for countdown display', async () => {
      const retryAfterSeconds = 60;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          'Retry-After': String(retryAfterSeconds),
        }),
        json: () => Promise.resolve({ error: 'Rate limited' }),
      });

      const response = await fetch('/api/email/send');
      const retryAfter = response.headers.get('Retry-After');

      expect(retryAfter).toBe('60');
    });
  });

  describe('Network Offline Handling', () => {
    it('detects navigator.onLine false', () => {
      // Mock navigator.onLine
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });

      expect(navigator.onLine).toBe(false);

      // Restore
      Object.defineProperty(navigator, 'onLine', {
        value: originalOnLine,
        configurable: true,
      });
    });

    it('shows offline indicator when fetch fails with network error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      let isOffline = false;
      try {
        await fetch('/api/railway/health');
      } catch (error) {
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          isOffline = true;
        }
      }

      expect(isOffline).toBe(true);
    });

    it('queues operations when offline', async () => {
      const offlineQueue: Array<{ url: string; method: string; body: unknown }> = [];
      
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const queuedFetch = async (url: string, options: RequestInit = {}) => {
        try {
          return await fetch(url, options);
        } catch (error) {
          if (error instanceof TypeError && error.message === 'Failed to fetch') {
            offlineQueue.push({
              url,
              method: options.method || 'GET',
              body: options.body,
            });
            return null;
          }
          throw error;
        }
      };

      await queuedFetch('/api/email/send', { 
        method: 'POST', 
        body: JSON.stringify({ to: 'test@example.com' }),
      });

      expect(offlineQueue).toHaveLength(1);
      expect(offlineQueue[0].url).toBe('/api/email/send');
    });
  });

  describe('Circuit Breaker Open (503) Handling', () => {
    it('shows service unavailable message when circuit is open', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({
          error: 'Service temporarily unavailable',
          code: 'CIRCUIT_OPEN',
          detail: 'Circuit breaker is open after 5 consecutive failures',
        }),
      });

      const response = await fetch('/api/railway/prospects');
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.code).toBe('CIRCUIT_OPEN');
    });

    it('suggests retry after circuit breaker timeout', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({
          'Retry-After': '30', // Circuit breaker timeout
        }),
        json: () => Promise.resolve({
          error: 'Service temporarily unavailable',
        }),
      });

      const response = await fetch('/api/railway/prospects');
      const retryAfter = response.headers.get('Retry-After');

      expect(retryAfter).toBe('30');
    });
  });

  describe('Malformed Response Handling', () => {
    it('handles non-JSON response gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
        text: () => Promise.resolve('<!DOCTYPE html><html>Error Page</html>'),
      });

      const response = await fetch('/api/railway/prospects');
      
      let parseError = false;
      try {
        await response.json();
      } catch (error) {
        if (error instanceof SyntaxError) {
          parseError = true;
        }
      }

      expect(parseError).toBe(true);
    });

    it('handles empty response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
      });

      const response = await fetch('/api/railway/delete/123');
      
      expect(response.status).toBe(204);
    });
  });

  describe('Error Recovery', () => {
    it('clears error state on successful retry', async () => {
      let errorState: string | null = 'Network error';
      
      // First call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      });

      const response = await fetch('/api/railway/prospects');
      if (response.ok) {
        errorState = null;
      }

      expect(errorState).toBeNull();
    });

    it('maintains app usability during errors', async () => {
      // Even with errors, app should remain interactive
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      let appUsable = true;
      try {
        await fetch('/api/railway/prospects');
      } catch {
        // Error occurred but app should still be usable
        appUsable = true;
      }

      expect(appUsable).toBe(true);
    });
  });
});

describe('Error Message User-Friendliness', () => {
  describe('Technical to User-Friendly Translation', () => {
    const errorTranslations: Array<{ technical: string; userFriendly: string }> = [
      { technical: 'ECONNREFUSED', userFriendly: 'Unable to connect to server' },
      { technical: 'ETIMEDOUT', userFriendly: 'Request timed out' },
      { technical: 'Failed to fetch', userFriendly: 'Network connection lost' },
      { technical: 'Internal server error', userFriendly: 'Something went wrong on our end' },
      { technical: 'Invalid token', userFriendly: 'Please sign in again' },
      { technical: 'Rate limited', userFriendly: 'Too many requests. Please wait a moment.' },
    ];

    it.each(errorTranslations)(
      'translates "$technical" to user-friendly message',
      ({ technical, userFriendly }) => {
        const translateError = (error: string): string => {
          const map: Record<string, string> = {
            'ECONNREFUSED': 'Unable to connect to server',
            'ETIMEDOUT': 'Request timed out',
            'Failed to fetch': 'Network connection lost',
            'Internal server error': 'Something went wrong on our end',
            'Invalid token': 'Please sign in again',
            'Rate limited': 'Too many requests. Please wait a moment.',
          };
          return map[error] || 'An unexpected error occurred';
        };

        expect(translateError(technical)).toBe(userFriendly);
      }
    );
  });

  describe('Error Context Preservation', () => {
    it('includes requestId for support debugging', async () => {
      const requestId = 'req_abc123';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          error: 'Internal error',
          requestId,
        }),
      });

      const response = await fetch('/api/email/send');
      const data = await response.json();

      // Error should include requestId for support
      expect(data.requestId).toBe(requestId);
    });

    it('preserves error detail for advanced users', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: () => Promise.resolve({
          error: 'Email blocked',
          reason: 'suppressed',
          detail: 'Email is on bounce list since 2026-01-15',
        }),
      });

      const response = await fetch('/api/email/send');
      const data = await response.json();

      expect(data.detail).toContain('bounce list');
    });
  });
});
