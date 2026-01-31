/**
 * Firestore Service
 * Sprint 27 - T27.2
 * 
 * Provides CRUD operations with optimistic updates, real-time subscriptions,
 * batch operations, and offline queue support.
 */

import type { Prospect, Activity, SequenceEnrollment, Tenant, TenantUser } from '../types/firestore';

/**
 * Firestore-like Timestamp interface
 */
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

/**
 * Query filter operators
 */
export type QueryOperator = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'array-contains-any';

/**
 * Query filter
 */
export interface QueryFilter {
  field: string;
  operator: QueryOperator;
  value: unknown;
}

/**
 * Query options
 */
export interface QueryOptions {
  filters?: QueryFilter[];
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  startAfter?: unknown;
  endBefore?: unknown;
}

/**
 * Batch operation
 */
export interface BatchOperation {
  type: 'set' | 'update' | 'delete';
  collection: string;
  docId: string;
  data?: Record<string, unknown>;
}

/**
 * Subscription callback
 */
export type SubscriptionCallback<T> = (data: T[], error?: Error) => void;

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * Write result
 */
export interface WriteResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Paginated result for cursor-based pagination
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
    total?: number; // Optional total count (expensive for large collections)
  };
}

/**
 * Batch result
 */
export interface BatchResult {
  success: boolean;
  committed: number;
  failed: number;
  errors: Array<{ docId: string; error: string }>;
}

/**
 * Pending write for offline queue
 */
export interface PendingWrite {
  id: string;
  operation: BatchOperation;
  timestamp: number;
  retries: number;
}

/**
 * Service configuration
 */
export interface FirestoreServiceConfig {
  tenantId: string;
  userId?: string;
  enableOfflineQueue?: boolean;
  offlineQueueKey?: string;
  maxBatchSize?: number;
  enableOptimisticUpdates?: boolean;
}

const DEFAULT_CONFIG = {
  enableOfflineQueue: true,
  offlineQueueKey: 'yardflow_offline_queue',
  maxBatchSize: 500,
  enableOptimisticUpdates: true,
};

/**
 * Create Firestore Service
 */
export function createFirestoreService(config: FirestoreServiceConfig) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // In-memory cache for optimistic updates
  const cache = new Map<string, Map<string, unknown>>();
  
  // Subscriptions registry
  const subscriptions = new Map<string, Set<SubscriptionCallback<unknown>>>();
  
  // Offline queue
  let offlineQueue: PendingWrite[] = [];
  
  // Connection status
  let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // ==========================================================================
  // Initialization
  // ==========================================================================

  function init(): void {
    loadOfflineQueue();
    
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
  }

  function destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
    
    // Clear all subscriptions
    subscriptions.clear();
    cache.clear();
  }

  function handleOnline(): void {
    isOnline = true;
    processOfflineQueue();
  }

  function handleOffline(): void {
    isOnline = false;
  }

  // ==========================================================================
  // Collection Paths
  // ==========================================================================

  function getCollectionPath(collection: string): string {
    switch (collection) {
      case 'prospects':
        return `tenants/${cfg.tenantId}/prospects`;
      case 'activities':
        return `tenants/${cfg.tenantId}/activities`;
      case 'sequences':
        return `tenants/${cfg.tenantId}/sequences`;
      case 'companies':
        return `tenants/${cfg.tenantId}/companies`;
      case 'users':
        return `tenants/${cfg.tenantId}/users`;
      case 'tenants':
        return 'tenants';
      default:
        return `tenants/${cfg.tenantId}/${collection}`;
    }
  }

  /**
   * Get full document path (for future Firebase SDK integration)
   * @internal
   */
  function _getDocPath(collection: string, docId: string): string {
    return `${getCollectionPath(collection)}/${docId}`;
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  function getFromCache<T>(collection: string, docId: string): T | undefined {
    const collectionCache = cache.get(collection);
    return collectionCache?.get(docId) as T | undefined;
  }

  function setInCache<T>(collection: string, docId: string, data: T): void {
    if (!cache.has(collection)) {
      cache.set(collection, new Map());
    }
    cache.get(collection)!.set(docId, data);
  }

  function removeFromCache(collection: string, docId: string): void {
    cache.get(collection)?.delete(docId);
  }

  /**
   * Clear collection cache (for future use)
   * @internal
   */
  function _clearCollectionCache(collection: string): void {
    cache.delete(collection);
  }

  function getAllFromCache<T>(collection: string): T[] {
    const collectionCache = cache.get(collection);
    if (!collectionCache) return [];
    return Array.from(collectionCache.values()) as T[];
  }

  // ==========================================================================
  // Offline Queue
  // ==========================================================================

  function loadOfflineQueue(): void {
    try {
      const stored = localStorage.getItem(cfg.offlineQueueKey);
      if (stored) {
        offlineQueue = JSON.parse(stored);
      }
    } catch {
      offlineQueue = [];
    }
  }

  function saveOfflineQueue(): void {
    try {
      localStorage.setItem(cfg.offlineQueueKey, JSON.stringify(offlineQueue));
    } catch {
      // Storage full
    }
  }

  function addToOfflineQueue(operation: BatchOperation): void {
    const pending: PendingWrite = {
      id: `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      operation,
      timestamp: Date.now(),
      retries: 0,
    };
    offlineQueue.push(pending);
    saveOfflineQueue();
  }

  async function processOfflineQueue(): Promise<void> {
    if (!isOnline || offlineQueue.length === 0) return;

    const toProcess = [...offlineQueue];
    offlineQueue = [];
    saveOfflineQueue();

    for (const pending of toProcess) {
      try {
        await executeOperation(pending.operation);
      } catch {
        pending.retries++;
        if (pending.retries < 3) {
          offlineQueue.push(pending);
        }
      }
    }

    saveOfflineQueue();
  }

  function getOfflineQueueStatus(): { pending: number; oldest: number | null } {
    return {
      pending: offlineQueue.length,
      oldest: offlineQueue.length > 0 ? offlineQueue[0].timestamp : null,
    };
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  async function create<T extends { id: string }>(
    collection: string,
    data: Omit<T, 'id'> & { id?: string }
  ): Promise<WriteResult> {
    const id = data.id || generateId();
    const docData = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: cfg.userId,
    } as unknown as T;

    // Optimistic update
    if (cfg.enableOptimisticUpdates) {
      setInCache(collection, id, docData);
      notifySubscribers(collection);
    }

    if (!isOnline && cfg.enableOfflineQueue) {
      addToOfflineQueue({
        type: 'set',
        collection,
        docId: id,
        data: docData as Record<string, unknown>,
      });
      return { success: true, id };
    }

    try {
      await executeOperation({
        type: 'set',
        collection,
        docId: id,
        data: docData as Record<string, unknown>,
      });
      return { success: true, id };
    } catch (error) {
      // Rollback optimistic update
      if (cfg.enableOptimisticUpdates) {
        removeFromCache(collection, id);
        notifySubscribers(collection);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create',
      };
    }
  }

  async function read<T>(collection: string, docId: string): Promise<T | null> {
    // Check cache first
    const cached = getFromCache<T>(collection, docId);
    if (cached) return cached;

    // In a real implementation, this would fetch from Firestore
    // For now, return null (mock)
    return null;
  }

  async function update<T>(
    collection: string,
    docId: string,
    data: Partial<T>
  ): Promise<WriteResult> {
    const existing = getFromCache<T>(collection, docId);
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: cfg.userId,
    };

    // Optimistic update
    if (cfg.enableOptimisticUpdates && existing) {
      const updated = { ...existing, ...updateData } as T;
      setInCache(collection, docId, updated);
      notifySubscribers(collection);
    }

    if (!isOnline && cfg.enableOfflineQueue) {
      addToOfflineQueue({
        type: 'update',
        collection,
        docId,
        data: updateData as Record<string, unknown>,
      });
      return { success: true, id: docId };
    }

    try {
      await executeOperation({
        type: 'update',
        collection,
        docId,
        data: updateData as Record<string, unknown>,
      });
      return { success: true, id: docId };
    } catch (error) {
      // Rollback optimistic update
      if (cfg.enableOptimisticUpdates && existing) {
        setInCache(collection, docId, existing);
        notifySubscribers(collection);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update',
      };
    }
  }

  async function remove(collection: string, docId: string): Promise<WriteResult> {
    const existing = getFromCache(collection, docId);

    // Optimistic delete
    if (cfg.enableOptimisticUpdates) {
      removeFromCache(collection, docId);
      notifySubscribers(collection);
    }

    if (!isOnline && cfg.enableOfflineQueue) {
      addToOfflineQueue({
        type: 'delete',
        collection,
        docId,
      });
      return { success: true, id: docId };
    }

    try {
      await executeOperation({
        type: 'delete',
        collection,
        docId,
      });
      return { success: true, id: docId };
    } catch (error) {
      // Rollback optimistic delete
      if (cfg.enableOptimisticUpdates && existing) {
        setInCache(collection, docId, existing);
        notifySubscribers(collection);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete',
      };
    }
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  async function query<T>(
    collection: string,
    options: QueryOptions = {}
  ): Promise<T[]> {
    // For now, filter from cache (in real impl, would query Firestore)
    let results = getAllFromCache<T>(collection);

    // Apply filters
    if (options.filters) {
      for (const filter of options.filters) {
        results = results.filter((doc) => {
          const value = (doc as Record<string, unknown>)[filter.field];
          return applyOperator(value, filter.operator, filter.value);
        });
      }
    }

    // Apply ordering
    if (options.orderBy && options.orderBy.length > 0) {
      results.sort((a, b) => {
        for (const order of options.orderBy!) {
          const aVal = (a as Record<string, unknown>)[order.field];
          const bVal = (b as Record<string, unknown>)[order.field];
          const cmp = compareValues(aVal, bVal);
          if (cmp !== 0) {
            return order.direction === 'desc' ? -cmp : cmp;
          }
        }
        return 0;
      });
    }

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Paginated query with cursor-based navigation
   * @param collection - The collection to query
   * @param options - Query options including limit for page size
   * @param cursor - Optional cursor (encoded doc ID) for pagination
   * @returns Paginated result with data and pagination metadata
   */
  async function queryPaginated<T extends { id: string }>(
    collection: string,
    options: QueryOptions = {},
    cursor?: string | null
  ): Promise<PaginatedResult<T>> {
    const pageSize = options.limit || 25;
    
    // Get all results (with filters and ordering applied)
    let allResults = getAllFromCache<T>(collection);
    
    // Apply filters
    if (options.filters) {
      for (const filter of options.filters) {
        allResults = allResults.filter((doc) => {
          const value = (doc as Record<string, unknown>)[filter.field];
          return applyOperator(value, filter.operator, filter.value);
        });
      }
    }
    
    // Apply ordering
    if (options.orderBy && options.orderBy.length > 0) {
      allResults.sort((a, b) => {
        for (const order of options.orderBy!) {
          const aVal = (a as Record<string, unknown>)[order.field];
          const bVal = (b as Record<string, unknown>)[order.field];
          const cmp = compareValues(aVal, bVal);
          if (cmp !== 0) {
            return order.direction === 'desc' ? -cmp : cmp;
          }
        }
        return 0;
      });
    }
    
    const total = allResults.length;
    
    // Find cursor position
    let startIndex = 0;
    if (cursor) {
      const decodedCursor = atob(cursor);
      const cursorIndex = allResults.findIndex((doc) => doc.id === decodedCursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1; // Start after the cursor
      }
    }
    
    // Slice for current page (fetch one extra to check hasMore)
    const pageResults = allResults.slice(startIndex, startIndex + pageSize + 1);
    const hasMore = pageResults.length > pageSize;
    
    // Remove the extra item if present
    const data = hasMore ? pageResults.slice(0, pageSize) : pageResults;
    
    // Calculate cursors
    const lastItem = data[data.length - 1];
    const firstItem = data[0];
    
    return {
      data,
      pagination: {
        hasMore,
        nextCursor: hasMore && lastItem ? btoa(lastItem.id) : null,
        prevCursor: startIndex > 0 && firstItem ? btoa(allResults[startIndex - 1]?.id || '') : null,
        total,
      },
    };
  }

  function applyOperator(docValue: unknown, operator: QueryOperator, filterValue: unknown): boolean {
    switch (operator) {
      case '==':
        return docValue === filterValue;
      case '!=':
        return docValue !== filterValue;
      case '<':
        return (docValue as number) < (filterValue as number);
      case '<=':
        return (docValue as number) <= (filterValue as number);
      case '>':
        return (docValue as number) > (filterValue as number);
      case '>=':
        return (docValue as number) >= (filterValue as number);
      case 'array-contains':
        return Array.isArray(docValue) && docValue.includes(filterValue);
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(docValue);
      case 'array-contains-any':
        return Array.isArray(docValue) && Array.isArray(filterValue) && 
          filterValue.some((v) => docValue.includes(v));
      default:
        return false;
    }
  }

  function compareValues(a: unknown, b: unknown): number {
    if (a === b) return 0;
    if (a === null || a === undefined) return -1;
    if (b === null || b === undefined) return 1;
    if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b));
  }

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  async function batch(operations: BatchOperation[]): Promise<BatchResult> {
    const result: BatchResult = {
      success: true,
      committed: 0,
      failed: 0,
      errors: [],
    };

    // Validate batch size
    if (operations.length > cfg.maxBatchSize) {
      return {
        success: false,
        committed: 0,
        failed: operations.length,
        errors: [{ docId: '', error: `Batch size exceeds maximum of ${cfg.maxBatchSize}` }],
      };
    }

    // Process in chunks if needed
    for (const op of operations) {
      try {
        if (cfg.enableOptimisticUpdates) {
          applyOptimisticOperation(op);
        }

        if (!isOnline && cfg.enableOfflineQueue) {
          addToOfflineQueue(op);
          result.committed++;
        } else {
          await executeOperation(op);
          result.committed++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          docId: op.docId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    result.success = result.failed === 0;
    
    // Notify subscribers for affected collections
    const collections = new Set(operations.map((op) => op.collection));
    for (const collection of collections) {
      notifySubscribers(collection);
    }

    return result;
  }

  function applyOptimisticOperation(op: BatchOperation): void {
    switch (op.type) {
      case 'set':
        if (op.data) {
          setInCache(op.collection, op.docId, op.data);
        }
        break;
      case 'update':
        if (op.data) {
          const existing = getFromCache(op.collection, op.docId);
          if (existing) {
            setInCache(op.collection, op.docId, { ...existing, ...op.data });
          }
        }
        break;
      case 'delete':
        removeFromCache(op.collection, op.docId);
        break;
    }
  }

  async function executeOperation(_op: BatchOperation): Promise<void> {
    // In real implementation, this would call Firebase SDK
    // For now, just resolve immediately (mock mode)
    return Promise.resolve();
  }

  // ==========================================================================
  // Subscriptions
  // ==========================================================================

  function subscribe<T>(
    collection: string,
    callback: SubscriptionCallback<T>,
    options: QueryOptions = {}
  ): Unsubscribe {
    if (!subscriptions.has(collection)) {
      subscriptions.set(collection, new Set());
    }
    
    const wrappedCallback = async (_data: unknown[], error?: Error) => {
      if (error) {
        callback([], error);
        return;
      }
      
      // Apply query options to cached data
      const filtered = await query<T>(collection, options);
      callback(filtered);
    };
    
    subscriptions.get(collection)!.add(wrappedCallback as SubscriptionCallback<unknown>);
    
    // Initial data
    query<T>(collection, options).then((data) => callback(data));
    
    return () => {
      subscriptions.get(collection)?.delete(wrappedCallback as SubscriptionCallback<unknown>);
    };
  }

  function subscribeDoc<T>(
    collection: string,
    docId: string,
    callback: (data: T | null, error?: Error) => void
  ): Unsubscribe {
    const wrappedCallback: SubscriptionCallback<T> = () => {
      const doc = getFromCache<T>(collection, docId);
      callback(doc || null);
    };
    
    if (!subscriptions.has(collection)) {
      subscriptions.set(collection, new Set());
    }
    
    subscriptions.get(collection)!.add(wrappedCallback as SubscriptionCallback<unknown>);
    
    // Initial data
    const initial = getFromCache<T>(collection, docId);
    callback(initial || null);
    
    return () => {
      subscriptions.get(collection)?.delete(wrappedCallback as SubscriptionCallback<unknown>);
    };
  }

  function notifySubscribers(collection: string): void {
    const callbacks = subscriptions.get(collection);
    if (!callbacks) return;
    
    const data = getAllFromCache(collection);
    for (const callback of callbacks) {
      try {
        callback(data);
      } catch {
        // Callback error - don't propagate
      }
    }
  }

  // ==========================================================================
  // Utility Functions
  // ==========================================================================

  function generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  }

  function getConnectionStatus(): { online: boolean; pendingWrites: number } {
    return {
      online: isOnline,
      pendingWrites: offlineQueue.length,
    };
  }

  // ==========================================================================
  // Prospect-specific Operations
  // ==========================================================================

  async function getProspects(options?: QueryOptions): Promise<Prospect[]> {
    return query<Prospect>('prospects', options);
  }

  /**
   * Get paginated prospects with cursor-based navigation
   * @param options - Query options (filters, orderBy, limit as page size)
   * @param cursor - Optional cursor for pagination (from previous result)
   * @returns Paginated prospects with navigation metadata
   */
  async function getPaginatedProspects(
    options?: QueryOptions,
    cursor?: string | null
  ): Promise<PaginatedResult<Prospect>> {
    return queryPaginated<Prospect>('prospects', options || {}, cursor);
  }

  async function getProspect(id: string): Promise<Prospect | null> {
    return read<Prospect>('prospects', id);
  }

  async function createProspect(data: Omit<Prospect, 'id'>): Promise<WriteResult> {
    return create<Prospect>('prospects', data);
  }

  async function updateProspect(id: string, data: Partial<Prospect>): Promise<WriteResult> {
    return update<Prospect>('prospects', id, data);
  }

  async function deleteProspect(id: string): Promise<WriteResult> {
    return remove('prospects', id);
  }

  // ==========================================================================
  // Activity-specific Operations
  // ==========================================================================

  async function getActivities(options?: QueryOptions): Promise<Activity[]> {
    return query<Activity>('activities', options);
  }

  async function createActivity(data: Omit<Activity, 'id'>): Promise<WriteResult> {
    return create<Activity>('activities', data);
  }

  // ==========================================================================
  // Sequence Enrollment Operations
  // ==========================================================================

  async function getSequences(options?: QueryOptions): Promise<SequenceEnrollment[]> {
    return query<SequenceEnrollment>('sequences', options);
  }

  async function getSequence(id: string): Promise<SequenceEnrollment | null> {
    return read<SequenceEnrollment>('sequences', id);
  }

  async function createSequence(data: Omit<SequenceEnrollment, 'id'>): Promise<WriteResult> {
    return create<SequenceEnrollment>('sequences', data);
  }

  async function updateSequence(id: string, data: Partial<SequenceEnrollment>): Promise<WriteResult> {
    return update<SequenceEnrollment>('sequences', id, data);
  }

  async function deleteSequence(id: string): Promise<WriteResult> {
    return remove('sequences', id);
  }

  // ==========================================================================
  // Tenant Operations
  // ==========================================================================

  async function getTenant(): Promise<Tenant | null> {
    return read<Tenant>('tenants', cfg.tenantId);
  }

  async function updateTenant(data: Partial<Tenant>): Promise<WriteResult> {
    return update<Tenant>('tenants', cfg.tenantId, data);
  }

  async function getTenantUsers(): Promise<TenantUser[]> {
    return query<TenantUser>('users');
  }

  // Initialize
  init();

  return {
    // CRUD
    create,
    read,
    update,
    remove,
    query,
    queryPaginated,
    batch,
    
    // Subscriptions
    subscribe,
    subscribeDoc,
    
    // Prospect operations
    getProspects,
    getPaginatedProspects,
    getProspect,
    createProspect,
    updateProspect,
    deleteProspect,
    
    // Activity operations
    getActivities,
    createActivity,
    
    // Sequence operations
    getSequences,
    getSequence,
    createSequence,
    updateSequence,
    deleteSequence,
    
    // Tenant operations
    getTenant,
    updateTenant,
    getTenantUsers,
    
    // Status
    getConnectionStatus,
    getOfflineQueueStatus,
    processOfflineQueue,
    
    // Lifecycle
    destroy,
    
    // Cache & internal (for testing)
    _setInCache: setInCache,
    _clearCache: () => cache.clear(),
    _getDocPath,
    _clearCollectionCache,
  };
}

export type FirestoreService = ReturnType<typeof createFirestoreService>;
