/**
 * useSequences Hook Unit Tests
 * 
 * Sprint 94: T94.1 - Tests for useSequences hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { RailwaySequence, SequenceAnalytics } from '@/types/railway';

// Use vi.hoisted to declare mocks
const { mockRailwayClient, mockFeatureFlags } = vi.hoisted(() => ({
  mockRailwayClient: {
    sequences: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      analytics: vi.fn(),
    },
  },
  mockFeatureFlags: {
    RAILWAY_ENABLED: true,
    RAILWAY_DATA_ENABLED: true,
    DUAL_WRITE_ENABLED: false,
    DEBUG_RAILWAY_REQUESTS: false,
  },
}));

// Mock dependencies
vi.mock('@/services/RailwayApiClient', () => ({
  railwayClient: mockRailwayClient,
}));

vi.mock('@/config/featureFlags', () => ({
  featureFlags: mockFeatureFlags,
}));

// Import after mocks
import { useSequences, useSequence } from '@/hooks/useSequences';

// =============================================================================
// Test Data
// =============================================================================

const mockSequence: RailwaySequence = {
  id: 'seq-1',
  name: 'Cold Outreach',
  description: 'Standard cold outreach sequence',
  status: 'active',
  steps: [
    { id: 'step-1', order: 0, type: 'email', delayDays: 0, subject: 'Hello', body: 'Hi there' },
    { id: 'step-2', order: 1, type: 'wait', delayDays: 3 },
    { id: 'step-3', order: 2, type: 'email', delayDays: 0, subject: 'Follow up', body: 'Just following up' },
  ],
  enrollmentCount: 50,
  activeEnrollmentCount: 20,
  completedEnrollmentCount: 25,
  ownerId: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
};

const mockSequence2: RailwaySequence = {
  id: 'seq-2',
  name: 'Meeting Request',
  description: 'Request a meeting',
  status: 'active',
  steps: [
    { id: 'step-1', order: 0, type: 'email', delayDays: 0, subject: 'Meeting?', body: 'Can we chat?' },
  ],
  enrollmentCount: 10,
  activeEnrollmentCount: 5,
  completedEnrollmentCount: 3,
  ownerId: 'user-1',
  createdAt: '2026-01-10T00:00:00Z',
  updatedAt: '2026-01-20T00:00:00Z',
};

// =============================================================================
// Tests
// =============================================================================

describe('useSequences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlags.RAILWAY_ENABLED = true;
    mockFeatureFlags.RAILWAY_DATA_ENABLED = true;
  });

  describe('initialization', () => {
    it('loads sequences on mount when autoFetch is true', async () => {
      mockRailwayClient.sequences.list.mockResolvedValueOnce({
        ok: true,
        data: [mockSequence, mockSequence2],
      });

      const { result } = renderHook(() => useSequences({ autoFetch: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockRailwayClient.sequences.list).toHaveBeenCalled();
      expect(result.current.sequences).toHaveLength(2);
      expect(result.current.sequences[0].name).toBe('Cold Outreach');
    });

    it('does not load when Railway is disabled', async () => {
      mockFeatureFlags.RAILWAY_ENABLED = false;

      const { result } = renderHook(() => useSequences({ autoFetch: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockRailwayClient.sequences.list).not.toHaveBeenCalled();
      expect(result.current.sequences).toHaveLength(0);
    });

    it('handles API error gracefully', async () => {
      mockRailwayClient.sequences.list.mockResolvedValueOnce({
        ok: false,
        error: 'Network error',
      });

      const { result } = renderHook(() => useSequences());

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error?.message).toContain('Network error');
    });
  });

  describe('createSequence', () => {
    it('creates a sequence and adds to list', async () => {
      const newSequence: RailwaySequence = {
        ...mockSequence,
        id: 'seq-new',
        name: 'New Sequence',
      };

      mockRailwayClient.sequences.list.mockResolvedValueOnce({
        ok: true,
        data: [mockSequence],
      });
      mockRailwayClient.sequences.create.mockResolvedValueOnce({
        ok: true,
        data: newSequence,
      });

      const { result } = renderHook(() => useSequences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let created: RailwaySequence | null = null;
      await act(async () => {
        created = await result.current.createSequence({
          name: 'New Sequence',
          steps: [],
        });
      });

      expect((created as RailwaySequence | null)?.id).toBe('seq-new');
      expect(result.current.sequences).toHaveLength(2);
      expect(result.current.sequences.some(s => s.name === 'New Sequence')).toBe(true);
    });

    it('returns null when Railway is disabled', async () => {
      mockFeatureFlags.RAILWAY_ENABLED = false;

      const { result } = renderHook(() => useSequences({ autoFetch: false }));

      let created: RailwaySequence | null = null;
      await act(async () => {
        created = await result.current.createSequence({
          name: 'Test',
          steps: [],
        });
      });

      expect(created).toBeNull();
    });
  });

  describe('updateSequence', () => {
    it('updates sequence with optimistic update', async () => {
      mockRailwayClient.sequences.list.mockResolvedValueOnce({
        ok: true,
        data: [mockSequence],
      });
      mockRailwayClient.sequences.update.mockResolvedValueOnce({
        ok: true,
        data: { ...mockSequence, name: 'Updated Name' },
      });

      const { result } = renderHook(() => useSequences());

      await waitFor(() => {
        expect(result.current.sequences).toHaveLength(1);
      });

      let success = false;
      await act(async () => {
        success = await result.current.updateSequence('seq-1', { name: 'Updated Name' });
      });

      expect(success).toBe(true);
      expect(result.current.sequences[0].name).toBe('Updated Name');
    });

    it('rolls back on API failure', async () => {
      mockRailwayClient.sequences.list.mockResolvedValueOnce({
        ok: true,
        data: [mockSequence],
      });
      mockRailwayClient.sequences.update.mockResolvedValueOnce({
        ok: false,
        error: 'Update failed',
      });

      const { result } = renderHook(() => useSequences());

      await waitFor(() => {
        expect(result.current.sequences).toHaveLength(1);
      });

      const originalName = result.current.sequences[0].name;

      await act(async () => {
        await result.current.updateSequence('seq-1', { name: 'New Name' });
      });

      // Should rollback to original
      expect(result.current.sequences[0].name).toBe(originalName);
      expect(result.current.error).not.toBeNull();
    });
  });

  describe('deleteSequence', () => {
    it('deletes sequence with optimistic delete', async () => {
      mockRailwayClient.sequences.list.mockResolvedValueOnce({
        ok: true,
        data: [mockSequence, mockSequence2],
      });
      mockRailwayClient.sequences.delete.mockResolvedValueOnce({
        ok: true,
      });

      const { result } = renderHook(() => useSequences());

      await waitFor(() => {
        expect(result.current.sequences).toHaveLength(2);
      });

      let success = false;
      await act(async () => {
        success = await result.current.deleteSequence('seq-1');
      });

      expect(success).toBe(true);
      expect(result.current.sequences).toHaveLength(1);
      expect(result.current.sequences[0].id).toBe('seq-2');
    });

    it('rolls back on delete failure', async () => {
      mockRailwayClient.sequences.list.mockResolvedValueOnce({
        ok: true,
        data: [mockSequence],
      });
      mockRailwayClient.sequences.delete.mockResolvedValueOnce({
        ok: false,
        error: 'Delete failed',
      });

      const { result } = renderHook(() => useSequences());

      await waitFor(() => {
        expect(result.current.sequences).toHaveLength(1);
      });

      await act(async () => {
        await result.current.deleteSequence('seq-1');
      });

      // Should rollback
      expect(result.current.sequences).toHaveLength(1);
    });
  });

  describe('duplicateSequence', () => {
    it('duplicates a sequence', async () => {
      const duplicated: RailwaySequence = {
        ...mockSequence,
        id: 'seq-dup',
        name: 'Copy of Cold Outreach',
      };

      mockRailwayClient.sequences.list.mockResolvedValueOnce({
        ok: true,
        data: [mockSequence],
      });
      mockRailwayClient.sequences.get.mockResolvedValueOnce({
        ok: true,
        data: mockSequence,
      });
      mockRailwayClient.sequences.create.mockResolvedValueOnce({
        ok: true,
        data: duplicated,
      });

      const { result } = renderHook(() => useSequences());

      await waitFor(() => {
        expect(result.current.sequences).toHaveLength(1);
      });

      let dup: RailwaySequence | null = null;
      await act(async () => {
        dup = await result.current.duplicateSequence('seq-1', 'Copy of Cold Outreach');
      });

      expect((dup as RailwaySequence | null)?.name).toBe('Copy of Cold Outreach');
      expect(result.current.sequences).toHaveLength(2);
    });
  });

  describe('getAnalytics', () => {
    it('fetches sequence analytics', async () => {
      const analytics: SequenceAnalytics = {
        sequenceId: 'seq-1',
        name: 'Cold Outreach',
        metrics: {
          totalEnrollments: 100,
          activeEnrollments: 30,
          completedEnrollments: 50,
          repliedEnrollments: 15,
          cancelledEnrollments: 10,
          avgStepsCompleted: 2.3,
          replyRate: 15,
          completionRate: 50,
        },
        stepMetrics: [
          { stepIndex: 0, type: 'email' as const, sent: 100, opened: 80, clicked: 20, replied: 10 },
          { stepIndex: 1, type: 'email' as const, sent: 85, opened: 60, clicked: 15, replied: 5 },
        ],
      };

      mockRailwayClient.sequences.list.mockResolvedValueOnce({
        ok: true,
        data: [mockSequence],
      });
      mockRailwayClient.sequences.analytics.mockResolvedValueOnce({
        ok: true,
        data: analytics,
      });

      const { result } = renderHook(() => useSequences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let result_analytics: SequenceAnalytics | null = null;
      await act(async () => {
        result_analytics = await result.current.getAnalytics('seq-1');
      });

      expect((result_analytics as SequenceAnalytics | null)?.metrics.totalEnrollments).toBe(100);
      expect((result_analytics as SequenceAnalytics | null)?.metrics.replyRate).toBe(15);
    });
  });

  describe('refresh', () => {
    it('reloads sequences from Railway', async () => {
      mockRailwayClient.sequences.list
        .mockResolvedValueOnce({ ok: true, data: [mockSequence] })
        .mockResolvedValueOnce({ ok: true, data: [mockSequence, mockSequence2] });

      const { result } = renderHook(() => useSequences());

      await waitFor(() => {
        expect(result.current.sequences).toHaveLength(1);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.sequences).toHaveLength(2);
      expect(mockRailwayClient.sequences.list).toHaveBeenCalledTimes(2);
    });
  });
});

describe('useSequence (single)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlags.RAILWAY_ENABLED = true;
  });

  it('fetches a single sequence by ID', async () => {
    mockRailwayClient.sequences.get.mockResolvedValueOnce({
      ok: true,
      data: mockSequence,
    });

    const { result } = renderHook(() => useSequence('seq-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sequence?.id).toBe('seq-1');
    expect(result.current.sequence?.name).toBe('Cold Outreach');
  });

  it('returns null when ID is null', () => {
    const { result } = renderHook(() => useSequence(null));

    expect(result.current.sequence).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('handles fetch error', async () => {
    mockRailwayClient.sequences.get.mockResolvedValueOnce({
      ok: false,
      error: 'Not found',
    });

    const { result } = renderHook(() => useSequence('invalid-id'));

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.sequence).toBeNull();
  });
});
