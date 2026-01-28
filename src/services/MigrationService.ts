/**
 * Migration Service
 * Sprint 27 - T27.6
 * 
 * One-time migration from localStorage to Firestore with progress tracking
 * and rollback capability.
 */

import type { FirestoreService } from './FirestoreService';

export type MigrationStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'rolled-back';

export interface MigrationProgress {
  status: MigrationStatus;
  totalItems: number;
  migratedItems: number;
  currentCollection: string;
  percentComplete: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface MigrationRecord {
  id: string;
  tenantId: string;
  userId: string;
  status: MigrationStatus;
  startedAt: string;
  completedAt: string | null;
  collections: string[];
  itemCounts: Record<string, number>;
  rollbackAvailable: boolean;
  rollbackExpires: string | null;
  error: string | null;
}

export interface MigrationConfig {
  tenantId: string;
  userId: string;
  firestoreService: FirestoreService;
  localStoragePrefix?: string;
  rollbackHours?: number;
  batchSize?: number;
  onProgress?: (progress: MigrationProgress) => void;
}

const DEFAULT_CONFIG = {
  localStoragePrefix: 'yardflow_',
  rollbackHours: 24,
  batchSize: 100,
};

/**
 * Collection mapping from localStorage to Firestore
 */
const COLLECTION_MAP: Record<string, string> = {
  prospects: 'prospects',
  activities: 'activities',
  sequences: 'sequences',
  companies: 'companies',
  settings: 'settings',
};

/**
 * Create Migration Service
 */
export function createMigrationService(config: MigrationConfig) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Current migration state
  let currentProgress: MigrationProgress = {
    status: 'pending',
    totalItems: 0,
    migratedItems: 0,
    currentCollection: '',
    percentComplete: 0,
    startedAt: null,
    completedAt: null,
    error: null,
  };

  // Backup storage for rollback
  const backupData = new Map<string, unknown[]>();

  // ==========================================================================
  // Progress Tracking
  // ==========================================================================

  function updateProgress(partial: Partial<MigrationProgress>): void {
    currentProgress = { ...currentProgress, ...partial };
    
    if (currentProgress.totalItems > 0) {
      currentProgress.percentComplete = Math.round(
        (currentProgress.migratedItems / currentProgress.totalItems) * 100
      );
    }
    
    cfg.onProgress?.(currentProgress);
  }

  function getProgress(): MigrationProgress {
    return { ...currentProgress };
  }

  // ==========================================================================
  // localStorage Data Reading
  // ==========================================================================

  function getLocalStorageKeys(): string[] {
    const keys: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(cfg.localStoragePrefix)) {
        keys.push(key);
      }
    }
    
    return keys;
  }

  function getCollectionFromKey(key: string): string | null {
    const stripped = key.replace(cfg.localStoragePrefix, '');
    
    for (const [localKey, firestoreCollection] of Object.entries(COLLECTION_MAP)) {
      if (stripped === localKey || stripped.startsWith(`${localKey}_`)) {
        return firestoreCollection;
      }
    }
    
    return null;
  }

  function parseLocalStorageData(key: string): unknown[] | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      
      const parsed = JSON.parse(raw);
      
      // Handle both array and object storage
      if (Array.isArray(parsed)) {
        return parsed;
      }
      
      // Single object - wrap in array
      if (typeof parsed === 'object' && parsed !== null) {
        return [parsed];
      }
      
      return null;
    } catch {
      return null;
    }
  }

  function countLocalStorageItems(): { total: number; byCollection: Record<string, number> } {
    const byCollection: Record<string, number> = {};
    let total = 0;
    
    for (const key of getLocalStorageKeys()) {
      const collection = getCollectionFromKey(key);
      if (!collection) continue;
      
      const data = parseLocalStorageData(key);
      if (!data) continue;
      
      const count = data.length;
      byCollection[collection] = (byCollection[collection] || 0) + count;
      total += count;
    }
    
    return { total, byCollection };
  }

  // ==========================================================================
  // Migration
  // ==========================================================================

  async function checkMigrationStatus(): Promise<{
    needsMigration: boolean;
    itemCount: number;
    collections: string[];
  }> {
    const { total, byCollection } = countLocalStorageItems();
    const migrationKey = `${cfg.localStoragePrefix}migration_complete`;
    const alreadyMigrated = localStorage.getItem(migrationKey) === 'true';
    
    return {
      needsMigration: total > 0 && !alreadyMigrated,
      itemCount: total,
      collections: Object.keys(byCollection),
    };
  }

  async function migrate(): Promise<MigrationRecord> {
    const startedAt = new Date().toISOString();
    const record: MigrationRecord = {
      id: `migration-${Date.now()}`,
      tenantId: cfg.tenantId,
      userId: cfg.userId,
      status: 'in-progress',
      startedAt,
      completedAt: null,
      collections: [],
      itemCounts: {},
      rollbackAvailable: true,
      rollbackExpires: new Date(Date.now() + cfg.rollbackHours * 60 * 60 * 1000).toISOString(),
      error: null,
    };

    updateProgress({
      status: 'in-progress',
      startedAt,
      error: null,
    });

    try {
      // Count items first
      const { total } = countLocalStorageItems();
      
      updateProgress({
        totalItems: total,
        migratedItems: 0,
      });

      // Process each collection
      for (const [localKey, firestoreCollection] of Object.entries(COLLECTION_MAP)) {
        const fullKey = `${cfg.localStoragePrefix}${localKey}`;
        const data = parseLocalStorageData(fullKey);
        
        if (!data || data.length === 0) continue;
        
        updateProgress({ currentCollection: firestoreCollection });
        
        // Backup for rollback
        backupData.set(fullKey, data);
        
        // Migrate in batches
        await migrateCollection(firestoreCollection, data);
        
        record.collections.push(firestoreCollection);
        record.itemCounts[firestoreCollection] = data.length;
      }

      // Mark migration complete
      record.status = 'completed';
      record.completedAt = new Date().toISOString();
      
      localStorage.setItem(`${cfg.localStoragePrefix}migration_complete`, 'true');
      localStorage.setItem(`${cfg.localStoragePrefix}migration_record`, JSON.stringify(record));
      
      updateProgress({
        status: 'completed',
        completedAt: record.completedAt,
      });

      return record;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Migration failed';
      
      record.status = 'failed';
      record.error = error;
      
      updateProgress({
        status: 'failed',
        error,
      });

      return record;
    }
  }

  async function migrateCollection(collection: string, data: unknown[]): Promise<void> {
    // Process in batches
    for (let i = 0; i < data.length; i += cfg.batchSize) {
      const batch = data.slice(i, i + cfg.batchSize);
      
      const operations = batch.map((item) => {
        const doc = item as Record<string, unknown>;
        const docId = (doc.id as string) || generateId();
        
        return {
          type: 'set' as const,
          collection,
          docId,
          data: {
            ...doc,
            id: docId,
            migratedAt: new Date().toISOString(),
            migrationSource: 'localStorage',
          },
        };
      });
      
      await cfg.firestoreService.batch(operations);
      
      updateProgress({
        migratedItems: currentProgress.migratedItems + batch.length,
      });
    }
  }

  // ==========================================================================
  // Rollback
  // ==========================================================================

  async function canRollback(): Promise<boolean> {
    const recordJson = localStorage.getItem(`${cfg.localStoragePrefix}migration_record`);
    if (!recordJson) return false;
    
    try {
      const record: MigrationRecord = JSON.parse(recordJson);
      
      if (!record.rollbackAvailable || !record.rollbackExpires) {
        return false;
      }
      
      return new Date(record.rollbackExpires).getTime() > Date.now();
    } catch {
      return false;
    }
  }

  async function rollback(): Promise<{ success: boolean; error?: string }> {
    if (!(await canRollback())) {
      return { success: false, error: 'Rollback not available or expired' };
    }

    try {
      updateProgress({
        status: 'in-progress',
        currentCollection: 'rollback',
      });

      // Restore from backup
      for (const [key, data] of backupData.entries()) {
        if (data.length > 0) {
          localStorage.setItem(key, JSON.stringify(data));
        }
      }

      // Clear migration markers
      localStorage.removeItem(`${cfg.localStoragePrefix}migration_complete`);
      
      // Update record
      const recordJson = localStorage.getItem(`${cfg.localStoragePrefix}migration_record`);
      if (recordJson) {
        const record: MigrationRecord = JSON.parse(recordJson);
        record.status = 'rolled-back';
        record.rollbackAvailable = false;
        localStorage.setItem(`${cfg.localStoragePrefix}migration_record`, JSON.stringify(record));
      }

      updateProgress({
        status: 'rolled-back',
      });

      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Rollback failed';
      
      updateProgress({
        status: 'failed',
        error,
      });

      return { success: false, error };
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  async function cleanupLocalStorage(): Promise<{ success: boolean; itemsRemoved: number }> {
    let itemsRemoved = 0;
    
    try {
      for (const key of getLocalStorageKeys()) {
        // Don't remove migration markers
        if (key.includes('migration_')) continue;
        
        localStorage.removeItem(key);
        itemsRemoved++;
      }
      
      return { success: true, itemsRemoved };
    } catch {
      return { success: false, itemsRemoved };
    }
  }

  function getMigrationRecord(): MigrationRecord | null {
    try {
      const json = localStorage.getItem(`${cfg.localStoragePrefix}migration_record`);
      return json ? JSON.parse(json) : null;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  function generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  }

  return {
    // Status
    checkMigrationStatus,
    getProgress,
    getMigrationRecord,
    
    // Migration
    migrate,
    
    // Rollback
    canRollback,
    rollback,
    
    // Cleanup
    cleanupLocalStorage,
    
    // Testing
    _countItems: countLocalStorageItems,
    _parseData: parseLocalStorageData,
  };
}

export type MigrationService = ReturnType<typeof createMigrationService>;
