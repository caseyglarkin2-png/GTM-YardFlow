/**
 * Offline Queue Service
 * Sprint 27 - T27.7
 * 
 * IndexedDB-backed queue for offline writes with auto-sync on reconnect.
 */

import type { FirestoreService } from './FirestoreService';

export type OperationType = 'create' | 'update' | 'remove';

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

export interface QueuedOperation {
  id: string;
  type: OperationType;
  collection: string;
  docId: string;
  data?: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface OfflineQueueConfig {
  dbName?: string;
  storeName?: string;
  maxRetries?: number;
  retryDelay?: number;
  firestoreService?: FirestoreService;
  onStatusChange?: (status: SyncStatus, pendingCount: number) => void;
}

const DEFAULT_CONFIG = {
  dbName: 'yardflow-offline',
  storeName: 'queue',
  maxRetries: 3,
  retryDelay: 1000,
};

// IndexedDB wrapper
let dbInstance: IDBDatabase | null = null;

async function openDatabase(dbName: string, storeName: string): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Create Offline Queue Service
 */
export function createOfflineQueue(config: OfflineQueueConfig = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // State
  let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  let isSyncing = false;
  let pendingCount = 0;

  // Online/offline event handlers
  const handleOnline = () => {
    isOnline = true;
    processQueue();
  };

  const handleOffline = () => {
    isOnline = false;
    notifyStatusChange();
  };

  // Setup listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  // ==========================================================================
  // Status Management
  // ==========================================================================

  function getStatus(): SyncStatus {
    if (!isOnline) return 'offline';
    if (isSyncing) return 'syncing';
    if (pendingCount > 0) return 'pending';
    return 'synced';
  }

  function notifyStatusChange(): void {
    cfg.onStatusChange?.(getStatus(), pendingCount);
  }

  // ==========================================================================
  // Queue Operations
  // ==========================================================================

  async function enqueue(operation: Omit<QueuedOperation, 'id' | 'createdAt' | 'attempts'>): Promise<string> {
    const db = await openDatabase(cfg.dbName, cfg.storeName);
    
    const queuedOp: QueuedOperation = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      attempts: 0,
      ...operation,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(cfg.storeName, 'readwrite');
      const store = tx.objectStore(cfg.storeName);
      const request = store.add(queuedOp);

      request.onsuccess = () => {
        pendingCount++;
        notifyStatusChange();
        resolve(queuedOp.id);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function dequeue(id: string): Promise<void> {
    const db = await openDatabase(cfg.dbName, cfg.storeName);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(cfg.storeName, 'readwrite');
      const store = tx.objectStore(cfg.storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        pendingCount = Math.max(0, pendingCount - 1);
        notifyStatusChange();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function updateOperation(operation: QueuedOperation): Promise<void> {
    const db = await openDatabase(cfg.dbName, cfg.storeName);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(cfg.storeName, 'readwrite');
      const store = tx.objectStore(cfg.storeName);
      const request = store.put(operation);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function getAll(): Promise<QueuedOperation[]> {
    const db = await openDatabase(cfg.dbName, cfg.storeName);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(cfg.storeName, 'readonly');
      const store = tx.objectStore(cfg.storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function getQueueSize(): Promise<number> {
    const all = await getAll();
    pendingCount = all.length;
    return pendingCount;
  }

  async function clear(): Promise<void> {
    const db = await openDatabase(cfg.dbName, cfg.storeName);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(cfg.storeName, 'readwrite');
      const store = tx.objectStore(cfg.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        pendingCount = 0;
        notifyStatusChange();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================================================
  // Queue Processing
  // ==========================================================================

  async function processQueue(): Promise<{ processed: number; failed: number }> {
    if (!isOnline || isSyncing || !cfg.firestoreService) {
      return { processed: 0, failed: 0 };
    }

    isSyncing = true;
    notifyStatusChange();

    let processed = 0;
    let failed = 0;

    try {
      const operations = await getAll();
      
      // Sort by createdAt (oldest first)
      operations.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      for (const op of operations) {
        try {
          await executeOperation(op);
          await dequeue(op.id);
          processed++;
        } catch (err) {
          op.attempts++;
          op.lastError = err instanceof Error ? err.message : 'Unknown error';

          if (op.attempts >= cfg.maxRetries) {
            // Move to dead letter (just mark as failed for now)
            failed++;
            await dequeue(op.id);
          } else {
            await updateOperation(op);
            // Wait before retry
            await sleep(cfg.retryDelay * op.attempts);
          }
        }
      }

      return { processed, failed };
    } finally {
      isSyncing = false;
      await getQueueSize(); // Update count
      notifyStatusChange();
    }
  }

  async function executeOperation(op: QueuedOperation): Promise<void> {
    if (!cfg.firestoreService) {
      throw new Error('FirestoreService not configured');
    }

    switch (op.type) {
      case 'create':
        if (!op.data) throw new Error('Data required for create operation');
        await cfg.firestoreService.create(op.collection, op.data);
        break;

      case 'update':
        if (!op.data) throw new Error('Data required for update operation');
        await cfg.firestoreService.update(op.collection, op.docId, op.data);
        break;

      case 'remove':
        await cfg.firestoreService.remove(op.collection, op.docId);
        break;

      default:
        throw new Error(`Unknown operation type: ${op.type}`);
    }
  }

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  async function queueCreate(
    collection: string,
    data: Record<string, unknown>
  ): Promise<string> {
    const docId = (data.id as string) || generateId();
    return enqueue({
      type: 'create',
      collection,
      docId,
      data: { ...data, id: docId },
    });
  }

  async function queueUpdate(
    collection: string,
    docId: string,
    data: Record<string, unknown>
  ): Promise<string> {
    return enqueue({
      type: 'update',
      collection,
      docId,
      data,
    });
  }

  async function queueRemove(collection: string, docId: string): Promise<string> {
    return enqueue({
      type: 'remove',
      collection,
      docId,
    });
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  function destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
    dbInstance = null;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  function generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Initialize pending count
  getQueueSize().catch(() => {
    // Ignore init errors
  });

  return {
    // Status
    getStatus,
    getQueueSize,
    isOnline: () => isOnline,

    // Queue operations
    enqueue,
    dequeue,
    getAll,
    clear,

    // Convenience methods
    queueCreate,
    queueUpdate,
    queueRemove,

    // Processing
    processQueue,

    // Lifecycle
    destroy,

    // Testing
    _setOnline: (online: boolean) => {
      isOnline = online;
      notifyStatusChange();
    },
    _getConfig: () => cfg,
  };
}

export type OfflineQueue = ReturnType<typeof createOfflineQueue>;
