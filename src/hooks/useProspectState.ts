/**
 * useProspectState Hook - Prospect State Management
 * 
 * Sprint 93: T93.2 - Extract Prospect State to Custom Hook
 * Sprint 93: T93.3 - Replace Prospect Reads with Railway
 * Sprint 93: T93.4 - Replace Prospect Mutations with Railway
 * 
 * This hook encapsulates all prospect state management, including:
 * - Loading prospects from Firestore or Railway (feature-flagged)
 * - CRUD operations with dual-write support
 * - Optimistic updates with rollback on failure
 * 
 * @example
 * const { prospects, isLoading, updateProspect, deleteProspect } = useProspectState();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getFirestore, 
  collection, 
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import type { Prospect } from '../types';
import { HITLIST_PROSPECTS } from '../data/hitlistData';
import { featureFlags, isDualWriteEnabled } from '../config/featureFlags';
import { railwayClient } from '../services/RailwayApiClient';
import type { RailwayProspect } from '../types/railway';

// =============================================================================
// Types
// =============================================================================

export interface UseProspectStateOptions {
  /** Enable real-time Firestore listener (default: true when not using Railway) */
  enableRealtimeSync?: boolean;
  /** Initial prospects data (for SSR or testing) */
  initialData?: Prospect[];
}

export interface UseProspectStateReturn {
  /** List of prospects */
  prospects: Prospect[];
  /** Set prospects directly (for bulk operations) */
  setProspects: React.Dispatch<React.SetStateAction<Prospect[]>>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Data source currently in use */
  dataSource: 'firestore' | 'railway' | 'local';
  /** Update a single prospect */
  updateProspect: (id: string, data: Partial<Prospect>) => Promise<boolean>;
  /** Update prospect status */
  updateProspectStatus: (id: string, status: Prospect['status']) => Promise<boolean>;
  /** Update prospect email */
  updateProspectEmail: (id: string, email: string | undefined) => Promise<boolean>;
  /** Delete a prospect */
  deleteProspect: (id: string) => Promise<boolean>;
  /** Bulk delete prospects */
  bulkDeleteProspects: (ids: string[]) => Promise<{ success: boolean; deleted: number }>;
  /** Bulk update prospects */
  bulkUpdateProspects: (ids: string[], data: Partial<Prospect>) => Promise<{ success: boolean; updated: number }>;
  /** Add new prospects (e.g., from import) */
  addProspects: (newProspects: Prospect[]) => Promise<boolean>;
  /** Refresh prospects from source */
  refresh: () => Promise<void>;
}

// =============================================================================
// Helpers
// =============================================================================

function getDb() {
  try {
    const app = getApp();
    return getFirestore(app);
  } catch {
    return null;
  }
}

/**
 * Map Railway prospect to local Prospect type
 */
function mapRailwayToProspect(railway: RailwayProspect): Prospect {
  // Map Railway status to local Prospect status
  const statusMap: Record<string, Prospect['status']> = {
    'new': 'new',
    'researching': 'new',
    'contacted': 'contacted',
    'replied': 'contacted',
    'meeting_scheduled': 'meeting_booked',
    'closed_won': 'meeting_booked',
    'closed_lost': 'contacted',
    'nurturing': 'contacted',
  };

  return {
    id: railway.id,
    name: railway.name || `${railway.firstName} ${railway.lastName}`.trim(),
    email: railway.email ?? undefined,
    company: railway.companyName || '',
    title: railway.title || '',
    tier: railway.tier,
    score: railway.score,
    status: statusMap[railway.status] || 'new',
    isOps: false,
    isExec: false,
    linkedinUrl: railway.linkedinUrl ?? undefined,
    location: railway.timezone ?? undefined,
    tags: railway.tags,
    notes: railway.notes ?? undefined,
    createdAt: railway.createdAt ? new Date(railway.createdAt).getTime() : undefined,
    updatedAt: railway.updatedAt ? new Date(railway.updatedAt).getTime() : undefined,
  };
}

/**
 * Map local Prospect to Railway update format
 */
function mapProspectToRailway(prospect: Partial<Prospect>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  
  if (prospect.name !== undefined) {
    const parts = prospect.name.split(' ');
    mapped.firstName = parts[0] || '';
    mapped.lastName = parts.slice(1).join(' ') || '';
  }
  if (prospect.email !== undefined) mapped.email = prospect.email || null;
  if (prospect.company !== undefined) mapped.companyName = prospect.company;
  if (prospect.title !== undefined) mapped.title = prospect.title;
  if (prospect.tier !== undefined) mapped.tier = prospect.tier;
  if (prospect.score !== undefined) mapped.score = prospect.score;
  if (prospect.status !== undefined) mapped.status = prospect.status;
  if (prospect.linkedinUrl !== undefined) mapped.linkedinUrl = prospect.linkedinUrl || null;
  if (prospect.tags !== undefined) mapped.tags = prospect.tags;
  if (prospect.notes !== undefined) mapped.notes = prospect.notes || null;
  
  return mapped;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useProspectState(options: UseProspectStateOptions = {}): UseProspectStateReturn {
  const {
    enableRealtimeSync = true,
    initialData = HITLIST_PROSPECTS,
  } = options;

  // State
  const [prospects, setProspects] = useState<Prospect[]>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [dataSource, setDataSource] = useState<'firestore' | 'railway' | 'local'>('local');

  // Refs for cleanup and preventing double-load
  const mountedRef = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const loadedRef = useRef(false);

  // ---------------------------------------------------------------------------
  // T93.3: Load Prospects (Railway or Firestore)
  // ---------------------------------------------------------------------------

  const loadFromRailway = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await railwayClient.prospects.list({ pageSize: 1000 });

      if (!mountedRef.current) return;

      if (result.ok && result.data) {
        const mapped = result.data.data.map(mapRailwayToProspect);
        setProspects(mapped);
        setDataSource('railway');
        
        if (featureFlags.DEBUG_RAILWAY_REQUESTS) {
          console.log(`[useProspectState] Loaded ${mapped.length} prospects from Railway`);
        }
      } else {
        throw new Error(result.error || 'Failed to load prospects from Railway');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[useProspectState] Railway load failed:', err);
      setError(err instanceof Error ? err : new Error('Failed to load prospects'));
      
      // Fallback to local data on error
      setDataSource('local');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        loadedRef.current = true;
      }
    }
  }, []);

  const loadFromFirestore = useCallback((): void => {
    const db = getDb();
    if (!db) {
      setIsLoading(false);
      setDataSource('local');
      loadedRef.current = true;
      return;
    }

    // Clean up previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    if (!enableRealtimeSync) {
      // One-time load (not implemented for Firestore in this hook)
      setIsLoading(false);
      setDataSource('local');
      loadedRef.current = true;
      return;
    }

    // Real-time listener
    const prospectsRef = collection(db, 'prospects');
    
    unsubscribeRef.current = onSnapshot(
      prospectsRef,
      (snapshot) => {
        if (!mountedRef.current) return;
        
        const loaded: Prospect[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Prospect));
        
        // Merge with hitlist data for prospects not in Firestore
        const firestoreIds = new Set(loaded.map(p => p.id));
        const hitlistOnly = HITLIST_PROSPECTS.filter(p => !firestoreIds.has(p.id));
        
        setProspects([...loaded, ...hitlistOnly]);
        setDataSource('firestore');
        setIsLoading(false);
        loadedRef.current = true;
      },
      (err) => {
        if (!mountedRef.current) return;
        console.error('[useProspectState] Firestore error:', err);
        setError(err);
        setDataSource('local');
        setIsLoading(false);
        loadedRef.current = true;
      }
    );
  }, [enableRealtimeSync]);

  const loadProspects = useCallback(async (): Promise<void> => {
    // T93.3: Feature flag determines data source
    if (featureFlags.RAILWAY_ENABLED && featureFlags.RAILWAY_DATA_ENABLED) {
      await loadFromRailway();
    } else {
      loadFromFirestore();
    }
  }, [loadFromRailway, loadFromFirestore]);

  // Initial load
  useEffect(() => {
    if (!loadedRef.current) {
      loadProspects();
    }

    return () => {
      mountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [loadProspects]);

  // ---------------------------------------------------------------------------
  // T93.4: Update Prospect (with dual-write support)
  // ---------------------------------------------------------------------------

  const updateProspect = useCallback(async (id: string, data: Partial<Prospect>): Promise<boolean> => {
    // Store original for rollback
    const originalProspects = [...prospects];
    const originalProspect = prospects.find(p => p.id === id);
    
    if (!originalProspect) {
      console.warn(`[useProspectState] Prospect ${id} not found`);
      return false;
    }

    // Optimistic update
    setProspects(prev => prev.map(p => p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p));

    try {
      // T93.4: Railway write
      if (featureFlags.RAILWAY_ENABLED && featureFlags.RAILWAY_DATA_ENABLED) {
        const railwayData = mapProspectToRailway(data);
        const result = await railwayClient.prospects.update(id, railwayData as any);
        
        if (!result.ok) {
          throw new Error(result.error || 'Railway update failed');
        }
      }

      // T93.4: Dual-write to Firestore
      if (isDualWriteEnabled() || (!featureFlags.RAILWAY_ENABLED)) {
        const db = getDb();
        if (db) {
          const prospectRef = doc(db, 'prospects', id);
          await updateDoc(prospectRef, {
            ...data,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      return true;
    } catch (err) {
      console.error('[useProspectState] Update failed:', err);
      // Rollback optimistic update
      setProspects(originalProspects);
      setError(err instanceof Error ? err : new Error('Update failed'));
      return false;
    }
  }, [prospects]);

  const updateProspectStatus = useCallback(async (id: string, status: Prospect['status']): Promise<boolean> => {
    return updateProspect(id, { status });
  }, [updateProspect]);

  const updateProspectEmail = useCallback(async (id: string, email: string | undefined): Promise<boolean> => {
    return updateProspect(id, { email });
  }, [updateProspect]);

  // ---------------------------------------------------------------------------
  // T93.4: Delete Prospect
  // ---------------------------------------------------------------------------

  const deleteProspect = useCallback(async (id: string): Promise<boolean> => {
    // Store for rollback
    const originalProspects = [...prospects];

    // Optimistic delete
    setProspects(prev => prev.filter(p => p.id !== id));

    try {
      // Railway delete
      if (featureFlags.RAILWAY_ENABLED && featureFlags.RAILWAY_DATA_ENABLED) {
        const result = await railwayClient.prospects.delete(id);
        if (!result.ok) {
          throw new Error(result.error || 'Railway delete failed');
        }
      }

      // Dual-write to Firestore
      if (isDualWriteEnabled() || (!featureFlags.RAILWAY_ENABLED)) {
        const db = getDb();
        if (db) {
          await deleteDoc(doc(db, 'prospects', id));
        }
      }

      return true;
    } catch (err) {
      console.error('[useProspectState] Delete failed:', err);
      // Rollback
      setProspects(originalProspects);
      setError(err instanceof Error ? err : new Error('Delete failed'));
      return false;
    }
  }, [prospects]);

  // ---------------------------------------------------------------------------
  // Bulk Operations
  // ---------------------------------------------------------------------------

  const bulkDeleteProspects = useCallback(async (ids: string[]): Promise<{ success: boolean; deleted: number }> => {
    const idsSet = new Set(ids);
    const originalProspects = [...prospects];

    // Optimistic delete
    setProspects(prev => prev.filter(p => !idsSet.has(p.id)));

    try {
      let deleted = 0;

      // Railway bulk delete (one by one for now, could batch)
      if (featureFlags.RAILWAY_ENABLED && featureFlags.RAILWAY_DATA_ENABLED) {
        for (const id of ids) {
          const result = await railwayClient.prospects.delete(id);
          if (result.ok) deleted++;
        }
      }

      // Firestore batch delete
      if (isDualWriteEnabled() || (!featureFlags.RAILWAY_ENABLED)) {
        const db = getDb();
        if (db) {
          const batch = writeBatch(db);
          for (const id of ids) {
            batch.delete(doc(db, 'prospects', id));
          }
          await batch.commit();
          if (!featureFlags.RAILWAY_ENABLED) {
            deleted = ids.length;
          }
        }
      }

      return { success: true, deleted };
    } catch (err) {
      console.error('[useProspectState] Bulk delete failed:', err);
      setProspects(originalProspects);
      setError(err instanceof Error ? err : new Error('Bulk delete failed'));
      return { success: false, deleted: 0 };
    }
  }, [prospects]);

  const bulkUpdateProspects = useCallback(async (ids: string[], data: Partial<Prospect>): Promise<{ success: boolean; updated: number }> => {
    const idsSet = new Set(ids);
    const originalProspects = [...prospects];

    // Optimistic update
    setProspects(prev => prev.map(p => idsSet.has(p.id) ? { ...p, ...data, updatedAt: Date.now() } : p));

    try {
      let updated = 0;

      // Railway bulk update
      if (featureFlags.RAILWAY_ENABLED && featureFlags.RAILWAY_DATA_ENABLED) {
        const railwayData = mapProspectToRailway(data);
        for (const id of ids) {
          const result = await railwayClient.prospects.update(id, railwayData as any);
          if (result.ok) updated++;
        }
      }

      // Firestore batch update
      if (isDualWriteEnabled() || (!featureFlags.RAILWAY_ENABLED)) {
        const db = getDb();
        if (db) {
          const batch = writeBatch(db);
          for (const id of ids) {
            batch.update(doc(db, 'prospects', id), { ...data, updatedAt: new Date().toISOString() });
          }
          await batch.commit();
          if (!featureFlags.RAILWAY_ENABLED) {
            updated = ids.length;
          }
        }
      }

      return { success: true, updated };
    } catch (err) {
      console.error('[useProspectState] Bulk update failed:', err);
      setProspects(originalProspects);
      setError(err instanceof Error ? err : new Error('Bulk update failed'));
      return { success: false, updated: 0 };
    }
  }, [prospects]);

  const addProspects = useCallback(async (newProspects: Prospect[]): Promise<boolean> => {
    // Optimistic add
    setProspects(prev => [...prev, ...newProspects]);

    try {
      // Railway create
      if (featureFlags.RAILWAY_ENABLED && featureFlags.RAILWAY_DATA_ENABLED) {
        for (const prospect of newProspects) {
          const railwayData = mapProspectToRailway(prospect);
          await railwayClient.prospects.create(railwayData as any);
        }
      }

      // Firestore batch create
      if (isDualWriteEnabled() || (!featureFlags.RAILWAY_ENABLED)) {
        const db = getDb();
        if (db) {
          const batch = writeBatch(db);
          for (const prospect of newProspects) {
            batch.set(doc(db, 'prospects', prospect.id), {
              ...prospect,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          await batch.commit();
        }
      }

      return true;
    } catch (err) {
      console.error('[useProspectState] Add prospects failed:', err);
      // Remove optimistically added prospects
      const newIds = new Set(newProspects.map(p => p.id));
      setProspects(prev => prev.filter(p => !newIds.has(p.id)));
      setError(err instanceof Error ? err : new Error('Add prospects failed'));
      return false;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    prospects,
    setProspects,
    isLoading,
    error,
    dataSource,
    updateProspect,
    updateProspectStatus,
    updateProspectEmail,
    deleteProspect,
    bulkDeleteProspects,
    bulkUpdateProspects,
    addProspects,
    refresh: loadProspects,
  };
}

export default useProspectState;
