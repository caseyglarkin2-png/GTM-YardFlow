/**
 * useEmailReputation Hook Tests
 * 
 * Sprint 39A.3: Tests for email reputation React hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock Firebase auth
vi.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('mock-token'),
    },
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { useEmailReputation } from '../../hooks/useEmailReputation';

describe('useEmailReputation', () => {
  const mockReputationData = {
    metrics: {
      period: '7d',
      sent: 100,
      delivered: 95,
      bounced: 5,
      complained: 0,
      opened: 30,
      clicked: 10,
      replied: 5,
      unsubscribed: 2,
      deliverabilityRate: 0.95,
      bounceRate: 0.05,
      spamRate: 0,
      openRate: 0.316,
      clickRate: 0.105,
      replyRate: 0.053,
      healthScore: 85,
      healthGrade: 'B' as const,
    },
    trend: [],
    issues: [],
    recommendations: ['Your email reputation looks healthy!'],
    pauseRecommended: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockReputationData),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts in loading state', () => {
      const { result } = renderHook(() => useEmailReputation());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('skips initial fetch when skipInitialFetch is true', async () => {
      const { result } = renderHook(() => 
        useEmailReputation({ skipInitialFetch: true })
      );

      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('data fetching', () => {
    it('fetches data on mount', async () => {
      const { result } = renderHook(() => useEmailReputation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/email/reputation?period=7d',
        expect.objectContaining({
          headers: { Authorization: 'Bearer mock-token' },
        })
      );
      expect(result.current.data).toEqual(mockReputationData);
    });

    it('uses correct period in request', async () => {
      renderHook(() => useEmailReputation({ period: '30d' }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/email/reputation?period=30d',
          expect.any(Object)
        );
      });
    });

    it('handles fetch errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const { result } = renderHook(() => useEmailReputation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Server error');
      expect(result.current.data).toBeNull();
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useEmailReputation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('refresh', () => {
    it('provides refresh function', async () => {
      const { result } = renderHook(() => useEmailReputation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refresh).toBe('function');
    });

    it('refresh fetches new data', async () => {
      const { result } = renderHook(() => useEmailReputation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('computed values', () => {
    it('calculates gradeColor correctly', async () => {
      const { result } = renderHook(() => useEmailReputation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // B grade should be blue
      expect(result.current.gradeColor).toBe('text-blue-600');
    });

    it('calculates isHealthy correctly', async () => {
      const { result } = renderHook(() => useEmailReputation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 85 score is healthy
      expect(result.current.isHealthy).toBe(true);
    });

    it('reports unhealthy for low scores', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...mockReputationData,
          metrics: { ...mockReputationData.metrics, healthScore: 50 },
        }),
      });

      const { result } = renderHook(() => useEmailReputation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isHealthy).toBe(false);
    });

    it('calculates shouldPauseSending from response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...mockReputationData,
          pauseRecommended: true,
          pauseReason: 'High bounce rate',
        }),
      });

      const { result } = renderHook(() => useEmailReputation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.shouldPauseSending).toBe(true);
    });
  });

  describe('lastUpdated', () => {
    it('sets lastUpdated after successful fetch', async () => {
      const { result } = renderHook(() => useEmailReputation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lastUpdated).toBeInstanceOf(Date);
    });

    it('lastUpdated is null before fetch', () => {
      const { result } = renderHook(() => 
        useEmailReputation({ skipInitialFetch: true })
      );

      expect(result.current.lastUpdated).toBeNull();
    });
  });

  describe('grade colors', () => {
    const gradeTests: Array<{
      grade: 'A' | 'B' | 'C' | 'D' | 'F';
      expectedColor: string;
    }> = [
      { grade: 'A', expectedColor: 'text-green-600' },
      { grade: 'B', expectedColor: 'text-blue-600' },
      { grade: 'C', expectedColor: 'text-yellow-600' },
      { grade: 'D', expectedColor: 'text-orange-600' },
      { grade: 'F', expectedColor: 'text-red-600' },
    ];

    gradeTests.forEach(({ grade, expectedColor }) => {
      it(`returns ${expectedColor} for grade ${grade}`, async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            ...mockReputationData,
            metrics: { ...mockReputationData.metrics, healthGrade: grade },
          }),
        });

        const { result } = renderHook(() => useEmailReputation());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.gradeColor).toBe(expectedColor);
      });
    });
  });
});
