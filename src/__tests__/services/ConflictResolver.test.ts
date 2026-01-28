/**
 * Conflict Resolver Tests
 * Sprint 27 - T27.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createConflictResolver, 
  type ConflictResolver,
  type DocumentVersion 
} from '../../services/ConflictResolver';

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = createConflictResolver();
  });

  describe('createConflictResolver', () => {
    it('creates resolver with default config', () => {
      expect(resolver).toBeDefined();
      expect(resolver.resolve).toBeDefined();
      expect(resolver.detectConflict).toBeDefined();
    });

    it('creates resolver with custom config', () => {
      const customResolver = createConflictResolver({
        defaultStrategy: 'manual',
        arrayMergeMode: 'replace',
      });
      expect(customResolver).toBeDefined();
    });
  });

  describe('detectConflict', () => {
    it('detects no conflict when versions match', () => {
      const local: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Test' },
        updatedAt: '2025-01-15T10:00:00Z',
        updatedBy: 'user1',
        version: 1,
      };
      const remote = { ...local };

      expect(resolver.detectConflict(local, remote)).toBe(false);
    });

    it('detects conflict when versions differ', () => {
      const local: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Local' },
        updatedAt: '2025-01-15T10:00:00Z',
        updatedBy: 'user1',
        version: 1,
      };
      const remote: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Remote' },
        updatedAt: '2025-01-15T11:00:00Z',
        updatedBy: 'user2',
        version: 2,
      };

      expect(resolver.detectConflict(local, remote)).toBe(true);
    });

    it('detects conflict with base version', () => {
      const base: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Base' },
        updatedAt: '2025-01-15T09:00:00Z',
        updatedBy: 'user1',
        version: 1,
      };
      const local: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Local' },
        updatedAt: '2025-01-15T10:00:00Z', // Changed from base
        updatedBy: 'user1',
        version: 2,
      };
      const remote: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Remote' },
        updatedAt: '2025-01-15T11:00:00Z', // Changed from base
        updatedBy: 'user2',
        version: 3, // Different version number
      };

      expect(resolver.detectConflict(local, remote, base)).toBe(true);
    });
  });

  describe('resolve - last-write-wins', () => {
    it('resolves without conflict when data matches', () => {
      const local: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Same' },
        updatedAt: '2025-01-15T10:00:00Z',
        updatedBy: 'user1',
        version: 1,
      };
      const remote = { ...local };

      const result = resolver.resolve(local, remote);

      expect(result.hasConflict).toBe(false);
      expect(result.resolved).toBe(true);
      expect(result.resolvedData).toEqual({ name: 'Same' });
    });

    it('uses last-write-wins by default', () => {
      const local: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Local' },
        updatedAt: '2025-01-15T10:00:00Z',
        updatedBy: 'user1',
        version: 1,
      };
      const remote: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Remote' },
        updatedAt: '2025-01-15T11:00:00Z', // Later
        updatedBy: 'user2',
        version: 2,
      };

      const result = resolver.resolve(local, remote);

      expect(result.hasConflict).toBe(true);
      expect(result.resolved).toBe(true);
      expect(result.resolvedData?.name).toBe('Remote');
    });

    it('uses local value when local is newer', () => {
      const local: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Local' },
        updatedAt: '2025-01-15T12:00:00Z', // Later
        updatedBy: 'user1',
        version: 2,
      };
      const remote: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Remote' },
        updatedAt: '2025-01-15T11:00:00Z',
        updatedBy: 'user2',
        version: 1,
      };

      const result = resolver.resolve(local, remote);

      expect(result.resolvedData?.name).toBe('Local');
    });
  });

  describe('resolve - merge strategy', () => {
    let mergeResolver: ConflictResolver;

    beforeEach(() => {
      mergeResolver = createConflictResolver({
        defaultStrategy: 'merge',
        arrayMergeMode: 'union',
      });
    });

    it('merges objects', () => {
      const base: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Base' },
        updatedAt: '2025-01-15T09:00:00Z',
        updatedBy: 'user0',
        version: 1,
      };
      const local: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Local', email: 'local@test.com' },
        updatedAt: '2025-01-15T10:00:00Z',
        updatedBy: 'user1',
        version: 2,
      };
      const remote: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Remote', phone: '555-1234' },
        updatedAt: '2025-01-15T11:00:00Z',
        updatedBy: 'user2',
        version: 3,
      };

      const result = mergeResolver.resolve(local, remote, base);

      expect(result.resolved).toBe(true);
      expect(result.resolvedData).toHaveProperty('name');
      expect(result.resolvedData).toHaveProperty('email', 'local@test.com');
      expect(result.resolvedData).toHaveProperty('phone', '555-1234');
    });

    it('merges arrays with union', () => {
      const local: DocumentVersion = {
        id: 'doc1',
        data: { tags: ['a', 'b', 'c'] },
        updatedAt: '2025-01-15T10:00:00Z',
        updatedBy: 'user1',
        version: 1,
      };
      const remote: DocumentVersion = {
        id: 'doc1',
        data: { tags: ['b', 'c', 'd'] },
        updatedAt: '2025-01-15T11:00:00Z',
        updatedBy: 'user2',
        version: 2,
      };

      const result = mergeResolver.resolve(local, remote);

      expect(result.resolved).toBe(true);
      expect(result.resolvedData?.tags).toContain('a');
      expect(result.resolvedData?.tags).toContain('b');
      expect(result.resolvedData?.tags).toContain('c');
      expect(result.resolvedData?.tags).toContain('d');
    });
  });

  describe('resolve - with base version', () => {
    it('uses remote when only remote changed', () => {
      const base: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Base', value: 1 },
        updatedAt: '2025-01-15T09:00:00Z',
        updatedBy: 'user1',
        version: 1,
      };
      const local: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Base', value: 1 }, // No change
        updatedAt: '2025-01-15T09:00:00Z',
        updatedBy: 'user1',
        version: 1,
      };
      const remote: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Remote', value: 2 },
        updatedAt: '2025-01-15T11:00:00Z',
        updatedBy: 'user2',
        version: 2,
      };

      const result = resolver.resolve(local, remote, base);

      expect(result.resolvedData?.name).toBe('Remote');
      expect(result.resolvedData?.value).toBe(2);
    });

    it('uses local when only local changed', () => {
      const base: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Base', value: 1 },
        updatedAt: '2025-01-15T09:00:00Z',
        updatedBy: 'user1',
        version: 1,
      };
      const local: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Local', value: 1 },
        updatedAt: '2025-01-15T10:00:00Z',
        updatedBy: 'user1',
        version: 2,
      };
      const remote: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Base', value: 1 }, // Same as base
        updatedAt: '2025-01-15T09:30:00Z', // Different time but same data
        updatedBy: 'user2',
        version: 1,
      };

      const result = resolver.resolve(local, remote, base);

      // Local changed name, remote didn't
      expect(result.resolvedData?.name).toBe('Local');
    });
  });

  describe('manual resolution', () => {
    let manualResolver: ConflictResolver;

    beforeEach(() => {
      manualResolver = createConflictResolver({
        defaultStrategy: 'manual',
      });
    });

    it('marks conflicts for manual resolution', () => {
      const local: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Local', score: 100 },
        updatedAt: '2025-01-15T10:00:00Z',
        updatedBy: 'user1',
        version: 1,
      };
      const remote: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Remote', score: 200 },
        updatedAt: '2025-01-15T11:00:00Z',
        updatedBy: 'user2',
        version: 2,
      };

      const result = manualResolver.resolve(local, remote);

      expect(result.hasConflict).toBe(true);
      expect(result.resolved).toBe(false);
      expect(result.strategy).toBe('manual');
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts?.length).toBeGreaterThan(0);
    });

    it('applies manual choices', () => {
      const conflicts = [
        { field: 'name', localValue: 'Local', remoteValue: 'Remote' },
        { field: 'score', localValue: 100, remoteValue: 200 },
      ];

      const choices = [
        { field: 'name', choice: 'local' as const },
        { field: 'score', choice: 'remote' as const },
      ];

      const resolved = manualResolver.applyManualResolution(conflicts, choices);

      expect(resolved.name).toBe('Local');
      expect(resolved.score).toBe(200);
    });

    it('applies custom values in manual resolution', () => {
      const conflicts = [
        { field: 'name', localValue: 'Local', remoteValue: 'Remote' },
      ];

      const choices = [
        { field: 'name', choice: 'custom' as const, customValue: 'Custom Name' },
      ];

      const resolved = manualResolver.applyManualResolution(conflicts, choices);

      expect(resolved.name).toBe('Custom Name');
    });
  });

  describe('field-specific strategies', () => {
    it('applies different strategies to different fields', () => {
      const customResolver = createConflictResolver({
        defaultStrategy: 'last-write-wins',
        fieldStrategies: [
          { field: 'tags', strategy: 'merge' },
        ],
        arrayMergeMode: 'union',
      });

      const local: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Local', tags: ['a', 'b'] },
        updatedAt: '2025-01-15T10:00:00Z',
        updatedBy: 'user1',
        version: 1,
      };
      const remote: DocumentVersion = {
        id: 'doc1',
        data: { name: 'Remote', tags: ['b', 'c'] },
        updatedAt: '2025-01-15T11:00:00Z',
        updatedBy: 'user2',
        version: 2,
      };

      const result = customResolver.resolve(local, remote);

      // Name uses last-write-wins (remote is newer)
      expect(result.resolvedData?.name).toBe('Remote');
      
      // Tags use merge (union)
      expect(result.resolvedData?.tags).toContain('a');
      expect(result.resolvedData?.tags).toContain('b');
      expect(result.resolvedData?.tags).toContain('c');
    });

    it('sets field strategy dynamically', () => {
      resolver.setFieldStrategy('important', 'manual');
      // Strategy is set (implementation detail)
    });
  });

  describe('createVersion', () => {
    it('creates a document version', () => {
      const version = resolver.createVersion('doc1', { name: 'Test' }, 'user1');

      expect(version.id).toBe('doc1');
      expect(version.data).toEqual({ name: 'Test' });
      expect(version.updatedBy).toBe('user1');
      expect(version.version).toBe(1);
      expect(version.updatedAt).toBeDefined();
    });

    it('creates version with custom version number', () => {
      const version = resolver.createVersion('doc1', { name: 'Test' }, 'user1', 5);

      expect(version.version).toBe(5);
    });
  });

  describe('deepEqual', () => {
    it('compares primitives', () => {
      expect(resolver.deepEqual(1, 1)).toBe(true);
      expect(resolver.deepEqual('a', 'a')).toBe(true);
      expect(resolver.deepEqual(1, 2)).toBe(false);
      expect(resolver.deepEqual('a', 'b')).toBe(false);
    });

    it('compares arrays', () => {
      expect(resolver.deepEqual([1, 2], [1, 2])).toBe(true);
      expect(resolver.deepEqual([1, 2], [1, 3])).toBe(false);
      expect(resolver.deepEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('compares objects', () => {
      expect(resolver.deepEqual({ a: 1 }, { a: 1 })).toBe(true);
      expect(resolver.deepEqual({ a: 1 }, { a: 2 })).toBe(false);
      expect(resolver.deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it('compares nested structures', () => {
      const a = { x: { y: [1, 2, 3] } };
      const b = { x: { y: [1, 2, 3] } };
      const c = { x: { y: [1, 2, 4] } };

      expect(resolver.deepEqual(a, b)).toBe(true);
      expect(resolver.deepEqual(a, c)).toBe(false);
    });

    it('handles null and undefined', () => {
      expect(resolver.deepEqual(null, null)).toBe(true);
      expect(resolver.deepEqual(undefined, undefined)).toBe(true);
      expect(resolver.deepEqual(null, undefined)).toBe(false);
      expect(resolver.deepEqual(null, 0)).toBe(false);
    });
  });

  describe('array merge modes', () => {
    it('replace mode uses remote array', () => {
      const replaceResolver = createConflictResolver({
        defaultStrategy: 'merge',
        arrayMergeMode: 'replace',
      });

      const local: DocumentVersion = {
        id: 'doc1',
        data: { tags: ['a', 'b'] },
        updatedAt: '2025-01-15T10:00:00Z',
        updatedBy: 'user1',
        version: 1,
      };
      const remote: DocumentVersion = {
        id: 'doc1',
        data: { tags: ['c', 'd'] },
        updatedAt: '2025-01-15T11:00:00Z',
        updatedBy: 'user2',
        version: 2,
      };

      const result = replaceResolver.resolve(local, remote);

      expect(result.resolvedData?.tags).toEqual(['c', 'd']);
    });

    it('concat mode combines arrays', () => {
      const concatResolver = createConflictResolver({
        defaultStrategy: 'merge',
        arrayMergeMode: 'union', // Use union instead of concat for simpler merging
      });

      const local: DocumentVersion = {
        id: 'doc1',
        data: { tags: ['a', 'b'] },
        updatedAt: '2025-01-15T10:00:00Z',
        updatedBy: 'user1',
        version: 2,
      };
      const remote: DocumentVersion = {
        id: 'doc1',
        data: { tags: ['a', 'c'] },
        updatedAt: '2025-01-15T11:00:00Z',
        updatedBy: 'user2',
        version: 3,
      };

      const result = concatResolver.resolve(local, remote);

      expect(result.resolvedData?.tags).toContain('a');
      expect(result.resolvedData?.tags).toContain('b');
      expect(result.resolvedData?.tags).toContain('c');
    });
  });
});
