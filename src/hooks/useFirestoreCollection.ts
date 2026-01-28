/**
 * useFirestoreCollection Hook
 * Sprint 27 - T27.3
 * 
 * React hook for subscribing to Firestore collection updates with real-time sync.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FirestoreService, QueryOptions } from '../services/FirestoreService';

export interface UseFirestoreCollectionOptions<T> extends QueryOptions {
  /** Enable real-time subscriptions (default: true) */
  realtime?: boolean;
  /** Callback when data changes */
  onDataChange?: (data: T[]) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

export interface UseFirestoreCollectionResult<T> {
  /** Collection data */
  data: T[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether data is from cache */
  isFromCache: boolean;
  /** Refetch data */
  refetch: () => Promise<void>;
  /** Connection status */
  connectionStatus: 'online' | 'offline';
  /** Number of pending writes */
  pendingWrites: number;
}

/**
 * Hook for subscribing to a Firestore collection with real-time updates
 */
export function useFirestoreCollection<T>(
  firestoreService: FirestoreService | null,
  collection: string,
  options: UseFirestoreCollectionOptions<T> = {}
): UseFirestoreCollectionResult<T> {
  const { realtime = true, onDataChange, onError, ...queryOptions } = options;
  
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');
  const [pendingWrites, setPendingWrites] = useState(0);
  
  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  const optionsRef = useRef(queryOptions);
  
  // Update options ref when they change
  useEffect(() => {
    optionsRef.current = queryOptions;
  });

  // Callback refs to avoid recreating subscription
  const onDataChangeRef = useRef(onDataChange);
  const onErrorRef = useRef(onError);
  
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
    onErrorRef.current = onError;
  });

  const refetch = useCallback(async () => {
    if (!firestoreService) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await firestoreService.query<T>(collection, optionsRef.current);
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
        onDataChangeRef.current?.(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error('Failed to fetch');
        setError(error);
        setLoading(false);
        onErrorRef.current?.(error);
      }
    }
  }, [firestoreService, collection]);

  // Subscribe to collection updates
  useEffect(() => {
    if (!firestoreService) {
      setLoading(false);
      return;
    }
    
    mountedRef.current = true;
    setLoading(true);
    setError(null);
    
    let unsubscribe: (() => void) | undefined;
    
    if (realtime) {
      // Real-time subscription
      unsubscribe = firestoreService.subscribe<T>(
        collection,
        (newData, err) => {
          if (!mountedRef.current) return;
          
          if (err) {
            setError(err);
            setLoading(false);
            onErrorRef.current?.(err);
            return;
          }
          
          setData(newData);
          setLoading(false);
          setIsFromCache(false);
          onDataChangeRef.current?.(newData);
        },
        queryOptions
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
  }, [firestoreService, collection, realtime, refetch, JSON.stringify(queryOptions)]);

  // Poll connection status
  useEffect(() => {
    if (!firestoreService) return;
    
    const checkStatus = () => {
      if (!mountedRef.current) return;
      
      const status = firestoreService.getConnectionStatus();
      setConnectionStatus(status.online ? 'online' : 'offline');
      setPendingWrites(status.pendingWrites);
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    
    return () => clearInterval(interval);
  }, [firestoreService]);

  return {
    data,
    loading,
    error,
    isFromCache,
    refetch,
    connectionStatus,
    pendingWrites,
  };
}

/**
 * Hook for subscribing to a specific collection type (prospects)
 */
export function useProspects<T>(
  firestoreService: FirestoreService | null,
  options: Omit<UseFirestoreCollectionOptions<T>, 'collection'> = {}
): UseFirestoreCollectionResult<T> {
  return useFirestoreCollection<T>(firestoreService, 'prospects', options);
}

/**
 * Hook for subscribing to activities
 */
export function useActivities<T>(
  firestoreService: FirestoreService | null,
  options: Omit<UseFirestoreCollectionOptions<T>, 'collection'> = {}
): UseFirestoreCollectionResult<T> {
  return useFirestoreCollection<T>(firestoreService, 'activities', options);
}

/**
 * Hook for subscribing to sequences
 */
export function useSequences<T>(
  firestoreService: FirestoreService | null,
  options: Omit<UseFirestoreCollectionOptions<T>, 'collection'> = {}
): UseFirestoreCollectionResult<T> {
  return useFirestoreCollection<T>(firestoreService, 'sequences', options);
}
