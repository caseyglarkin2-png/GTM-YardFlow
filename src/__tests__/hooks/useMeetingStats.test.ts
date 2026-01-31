/**
 * Tests for useMeetingStats Hook
 * Sprint 204: Meeting Attribution Dashboard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch before importing the hook
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMeetingStats, useMeetingKPIs } from '@/hooks/useMeetingStats';

describe('useMeetingStats', () => {
  const mockAnalytics = {
    bySequence: [
      { name: 'Q1 Outreach', sequenceId: 'seq1', count: 15 },
      { name: 'Cold Outreach', sequenceId: 'seq2', count: 10 },
    ],
    byTemplate: [
      { name: 'Introduction', templateId: 'tpl1', count: 12 },
      { name: 'Value Prop', templateId: 'tpl2', count: 8 },
    ],
    byDay: [
      { date: '2024-01-15', count: 5 },
      { date: '2024-01-16', count: 3 },
    ],
    total: 25,
    thisWeek: 10,
    lastWeek: 8,
    percentChange: 25,
  };

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockAnalytics }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useMeetingStats hook', () => {
    it('returns initial loading state', () => {
      const { result } = renderHook(() => useMeetingStats({}));
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.analytics).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('fetches and returns analytics data', async () => {
      const { result } = renderHook(() => useMeetingStats({}));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.analytics).toEqual(mockAnalytics);
      expect(result.current.error).toBeNull();
    });

    it('handles fetch error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useMeetingStats({}));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.analytics).toBeNull();
      expect(result.current.error).toBeTruthy();
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useMeetingStats({}));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.error?.message).toBe('Network error');
    });

    it('includes date parameters in fetch request', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      renderHook(() => useMeetingStats({ startDate, endDate }));
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('startDate=');
      expect(url).toContain('endDate=');
    });

    it('refresh function triggers new fetch', async () => {
      const { result } = renderHook(() => useMeetingStats({}));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      act(() => {
        result.current.refresh();
      });
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    it('refetches when dates change', async () => {
      const { result, rerender } = renderHook(
        (props: { startDate?: Date }) => useMeetingStats(props),
        { initialProps: { startDate: new Date('2024-01-01') } }
      );
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      rerender({ startDate: new Date('2024-02-01') });
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('useMeetingKPIs hook', () => {
    it('returns computed KPIs from analytics', async () => {
      const { result } = renderHook(() => useMeetingKPIs({}));
      
      await waitFor(() => {
        expect(result.current.total).toBe(25);
      });
      
      expect(result.current.thisWeek).toBe(10);
      expect(result.current.lastWeek).toBe(8);
      expect(result.current.trend).toBe('up');
    });

    it('identifies top sequence correctly', async () => {
      const { result } = renderHook(() => useMeetingKPIs({}));
      
      await waitFor(() => {
        expect(result.current.topSequence).toBeDefined();
      });
      
      expect(result.current.topSequence?.name).toBe('Q1 Outreach');
      expect(result.current.topSequence?.count).toBe(15);
    });

    it('identifies top template correctly', async () => {
      const { result } = renderHook(() => useMeetingKPIs({}));
      
      await waitFor(() => {
        expect(result.current.topTemplate).toBeDefined();
      });
      
      expect(result.current.topTemplate?.name).toBe('Introduction');
      expect(result.current.topTemplate?.count).toBe(12);
    });

    it('returns down trend when week decreased', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ...mockAnalytics,
            thisWeek: 5,
            lastWeek: 10,
            percentChange: -50,
          },
        }),
      });

      const { result } = renderHook(() => useMeetingKPIs({}));
      
      await waitFor(() => {
        expect(result.current.trend).toBe('down');
      });
    });

    it('returns flat trend when no change', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ...mockAnalytics,
            thisWeek: 10,
            lastWeek: 10,
            percentChange: 0,
          },
        }),
      });

      const { result } = renderHook(() => useMeetingKPIs({}));
      
      await waitFor(() => {
        expect(result.current.trend).toBe('flat');
      });
    });

    it('returns null for top items when empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ...mockAnalytics,
            bySequence: [],
            byTemplate: [],
          },
        }),
      });

      const { result } = renderHook(() => useMeetingKPIs({}));
      
      await waitFor(() => {
        expect(result.current.topSequence).toBeNull();
        expect(result.current.topTemplate).toBeNull();
      });
    });

    it('returns default values while loading', () => {
      // Don't resolve fetch immediately
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useMeetingKPIs({}));
      
      expect(result.current.total).toBe(0);
      expect(result.current.thisWeek).toBe(0);
      expect(result.current.lastWeek).toBe(0);
      expect(result.current.trend).toBe('flat');
      expect(result.current.topSequence).toBeNull();
      expect(result.current.topTemplate).toBeNull();
    });
  });
});
