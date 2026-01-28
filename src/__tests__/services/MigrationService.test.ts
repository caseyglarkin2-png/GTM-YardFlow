/**
 * Migration Service Tests
 * Sprint 27 - T27.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMigrationService, type MigrationProgress } from '../../services/MigrationService';
import type { FirestoreService } from '../../services/FirestoreService';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock FirestoreService
function createMockFirestoreService(): FirestoreService {
  return {
    create: vi.fn().mockResolvedValue({}),
    read: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
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

describe('MigrationService', () => {
  let mockFirestore: FirestoreService;
  let progressUpdates: MigrationProgress[];

  beforeEach(() => {
    mockLocalStorage.clear();
    mockFirestore = createMockFirestoreService();
    progressUpdates = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createService(overrides = {}) {
    return createMigrationService({
      tenantId: 'test-tenant',
      userId: 'test-user',
      firestoreService: mockFirestore,
      onProgress: (progress) => progressUpdates.push({ ...progress }),
      ...overrides,
    });
  }

  // ==========================================================================
  // Migration Status Check
  // ==========================================================================

  describe('checkMigrationStatus', () => {
    it('should return needsMigration=false when localStorage is empty', async () => {
      const service = createService();
      const status = await service.checkMigrationStatus();

      expect(status.needsMigration).toBe(false);
      expect(status.itemCount).toBe(0);
      expect(status.collections).toEqual([]);
    });

    it('should return needsMigration=true when data exists', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([
        { id: '1', name: 'Prospect 1' },
        { id: '2', name: 'Prospect 2' },
      ]));

      const service = createService();
      const status = await service.checkMigrationStatus();

      expect(status.needsMigration).toBe(true);
      expect(status.itemCount).toBe(2);
      expect(status.collections).toContain('prospects');
    });

    it('should return needsMigration=false when already migrated', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '1' }]));
      mockLocalStorage.setItem('yardflow_migration_complete', 'true');

      const service = createService();
      const status = await service.checkMigrationStatus();

      expect(status.needsMigration).toBe(false);
    });

    it('should count items across multiple collections', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '1' }, { id: '2' }]));
      mockLocalStorage.setItem('yardflow_activities', JSON.stringify([{ id: '3' }]));
      mockLocalStorage.setItem('yardflow_sequences', JSON.stringify([{ id: '4' }, { id: '5' }, { id: '6' }]));

      const service = createService();
      const status = await service.checkMigrationStatus();

      expect(status.itemCount).toBe(6);
      expect(status.collections).toContain('prospects');
      expect(status.collections).toContain('activities');
      expect(status.collections).toContain('sequences');
    });

    it('should ignore keys without prefix', async () => {
      mockLocalStorage.setItem('other_key', JSON.stringify([{ id: '1' }]));
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '2' }]));

      const service = createService();
      const status = await service.checkMigrationStatus();

      expect(status.itemCount).toBe(1);
    });
  });

  // ==========================================================================
  // Migration
  // ==========================================================================

  describe('migrate', () => {
    it('should migrate prospects to Firestore', async () => {
      const prospects = [
        { id: 'p1', name: 'Prospect 1', email: 'p1@example.com' },
        { id: 'p2', name: 'Prospect 2', email: 'p2@example.com' },
      ];
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify(prospects));

      const service = createService();
      const record = await service.migrate();

      expect(record.status).toBe('completed');
      expect(record.collections).toContain('prospects');
      expect(record.itemCounts.prospects).toBe(2);
      expect(mockFirestore.batch).toHaveBeenCalled();
    });

    it('should migrate multiple collections', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '1' }]));
      mockLocalStorage.setItem('yardflow_activities', JSON.stringify([{ id: '2' }]));

      const service = createService();
      const record = await service.migrate();

      expect(record.status).toBe('completed');
      expect(record.collections).toContain('prospects');
      expect(record.collections).toContain('activities');
    });

    it('should report progress during migration', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([
        { id: '1' },
        { id: '2' },
        { id: '3' },
      ]));

      const service = createService();
      await service.migrate();

      // Should have progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // First update should be in-progress
      const inProgressUpdate = progressUpdates.find(p => p.status === 'in-progress');
      expect(inProgressUpdate).toBeDefined();
      
      // Last update should be completed
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.status).toBe('completed');
      expect(lastUpdate.percentComplete).toBe(100);
    });

    it('should set migration complete marker in localStorage', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '1' }]));

      const service = createService();
      await service.migrate();

      expect(mockLocalStorage.getItem('yardflow_migration_complete')).toBe('true');
    });

    it('should store migration record in localStorage', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '1' }]));

      const service = createService();
      await service.migrate();

      const recordJson = mockLocalStorage.getItem('yardflow_migration_record');
      expect(recordJson).not.toBeNull();
      
      const record = JSON.parse(recordJson!);
      expect(record.status).toBe('completed');
      expect(record.tenantId).toBe('test-tenant');
      expect(record.userId).toBe('test-user');
    });

    it('should add metadata to migrated documents', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: 'p1', name: 'Test' }]));

      const service = createService();
      await service.migrate();

      const batchCall = (mockFirestore.batch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(batchCall[0].data.migratedAt).toBeDefined();
      expect(batchCall[0].data.migrationSource).toBe('localStorage');
    });

    it('should handle migration failure', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '1' }]));
      (mockFirestore.batch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Firestore error'));

      const service = createService();
      const record = await service.migrate();

      expect(record.status).toBe('failed');
      expect(record.error).toBe('Firestore error');
    });

    it('should batch items when exceeding batch size', async () => {
      // Create 250 items
      const items = Array.from({ length: 250 }, (_, i) => ({ id: `p${i}` }));
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify(items));

      const service = createService({ batchSize: 100 });
      await service.migrate();

      // Should have called batch 3 times (100 + 100 + 50)
      expect(mockFirestore.batch).toHaveBeenCalledTimes(3);
    });

    it('should handle single object storage (not array)', async () => {
      // Store as single object instead of array
      mockLocalStorage.setItem('yardflow_settings', JSON.stringify({ theme: 'dark', language: 'en' }));

      const service = createService();
      const record = await service.migrate();

      expect(record.status).toBe('completed');
      expect(record.itemCounts.settings).toBe(1);
    });

    it('should generate ID for items without id', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ name: 'No ID' }]));

      const service = createService();
      await service.migrate();

      const batchCall = (mockFirestore.batch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(batchCall[0].data.id).toBeDefined();
      expect(batchCall[0].docId).toBeDefined();
    });
  });

  // ==========================================================================
  // Rollback
  // ==========================================================================

  describe('canRollback', () => {
    it('should return false when no migration record exists', async () => {
      const service = createService();
      expect(await service.canRollback()).toBe(false);
    });

    it('should return true within rollback window', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '1' }]));
      
      const service = createService({ rollbackHours: 24 });
      await service.migrate();

      expect(await service.canRollback()).toBe(true);
    });

    it('should return false after rollback window expires', async () => {
      const pastExpiry = new Date(Date.now() - 1000).toISOString();
      const record = {
        rollbackAvailable: true,
        rollbackExpires: pastExpiry,
      };
      mockLocalStorage.setItem('yardflow_migration_record', JSON.stringify(record));

      const service = createService();
      expect(await service.canRollback()).toBe(false);
    });

    it('should return false when rollbackAvailable is false', async () => {
      const record = {
        rollbackAvailable: false,
        rollbackExpires: new Date(Date.now() + 86400000).toISOString(),
      };
      mockLocalStorage.setItem('yardflow_migration_record', JSON.stringify(record));

      const service = createService();
      expect(await service.canRollback()).toBe(false);
    });
  });

  describe('rollback', () => {
    it('should restore data to localStorage', async () => {
      const originalData = [{ id: '1', name: 'Test' }];
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify(originalData));

      const service = createService();
      await service.migrate();
      
      // Clear the prospects key to simulate Firestore taking over
      mockLocalStorage.removeItem('yardflow_prospects');
      
      const result = await service.rollback();

      expect(result.success).toBe(true);
      
      // Data should be restored
      const restoredData = JSON.parse(mockLocalStorage.getItem('yardflow_prospects')!);
      expect(restoredData).toEqual(originalData);
    });

    it('should clear migration complete marker', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '1' }]));

      const service = createService();
      await service.migrate();
      
      expect(mockLocalStorage.getItem('yardflow_migration_complete')).toBe('true');
      
      await service.rollback();

      expect(mockLocalStorage.getItem('yardflow_migration_complete')).toBeNull();
    });

    it('should update migration record status', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '1' }]));

      const service = createService();
      await service.migrate();
      await service.rollback();

      const record = JSON.parse(mockLocalStorage.getItem('yardflow_migration_record')!);
      expect(record.status).toBe('rolled-back');
      expect(record.rollbackAvailable).toBe(false);
    });

    it('should fail when rollback not available', async () => {
      const service = createService();
      const result = await service.rollback();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rollback not available or expired');
    });

    it('should report progress during rollback', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '1' }]));

      const service = createService();
      await service.migrate();
      progressUpdates = []; // Reset
      
      await service.rollback();

      const rollbackUpdate = progressUpdates.find(p => p.currentCollection === 'rollback');
      expect(rollbackUpdate).toBeDefined();
      
      const finalUpdate = progressUpdates[progressUpdates.length - 1];
      expect(finalUpdate.status).toBe('rolled-back');
    });
  });

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  describe('cleanupLocalStorage', () => {
    it('should remove migrated data from localStorage', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '1' }]));
      mockLocalStorage.setItem('yardflow_activities', JSON.stringify([{ id: '2' }]));
      mockLocalStorage.setItem('yardflow_migration_complete', 'true');

      const service = createService();
      const result = await service.cleanupLocalStorage();

      expect(result.success).toBe(true);
      expect(result.itemsRemoved).toBe(2); // Should not remove migration markers
      expect(mockLocalStorage.getItem('yardflow_prospects')).toBeNull();
      expect(mockLocalStorage.getItem('yardflow_activities')).toBeNull();
      expect(mockLocalStorage.getItem('yardflow_migration_complete')).toBe('true');
    });

    it('should preserve migration markers', async () => {
      mockLocalStorage.setItem('yardflow_migration_complete', 'true');
      mockLocalStorage.setItem('yardflow_migration_record', JSON.stringify({ status: 'completed' }));

      const service = createService();
      await service.cleanupLocalStorage();

      expect(mockLocalStorage.getItem('yardflow_migration_complete')).toBe('true');
      expect(mockLocalStorage.getItem('yardflow_migration_record')).not.toBeNull();
    });
  });

  // ==========================================================================
  // Progress & Records
  // ==========================================================================

  describe('getProgress', () => {
    it('should return current progress', () => {
      const service = createService();
      const progress = service.getProgress();

      expect(progress.status).toBe('pending');
      expect(progress.totalItems).toBe(0);
      expect(progress.migratedItems).toBe(0);
    });

    it('should return updated progress after migration', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '1' }]));

      const service = createService();
      await service.migrate();
      
      const progress = service.getProgress();
      expect(progress.status).toBe('completed');
      expect(progress.percentComplete).toBe(100);
    });
  });

  describe('getMigrationRecord', () => {
    it('should return null when no record exists', () => {
      const service = createService();
      expect(service.getMigrationRecord()).toBeNull();
    });

    it('should return migration record after migration', async () => {
      mockLocalStorage.setItem('yardflow_prospects', JSON.stringify([{ id: '1' }]));

      const service = createService();
      await service.migrate();
      
      const record = service.getMigrationRecord();
      expect(record).not.toBeNull();
      expect(record!.status).toBe('completed');
      expect(record!.collections).toContain('prospects');
    });
  });

  // ==========================================================================
  // Custom Prefix
  // ==========================================================================

  describe('custom localStorage prefix', () => {
    it('should use custom prefix for reading data', async () => {
      mockLocalStorage.setItem('custom_prospects', JSON.stringify([{ id: '1' }]));

      const service = createService({ localStoragePrefix: 'custom_' });
      const status = await service.checkMigrationStatus();

      expect(status.needsMigration).toBe(true);
      expect(status.itemCount).toBe(1);
    });

    it('should use custom prefix for migration markers', async () => {
      mockLocalStorage.setItem('custom_prospects', JSON.stringify([{ id: '1' }]));

      const service = createService({ localStoragePrefix: 'custom_' });
      await service.migrate();

      expect(mockLocalStorage.getItem('custom_migration_complete')).toBe('true');
      expect(mockLocalStorage.getItem('custom_migration_record')).not.toBeNull();
    });
  });

  // ==========================================================================
  // Data Parsing
  // ==========================================================================

  describe('_parseData', () => {
    it('should handle invalid JSON gracefully', () => {
      mockLocalStorage.setItem('yardflow_prospects', 'not valid json');

      const service = createService();
      const data = service._parseData('yardflow_prospects');

      expect(data).toBeNull();
    });

    it('should handle null values', () => {
      const service = createService();
      const data = service._parseData('nonexistent');

      expect(data).toBeNull();
    });

    it('should handle primitive values', () => {
      mockLocalStorage.setItem('yardflow_prospects', '"just a string"');

      const service = createService();
      const data = service._parseData('yardflow_prospects');

      expect(data).toBeNull();
    });
  });
});
