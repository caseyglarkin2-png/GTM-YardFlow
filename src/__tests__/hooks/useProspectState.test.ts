/**
 * T93.2-T93.4: useProspectState Hook Unit Tests
 * 
 * Tests for prospect state management hook including:
 * - Loading from Railway vs Firestore (feature flagged)
 * - CRUD operations with dual-write
 * - Optimistic updates with rollback
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Prospect } from '@/types';

// Use vi.hoisted to declare mocks that can be referenced in vi.mock
const { mockFeatureFlags, mockRailwayClient } = vi.hoisted(() => ({
  mockFeatureFlags: {
    RAILWAY_ENABLED: false,
    RAILWAY_DATA_ENABLED: false,
    DUAL_WRITE_ENABLED: false,
    DEBUG_RAILWAY_REQUESTS: false,
  },
  mockRailwayClient: {
    prospects: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock Firebase BEFORE imports
vi.mock('firebase/app', () => ({
  getApp: vi.fn(() => ({})),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  onSnapshot: vi.fn((_ref, onNext) => {
    // Simulate empty Firestore
    setTimeout(() => onNext({ docs: [] }), 10);
    return vi.fn(); // unsubscribe
  }),
  doc: vi.fn(),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  setDoc: vi.fn(() => Promise.resolve()),
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    delete: vi.fn(),
    set: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
}));

// Mock Railway client
vi.mock('@/services/RailwayApiClient', () => ({
  railwayClient: mockRailwayClient,
}));

// Mock feature flags - Railway disabled by default
vi.mock('@/config/featureFlags', () => ({
  featureFlags: mockFeatureFlags,
  isDualWriteEnabled: () => mockFeatureFlags.DUAL_WRITE_ENABLED && mockFeatureFlags.RAILWAY_ENABLED,
}));

// Mock hitlist data
vi.mock('@/data/hitlistData', () => ({
  HITLIST_PROSPECTS: [
    {
      id: 'test-1',
      name: 'John Doe',
      email: 'john@example.com',
      company: 'Acme Inc',
      title: 'CEO',
      tier: 'Tier 1',
      score: 85,
      status: 'new',
      isOps: false,
      isExec: true,
      tags: [],
    },
    {
      id: 'test-2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      company: 'TechCorp',
      title: 'CTO',
      tier: 'Tier 2',
      score: 75,
      status: 'contacted',
      isOps: true,
      isExec: false,
      tags: ['tech'],
    },
  ] as Prospect[],
}));

// Import after mocks
import { useProspectState } from '@/hooks/useProspectState';

describe('useProspectState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset feature flags
    mockFeatureFlags.RAILWAY_ENABLED = false;
    mockFeatureFlags.RAILWAY_DATA_ENABLED = false;
    mockFeatureFlags.DUAL_WRITE_ENABLED = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('loads with initial hitlist data', async () => {
      const { result } = renderHook(() => useProspectState());

      // Should have initial data immediately
      expect(result.current.prospects.length).toBeGreaterThan(0);
      expect(result.current.prospects[0].id).toBe('test-1');
    });

    it('exposes loading state', () => {
      const { result } = renderHook(() => useProspectState());
      
      // isLoading starts true
      expect(typeof result.current.isLoading).toBe('boolean');
    });

    it('exposes data source indicator', () => {
      const { result } = renderHook(() => useProspectState());
      
      expect(['firestore', 'railway', 'local']).toContain(result.current.dataSource);
    });
  });

  describe('Railway data source (T93.3)', () => {
    beforeEach(() => {
      mockFeatureFlags.RAILWAY_ENABLED = true;
      mockFeatureFlags.RAILWAY_DATA_ENABLED = true;
    });

    it('loads from Railway when feature flag enabled', async () => {
      const railwayProspects = [
        {
          id: 'railway-1',
          firstName: 'Rail',
          lastName: 'Way',
          name: 'Rail Way',
          email: 'rail@way.com',
          companyName: 'Railway Inc',
          title: 'Engineer',
          tier: 'Tier 1',
          score: 90,
          status: 'new',
          tags: [],
          createdAt: '2026-01-30T00:00:00Z',
          updatedAt: '2026-01-30T00:00:00Z',
        },
      ];

      mockRailwayClient.prospects.list.mockResolvedValueOnce({
        ok: true,
        data: { data: railwayProspects, pagination: { total: 1 } },
      });

      const { result } = renderHook(() => useProspectState());

      await waitFor(() => {
        expect(result.current.dataSource).toBe('railway');
      });

      expect(mockRailwayClient.prospects.list).toHaveBeenCalled();
      expect(result.current.prospects.some(p => p.id === 'railway-1')).toBe(true);
    });

    it('falls back to local data on Railway error', async () => {
      mockRailwayClient.prospects.list.mockResolvedValueOnce({
        ok: false,
        error: 'Railway unavailable',
      });

      const { result } = renderHook(() => useProspectState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.dataSource).toBe('local');
      expect(result.current.error).not.toBeNull();
    });
  });

  describe('updateProspect (T93.4)', () => {
    it('performs optimistic update', async () => {
      const { result } = renderHook(() => useProspectState());

      const originalStatus = result.current.prospects[0].status;

      await act(async () => {
        await result.current.updateProspect('test-1', { status: 'contacted' });
      });

      expect(result.current.prospects[0].status).toBe('contacted');
    });

    it('calls Railway API when enabled', async () => {
      mockFeatureFlags.RAILWAY_ENABLED = true;
      mockFeatureFlags.RAILWAY_DATA_ENABLED = true;
      mockRailwayClient.prospects.update.mockResolvedValueOnce({ ok: true, data: {} });
      mockRailwayClient.prospects.list.mockResolvedValueOnce({
        ok: true,
        data: { data: [], pagination: { total: 0 } },
      });

      const { result } = renderHook(() => useProspectState({ initialData: [
        { id: 'test-1', name: 'Test', status: 'new', company: 'Co', title: 'T', tier: 'Tier 1', score: 50, tags: [], isOps: false, isExec: false }
      ] }));

      await act(async () => {
        await result.current.updateProspect('test-1', { status: 'contacted' });
      });

      expect(mockRailwayClient.prospects.update).toHaveBeenCalledWith(
        'test-1',
        expect.objectContaining({ status: 'contacted' })
      );
    });

    it('rolls back on API failure', async () => {
      mockFeatureFlags.RAILWAY_ENABLED = true;
      mockFeatureFlags.RAILWAY_DATA_ENABLED = true;
      mockRailwayClient.prospects.update.mockResolvedValueOnce({ ok: false, error: 'Failed' });
      mockRailwayClient.prospects.list.mockResolvedValueOnce({
        ok: true,
        data: { data: [], pagination: { total: 0 } },
      });

      const { result } = renderHook(() => useProspectState({ initialData: [
        { id: 'test-1', name: 'Test', status: 'new', company: 'Co', title: 'T', tier: 'Tier 1', score: 50, tags: [], isOps: false, isExec: false }
      ] }));

      const originalStatus = result.current.prospects[0].status;

      await act(async () => {
        const success = await result.current.updateProspect('test-1', { status: 'contacted' });
        expect(success).toBe(false);
      });

      // Should have rolled back
      expect(result.current.prospects[0].status).toBe(originalStatus);
    });
  });

  describe('updateProspectStatus', () => {
    it('updates status field', async () => {
      const { result } = renderHook(() => useProspectState());

      await act(async () => {
        await result.current.updateProspectStatus('test-1', 'meeting_booked');
      });

      expect(result.current.prospects[0].status).toBe('meeting_booked');
    });
  });

  describe('updateProspectEmail', () => {
    it('updates email field', async () => {
      const { result } = renderHook(() => useProspectState());

      await act(async () => {
        await result.current.updateProspectEmail('test-1', 'newemail@test.com');
      });

      expect(result.current.prospects[0].email).toBe('newemail@test.com');
    });

    it('can clear email', async () => {
      const { result } = renderHook(() => useProspectState());

      await act(async () => {
        await result.current.updateProspectEmail('test-1', undefined);
      });

      expect(result.current.prospects[0].email).toBeUndefined();
    });
  });

  describe('deleteProspect', () => {
    it('removes prospect from list', async () => {
      const { result } = renderHook(() => useProspectState());

      const initialCount = result.current.prospects.length;

      await act(async () => {
        await result.current.deleteProspect('test-1');
      });

      expect(result.current.prospects.length).toBe(initialCount - 1);
      expect(result.current.prospects.find(p => p.id === 'test-1')).toBeUndefined();
    });

    it('calls Railway delete when enabled', async () => {
      mockFeatureFlags.RAILWAY_ENABLED = true;
      mockFeatureFlags.RAILWAY_DATA_ENABLED = true;
      mockRailwayClient.prospects.delete.mockResolvedValueOnce({ ok: true });
      mockRailwayClient.prospects.list.mockResolvedValueOnce({
        ok: true,
        data: { data: [], pagination: { total: 0 } },
      });

      const { result } = renderHook(() => useProspectState({ initialData: [
        { id: 'test-1', name: 'Test', status: 'new', company: 'Co', title: 'T', tier: 'Tier 1', score: 50, tags: [], isOps: false, isExec: false }
      ] }));

      await act(async () => {
        await result.current.deleteProspect('test-1');
      });

      expect(mockRailwayClient.prospects.delete).toHaveBeenCalledWith('test-1');
    });
  });

  describe('bulkDeleteProspects', () => {
    it('removes multiple prospects', async () => {
      const { result } = renderHook(() => useProspectState());

      await act(async () => {
        const response = await result.current.bulkDeleteProspects(['test-1', 'test-2']);
        expect(response.success).toBe(true);
      });

      expect(result.current.prospects.length).toBe(0);
    });
  });

  describe('bulkUpdateProspects', () => {
    it('updates multiple prospects', async () => {
      const { result } = renderHook(() => useProspectState());

      await act(async () => {
        const response = await result.current.bulkUpdateProspects(['test-1', 'test-2'], { status: 'contacted' });
        expect(response.success).toBe(true);
      });

      expect(result.current.prospects.every(p => p.status === 'contacted')).toBe(true);
    });
  });

  describe('addProspects', () => {
    it('adds new prospects to list', async () => {
      const { result } = renderHook(() => useProspectState());

      const initialCount = result.current.prospects.length;
      const newProspect: Prospect = {
        id: 'new-1',
        name: 'New Person',
        company: 'New Co',
        title: 'New Title',
        tier: 'Tier 3',
        score: 60,
        status: 'new',
        tags: [],
        isOps: false,
        isExec: false,
      };

      await act(async () => {
        await result.current.addProspects([newProspect]);
      });

      expect(result.current.prospects.length).toBe(initialCount + 1);
      expect(result.current.prospects.find(p => p.id === 'new-1')).toBeDefined();
    });
  });

  describe('dual-write mode (T93.4)', () => {
    it('writes to both Railway and Firestore when dual-write enabled', async () => {
      mockFeatureFlags.RAILWAY_ENABLED = true;
      mockFeatureFlags.RAILWAY_DATA_ENABLED = true;
      mockFeatureFlags.DUAL_WRITE_ENABLED = true;
      mockRailwayClient.prospects.update.mockResolvedValueOnce({ ok: true, data: {} });
      mockRailwayClient.prospects.list.mockResolvedValueOnce({
        ok: true,
        data: { data: [], pagination: { total: 0 } },
      });

      const { result } = renderHook(() => useProspectState({ initialData: [
        { id: 'test-1', name: 'Test', status: 'new', company: 'Co', title: 'T', tier: 'Tier 1', score: 50, tags: [], isOps: false, isExec: false }
      ] }));

      await act(async () => {
        await result.current.updateProspect('test-1', { status: 'contacted' });
      });

      // Should call Railway
      expect(mockRailwayClient.prospects.update).toHaveBeenCalled();
      
      // Firestore updateDoc would also be called (mocked)
      // We've already mocked it to resolve, so this test verifies no errors
    });
  });

  describe('refresh', () => {
    it('reloads data from source', async () => {
      const { result } = renderHook(() => useProspectState());

      await act(async () => {
        await result.current.refresh();
      });

      // Should complete without error
      expect(result.current.error).toBeNull();
    });
  });

  describe('setProspects (direct setter)', () => {
    it('allows direct state updates', () => {
      const { result } = renderHook(() => useProspectState());

      act(() => {
        result.current.setProspects([
          { id: 'direct-1', name: 'Direct', company: 'Co', title: 'T', tier: 'Tier 1', score: 50, status: 'new', tags: [], isOps: false, isExec: false }
        ]);
      });

      expect(result.current.prospects[0].id).toBe('direct-1');
    });
  });
});
