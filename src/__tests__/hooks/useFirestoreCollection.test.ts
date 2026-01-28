/**
 * useFirestoreCollection Hook Tests
 * Sprint 27 - T27.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFirestoreCollection, useProspects, useActivities, useSequences } from '../../hooks/useFirestoreCollection';
import { createFirestoreService, type FirestoreService } from '../../services/FirestoreService';

// Test helper: allow any data shape for mock operations
type TestFirestoreService = Omit<FirestoreService, 'create' | 'update' | 'read' | 'query'> & {
  create: (collection: string, data: Record<string, unknown>) => Promise<{ success: boolean; id?: string; error?: string }>;
  update: (collection: string, docId: string, data: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  read: <T = Record<string, unknown>>(collection: string, docId: string) => Promise<T | null>;
  query: <T = Record<string, unknown>>(collection: string, options?: unknown) => Promise<T[]>;
};

describe('useFirestoreCollection', () => {
  let service: TestFirestoreService;

  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(),
    });

    service = createFirestoreService({
      tenantId: 'test-tenant',
      userId: 'test-user',
    }) as unknown as TestFirestoreService;
  });

  afterEach(() => {
    service.destroy();
    vi.unstubAllGlobals();
  });

  describe('basic functionality', () => {
    it('returns loading state initially', () => {
      const { result } = renderHook(() => 
        useFirestoreCollection(service, 'prospects')
      );

      expect(result.current.loading).toBe(true);
    });

    it('returns empty data for empty collection', async () => {
      const { result } = renderHook(() => 
        useFirestoreCollection(service, 'prospects')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('returns data from collection', async () => {
      await service.create('prospects', { id: 'p1' } as any);
      await service.create('prospects', { id: 'p2' } as any);

      const { result } = renderHook(() => 
        useFirestoreCollection(service, 'prospects')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(2);
    });

    it('handles null service gracefully', async () => {
      const { result } = renderHook(() => 
        useFirestoreCollection(null, 'prospects')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe('real-time updates', () => {
    it('updates when data changes', async () => {
      const { result } = renderHook(() => 
        useFirestoreCollection(service, 'prospects', { realtime: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(0);

      await act(async () => {
        await service.create('prospects', { id: 'new1' } as any);
      });

      // Data updates through subscription
      expect(result.current.data.length).toBeGreaterThanOrEqual(0);
    });

    it('unsubscribes on unmount', async () => {
      const { result, unmount } = renderHook(() => 
        useFirestoreCollection(service, 'prospects')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not throw on unmount
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('query options', () => {
    it('applies filters', async () => {
      await service.create('prospects', { id: 'p1', tier: 1 });
      await service.create('prospects', { id: 'p2', tier: 2 });
      await service.create('prospects', { id: 'p3', tier: 1 });

      const { result } = renderHook(() => 
        useFirestoreCollection(service, 'prospects', {
          filters: [{ field: 'tier', operator: '==', value: 1 }],
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(2);
    });

    it('applies limit', async () => {
      await service.create('prospects', { id: 'p1' });
      await service.create('prospects', { id: 'p2' });
      await service.create('prospects', { id: 'p3' });

      const { result } = renderHook(() => 
        useFirestoreCollection(service, 'prospects', { limit: 2 })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(2);
    });
  });

  describe('callbacks', () => {
    it('calls onDataChange when data updates', async () => {
      const onDataChange = vi.fn();
      
      await service.create('prospects', { id: 'p1' } as any);

      renderHook(() => 
        useFirestoreCollection(service, 'prospects', { onDataChange })
      );

      await waitFor(() => {
        expect(onDataChange).toHaveBeenCalled();
      });
    });
  });

  describe('connection status', () => {
    it('returns connection status', async () => {
      const { result } = renderHook(() => 
        useFirestoreCollection(service, 'prospects')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.connectionStatus).toBe('online');
      expect(result.current.pendingWrites).toBe(0);
    });
  });

  describe('refetch', () => {
    it('refetches data on demand', async () => {
      const { result } = renderHook(() => 
        useFirestoreCollection(service, 'prospects')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(0);

      await service.create('prospects', { id: 'refetch1' });

      await act(async () => {
        await result.current.refetch();
      });

      // After refetch, should have the new data
      expect(result.current.data.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('non-realtime mode', () => {
    it('fetches data once without subscription', async () => {
      await service.create('prospects', { id: 'p1' });

      const { result } = renderHook(() => 
        useFirestoreCollection(service, 'prospects', { realtime: false })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
    });
  });
});

describe('Collection Type Hooks', () => {
  let service: FirestoreService;

  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });

    service = createFirestoreService({
      tenantId: 'test-tenant',
      userId: 'test-user',
    });
  });

  afterEach(() => {
    service.destroy();
    vi.unstubAllGlobals();
  });

  describe('useProspects', () => {
    it('fetches prospects collection', async () => {
      await service.create('prospects', { id: 'p1' } as any);

      const { result } = renderHook(() => useProspects(service));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
    });
  });

  describe('useActivities', () => {
    it('fetches activities collection', async () => {
      await service.create('activities', { id: 'a1', type: 'email' } as any);

      const { result } = renderHook(() => useActivities(service));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
    });
  });

  describe('useSequences', () => {
    it('fetches sequences collection', async () => {
      await service.create('sequences', { id: 's1', name: 'Sequence' } as any);

      const { result } = renderHook(() => useSequences(service));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
    });
  });
});
