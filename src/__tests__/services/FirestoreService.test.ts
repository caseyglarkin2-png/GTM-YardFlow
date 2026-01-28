/**
 * Firestore Service Tests
 * Sprint 27 - T27.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFirestoreService, type FirestoreService } from '../../services/FirestoreService';

// Test helper: allow any data shape for mock operations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestFirestoreService = Omit<FirestoreService, 'create' | 'update' | 'read' | 'query'> & {
  create: (collection: string, data: Record<string, unknown>) => Promise<{ success: boolean; id?: string; error?: string }>;
  update: (collection: string, docId: string, data: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  read: <T = Record<string, unknown>>(collection: string, docId: string) => Promise<T | null>;
  query: <T = Record<string, unknown>>(collection: string, options?: unknown) => Promise<T[]>;
};

describe('FirestoreService', () => {
  let service: TestFirestoreService;

  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    });

    service = createFirestoreService({
      tenantId: 'test-tenant',
      userId: 'test-user',
    }) as unknown as TestFirestoreService;
  });

  afterEach(() => {
    service.destroy();
    vi.unstubAllGlobals();
  });

  describe('createFirestoreService', () => {
    it('creates service with required config', () => {
      expect(service).toBeDefined();
      expect(service.create).toBeDefined();
      expect(service.read).toBeDefined();
      expect(service.update).toBeDefined();
      expect(service.remove).toBeDefined();
      expect(service.query).toBeDefined();
    });

    it('creates service with custom config', () => {
      const customService = createFirestoreService({
        tenantId: 'custom-tenant',
        userId: 'custom-user',
        enableOfflineQueue: false,
        maxBatchSize: 100,
      });
      
      expect(customService).toBeDefined();
      customService.destroy();
    });
  });

  describe('CRUD Operations', () => {
    describe('create', () => {
      it('creates document with generated id', async () => {
        const result = await service.create('prospects', {
          name: 'Test Prospect',
          email: 'test@example.com',
        });

        expect(result.success).toBe(true);
        expect(result.id).toBeDefined();
        expect(result.id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
      });

      it('creates document with custom id', async () => {
        const result = await service.create('prospects', {
          id: 'custom-id-123',
          name: 'Test Prospect',
        });

        expect(result.success).toBe(true);
        expect(result.id).toBe('custom-id-123');
      });

      it('adds createdAt and updatedAt timestamps', async () => {
        const before = new Date();
        
        await service.create('prospects', {
          id: 'timestamp-test',
          name: 'Test',
        });

        const doc = await service.read<{ createdAt: string; updatedAt: string }>('prospects', 'timestamp-test');
        expect(doc).toBeDefined();
        expect(doc?.createdAt).toBeDefined();
        expect(new Date(doc!.createdAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
      });
    });

    describe('read', () => {
      it('reads document from cache', async () => {
        await service.create('prospects', {
          id: 'read-test',
          name: 'Read Test',
        });

        const doc = await service.read<{ id: string; name: string }>('prospects', 'read-test');
        expect(doc).toBeDefined();
        expect(doc?.name).toBe('Read Test');
      });

      it('returns null for non-existent document', async () => {
        const doc = await service.read('prospects', 'nonexistent');
        expect(doc).toBeNull();
      });
    });

    describe('update', () => {
      it('updates existing document', async () => {
        await service.create('prospects', {
          id: 'update-test',
          name: 'Original',
          status: 'active',
        });

        const result = await service.update('prospects', 'update-test', {
          name: 'Updated',
        });

        expect(result.success).toBe(true);

        const doc = await service.read<{ name: string }>('prospects', 'update-test');
        expect(doc?.name).toBe('Updated');
      });

      it('updates updatedAt timestamp', async () => {
        await service.create('prospects', { id: 'ts-update', name: 'Original' });
        
        const original = await service.read<{ updatedAt: string }>('prospects', 'ts-update');
        const originalTime = new Date(original!.updatedAt).getTime();

        // Small delay to ensure different timestamp
        await new Promise(r => setTimeout(r, 5));
        
        await service.update('prospects', 'ts-update', { name: 'Updated' });

        const doc = await service.read<{ updatedAt: string }>('prospects', 'ts-update');
        const updatedTime = new Date(doc!.updatedAt).getTime();
        expect(updatedTime).toBeGreaterThanOrEqual(originalTime);
      });
    });

    describe('remove', () => {
      it('removes document', async () => {
        await service.create('prospects', { id: 'delete-test' });
        
        const result = await service.remove('prospects', 'delete-test');
        expect(result.success).toBe(true);

        const doc = await service.read('prospects', 'delete-test');
        expect(doc).toBeNull();
      });

      it('removes non-existent document without error', async () => {
        const result = await service.remove('prospects', 'nonexistent');
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await service.create('prospects', { id: 'p1', name: 'Alice', tier: 1, score: 90 });
      await service.create('prospects', { id: 'p2', name: 'Bob', tier: 2, score: 75 });
      await service.create('prospects', { id: 'p3', name: 'Charlie', tier: 1, score: 85 });
      await service.create('prospects', { id: 'p4', name: 'Diana', tier: 3, score: 60 });
    });

    it('queries all documents without filters', async () => {
      const results = await service.query('prospects');
      expect(results.length).toBe(4);
    });

    it('filters with == operator', async () => {
      const results = await service.query('prospects', {
        filters: [{ field: 'tier', operator: '==', value: 1 }],
      });
      expect(results.length).toBe(2);
    });

    it('filters with != operator', async () => {
      const results = await service.query('prospects', {
        filters: [{ field: 'tier', operator: '!=', value: 1 }],
      });
      expect(results.length).toBe(2);
    });

    it('filters with > operator', async () => {
      const results = await service.query('prospects', {
        filters: [{ field: 'score', operator: '>', value: 80 }],
      });
      expect(results.length).toBe(2);
    });

    it('filters with >= operator', async () => {
      const results = await service.query('prospects', {
        filters: [{ field: 'score', operator: '>=', value: 75 }],
      });
      expect(results.length).toBe(3);
    });

    it('filters with < operator', async () => {
      const results = await service.query('prospects', {
        filters: [{ field: 'score', operator: '<', value: 80 }],
      });
      expect(results.length).toBe(2);
    });

    it('filters with <= operator', async () => {
      const results = await service.query('prospects', {
        filters: [{ field: 'score', operator: '<=', value: 75 }],
      });
      expect(results.length).toBe(2);
    });

    it('filters with in operator', async () => {
      const results = await service.query('prospects', {
        filters: [{ field: 'tier', operator: 'in', value: [1, 2] }],
      });
      expect(results.length).toBe(3);
    });

    it('filters with array-contains operator', async () => {
      await service.create('prospects', { id: 'p5', name: 'Eve', tags: ['vip', 'priority'] });
      
      const results = await service.query('prospects', {
        filters: [{ field: 'tags', operator: 'array-contains', value: 'vip' }],
      });
      expect(results.length).toBe(1);
    });

    it('filters with array-contains-any operator', async () => {
      await service.create('prospects', { id: 'p5', tags: ['vip'] });
      await service.create('prospects', { id: 'p6', tags: ['priority'] });
      
      const results = await service.query('prospects', {
        filters: [{ field: 'tags', operator: 'array-contains-any', value: ['vip', 'priority'] }],
      });
      expect(results.length).toBe(2);
    });

    it('applies multiple filters', async () => {
      const results = await service.query('prospects', {
        filters: [
          { field: 'tier', operator: '==', value: 1 },
          { field: 'score', operator: '>=', value: 85 },
        ],
      });
      expect(results.length).toBe(2);
    });

    it('orders results ascending', async () => {
      const results = await service.query<{ name: string }>('prospects', {
        orderBy: [{ field: 'name', direction: 'asc' }],
      });
      expect(results[0].name).toBe('Alice');
      expect(results[3].name).toBe('Diana');
    });

    it('orders results descending', async () => {
      const results = await service.query<{ score: number }>('prospects', {
        orderBy: [{ field: 'score', direction: 'desc' }],
      });
      expect(results[0].score).toBe(90);
      expect(results[3].score).toBe(60);
    });

    it('applies limit', async () => {
      const results = await service.query('prospects', { limit: 2 });
      expect(results.length).toBe(2);
    });

    it('combines filter, order, and limit', async () => {
      const results = await service.query<{ tier: number; score: number }>('prospects', {
        filters: [{ field: 'tier', operator: '<=', value: 2 }],
        orderBy: [{ field: 'score', direction: 'desc' }],
        limit: 2,
      });
      
      expect(results.length).toBe(2);
      expect(results[0].score).toBe(90);
      expect(results[1].score).toBe(85);
    });
  });

  describe('Batch Operations', () => {
    it('processes batch of operations', async () => {
      const result = await service.batch([
        { type: 'set', collection: 'prospects', docId: 'b1', data: { name: 'Batch 1' } },
        { type: 'set', collection: 'prospects', docId: 'b2', data: { name: 'Batch 2' } },
        { type: 'set', collection: 'prospects', docId: 'b3', data: { name: 'Batch 3' } },
      ]);

      expect(result.success).toBe(true);
      expect(result.committed).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('handles mixed operations', async () => {
      await service.create('prospects', { id: 'mix1', name: 'Original' });

      const result = await service.batch([
        { type: 'set', collection: 'prospects', docId: 'mix2', data: { name: 'New' } },
        { type: 'update', collection: 'prospects', docId: 'mix1', data: { name: 'Updated' } },
      ]);

      expect(result.success).toBe(true);
      expect(result.committed).toBe(2);
    });

    it('rejects batch exceeding max size', async () => {
      const smallService = createFirestoreService({
        tenantId: 'test',
        maxBatchSize: 2,
      });

      const result = await smallService.batch([
        { type: 'set', collection: 'x', docId: '1', data: {} },
        { type: 'set', collection: 'x', docId: '2', data: {} },
        { type: 'set', collection: 'x', docId: '3', data: {} },
      ]);

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toContain('maximum');
      
      smallService.destroy();
    });

    it('handles delete operations', async () => {
      await service.create('prospects', { id: 'del1' });
      await service.create('prospects', { id: 'del2' });

      const result = await service.batch([
        { type: 'delete', collection: 'prospects', docId: 'del1' },
        { type: 'delete', collection: 'prospects', docId: 'del2' },
      ]);

      expect(result.success).toBe(true);
      
      const remaining = await service.query('prospects');
      expect(remaining.length).toBe(0);
    });
  });

  describe('Subscriptions', () => {
    it('subscribes to collection changes', async () => {
      const callback = vi.fn();
      const unsubscribe = service.subscribe('prospects', callback);

      // Wait for initial callback
      await new Promise(r => setTimeout(r, 10));
      expect(callback).toHaveBeenCalledWith([]);

      await service.create('prospects', { id: 'sub1', name: 'Subscriber' });

      expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);

      unsubscribe();
    });

    it('unsubscribes properly', async () => {
      const callback = vi.fn();
      const unsubscribe = service.subscribe('prospects', callback);
      
      // Wait for initial callback
      await new Promise(r => setTimeout(r, 10));
      const callCountBeforeUnsub = callback.mock.calls.length;

      unsubscribe();

      await service.create('prospects', { id: 'unsub-test' });
      
      // Should not have been called after unsubscribe
      expect(callback.mock.calls.length).toBe(callCountBeforeUnsub);
    });

    it('subscribes to single document', async () => {
      await service.create('prospects', { id: 'doc-sub', name: 'Doc' });

      const callback = vi.fn();
      const unsubscribe = service.subscribeDoc('prospects', 'doc-sub', callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ name: 'Doc' }));

      await service.update('prospects', 'doc-sub', { name: 'Updated Doc' });

      expect(callback.mock.calls.length).toBeGreaterThanOrEqual(2);

      unsubscribe();
    });

    it('applies query options to subscription', async () => {
      await service.create('prospects', { id: 'qs1', tier: 1 });
      await service.create('prospects', { id: 'qs2', tier: 2 });
      await service.create('prospects', { id: 'qs3', tier: 1 });

      const callback = vi.fn();
      const unsubscribe = service.subscribe('prospects', callback, {
        filters: [{ field: 'tier', operator: '==', value: 1 }],
      });

      // Wait for async callback
      await new Promise(r => setTimeout(r, 10));

      const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0];
      expect(lastCall.length).toBe(2);

      unsubscribe();
    });
  });

  describe('Offline Queue', () => {
    it('queues writes when offline', async () => {
      // Simulate offline
      vi.stubGlobal('navigator', { onLine: false });
      
      const offlineService = createFirestoreService({
        tenantId: 'offline-test',
        enableOfflineQueue: true,
      });

      await offlineService.create('prospects', { id: 'offline1' });

      const status = offlineService.getOfflineQueueStatus();
      expect(status.pending).toBe(1);

      offlineService.destroy();
    });

    it('returns offline queue status', async () => {
      const status = service.getOfflineQueueStatus();
      expect(status).toEqual({
        pending: 0,
        oldest: null,
      });
    });

    it('reports connection status', () => {
      const status = service.getConnectionStatus();
      expect(status).toEqual({
        online: true,
        pendingWrites: 0,
      });
    });
  });

  describe('Prospect Operations', () => {
    it('creates prospect', async () => {
      const result = await service.createProspect({
        name: 'Test Prospect',
        email: 'test@example.com',
        company: 'TestCo',
        title: 'Manager',
        tier: 'T1',
        score: 85,
        status: 'new',
        tags: ['vip'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('gets prospect by id', async () => {
      await service.createProspect({
        id: 'get-prospect-test',
        name: 'Get Test',
        email: 'get@test.com',
        company: 'Co',
        title: 'Title',
        tier: 1,
        score: 50,
        status: 'active',
        tags: [],
        createdAt: '',
        updatedAt: '',
      } as any);

      const prospect = await service.getProspect('get-prospect-test');
      expect(prospect).toBeDefined();
      expect(prospect?.name).toBe('Get Test');
    });

    it('updates prospect', async () => {
      await service.createProspect({
        id: 'update-prospect',
        name: 'Original',
        email: 'orig@test.com',
        company: 'Co',
        title: 'Title',
        tier: 1,
        score: 50,
        status: 'active',
        tags: [],
        createdAt: '',
        updatedAt: '',
      } as any);

      const result = await service.updateProspect('update-prospect', {
        name: 'Updated Name',
        score: 95,
      });

      expect(result.success).toBe(true);
    });

    it('deletes prospect', async () => {
      await service.createProspect({
        id: 'delete-prospect',
        name: 'Delete Me',
        email: 'del@test.com',
        company: 'Co',
        title: 'Title',
        tier: 1,
        score: 50,
        status: 'active',
        tags: [],
        createdAt: '',
        updatedAt: '',
      } as any);

      const result = await service.deleteProspect('delete-prospect');
      expect(result.success).toBe(true);

      const deleted = await service.getProspect('delete-prospect');
      expect(deleted).toBeNull();
    });

    it('gets prospects with filters', async () => {
      await service.createProspect({
        id: 'filter1',
        name: 'High Tier',
        tier: 1,
        score: 90,
        email: '', company: '', title: '', status: 'active', tags: [], createdAt: '', updatedAt: '',
      } as any);
      await service.createProspect({
        id: 'filter2',
        name: 'Low Tier',
        tier: 3,
        score: 40,
        email: '', company: '', title: '', status: 'active', tags: [], createdAt: '', updatedAt: '',
      } as any);

      const results = await service.getProspects({
        filters: [{ field: 'tier', operator: '==', value: 1 }],
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('High Tier');
    });
  });

  describe('Activity Operations', () => {
    it('creates activity', async () => {
      const result = await service.createActivity({
        prospectId: 'p1',
        type: 'email_sent',
        body: 'Sent email',
        userId: 'user1',
        timestamp: new Date().toISOString(),
      } as any);

      expect(result.success).toBe(true);
    });

    it('gets activities with filters', async () => {
      await service.createActivity({
        id: 'a1',
        prospectId: 'p1',
        type: 'email_sent',
        content: 'Email 1',
        userId: 'user1',
        timestamp: new Date().toISOString(),
      } as any);
      await service.createActivity({
        id: 'a2',
        prospectId: 'p1',
        type: 'call',
        content: 'Call 1',
        userId: 'user1',
        timestamp: new Date().toISOString(),
      } as any);

      const results = await service.getActivities({
        filters: [{ field: 'type', operator: '==', value: 'email_sent' }],
      });

      expect(results.length).toBe(1);
    });
  });

  describe('Sequence Operations', () => {
    it('creates sequence', async () => {
      const result = await service.createSequence({
        name: 'Test Sequence',
        description: 'Test desc',
        steps: [],
        status: 'active',
        createdAt: '',
        updatedAt: '',
        createdBy: 'user1',
      } as unknown as Parameters<typeof service.createSequence>[0]);

      expect(result.success).toBe(true);
    });

    it('gets sequence by id', async () => {
      await service.createSequence({
        id: 'seq1',
        name: 'Get Sequence',
        description: '',
        steps: [],
        status: 'active',
        createdAt: '',
        updatedAt: '',
        createdBy: 'user1',
      } as any);

      const seq = await service.getSequence('seq1');
      expect(seq).toBeDefined();
      expect((seq as Record<string, unknown>)?.name).toBe('Get Sequence');
    });

    it('updates sequence', async () => {
      await service.createSequence({
        id: 'seq-update',
        name: 'Original',
        description: '',
        steps: [],
        status: 'draft',
        createdAt: '',
        updatedAt: '',
        createdBy: 'user1',
      } as any);

      const result = await service.updateSequence('seq-update', {
        sequenceName: 'Updated Sequence',
        status: 'active',
      });

      expect(result.success).toBe(true);
    });

    it('deletes sequence', async () => {
      await service.createSequence({
        id: 'seq-delete',
        name: 'Delete Me',
        description: '',
        steps: [],
        status: 'draft',
        createdAt: '',
        updatedAt: '',
        createdBy: 'user1',
      } as any);

      const result = await service.deleteSequence('seq-delete');
      expect(result.success).toBe(true);

      const deleted = await service.getSequence('seq-delete');
      expect(deleted).toBeNull();
    });
  });

  describe('Tenant Operations', () => {
    it('updates tenant', async () => {
      // Pre-populate tenant in cache
      service._setInCache('tenants', 'test-tenant', {
        id: 'test-tenant',
        name: 'Test Tenant',
      });

      const result = await service.updateTenant({
        name: 'Updated Tenant',
      });

      expect(result.success).toBe(true);
    });

    it('gets tenant users', async () => {
      service._setInCache('users', 'user1', { id: 'user1', email: 'user1@test.com' });
      service._setInCache('users', 'user2', { id: 'user2', email: 'user2@test.com' });

      const users = await service.getTenantUsers();
      expect(users.length).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('handles errors gracefully', () => {
      // Just verifying no throw on basic operations
      expect(() => service.getConnectionStatus()).not.toThrow();
      expect(() => service.getOfflineQueueStatus()).not.toThrow();
    });
  });

  describe('Lifecycle', () => {
    it('destroys service properly', () => {
      const testService = createFirestoreService({ tenantId: 'destroy-test' });
      expect(() => testService.destroy()).not.toThrow();
    });

    it('clears cache on destroy', async () => {
      const testService = createFirestoreService({ tenantId: 'cache-test' });
      
      await testService.create('prospects', { id: 'cache1' });
      testService.destroy();

      // Create new service - should not have old data
      const newService = createFirestoreService({ tenantId: 'cache-test' });
      const doc = await newService.read('prospects', 'cache1');
      expect(doc).toBeNull();
      newService.destroy();
    });
  });
});
