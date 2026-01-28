/**
 * useFirestoreDoc Hook
 * Sprint 27 - T27.3
 * 
 * React hook for subscribing to a single Firestore document with real-time sync.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FirestoreService, WriteResult } from '../services/FirestoreService';

export interface UseFirestoreDocOptions<T> {
  /** Enable real-time subscriptions (default: true) */
  realtime?: boolean;
  /** Callback when document changes */
  onDataChange?: (data: T | null) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

export interface UseFirestoreDocResult<T> {
  /** Document data */
  data: T | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether document exists */
  exists: boolean;
  /** Update the document */
  update: (data: Partial<T>) => Promise<WriteResult>;
  /** Delete the document */
  remove: () => Promise<WriteResult>;
  /** Refetch the document */
  refetch: () => Promise<void>;
  /** Connection status */
  connectionStatus: 'online' | 'offline';
}

/**
 * Hook for subscribing to a single Firestore document with real-time updates
 */
export function useFirestoreDoc<T>(
  firestoreService: FirestoreService | null,
  collection: string,
  docId: string | null,
  options: UseFirestoreDocOptions<T> = {}
): UseFirestoreDocResult<T> {
  const { realtime = true, onDataChange, onError } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [exists, setExists] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');
  
  // Track mounted state
  const mountedRef = useRef(true);
  
  // Callback refs
  const onDataChangeRef = useRef(onDataChange);
  const onErrorRef = useRef(onError);
  
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
    onErrorRef.current = onError;
  });

  const refetch = useCallback(async () => {
    if (!firestoreService || !docId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await firestoreService.read<T>(collection, docId);
      if (mountedRef.current) {
        setData(result);
        setExists(result !== null);
        setLoading(false);
        onDataChangeRef.current?.(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error('Failed to fetch document');
        setError(error);
        setLoading(false);
        onErrorRef.current?.(error);
      }
    }
  }, [firestoreService, collection, docId]);

  const update = useCallback(async (updateData: Partial<T>): Promise<WriteResult> => {
    if (!firestoreService || !docId) {
      return { success: false, error: 'No service or document ID' };
    }
    
    try {
      const result = await firestoreService.update<T>(collection, docId, updateData);
      
      // Optimistic update is handled by service, but we can update local state too
      if (result.success && mountedRef.current && data) {
        const updated = { ...data, ...updateData } as T;
        setData(updated);
        onDataChangeRef.current?.(updated);
      }
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update');
      return { success: false, error: error.message };
    }
  }, [firestoreService, collection, docId, data]);

  const remove = useCallback(async (): Promise<WriteResult> => {
    if (!firestoreService || !docId) {
      return { success: false, error: 'No service or document ID' };
    }
    
    try {
      const result = await firestoreService.remove(collection, docId);
      
      if (result.success && mountedRef.current) {
        setData(null);
        setExists(false);
        onDataChangeRef.current?.(null);
      }
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete');
      return { success: false, error: error.message };
    }
  }, [firestoreService, collection, docId]);

  // Subscribe to document updates
  useEffect(() => {
    if (!firestoreService || !docId) {
      setLoading(false);
      setData(null);
      setExists(false);
      return;
    }
    
    mountedRef.current = true;
    setLoading(true);
    setError(null);
    
    let unsubscribe: (() => void) | undefined;
    
    if (realtime) {
      // Real-time subscription
      unsubscribe = firestoreService.subscribeDoc<T>(
        collection,
        docId,
        (newData, err) => {
          if (!mountedRef.current) return;
          
          if (err) {
            setError(err);
            setLoading(false);
            onErrorRef.current?.(err);
            return;
          }
          
          setData(newData);
          setExists(newData !== null);
          setLoading(false);
          onDataChangeRef.current?.(newData);
        }
      );
    } else {
      // One-time fetch
      refetch();
    }
    
    // Cleanup subscription on unmount
    return () => {
      mountedRef.current = false;
      unsubscribe?.();
    };
  }, [firestoreService, collection, docId, realtime, refetch]);

  // Poll connection status
  useEffect(() => {
    if (!firestoreService) return;
    
    const checkStatus = () => {
      if (!mountedRef.current) return;
      
      const status = firestoreService.getConnectionStatus();
      setConnectionStatus(status.online ? 'online' : 'offline');
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    
    return () => clearInterval(interval);
  }, [firestoreService]);

  return {
    data,
    loading,
    error,
    exists,
    update,
    remove,
    refetch,
    connectionStatus,
  };
}

/**
 * Hook for a single prospect document
 */
export function useProspect<T>(
  firestoreService: FirestoreService | null,
  prospectId: string | null,
  options: UseFirestoreDocOptions<T> = {}
): UseFirestoreDocResult<T> {
  return useFirestoreDoc<T>(firestoreService, 'prospects', prospectId, options);
}

/**
 * Hook for tenant document
 */
export function useTenant<T>(
  firestoreService: FirestoreService | null,
  tenantId: string | null,
  options: UseFirestoreDocOptions<T> = {}
): UseFirestoreDocResult<T> {
  return useFirestoreDoc<T>(firestoreService, 'tenants', tenantId, options);
}
