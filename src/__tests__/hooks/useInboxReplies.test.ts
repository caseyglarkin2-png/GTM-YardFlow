/**
 * Tests for useInboxReplies hook
 * Sprint 201: Reply Inbox Feature
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useInboxReplies } from '@/hooks/useInboxReplies';

// Mock Firebase
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockWriteBatch = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn();

vi.mock('firebase/app', () => ({
  getApp: () => ({}),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  doc: (_db: unknown, _collection: string, id: string) => ({ id }),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  writeBatch: () => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  }),
}));

describe('useInboxReplies', () => {
  const mockProspects = [
    {
      id: 'prospect-1',
      name: 'John Doe',
      email: 'john@example.com',
      company: 'Acme Inc',
      needsResponse: true,
      lastReplyAt: Date.now() - 3600000, // 1 hour ago
      lastReplyType: 'human_reply',
      lastReplyId: 'reply-1',
    },
    {
      id: 'prospect-2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      company: 'Tech Corp',
      needsResponse: true,
      lastReplyAt: Date.now() - 7200000, // 2 hours ago
      lastReplyType: 'out_of_office',
      lastReplyId: 'reply-2',
    },
  ];

  const createMockSnapshot = (prospects: typeof mockProspects) => ({
    docs: prospects.map(p => ({
      id: p.id,
      data: () => p,
    })),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocs.mockResolvedValue(createMockSnapshot(mockProspects));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockBatchCommit.mockResolvedValue(undefined);
  });

  it('should fetch replies on mount by default', async () => {
    const { result } = renderHook(() => useInboxReplies());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetDocs).toHaveBeenCalled();
    expect(result.current.replies).toHaveLength(2);
    expect(result.current.unhandledCount).toBe(2);
  });

  it('should not fetch on mount when autoFetch is false', async () => {
    const { result } = renderHook(() => useInboxReplies({ autoFetch: false }));

    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(result.current.replies).toHaveLength(0);
  });

  it('should respect custom limit', async () => {
    renderHook(() => useInboxReplies({ limit: 10 }));

    await waitFor(() => {
      expect(mockGetDocs).toHaveBeenCalled();
    });
  });

  it('should mark single reply as handled', async () => {
    const { result } = renderHook(() => useInboxReplies());

    await waitFor(() => {
      expect(result.current.replies).toHaveLength(2);
    });

    await act(async () => {
      const success = await result.current.markAsHandled('prospect-1');
      expect(success).toBe(true);
    });

    expect(mockUpdateDoc).toHaveBeenCalled();

    // Optimistic update should remove from list
    expect(result.current.replies).toHaveLength(1);
    expect(result.current.replies[0].prospectId).toBe('prospect-2');
  });

  it('should mark all replies as handled', async () => {
    const { result } = renderHook(() => useInboxReplies());

    await waitFor(() => {
      expect(result.current.replies).toHaveLength(2);
    });

    await act(async () => {
      const success = await result.current.markAllAsHandled();
      expect(success).toBe(true);
    });

    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalled();

    expect(result.current.replies).toHaveLength(0);
  });

  it('should handle fetch errors', async () => {
    mockGetDocs.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useInboxReplies());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.error?.message).toBe('Network error');
    expect(result.current.replies).toHaveLength(0);
  });

  it('should refresh replies', async () => {
    const { result } = renderHook(() => useInboxReplies());

    await waitFor(() => {
      expect(result.current.replies).toHaveLength(2);
    });

    mockGetDocs.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('should transform prospect data into InboxReply format', async () => {
    const { result } = renderHook(() => useInboxReplies());

    await waitFor(() => {
      expect(result.current.replies).toHaveLength(2);
    });

    const reply = result.current.replies[0];
    expect(reply.prospectId).toBe('prospect-1');
    expect(reply.prospectName).toBe('John Doe');
    expect(reply.prospectEmail).toBe('john@example.com');
    expect(reply.company).toBe('Acme Inc');
    expect(reply.lastReplyType).toBe('human_reply');
  });

  it('should handle update failure gracefully', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => useInboxReplies());

    await waitFor(() => {
      expect(result.current.replies).toHaveLength(2);
    });

    await act(async () => {
      const success = await result.current.markAsHandled('prospect-1');
      expect(success).toBe(false);
    });

    // Should not remove from list on failure
    expect(result.current.replies).toHaveLength(2);
  });
});
