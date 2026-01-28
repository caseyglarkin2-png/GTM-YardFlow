/**
 * HubSpot Sync Engine Tests
 * Sprint 26 - T26.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSyncEngine } from '../../services/HubSpotSyncEngine';
import type { HubSpotClient } from '../../services/HubSpotClient';
import type { FieldMapper, ProspectFields } from '../../services/HubSpotFieldMapper';
import type { HubSpotContact } from '../../types/hubspot';

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageMock.store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageMock.store[key]; }),
  clear: vi.fn(() => { localStorageMock.store = {}; }),
};
vi.stubGlobal('localStorage', localStorageMock);

describe('HubSpot Sync Engine - T26.5', () => {
  let mockClient: HubSpotClient;
  let mockFieldMapper: FieldMapper;
  let mockProspectRepo: {
    getAll: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    getByHubSpotId: ReturnType<typeof vi.fn>;
    getModifiedSince: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };

  const sampleProspect: ProspectFields = {
    id: 'yf-123',
    name: 'John Doe',
    email: 'john@example.com',
    company: 'Acme Corp',
    updatedAt: '2026-01-15T00:00:00Z',
  };

  const sampleContact: HubSpotContact = {
    id: 'hs-456',
    properties: {
      firstname: 'John',
      lastname: 'Doe',
      email: 'john@example.com',
      company: 'Acme Corp',
      yardflow_id: 'yf-123',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    mockClient = {
      getContacts: vi.fn().mockResolvedValue({ results: [], hasMore: false }),
      getContact: vi.fn().mockResolvedValue(sampleContact),
      createContact: vi.fn().mockResolvedValue({ id: 'hs-new', properties: {} }),
      updateContact: vi.fn().mockResolvedValue(undefined),
      searchContacts: vi.fn().mockResolvedValue([]),
      getDeals: vi.fn(),
      getDeal: vi.fn(),
      createDeal: vi.fn(),
      updateDeal: vi.fn(),
      associateContactToDeal: vi.fn(),
      createNote: vi.fn(),
      createTask: vi.fn(),
      logEmail: vi.fn(),
      batchCreateContacts: vi.fn(),
      getRateLimitStatus: vi.fn(),
      invalidateCache: vi.fn(),
    } as unknown as HubSpotClient;

    mockFieldMapper = {
      prospectToHubSpot: vi.fn().mockReturnValue({
        properties: { firstname: 'John', lastname: 'Doe', email: 'john@example.com' },
        conflicts: [],
        skipped: [],
      }),
      hubSpotToProspect: vi.fn().mockReturnValue({
        properties: { name: 'John Doe', email: 'john@example.com' },
        conflicts: [],
        skipped: [],
      }),
      validateProspectForSync: vi.fn().mockReturnValue({ valid: true, missing: [] }),
      splitName: vi.fn(),
      joinName: vi.fn(),
      applyTransform: vi.fn(),
      mapStatus: vi.fn(),
      toE164: vi.fn(),
      extractLinkedInId: vi.fn(),
      getMissingRequiredFields: vi.fn().mockReturnValue([]),
    } as unknown as FieldMapper;

    mockProspectRepo = {
      getAll: vi.fn().mockResolvedValue([sampleProspect]),
      getById: vi.fn().mockResolvedValue(sampleProspect),
      getByHubSpotId: vi.fn().mockResolvedValue(null),
      getModifiedSince: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(sampleProspect),
    };
  });

  describe('syncAll', () => {
    it('should push all prospects to HubSpot', async () => {
      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      const result = await engine.syncAll('push');

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(1);
      expect(mockFieldMapper.prospectToHubSpot).toHaveBeenCalledWith(sampleProspect, undefined);
      expect(mockClient.createContact).toHaveBeenCalled();
    });

    it('should update existing HubSpot contact', async () => {
      vi.mocked(mockClient.searchContacts).mockResolvedValueOnce([sampleContact]);

      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      const result = await engine.syncAll('push');

      expect(result.success).toBe(true);
      expect(mockClient.updateContact).toHaveBeenCalledWith(
        'hs-456',
        expect.any(Object)
      );
    });

    it('should pull all contacts from HubSpot', async () => {
      const newContact: HubSpotContact = {
        ...sampleContact,
        id: 'hs-new',
        properties: {
          ...sampleContact.properties,
          yardflow_id: undefined, // No existing YardFlow link
        },
      };
      vi.mocked(mockClient.getContacts).mockResolvedValueOnce({
        results: [newContact],
        hasMore: false,
      });
      // No existing prospect found
      mockProspectRepo.getById.mockResolvedValueOnce(null);
      mockProspectRepo.getByHubSpotId.mockResolvedValueOnce(null);

      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      const result = await engine.syncAll('pull');

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(1);
      expect(mockFieldMapper.hubSpotToProspect).toHaveBeenCalled();
      expect(mockProspectRepo.create).toHaveBeenCalled();
    });

    it('should update existing prospect on pull', async () => {
      vi.mocked(mockClient.getContacts).mockResolvedValueOnce({
        results: [sampleContact],
        hasMore: false,
      });
      mockProspectRepo.getById.mockResolvedValueOnce(sampleProspect);

      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      const result = await engine.syncAll('pull');

      expect(result.success).toBe(true);
      expect(mockProspectRepo.update).toHaveBeenCalled();
    });

    it('should handle bidirectional sync', async () => {
      vi.mocked(mockClient.getContacts).mockResolvedValueOnce({
        results: [sampleContact],
        hasMore: false,
      });

      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      const result = await engine.syncAll('bidirectional');

      expect(result.success).toBe(true);
      // Push + Pull
      expect(mockFieldMapper.prospectToHubSpot).toHaveBeenCalled();
      expect(mockFieldMapper.hubSpotToProspect).toHaveBeenCalled();
    });

    it('should paginate through HubSpot contacts', async () => {
      vi.mocked(mockClient.getContacts)
        .mockResolvedValueOnce({
          results: [sampleContact],
          hasMore: true,
          nextCursor: 'cursor-1',
        })
        .mockResolvedValueOnce({
          results: [{ ...sampleContact, id: 'hs-789' }],
          hasMore: false,
        });

      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      const result = await engine.syncAll('pull');

      expect(result.recordsProcessed).toBe(2);
      expect(mockClient.getContacts).toHaveBeenCalledTimes(2);
    });
  });

  describe('syncProspect', () => {
    it('should sync a single prospect', async () => {
      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      const result = await engine.syncProspect('yf-123');

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(1);
    });

    it('should fail for non-existent prospect', async () => {
      mockProspectRepo.getById.mockResolvedValueOnce(null);

      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      const result = await engine.syncProspect('nonexistent');

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toBe('Prospect not found');
    });

    it('should fail for invalid prospect', async () => {
      vi.mocked(mockFieldMapper.validateProspectForSync).mockReturnValueOnce({
        valid: false,
        missing: ['email'],
      });

      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      const result = await engine.syncProspect('yf-123');

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toContain('Missing required fields');
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect and record conflicts', async () => {
      vi.mocked(mockFieldMapper.prospectToHubSpot).mockReturnValueOnce({
        properties: { email: 'john@example.com' },
        conflicts: [{
          field: 'company',
          localValue: 'Acme Corp',
          remoteValue: 'Acme Inc',
          localUpdatedAt: '2026-01-14T00:00:00Z',
          remoteUpdatedAt: '2026-01-15T00:00:00Z',
        }],
        skipped: [],
      });
      vi.mocked(mockClient.searchContacts).mockResolvedValueOnce([sampleContact]);

      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      const result = await engine.syncProspect('yf-123');

      expect(result.conflicts).toHaveLength(1);
      expect(engine.getConflicts()).toHaveLength(1);
    });

    it('should resolve conflict with local value', async () => {
      vi.mocked(mockFieldMapper.prospectToHubSpot).mockReturnValueOnce({
        properties: { email: 'john@example.com' },
        conflicts: [{
          field: 'company',
          localValue: 'Acme Corp',
          remoteValue: 'Acme Inc',
          localUpdatedAt: '2026-01-14T00:00:00Z',
          remoteUpdatedAt: '2026-01-15T00:00:00Z',
        }],
        skipped: [],
      });
      vi.mocked(mockClient.searchContacts).mockResolvedValueOnce([sampleContact]);

      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      await engine.syncProspect('yf-123');
      
      const conflicts = engine.getConflicts();
      await engine.resolveConflict(conflicts[0].id, 'local');

      expect(mockClient.updateContact).toHaveBeenCalled();
      expect(engine.getConflicts()).toHaveLength(0);
    });

    it('should resolve conflict with remote value', async () => {
      vi.mocked(mockFieldMapper.prospectToHubSpot).mockReturnValueOnce({
        properties: { email: 'john@example.com' },
        conflicts: [{
          field: 'company',
          localValue: 'Acme Corp',
          remoteValue: 'Acme Inc',
          localUpdatedAt: '2026-01-14T00:00:00Z',
          remoteUpdatedAt: '2026-01-15T00:00:00Z',
        }],
        skipped: [],
      });
      vi.mocked(mockClient.searchContacts).mockResolvedValueOnce([sampleContact]);

      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      await engine.syncProspect('yf-123');
      
      const conflicts = engine.getConflicts();
      await engine.resolveConflict(conflicts[0].id, 'remote');

      expect(mockProspectRepo.update).toHaveBeenCalled();
    });
  });

  describe('Sync Status', () => {
    it('should track sync status', async () => {
      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      expect(engine.getSyncStatus().inProgress).toBe(false);
      expect(engine.getSyncStatus().lastSyncAt).toBeNull();

      await engine.syncAll('push');

      expect(engine.getSyncStatus().inProgress).toBe(false);
      expect(engine.getSyncStatus().lastSyncAt).not.toBeNull();
      expect(engine.getSyncStatus().itemsProcessed).toBe(1);
    });
  });

  describe('Pause/Resume', () => {
    it('should not sync when paused', async () => {
      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      engine.pauseSync();
      const result = await engine.syncAll('push');

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toBe('Sync is paused');
    });

    it('should sync after resume', async () => {
      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      engine.pauseSync();
      engine.resumeSync();
      const result = await engine.syncAll('push');

      expect(result.success).toBe(true);
    });
  });

  describe('Sync Queue', () => {
    it('should enqueue items', () => {
      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      engine.enqueue({
        prospectId: 'yf-123',
        direction: 'push',
        priority: 1,
      });

      const queue = engine._getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].prospectId).toBe('yf-123');
    });

    it('should persist queue to localStorage', () => {
      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      engine.enqueue({
        prospectId: 'yf-123',
        direction: 'push',
        priority: 1,
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should process queue items', async () => {
      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      engine.enqueue({
        prospectId: 'yf-123',
        direction: 'push',
        priority: 1,
      });

      const result = await engine.processQueue();

      expect(result.recordsProcessed).toBe(1);
      expect(engine._getQueue()).toHaveLength(0);
    });

    it('should remove duplicates when enqueueing', () => {
      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      engine.enqueue({ prospectId: 'yf-123', direction: 'push', priority: 1 });
      engine.enqueue({ prospectId: 'yf-123', direction: 'push', priority: 2 });

      expect(engine._getQueue()).toHaveLength(1);
      expect(engine._getQueue()[0].priority).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      vi.mocked(mockClient.createContact).mockRejectedValueOnce(new Error('API Error'));

      const engine = createSyncEngine(mockClient, mockFieldMapper, mockProspectRepo);

      const result = await engine.syncAll('push');

      expect(result.success).toBe(false);
      expect(result.recordsFailed).toBe(1);
      expect(result.errors[0].error).toBe('API Error');
    });
  });
});
