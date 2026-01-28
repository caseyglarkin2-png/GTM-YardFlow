/**
 * HubSpot Sync Engine
 * Sprint 26 - T26.5
 * 
 * Handles bi-directional synchronization between YardFlow and HubSpot CRM.
 */

import type { HubSpotClient } from './HubSpotClient';
import type { FieldMapper, ProspectFields } from './HubSpotFieldMapper';
import type { HubSpotContact, SyncResult, SyncStatus, ConflictRecord, SyncDirection } from '../types/hubspot';

/**
 * Sync queue item
 */
interface SyncQueueItem {
  id: string;
  prospectId?: string;
  hubspotId?: string;
  direction: SyncDirection;
  priority: number;
  retries: number;
  createdAt: number;
  lastAttempt?: number;
  error?: string;
}

/**
 * Sync engine configuration
 */
interface SyncEngineConfig {
  /** Background sync interval in ms (default: 15 minutes) */
  syncInterval?: number;
  /** Max retries for failed syncs */
  maxRetries?: number;
  /** Batch size for bulk operations */
  batchSize?: number;
  /** Storage key for sync queue */
  storageKey?: string;
}

/**
 * Prospect repository interface
 */
interface ProspectRepository {
  getAll(): Promise<ProspectFields[]>;
  getById(id: string): Promise<ProspectFields | null>;
  getByHubSpotId(hubspotId: string): Promise<ProspectFields | null>;
  getModifiedSince(timestamp: string): Promise<ProspectFields[]>;
  update(id: string, data: Partial<ProspectFields>): Promise<void>;
  create(data: ProspectFields): Promise<ProspectFields>;
}

const DEFAULT_CONFIG: Required<SyncEngineConfig> = {
  syncInterval: 15 * 60 * 1000, // 15 minutes
  maxRetries: 3,
  batchSize: 100,
  storageKey: 'yardflow_hubspot_sync_queue',
};

/**
 * Create HubSpot Sync Engine
 */
export function createSyncEngine(
  client: HubSpotClient,
  fieldMapper: FieldMapper,
  prospectRepo: ProspectRepository,
  config: SyncEngineConfig = {}
) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  let syncStatus: SyncStatus = {
    lastSyncAt: null,
    inProgress: false,
    itemsProcessed: 0,
    itemsFailed: 0,
    nextSyncAt: null,
  };
  
  let syncQueue: SyncQueueItem[] = [];
  let conflicts: ConflictRecord[] = [];
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isPaused = false;

  // Load queue from storage
  function loadQueue(): void {
    try {
      const stored = localStorage.getItem(cfg.storageKey);
      if (stored) {
        syncQueue = JSON.parse(stored);
      }
    } catch {
      syncQueue = [];
    }
  }

  // Save queue to storage
  function saveQueue(): void {
    try {
      localStorage.setItem(cfg.storageKey, JSON.stringify(syncQueue));
    } catch {
      // Storage full or unavailable
    }
  }

  // Add item to sync queue
  function enqueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retries'>): void {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      retries: 0,
    };
    
    // Remove duplicate if exists
    syncQueue = syncQueue.filter(q => 
      q.prospectId !== item.prospectId || q.direction !== item.direction
    );
    
    syncQueue.push(queueItem);
    syncQueue.sort((a, b) => b.priority - a.priority);
    saveQueue();
  }

  // Process a single push sync (YardFlow → HubSpot)
  async function pushProspect(prospect: ProspectFields): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsFailed: 0,
      errors: [],
      conflicts: [],
    };

    try {
      // Validate prospect
      const validation = fieldMapper.validateProspectForSync(prospect);
      if (!validation.valid) {
        result.success = false;
        result.recordsFailed = 1;
        result.errors.push({
          recordId: prospect.id || 'unknown',
          error: `Missing required fields: ${validation.missing.join(', ')}`,
          timestamp: new Date().toISOString(),
        });
        return result;
      }

      // Check if contact exists in HubSpot
      let existingContact: HubSpotContact | null = null;
      
      if (prospect.email) {
        const searchResults = await client.searchContacts(prospect.email);
        existingContact = searchResults.find(c => 
          c.properties.email?.toLowerCase() === prospect.email?.toLowerCase()
        ) || null;
      }

      // Map fields
      const mappingResult = fieldMapper.prospectToHubSpot(prospect, existingContact || undefined);
      
      // Record conflicts
      if (mappingResult.conflicts.length > 0) {
        for (const conflict of mappingResult.conflicts) {
          conflicts.push({
            id: `conflict-${Date.now()}`,
            prospectId: prospect.id || '',
            hubspotId: existingContact?.id || '',
            field: conflict.field,
            localValue: conflict.localValue,
            remoteValue: conflict.remoteValue,
            detectedAt: new Date().toISOString(),
            resolved: false,
          });
          result.conflicts.push({
            id: `conflict-${Date.now()}`,
            prospectId: prospect.id || '',
            hubspotId: existingContact?.id || '',
            field: conflict.field,
            localValue: conflict.localValue,
            remoteValue: conflict.remoteValue,
            detectedAt: new Date().toISOString(),
            resolved: false,
          });
        }
      }

      // Create or update
      if (existingContact) {
        await client.updateContact(existingContact.id, mappingResult.properties);
      } else {
        const created = await client.createContact(mappingResult.properties);
        // Update prospect with HubSpot ID
        if (prospect.id) {
          await prospectRepo.update(prospect.id, { 
            hubspotId: created.id,
            lastSyncAt: new Date().toISOString(),
          } as Partial<ProspectFields>);
        }
      }

      result.recordsProcessed = 1;
    } catch (error) {
      result.success = false;
      result.recordsFailed = 1;
      result.errors.push({
        recordId: prospect.id || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }

  // Process a single pull sync (HubSpot → YardFlow)
  async function pullContact(contact: HubSpotContact): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsFailed: 0,
      errors: [],
      conflicts: [],
    };

    try {
      // Check if prospect exists
      const yardflowId = contact.properties.yardflow_id as string | undefined;
      let existingProspect = yardflowId 
        ? await prospectRepo.getById(yardflowId)
        : await prospectRepo.getByHubSpotId(contact.id);

      // Map fields
      const mappingResult = fieldMapper.hubSpotToProspect(contact, existingProspect || undefined);

      // Record conflicts
      if (mappingResult.conflicts.length > 0) {
        for (const conflict of mappingResult.conflicts) {
          conflicts.push({
            id: `conflict-${Date.now()}`,
            prospectId: existingProspect?.id || '',
            hubspotId: contact.id,
            field: conflict.field,
            localValue: conflict.localValue,
            remoteValue: conflict.remoteValue,
            detectedAt: new Date().toISOString(),
            resolved: false,
          });
        }
      }

      // Create or update
      if (existingProspect && existingProspect.id) {
        await prospectRepo.update(existingProspect.id, {
          ...mappingResult.properties as unknown as Partial<ProspectFields>,
          hubspotId: contact.id,
          lastSyncAt: new Date().toISOString(),
        });
      } else {
        await prospectRepo.create({
          ...mappingResult.properties as unknown as ProspectFields,
          hubspotId: contact.id,
          lastSyncAt: new Date().toISOString(),
        });
      }

      result.recordsProcessed = 1;
    } catch (error) {
      result.success = false;
      result.recordsFailed = 1;
      result.errors.push({
        recordId: contact.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }

  // Sync all records
  async function syncAll(direction: SyncDirection): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsFailed: 0,
      errors: [],
      conflicts: [],
    };

    if (isPaused) {
      result.success = false;
      result.errors.push({
        recordId: 'system',
        error: 'Sync is paused',
        timestamp: new Date().toISOString(),
      });
      return result;
    }

    syncStatus.inProgress = true;
    syncStatus.itemsProcessed = 0;
    syncStatus.itemsFailed = 0;

    try {
      // Push: YardFlow → HubSpot
      if (direction === 'push' || direction === 'bidirectional') {
        const prospects = await prospectRepo.getAll();
        
        // Process in batches
        for (let i = 0; i < prospects.length; i += cfg.batchSize) {
          const batch = prospects.slice(i, i + cfg.batchSize);
          
          const batchResults = await Promise.all(
            batch.map(prospect => pushProspect(prospect))
          );

          for (const batchResult of batchResults) {
            result.recordsProcessed += batchResult.recordsProcessed;
            result.recordsFailed += batchResult.recordsFailed;
            result.errors.push(...batchResult.errors);
            result.conflicts.push(...batchResult.conflicts);
          }

          syncStatus.itemsProcessed += batch.length;
        }
      }

      // Pull: HubSpot → YardFlow
      if (direction === 'pull' || direction === 'bidirectional') {
        let cursor: string | undefined;
        
        do {
          const response = await client.getContacts({ 
            limit: cfg.batchSize,
            after: cursor,
          });

          const pullResults = await Promise.all(
            response.results.map(contact => pullContact(contact))
          );

          for (const pullResult of pullResults) {
            result.recordsProcessed += pullResult.recordsProcessed;
            result.recordsFailed += pullResult.recordsFailed;
            result.errors.push(...pullResult.errors);
            result.conflicts.push(...pullResult.conflicts);
          }

          syncStatus.itemsProcessed += response.results.length;
          cursor = response.nextCursor;
        } while (cursor);
      }

      result.success = result.recordsFailed === 0;
    } catch (error) {
      result.success = false;
      result.errors.push({
        recordId: 'system',
        error: error instanceof Error ? error.message : 'Sync failed',
        timestamp: new Date().toISOString(),
      });
    } finally {
      syncStatus.inProgress = false;
      syncStatus.lastSyncAt = new Date().toISOString();
      syncStatus.itemsFailed = result.recordsFailed;
      
      if (intervalId) {
        syncStatus.nextSyncAt = new Date(Date.now() + cfg.syncInterval).toISOString();
      }
    }

    return result;
  }

  // Sync a single prospect
  async function syncProspect(prospectId: string): Promise<SyncResult> {
    const prospect = await prospectRepo.getById(prospectId);
    
    if (!prospect) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsFailed: 1,
        errors: [{
          recordId: prospectId,
          error: 'Prospect not found',
          timestamp: new Date().toISOString(),
        }],
        conflicts: [],
      };
    }

    return pushProspect(prospect);
  }

  // Get sync status
  function getSyncStatus(): SyncStatus {
    return { ...syncStatus };
  }

  // Get unresolved conflicts
  function getConflicts(): ConflictRecord[] {
    return conflicts.filter(c => !c.resolved);
  }

  // Resolve a conflict
  async function resolveConflict(
    conflictId: string, 
    resolution: 'local' | 'remote'
  ): Promise<void> {
    const conflict = conflicts.find(c => c.id === conflictId);
    
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    if (resolution === 'local') {
      // Push local value to HubSpot
      const prospect = await prospectRepo.getById(conflict.prospectId);
      if (prospect) {
        const mappingResult = fieldMapper.prospectToHubSpot(prospect);
        await client.updateContact(conflict.hubspotId, {
          [conflict.field]: mappingResult.properties[conflict.field],
        });
      }
    } else {
      // Pull remote value to YardFlow
      const contact = await client.getContact(conflict.hubspotId);
      if (contact) {
        const mappingResult = fieldMapper.hubSpotToProspect(contact);
        await prospectRepo.update(conflict.prospectId, {
          [conflict.field]: mappingResult.properties[conflict.field],
        } as Partial<ProspectFields>);
      }
    }

    conflict.resolved = true;
    conflict.resolution = resolution;
    conflict.resolvedAt = new Date().toISOString();
  }

  // Start background sync
  function startBackgroundSync(): void {
    if (intervalId) return;
    
    intervalId = setInterval(() => {
      if (!isPaused && !syncStatus.inProgress) {
        syncAll('bidirectional').catch(console.error);
      }
    }, cfg.syncInterval);
    
    syncStatus.nextSyncAt = new Date(Date.now() + cfg.syncInterval).toISOString();
  }

  // Stop background sync
  function stopBackgroundSync(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      syncStatus.nextSyncAt = null;
    }
  }

  // Pause sync
  function pauseSync(): void {
    isPaused = true;
  }

  // Resume sync
  function resumeSync(): void {
    isPaused = false;
  }

  // Process sync queue
  async function processQueue(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsFailed: 0,
      errors: [],
      conflicts: [],
    };

    loadQueue();

    for (const item of syncQueue) {
      if (item.retries >= cfg.maxRetries) {
        result.recordsFailed++;
        result.errors.push({
          recordId: item.prospectId || item.hubspotId || 'unknown',
          error: item.error || 'Max retries exceeded',
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      try {
        if (item.direction === 'push' && item.prospectId) {
          const syncResult = await syncProspect(item.prospectId);
          result.recordsProcessed += syncResult.recordsProcessed;
          result.recordsFailed += syncResult.recordsFailed;
          result.errors.push(...syncResult.errors);
          
          if (syncResult.success) {
            // Remove from queue
            syncQueue = syncQueue.filter(q => q.id !== item.id);
          }
        }
      } catch (error) {
        item.retries++;
        item.lastAttempt = Date.now();
        item.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    saveQueue();
    return result;
  }

  // Initialize
  loadQueue();

  return {
    syncAll,
    syncProspect,
    getSyncStatus,
    getConflicts,
    resolveConflict,
    pauseSync,
    resumeSync,
    startBackgroundSync,
    stopBackgroundSync,
    enqueue,
    processQueue,
    // For testing
    _getQueue: () => [...syncQueue],
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
