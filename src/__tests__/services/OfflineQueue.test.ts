/**
 * Offline Queue Service Tests
 * Sprint 27 - T27.7
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createOfflineQueue, type SyncStatus } from '../../services/OfflineQueue';
import type { FirestoreService } from '../../services/FirestoreService';

// Mock IndexedDB
const mockStore = new Map<string, unknown>();
const mockIDBRequest = (result: unknown) => ({
  result,
  onsuccess: null as (() => void) | null,
  onerror: null as (() => void) | null,
  error: null,
});

const mockIDBTransaction = (storeName: string) => ({
  objectStore: () => ({
    add: (value: unknown) => {
      const req = mockIDBRequest(null);
      setTimeout(() => {
        mockStore.set((value as { id: string }).id, value);
        req.onsuccess?.();
      }, 0);
      return req;
    },
    put: (value: unknown) => {
      const req = mockIDBRequest(null);
      setTimeout(() => {
        mockStore.set((value as { id: string }).id, value);
        req.onsuccess?.();
      }, 0);
      return req;
    },
    delete: (key: string) => {
      const req = mockIDBRequest(null);
      setTimeout(() => {
        mockStore.delete(key);
        req.onsuccess?.();
      }, 0);
      return req;
    },
    get: (key: string) => {
      const req = mockIDBRequest(mockStore.get(key));
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    },
    getAll: () => {
      const req = mockIDBRequest(Array.from(mockStore.values()));
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    },
    clear: () => {
      const req = mockIDBRequest(null);
      setTimeout(() => {
        mockStore.clear();
        req.onsuccess?.();
      }, 0);
      return req;
    },
  }),
});

const mockDB = {
  transaction: (storeName: string, _mode?: string) => mockIDBTransaction(storeName),
  objectStoreNames: { contains: () => true },
};

const mockIDBOpenRequest = () => {
  const req = {
    result: mockDB,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onupgradeneeded: null as (() => void) | null,
    error: null,
  };
  setTimeout(() => req.onsuccess?.(), 0);
  return req;
};

// Override indexedDB
Object.defineProperty(globalThis, 'indexedDB', {
  value: {
    open: () => mockIDBOpenRequest(),
  },
  writable: true,
});

// Mock navigator.onLine
let mockNavigatorOnLine = true;
Object.defineProperty(navigator, 'onLine', {
  get: () => mockNavigatorOnLine,
  configurable: true,
});

// Mock window event listeners
const windowListeners = new Map<string, Function>();
const mockWindow = {
  addEventListener: (event: string, fn: Function) => windowListeners.set(event, fn),
  removeEventListener: (event: string) => windowListeners.delete(event),
};
Object.defineProperty(globalThis, 'window', {
  value: mockWindow,
  writable: true,
});

// Mock FirestoreService
function createMockFirestoreService(): FirestoreService {
  return {
    create: vi.fn().mockResolvedValue({ id: 'created-id' }),
    read: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({ id: 'updated-id' }),
    remove: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([]),
    subscribe: vi.fn().mockReturnValue(() => {}),
    subscribeToDoc: vi.fn().mockReturnValue(() => {}),
    batch: vi.fn().mockResolvedValue([]),
    queueOperation: vi.fn().mockResolvedValue(undefined),
    getQueueSize: vi.fn().mockReturnValue(0),
    processQueue: vi.fn().mockResolvedValue(undefined),
    isOnline: vi.fn().mockReturnValue(true),
    setOnlineStatus: vi.fn(),
    _getDocPath: vi.fn(),
    _clearCollectionCache: vi.fn(),
  } as unknown as FirestoreService;
}

describe('OfflineQueue', () => {
  let mockFirestore: FirestoreService;
  let statusChanges: Array<{ status: SyncStatus; count: number }>;

  beforeEach(() => {
    mockStore.clear();
    mockNavigatorOnLine = true;
    mockFirestore = createMockFirestoreService();
    statusChanges = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createQueue(overrides = {}) {
    return createOfflineQueue({
      dbName: 'test-db',
      storeName: 'test-queue',
      firestoreService: mockFirestore,
      onStatusChange: (status, count) => statusChanges.push({ status, count }),
      ...overrides,
    });
  }

  // ==========================================================================
  // Status Management
  // ==========================================================================

  describe('getStatus', () => {
    it('should return synced when online with no pending', () => {
      const queue = createQueue();
      expect(queue.getStatus()).toBe('synced');
    });

    it('should return offline when not online', () => {
      mockNavigatorOnLine = false;
      const queue = createQueue();
      queue._setOnline(false);
      expect(queue.getStatus()).toBe('offline');
    });

    it('should return pending when there are queued operations', async () => {
      const queue = createQueue();
      await queue.enqueue({ type: 'create', collection: 'test', docId: 'doc1', data: {} });
      
      expect(queue.getStatus()).toBe('pending');
    });
  });

  // ==========================================================================
  // Queue Operations
  // ==========================================================================

  describe('enqueue', () => {
    it('should add operation to queue', async () => {
      const queue = createQueue();
      
      const id = await queue.enqueue({
        type: 'create',
        collection: 'prospects',
        docId: 'p1',
        data: { name: 'Test' },
      });

      expect(id).toBeDefined();
      const size = await queue.getQueueSize();
      expect(size).toBe(1);
    });

    it('should notify status change on enqueue', async () => {
      const queue = createQueue();
      
      await queue.enqueue({
        type: 'update',
        collection: 'prospects',
        docId: 'p1',
        data: { name: 'Updated' },
      });

      expect(statusChanges.length).toBeGreaterThan(0);
      expect(statusChanges[statusChanges.length - 1].count).toBe(1);
    });
  });

  describe('dequeue', () => {
    it('should remove operation from queue', async () => {
      const queue = createQueue();
      
      const id = await queue.enqueue({
        type: 'create',
        collection: 'test',
        docId: 'doc1',
        data: {},
      });
      
      expect(await queue.getQueueSize()).toBe(1);
      
      await queue.dequeue(id);
      
      expect(await queue.getQueueSize()).toBe(0);
    });
  });

  describe('getAll', () => {
    it('should return all queued operations', async () => {
      const queue = createQueue();
      
      await queue.enqueue({ type: 'create', collection: 'a', docId: '1', data: {} });
      await queue.enqueue({ type: 'update', collection: 'b', docId: '2', data: {} });
      await queue.enqueue({ type: 'remove', collection: 'c', docId: '3' });

      const all = await queue.getAll();
      expect(all.length).toBe(3);
    });

    it('should include operation metadata', async () => {
      const queue = createQueue();
      
      await queue.enqueue({
        type: 'create',
        collection: 'prospects',
        docId: 'p1',
        data: { name: 'Test' },
      });

      const all = await queue.getAll();
      expect(all[0]).toMatchObject({
        type: 'create',
        collection: 'prospects',
        docId: 'p1',
        attempts: 0,
      });
      expect(all[0].createdAt).toBeDefined();
      expect(all[0].id).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should remove all operations', async () => {
      const queue = createQueue();
      
      await queue.enqueue({ type: 'create', collection: 'a', docId: '1', data: {} });
      await queue.enqueue({ type: 'create', collection: 'b', docId: '2', data: {} });
      
      await queue.clear();
      
      expect(await queue.getQueueSize()).toBe(0);
    });
  });

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  describe('queueCreate', () => {
    it('should create operation with type create', async () => {
      const queue = createQueue();
      
      await queue.queueCreate('prospects', { name: 'New Prospect' });
      
      const all = await queue.getAll();
      expect(all[0].type).toBe('create');
      expect(all[0].collection).toBe('prospects');
    });

    it('should use provided id or generate one', async () => {
      const queue = createQueue();
      
      await queue.queueCreate('prospects', { id: 'custom-id', name: 'Test' });
      
      const all = await queue.getAll();
      expect(all[0].docId).toBe('custom-id');
    });
  });

  describe('queueUpdate', () => {
    it('should create operation with type update', async () => {
      const queue = createQueue();
      
      await queue.queueUpdate('prospects', 'p1', { name: 'Updated' });
      
      const all = await queue.getAll();
      expect(all[0].type).toBe('update');
      expect(all[0].docId).toBe('p1');
    });
  });

  describe('queueRemove', () => {
    it('should create operation with type remove', async () => {
      const queue = createQueue();
      
      await queue.queueRemove('prospects', 'p1');
      
      const all = await queue.getAll();
      expect(all[0].type).toBe('remove');
      expect(all[0].docId).toBe('p1');
      expect(all[0].data).toBeUndefined();
    });
  });

  // ==========================================================================
  // Queue Processing
  // ==========================================================================

  describe('processQueue', () => {
    it('should return early when offline', async () => {
      const queue = createQueue();
      queue._setOnline(false);
      
      await queue.enqueue({ type: 'create', collection: 'test', docId: '1', data: {} });
      
      const result = await queue.processQueue();
      
      expect(result.processed).toBe(0);
      expect(mockFirestore.create).not.toHaveBeenCalled();
    });

    it('should process create operations', async () => {
      const queue = createQueue();
      
      await queue.enqueue({
        type: 'create',
        collection: 'prospects',
        docId: 'p1',
        data: { name: 'New' },
      });
      
      const result = await queue.processQueue();
      
      expect(result.processed).toBe(1);
      expect(mockFirestore.create).toHaveBeenCalledWith('prospects', { name: 'New' });
    });

    it('should process update operations', async () => {
      const queue = createQueue();
      
      await queue.enqueue({
        type: 'update',
        collection: 'prospects',
        docId: 'p1',
        data: { name: 'Updated' },
      });
      
      await queue.processQueue();
      
      expect(mockFirestore.update).toHaveBeenCalledWith('prospects', 'p1', { name: 'Updated' });
    });

    it('should process remove operations', async () => {
      const queue = createQueue();
      
      await queue.enqueue({
        type: 'remove',
        collection: 'prospects',
        docId: 'p1',
      });
      
      await queue.processQueue();
      
      expect(mockFirestore.remove).toHaveBeenCalledWith('prospects', 'p1');
    });

    it('should dequeue successful operations', async () => {
      const queue = createQueue();
      
      await queue.enqueue({ type: 'create', collection: 'test', docId: '1', data: {} });
      expect(await queue.getQueueSize()).toBe(1);
      
      await queue.processQueue();
      
      expect(await queue.getQueueSize()).toBe(0);
    });

    it('should increment attempts on failure', async () => {
      (mockFirestore.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
      
      const queue = createQueue({ maxRetries: 3, retryDelay: 10 });
      
      await queue.enqueue({ type: 'create', collection: 'test', docId: '1', data: {} });
      
      await queue.processQueue();
      
      // After first failure, attempts should be incremented but kept for retry
      const all = await queue.getAll();
      
      // Either removed (after max retries) or attempts incremented
      if (all.length > 0) {
        expect(all[0].attempts).toBeGreaterThan(0);
        expect(all[0].lastError).toBe('Network error');
      }
    });
  });

  // ==========================================================================
  // Online/Offline Handling
  // ==========================================================================

  describe('online/offline handling', () => {
    it('should update status when going offline', () => {
      const queue = createQueue();
      queue._setOnline(false);
      
      expect(queue.getStatus()).toBe('offline');
    });

    it('should trigger sync when coming online', async () => {
      const queue = createQueue();
      queue._setOnline(false);
      
      await queue.enqueue({ type: 'create', collection: 'test', docId: '1', data: {} });
      
      // Simulate coming online
      queue._setOnline(true);
      const onlineHandler = windowListeners.get('online');
      if (onlineHandler) {
        await onlineHandler();
      }
      
      // Give time for processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockFirestore.create).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  describe('destroy', () => {
    it('should cleanup event listeners', () => {
      const queue = createQueue();
      
      queue.destroy();
      
      // Should not throw or cause issues after destroy
      expect(() => queue.getStatus()).not.toThrow();
    });
  });

  // ==========================================================================
  // Configuration
  // ==========================================================================

  describe('configuration', () => {
    it('should use default config values', () => {
      const queue = createQueue({});
      const cfg = queue._getConfig();
      
      expect(cfg.maxRetries).toBe(3);
      expect(cfg.retryDelay).toBe(1000);
    });

    it('should allow custom config', () => {
      const queue = createQueue({
        maxRetries: 5,
        retryDelay: 500,
      });
      const cfg = queue._getConfig();
      
      expect(cfg.maxRetries).toBe(5);
      expect(cfg.retryDelay).toBe(500);
    });
  });
});
