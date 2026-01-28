/**
 * useOfflineQueue Hook Tests
 * Sprint 34 - T34.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import * as OfflineQueueModule from '../../services/OfflineQueue';

// Mock the OfflineQueue service
vi.mock('../../services/OfflineQueue', () => ({
  createOfflineQueue: vi.fn(),
}));

describe('useOfflineQueue', () => {
  const mockQueue = {
    getQueueSize: vi.fn(),
    processQueue: vi.fn(),
    destroy: vi.fn(),
    enqueue: vi.fn(),
  };

  let statusChangeCallback: ((status: string, count: number) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    statusChangeCallback = null;
    
    (OfflineQueueModule.createOfflineQueue as ReturnType<typeof vi.fn>).mockImplementation((config) => {
      statusChangeCallback = config?.onStatusChange || null;
      return mockQueue;
    });
    
    mockQueue.getQueueSize.mockResolvedValue(0);
    mockQueue.processQueue.mockResolvedValue(undefined);
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with synced status when no pending items', async () => {
      mockQueue.getQueueSize.mockResolvedValue(0);

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(result.current.status).toBe('synced');
      });
      
      expect(result.current.pendingCount).toBe(0);
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isSyncing).toBe(false);
    });

    it('should set pending status when items in queue', async () => {
      mockQueue.getQueueSize.mockResolvedValue(5);

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(result.current.status).toBe('pending');
      });
      
      expect(result.current.pendingCount).toBe(5);
    });

    it('should create queue with config', () => {
      const config = { maxRetries: 5 };
      
      renderHook(() => useOfflineQueue(config));

      expect(OfflineQueueModule.createOfflineQueue).toHaveBeenCalledWith(
        expect.objectContaining({ maxRetries: 5 })
      );
    });
  });

  describe('status changes', () => {
    it('should update status when callback is called', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(statusChangeCallback).not.toBeNull();
      });

      act(() => {
        statusChangeCallback?.('syncing', 3);
      });

      expect(result.current.status).toBe('syncing');
      expect(result.current.pendingCount).toBe(3);
      expect(result.current.isSyncing).toBe(true);
    });

    it('should set lastSyncTime when synced with 0 pending', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(statusChangeCallback).not.toBeNull();
      });

      expect(result.current.lastSyncTime).toBeNull();

      act(() => {
        statusChangeCallback?.('synced', 0);
      });

      expect(result.current.lastSyncTime).toBeInstanceOf(Date);
    });
  });

  describe('online/offline', () => {
    it('should update isOnline on online event', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      
      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.isOnline).toBe(false);

      act(() => {
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
        window.dispatchEvent(new Event('online'));
      });

      expect(result.current.isOnline).toBe(true);
      expect(result.current.status).toBe('syncing');
    });

    it('should update status to offline on offline event', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.isOnline).toBe(false);
      expect(result.current.status).toBe('offline');
    });
  });

  describe('syncNow', () => {
    it('should process queue and update status', async () => {
      mockQueue.processQueue.mockResolvedValue(undefined);
      mockQueue.getQueueSize.mockResolvedValue(0);

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(result.current.status).toBeDefined();
      });

      await act(async () => {
        await result.current.syncNow();
      });

      expect(mockQueue.processQueue).toHaveBeenCalled();
      expect(result.current.status).toBe('synced');
      expect(result.current.lastSyncTime).toBeInstanceOf(Date);
    });

    it('should not sync when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      
      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.syncNow();
      });

      expect(mockQueue.processQueue).not.toHaveBeenCalled();
    });

    it('should set error status on sync failure', async () => {
      mockQueue.processQueue.mockRejectedValue(new Error('Sync failed'));

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(result.current.status).toBeDefined();
      });

      await act(async () => {
        await result.current.syncNow();
      });

      expect(result.current.status).toBe('error');
    });
  });

  describe('retry', () => {
    it('should call syncNow', async () => {
      mockQueue.processQueue.mockResolvedValue(undefined);
      mockQueue.getQueueSize.mockResolvedValue(0);

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(result.current.status).toBeDefined();
      });

      await act(async () => {
        await result.current.retry();
      });

      expect(mockQueue.processQueue).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should destroy queue on unmount', async () => {
      const { unmount } = renderHook(() => useOfflineQueue());

      unmount();

      expect(mockQueue.destroy).toHaveBeenCalled();
    });
  });

  describe('return interface', () => {
    it('should return all required properties', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current).toHaveProperty('status');
      expect(result.current).toHaveProperty('pendingCount');
      expect(result.current).toHaveProperty('isSyncing');
      expect(result.current).toHaveProperty('isOnline');
      expect(result.current).toHaveProperty('lastSyncTime');
      expect(result.current).toHaveProperty('syncNow');
      expect(result.current).toHaveProperty('retry');

      expect(typeof result.current.syncNow).toBe('function');
      expect(typeof result.current.retry).toBe('function');
    });
  });
});
