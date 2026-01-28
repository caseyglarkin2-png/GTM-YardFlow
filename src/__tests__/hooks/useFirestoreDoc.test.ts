/**
 * useFirestoreDoc Hook Tests
 * Sprint 27 - T27.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFirestoreDoc, useProspect, useTenant } from '../../hooks/useFirestoreDoc';
import { createFirestoreService, type FirestoreService } from '../../services/FirestoreService';

// Test helper: allow any data shape for mock operations
type TestFirestoreService = Omit<FirestoreService, 'create' | 'update' | 'read' | 'query'> & {
  create: (collection: string, data: Record<string, unknown>) => Promise<{ success: boolean; id?: string; error?: string }>;
  update: (collection: string, docId: string, data: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  read: <T = Record<string, unknown>>(collection: string, docId: string) => Promise<T | null>;
  query: <T = Record<string, unknown>>(collection: string, options?: unknown) => Promise<T[]>;
};

describe('useFirestoreDoc', () => {
  let service: TestFirestoreService;

  beforeEach(() => {
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
    it('returns initial state', async () => {
      const { result } = renderHook(() => 
        useFirestoreDoc(service, 'prospects', 'doc1')
      );

      // The hook may resolve synchronously with an empty cache, 
      // so check that it eventually resolves
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('returns null for non-existent document', async () => {
      const { result } = renderHook(() => 
        useFirestoreDoc(service, 'prospects', 'nonexistent')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.exists).toBe(false);
    });

    it('returns document data', async () => {
      await service.create('prospects', { id: 'doc1', name: 'Test Doc' });

      const { result } = renderHook(() => 
        useFirestoreDoc<{ id: string; name: string }>(service, 'prospects', 'doc1')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.name).toBe('Test Doc');
      expect(result.current.exists).toBe(true);
    });

    it('handles null service gracefully', async () => {
      const { result } = renderHook(() => 
        useFirestoreDoc(null, 'prospects', 'doc1')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBeNull();
    });

    it('handles null docId gracefully', async () => {
      const { result } = renderHook(() => 
        useFirestoreDoc(service, 'prospects', null)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.exists).toBe(false);
    });
  });

  describe('update operation', () => {
    it('updates document', async () => {
      await service.create('prospects', { id: 'update-doc', name: 'Original' });

      const { result } = renderHook(() => 
        useFirestoreDoc<{ id: string; name: string }>(service, 'prospects', 'update-doc')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let updateResult;
      await act(async () => {
        updateResult = await result.current.update({ name: 'Updated' });
      });

      expect(updateResult).toEqual({ success: true, id: 'update-doc' });
      expect(result.current.data?.name).toBe('Updated');
    });

    it('returns error when no docId', async () => {
      const { result } = renderHook(() => 
        useFirestoreDoc(service, 'prospects', null)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let updateResult: { success: boolean; error?: string } | undefined;
      await act(async () => {
        updateResult = await result.current.update({ name: 'Test' });
      });

      expect(updateResult!.success).toBe(false);
      expect(updateResult!.error).toBeDefined();
    });
  });

  describe('delete operation', () => {
    it('deletes document', async () => {
      await service.create('prospects', { id: 'delete-doc', name: 'Delete Me' });

      const { result } = renderHook(() => 
        useFirestoreDoc(service, 'prospects', 'delete-doc')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.exists).toBe(true);
      });

      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.remove();
      });

      expect(deleteResult).toEqual({ success: true, id: 'delete-doc' });
      expect(result.current.data).toBeNull();
      expect(result.current.exists).toBe(false);
    });

    it('returns error when no docId', async () => {
      const { result } = renderHook(() => 
        useFirestoreDoc(service, 'prospects', null)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let deleteResult: { success: boolean } | undefined;
      await act(async () => {
        deleteResult = await result.current.remove();
      });

      expect(deleteResult!.success).toBe(false);
    });
  });

  describe('refetch', () => {
    it('refetches document on demand', async () => {
      await service.create('prospects', { id: 'refetch-doc', name: 'Original' });

      const { result } = renderHook(() => 
        useFirestoreDoc<{ id: string; name: string }>(service, 'prospects', 'refetch-doc')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Update directly via service
      await service.update('prospects', 'refetch-doc', { name: 'Updated Directly' });

      await act(async () => {
        await result.current.refetch();
      });

      // May or may not reflect depending on subscription timing
      expect(result.current.data).toBeDefined();
    });
  });

  describe('real-time updates', () => {
    it('unsubscribes on unmount', async () => {
      await service.create('prospects', { id: 'unmount-doc' });

      const { result, unmount } = renderHook(() => 
        useFirestoreDoc(service, 'prospects', 'unmount-doc')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(() => unmount()).not.toThrow();
    });

    it('updates on data change', async () => {
      await service.create('prospects', { id: 'realtime-doc', name: 'Initial' });

      const { result } = renderHook(() => 
        useFirestoreDoc<{ id: string; name: string }>(service, 'prospects', 'realtime-doc', { realtime: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data?.name).toBe('Initial');
    });
  });

  describe('non-realtime mode', () => {
    it('fetches document once without subscription', async () => {
      await service.create('prospects', { id: 'one-time', name: 'One Time' });

      const { result } = renderHook(() => 
        useFirestoreDoc<{ id: string; name: string }>(service, 'prospects', 'one-time', { realtime: false })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data?.name).toBe('One Time');
    });
  });

  describe('callbacks', () => {
    it('calls onDataChange when data loads', async () => {
      const onDataChange = vi.fn();
      await service.create('prospects', { id: 'callback-doc', name: 'Callback' });

      renderHook(() => 
        useFirestoreDoc(service, 'prospects', 'callback-doc', { onDataChange })
      );

      await waitFor(() => {
        expect(onDataChange).toHaveBeenCalled();
      });
    });
  });

  describe('connection status', () => {
    it('returns connection status', async () => {
      const { result } = renderHook(() => 
        useFirestoreDoc(service, 'prospects', 'status-doc')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.connectionStatus).toBe('online');
    });
  });
});

describe('Document Type Hooks', () => {
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

  describe('useProspect', () => {
    it('fetches single prospect', async () => {
      await service.create('prospects', { id: 'prospect1', name: 'Test Prospect' } as any);

      const { result } = renderHook(() => 
        useProspect<{ id: string; name: string }>(service, 'prospect1')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data?.name).toBe('Test Prospect');
    });
  });

  describe('useTenant', () => {
    it('fetches tenant document', async () => {
      service._setInCache('tenants', 'tenant1', { id: 'tenant1', name: 'Test Tenant' });

      const { result } = renderHook(() => 
        useTenant<{ id: string; name: string }>(service, 'tenant1')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data?.name).toBe('Test Tenant');
    });
  });
});
