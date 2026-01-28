/**
 * useOfflineQueue Hook
 * Sprint 34 - T34.3
 * 
 * React hook for offline queue state management.
 * Provides sync status and pending count for UI display.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  createOfflineQueue, 
  type SyncStatus as SyncStatusType,
  type OfflineQueueConfig
} from '../services/OfflineQueue';

// =============================================================================
// Types
// =============================================================================

export interface UseOfflineQueueReturn {
  /** Current sync status */
  status: SyncStatusType;
  /** Number of pending operations */
  pendingCount: number;
  /** Whether currently syncing */
  isSyncing: boolean;
  /** Whether device is online */
  isOnline: boolean;
  /** Last successful sync timestamp */
  lastSyncTime: Date | null;
  /** Manually trigger sync */
  syncNow: () => Promise<void>;
  /** Retry failed operations */
  retry: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

// Singleton queue instance
let queueInstance: ReturnType<typeof createOfflineQueue> | null = null;

function getQueue(config?: OfflineQueueConfig) {
  if (!queueInstance) {
    queueInstance = createOfflineQueue(config);
  }
  return queueInstance;
}

export function useOfflineQueue(config?: OfflineQueueConfig): UseOfflineQueueReturn {
  const [status, setStatus] = useState<SyncStatusType>('synced');
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  const queueRef = useRef<ReturnType<typeof createOfflineQueue> | null>(null);

  // Initialize queue with status callback
  useEffect(() => {
    const queue = getQueue({
      ...config,
      onStatusChange: (newStatus, count) => {
        setStatus(newStatus);
        setPendingCount(count);
        if (newStatus === 'synced' && count === 0) {
          setLastSyncTime(new Date());
        }
      },
    });
    
    queueRef.current = queue;

    // Get initial pending count
    queue.getPendingCount().then(count => {
      setPendingCount(count);
      if (count > 0) {
        setStatus('pending');
      }
    }).catch(() => {
      // IndexedDB not available
    });

    return () => {
      queue.destroy();
      queueInstance = null;
    };
  }, [config]);

  // Online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setStatus('syncing');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync now
  const syncNow = useCallback(async () => {
    if (!queueRef.current || !isOnline) return;
    
    setStatus('syncing');
    try {
      await queueRef.current.processQueue();
      const count = await queueRef.current.getPendingCount();
      setPendingCount(count);
      setStatus(count > 0 ? 'pending' : 'synced');
      setLastSyncTime(new Date());
    } catch (error) {
      setStatus('error');
      console.error('[useOfflineQueue] Sync failed:', error);
    }
  }, [isOnline]);

  // Retry failed
  const retry = useCallback(async () => {
    if (!queueRef.current) return;
    await syncNow();
  }, [syncNow]);

  return {
    status,
    pendingCount,
    isSyncing: status === 'syncing',
    isOnline,
    lastSyncTime,
    syncNow,
    retry,
  };
}

export default useOfflineQueue;
