/**
 * useWarmupStatus Hook Tests
 * 
 * Sprint 38F: Tests for email warmup status hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWarmupStatus, getWarmupSchedule, wouldExceedLimit } from '../../hooks/useWarmupStatus';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock feature flags
vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    BYPASS_EMAIL_WARMUP: false,
  },
}));

describe('useWarmupStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sent: 25, total: 25 }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches warmup status on mount', async () => {
    const { result } = renderHook(() => useWarmupStatus({ autoRefresh: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/email/stats?period=today');
    expect(result.current.status).toBeDefined();
    expect(result.current.status?.sentToday).toBe(25);
  });

  it('calculates remaining sends correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sent: 30 }),
    });

    const { result } = renderHook(() => useWarmupStatus({ autoRefresh: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Week 2 = 100/day, sent 30 = 70 remaining
    expect(result.current.status?.dailyLimit).toBe(100);
    expect(result.current.status?.sentToday).toBe(30);
    expect(result.current.status?.remaining).toBe(70);
    expect(result.current.status?.canSend).toBe(true);
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWarmupStatus({ autoRefresh: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    // Should still have default status
    expect(result.current.status).toBeDefined();
    expect(result.current.status?.canSend).toBe(true);
  });

  it('calculates usage percentage', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sent: 80 }),
    });

    const { result } = renderHook(() => useWarmupStatus({ autoRefresh: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Week 2 = 100/day, sent 80 = 80%
    expect(result.current.status?.usagePercent).toBe(80);
  });
});

describe('getWarmupSchedule', () => {
  it('returns warmup schedule array', () => {
    const schedule = getWarmupSchedule();
    
    expect(schedule).toHaveLength(5);
    expect(schedule[0]).toEqual({ week: 1, dailyLimit: 50 });
    expect(schedule[4]).toEqual({ week: 5, dailyLimit: 1000 });
  });
});

describe('wouldExceedLimit', () => {
  it('returns true when send would exceed limit', () => {
    expect(wouldExceedLimit(45, 10, 50, false)).toBe(true);
  });

  it('returns false when within limit', () => {
    expect(wouldExceedLimit(30, 10, 50, false)).toBe(false);
  });

  it('returns false when bypassed regardless of count', () => {
    expect(wouldExceedLimit(100, 1000, 50, true)).toBe(false);
  });

  it('handles edge case at exact limit', () => {
    expect(wouldExceedLimit(40, 10, 50, false)).toBe(false); // exactly 50
    expect(wouldExceedLimit(41, 10, 50, false)).toBe(true);  // 51 > 50
  });
});
