import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BulkDeleteService,
  getBulkDeleteService,
  resetBulkDeleteService,
  type DeletedItem,
  type DeleteOptions,
} from '../../services/BulkDeleteService';
import type { Prospect } from '../../types';

describe('BulkDeleteService', () => {
  let service: BulkDeleteService;

  // Sample prospect data
  const sampleProspects: Prospect[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      company: 'Acme Corp',
      title: 'CEO',
      tier: 'Tier 1',
      status: 'new',
      priority: 'high',
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      company: 'Tech Inc',
      title: 'CTO',
      tier: 'Tier 2',
      status: 'contacted',
      priority: 'medium',
    },
    {
      id: '3',
      name: 'Bob Johnson',
      email: 'bob@example.com',
      company: 'StartupXYZ',
      title: 'Founder',
      tier: 'Tier 1',
      status: 'new',
      priority: 'high',
    },
  ];

  beforeEach(() => {
    resetBulkDeleteService();
    service = new BulkDeleteService();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('soft delete', () => {
    it('should move prospects to trash', async () => {
      const result = await service.softDelete(sampleProspects.slice(0, 2));

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(2);
      expect(service.getTrash()).toHaveLength(2);
    });

    it('should set deletion metadata', async () => {
      await service.softDelete([sampleProspects[0]], {
        deletedBy: 'user@example.com',
      });

      const trash = service.getTrash();
      expect(trash[0].deletedBy).toBe('user@example.com');
      expect(trash[0].deletedAt).toEqual(new Date('2024-03-15T12:00:00Z'));
    });

    it('should set expiration date', async () => {
      await service.softDelete([sampleProspects[0]]);

      const trash = service.getTrash();
      const expectedExpiry = new Date('2024-04-14T12:00:00Z'); // 30 days later
      expect(trash[0].expiresAt).toEqual(expectedExpiry);
    });

    it('should use custom expiration days', async () => {
      await service.softDelete([sampleProspects[0]], {
        expirationDays: 7,
      });

      const trash = service.getTrash();
      const expectedExpiry = new Date('2024-03-22T12:00:00Z'); // 7 days later
      expect(trash[0].expiresAt).toEqual(expectedExpiry);
    });

    it('should call delete handler', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      service.setDeleteHandler(handler);

      await service.softDelete(sampleProspects.slice(0, 2));

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith('1');
      expect(handler).toHaveBeenCalledWith('2');
    });

    it('should handle delete handler errors', async () => {
      const handler = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Delete failed'));
      service.setDeleteHandler(handler);

      const result = await service.softDelete(sampleProspects.slice(0, 2));

      // First succeeds, second fails (but still added to trash before handler)
      expect(result.deleted).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors?.[0].error).toBe('Delete failed');
    });
  });

  describe('hard delete', () => {
    it('should permanently delete without trash', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      service.setDeleteHandler(handler);

      const result = await service.hardDelete(sampleProspects.slice(0, 2));

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(2);
      expect(service.getTrash()).toHaveLength(0);
    });

    it('should fail without delete handler', async () => {
      const result = await service.hardDelete(sampleProspects);

      expect(result.success).toBe(false);
      expect(result.errors?.[0].error).toContain('No delete handler');
    });

    it('should handle errors', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Cannot delete'));
      service.setDeleteHandler(handler);

      const result = await service.hardDelete([sampleProspects[0]]);

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
    });
  });

  describe('delete method', () => {
    it('should default to soft delete', async () => {
      await service.delete(sampleProspects.slice(0, 1));

      expect(service.getTrash()).toHaveLength(1);
    });

    it('should hard delete when soft=false', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      service.setDeleteHandler(handler);

      await service.delete(sampleProspects.slice(0, 1), { soft: false });

      expect(service.getTrash()).toHaveLength(0);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('trash management', () => {
    beforeEach(async () => {
      await service.softDelete(sampleProspects);
    });

    it('should get all trash items', () => {
      const trash = service.getTrash();
      expect(trash).toHaveLength(3);
    });

    it('should sort trash by deletion date (newest first)', async () => {
      service.clearTrash();

      await service.softDelete([sampleProspects[0]]);
      vi.advanceTimersByTime(1000);
      await service.softDelete([sampleProspects[1]]);
      vi.advanceTimersByTime(1000);
      await service.softDelete([sampleProspects[2]]);

      const trash = service.getTrash();
      expect(trash[0].id).toBe('3'); // Most recent
      expect(trash[2].id).toBe('1'); // Oldest
    });

    it('should get trash item by ID', () => {
      const item = service.getTrashItem('1');
      expect(item).toBeDefined();
      expect(item?.prospect.name).toBe('John Doe');
    });

    it('should return undefined for non-existent ID', () => {
      const item = service.getTrashItem('nonexistent');
      expect(item).toBeUndefined();
    });

    it('should get trash summary', () => {
      const summary = service.getTrashSummary();

      expect(summary.count).toBe(3);
      expect(summary.oldestItem).toBeDefined();
      expect(summary.newestItem).toBeDefined();
    });

    it('should count items expiring within 7 days', async () => {
      service.clearTrash();

      // Add item expiring in 5 days
      await service.softDelete([sampleProspects[0]], { expirationDays: 5 });
      // Add item expiring in 10 days
      await service.softDelete([sampleProspects[1]], { expirationDays: 10 });

      const summary = service.getTrashSummary();
      expect(summary.expiringWithin7Days).toBe(1);
    });
  });

  describe('restore', () => {
    beforeEach(async () => {
      await service.softDelete(sampleProspects);
    });

    it('should restore items from trash', async () => {
      const result = await service.restore(['1', '2']);

      expect(result.success).toBe(true);
      expect(result.restored).toBe(2);
      expect(service.getTrash()).toHaveLength(1);
    });

    it('should call restore handler', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      service.setRestoreHandler(handler);

      await service.restore(['1']);

      expect(handler).toHaveBeenCalledWith(sampleProspects[0]);
    });

    it('should fail for non-existent items', async () => {
      const result = await service.restore(['nonexistent']);

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
      expect(result.errors?.[0].error).toContain('not found');
    });

    it('should handle restore handler errors', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Restore failed'));
      service.setRestoreHandler(handler);

      const result = await service.restore(['1']);

      expect(result.success).toBe(false);
      expect(result.errors?.[0].error).toBe('Restore failed');
    });

    it('should restore all items', async () => {
      const result = await service.restoreAll();

      expect(result.success).toBe(true);
      expect(result.restored).toBe(3);
      expect(service.getTrash()).toHaveLength(0);
    });
  });

  describe('empty trash', () => {
    beforeEach(async () => {
      await service.softDelete(sampleProspects);
    });

    it('should empty all trash', async () => {
      const result = await service.emptyTrash();

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(3);
      expect(service.getTrash()).toHaveLength(0);
    });

    it('should remove single item from trash', async () => {
      const result = await service.removeFromTrash('1');

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(1);
      expect(service.getTrash()).toHaveLength(2);
    });

    it('should fail to remove non-existent item', async () => {
      const result = await service.removeFromTrash('nonexistent');

      expect(result.success).toBe(false);
      expect(result.errors?.[0].error).toContain('not found');
    });
  });

  describe('expiration', () => {
    it('should cleanup expired items', async () => {
      await service.softDelete([sampleProspects[0]], { expirationDays: 1 });
      await service.softDelete([sampleProspects[1]], { expirationDays: 30 });

      // Advance time by 2 days
      vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);

      const result = await service.cleanupExpired();

      expect(result.deleted).toBe(1);
      expect(service.getTrash()).toHaveLength(1);
    });

    it('should get items expiring soon', async () => {
      await service.softDelete([sampleProspects[0]], { expirationDays: 3 });
      await service.softDelete([sampleProspects[1]], { expirationDays: 10 });
      await service.softDelete([sampleProspects[2]], { expirationDays: 30 });

      const expiring = service.getExpiringItems(7);

      expect(expiring).toHaveLength(1);
      expect(expiring[0].id).toBe('1');
    });

    it('should extend expiration', async () => {
      await service.softDelete([sampleProspects[0]]);

      const originalExpiry = service.getTrashItem('1')?.expiresAt;
      service.extendExpiration(['1'], 15);
      const newExpiry = service.getTrashItem('1')?.expiresAt;

      expect(newExpiry!.getTime()).toBeGreaterThan(originalExpiry!.getTime());
    });

    it('should return count of extended items', async () => {
      await service.softDelete(sampleProspects);

      const extended = service.extendExpiration(['1', '2', 'nonexistent'], 10);

      expect(extended).toBe(2);
    });
  });

  describe('search trash', () => {
    beforeEach(async () => {
      await service.softDelete(sampleProspects);
    });

    it('should search by name', () => {
      const results = service.searchTrash('John');

      // "John Doe" and "Bob Johnson" both match "John"
      expect(results).toHaveLength(2);
      expect(results.some(r => r.prospect.name === 'John Doe')).toBe(true);
    });

    it('should search by email', () => {
      const results = service.searchTrash('jane@');

      expect(results).toHaveLength(1);
      expect(results[0].prospect.email).toBe('jane@example.com');
    });

    it('should search by company', () => {
      const results = service.searchTrash('Acme');

      expect(results).toHaveLength(1);
      expect(results[0].prospect.company).toBe('Acme Corp');
    });

    it('should be case insensitive', () => {
      const results = service.searchTrash('JANE');

      expect(results).toHaveLength(1);
      expect(results[0].prospect.name).toBe('Jane Smith');
    });

    it('should return empty for no matches', () => {
      const results = service.searchTrash('nonexistent');

      expect(results).toHaveLength(0);
    });
  });

  describe('confirmation message', () => {
    it('should generate soft delete message for single item', () => {
      const message = service.getConfirmationMessage(1, true);

      expect(message).toContain('1 prospect');
      expect(message).toContain('trash');
      expect(message).toContain('30 days');
    });

    it('should generate soft delete message for multiple items', () => {
      const message = service.getConfirmationMessage(5, true);

      expect(message).toContain('5 prospects');
      expect(message).toContain('trash');
    });

    it('should generate hard delete message', () => {
      const message = service.getConfirmationMessage(3, false);

      expect(message).toContain('permanently delete');
      expect(message).toContain('3 prospects');
      expect(message).toContain('cannot be undone');
    });
  });

  describe('canRestore', () => {
    it('should return true for valid item', async () => {
      await service.softDelete([sampleProspects[0]]);

      expect(service.canRestore('1')).toBe(true);
    });

    it('should return false for non-existent item', () => {
      expect(service.canRestore('nonexistent')).toBe(false);
    });

    it('should return false for expired item', async () => {
      await service.softDelete([sampleProspects[0]], { expirationDays: 1 });

      // Advance time past expiration
      vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);

      expect(service.canRestore('1')).toBe(false);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      resetBulkDeleteService();
      const instance1 = getBulkDeleteService();
      const instance2 = getBulkDeleteService();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = getBulkDeleteService();
      resetBulkDeleteService();
      const instance2 = getBulkDeleteService();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', async () => {
      const result = await service.softDelete([]);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(0);
    });

    it('should handle large batch', async () => {
      const largeList = Array.from({ length: 100 }, (_, i) => ({
        ...sampleProspects[0],
        id: String(i),
      }));

      const result = await service.softDelete(largeList);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(100);
      expect(service.getTrash()).toHaveLength(100);
    });

    it('should clear trash', async () => {
      await service.softDelete(sampleProspects);
      service.clearTrash();

      expect(service.getTrash()).toHaveLength(0);
    });

    it('should handle duplicate deletes', async () => {
      await service.softDelete([sampleProspects[0]]);
      await service.softDelete([sampleProspects[0]]);

      // Same ID should overwrite
      expect(service.getTrash()).toHaveLength(1);
    });
  });
});
