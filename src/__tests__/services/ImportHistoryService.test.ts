/**
 * Import History Service Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ImportHistoryService,
  getImportHistoryService,
  resetImportHistoryService,
  type ImportRecord,
} from '../../services/ImportHistoryService';

// ============================================
// Mocks
// ============================================

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
});

// ============================================
// Tests
// ============================================

describe('ImportHistoryService', () => {
  let service: ImportHistoryService;

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    resetImportHistoryService();
    service = new ImportHistoryService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('startImport', () => {
    it('creates a new import record', () => {
      const id = service.startImport({
        source: 'linkedin',
        fileName: 'contacts.csv',
        totalContacts: 100,
      });

      expect(id).toBeDefined();
      expect(id).toMatch(/^import-/);

      const record = service.getRecord(id);
      expect(record).toBeDefined();
      expect(record?.source).toBe('linkedin');
      expect(record?.fileName).toBe('contacts.csv');
      expect(record?.totalContacts).toBe(100);
      expect(record?.status).toBe('pending');
    });

    it('sets timestamp', () => {
      const before = Date.now();
      const id = service.startImport({
        source: 'csv',
        totalContacts: 50,
      });
      const after = Date.now();

      const record = service.getRecord(id);
      expect(record?.timestamp).toBeGreaterThanOrEqual(before);
      expect(record?.timestamp).toBeLessThanOrEqual(after);
    });

    it('stores metadata', () => {
      const id = service.startImport({
        source: 'linkedin',
        totalContacts: 10,
        metadata: { version: '2.0', exportType: 'sales_navigator' },
      });

      const record = service.getRecord(id);
      expect(record?.metadata).toEqual({ version: '2.0', exportType: 'sales_navigator' });
    });

    it('saves to localStorage', () => {
      service.startImport({
        source: 'linkedin',
        totalContacts: 10,
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('limits records to maxRecords', () => {
      const limitedService = new ImportHistoryService({ maxRecords: 3 });

      limitedService.startImport({ source: 'csv', totalContacts: 1 });
      limitedService.startImport({ source: 'csv', totalContacts: 2 });
      limitedService.startImport({ source: 'csv', totalContacts: 3 });
      limitedService.startImport({ source: 'csv', totalContacts: 4 });

      const records = limitedService.getRecords();
      expect(records.length).toBe(3);
      expect(records[0].totalContacts).toBe(4); // Most recent first
    });
  });

  describe('completeImport', () => {
    it('updates record with results', () => {
      const id = service.startImport({
        source: 'linkedin',
        totalContacts: 100,
      });

      service.completeImport(id, {
        imported: 80,
        merged: 10,
        skipped: 5,
        failed: 5,
        prospectIds: ['p1', 'p2', 'p3'],
        mergedProspectIds: ['m1'],
        duration: 5000,
      });

      const record = service.getRecord(id);
      expect(record?.status).toBe('completed');
      expect(record?.imported).toBe(80);
      expect(record?.merged).toBe(10);
      expect(record?.skipped).toBe(5);
      expect(record?.failed).toBe(5);
      expect(record?.prospectIds).toEqual(['p1', 'p2', 'p3']);
      expect(record?.duration).toBe(5000);
    });

    it('handles non-existent import', () => {
      // Should not throw
      service.completeImport('non-existent', {
        imported: 10,
        merged: 0,
        skipped: 0,
        failed: 0,
        prospectIds: [],
        mergedProspectIds: [],
        duration: 1000,
      });
    });
  });

  describe('failImport', () => {
    it('marks import as failed with error', () => {
      const id = service.startImport({
        source: 'csv',
        totalContacts: 50,
      });

      service.failImport(id, 'Network error');

      const record = service.getRecord(id);
      expect(record?.status).toBe('failed');
      expect(record?.error).toBe('Network error');
    });
  });

  describe('canUndo', () => {
    it('returns true for recent completed import', () => {
      const id = service.startImport({
        source: 'linkedin',
        totalContacts: 10,
      });

      service.completeImport(id, {
        imported: 10,
        merged: 0,
        skipped: 0,
        failed: 0,
        prospectIds: ['p1', 'p2'],
        mergedProspectIds: [],
        duration: 1000,
      });

      expect(service.canUndo(id)).toBe(true);
    });

    it('returns false for pending import', () => {
      const id = service.startImport({
        source: 'linkedin',
        totalContacts: 10,
      });

      expect(service.canUndo(id)).toBe(false);
    });

    it('returns false for failed import', () => {
      const id = service.startImport({
        source: 'linkedin',
        totalContacts: 10,
      });

      service.failImport(id, 'Error');

      expect(service.canUndo(id)).toBe(false);
    });

    it('returns false for import with no prospect IDs', () => {
      const id = service.startImport({
        source: 'linkedin',
        totalContacts: 10,
      });

      service.completeImport(id, {
        imported: 0,
        merged: 0,
        skipped: 10,
        failed: 0,
        prospectIds: [],
        mergedProspectIds: [],
        duration: 1000,
      });

      expect(service.canUndo(id)).toBe(false);
    });

    it('returns false for expired import', () => {
      const shortWindowService = new ImportHistoryService({ undoWindow: 100 }); // 100ms window

      const id = shortWindowService.startImport({
        source: 'linkedin',
        totalContacts: 10,
      });

      shortWindowService.completeImport(id, {
        imported: 10,
        merged: 0,
        skipped: 0,
        failed: 0,
        prospectIds: ['p1'],
        mergedProspectIds: [],
        duration: 1000,
      });

      // Wait for undo window to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortWindowService.canUndo(id)).toBe(false);
          resolve();
        }, 150);
      });
    });

    it('returns false for non-existent import', () => {
      expect(service.canUndo('non-existent')).toBe(false);
    });
  });

  describe('undoImport', () => {
    it('calls onDelete with prospect IDs', async () => {
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      service.setCallbacks({ onDelete: mockDelete });

      const id = service.startImport({
        source: 'linkedin',
        totalContacts: 10,
      });

      service.completeImport(id, {
        imported: 10,
        merged: 0,
        skipped: 0,
        failed: 0,
        prospectIds: ['p1', 'p2', 'p3'],
        mergedProspectIds: [],
        duration: 1000,
      });

      const result = await service.undoImport(id);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(3);
      expect(mockDelete).toHaveBeenCalledWith(['p1', 'p2', 'p3']);
    });

    it('marks record as undone', async () => {
      service.setCallbacks({ onDelete: vi.fn().mockResolvedValue(undefined) });

      const id = service.startImport({
        source: 'linkedin',
        totalContacts: 10,
      });

      service.completeImport(id, {
        imported: 10,
        merged: 0,
        skipped: 0,
        failed: 0,
        prospectIds: ['p1'],
        mergedProspectIds: [],
        duration: 1000,
      });

      await service.undoImport(id);

      const record = service.getRecord(id);
      expect(record?.status).toBe('undone');
    });

    it('returns error for non-existent import', async () => {
      const result = await service.undoImport('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Import record not found');
    });

    it('returns error if cannot undo', async () => {
      const id = service.startImport({
        source: 'linkedin',
        totalContacts: 10,
      });

      // Still pending, can't undo
      const result = await service.undoImport(id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be undone');
    });

    it('handles delete callback error', async () => {
      service.setCallbacks({
        onDelete: vi.fn().mockRejectedValue(new Error('Delete failed')),
      });

      const id = service.startImport({
        source: 'linkedin',
        totalContacts: 10,
      });

      service.completeImport(id, {
        imported: 10,
        merged: 0,
        skipped: 0,
        failed: 0,
        prospectIds: ['p1'],
        mergedProspectIds: [],
        duration: 1000,
      });

      const result = await service.undoImport(id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });

  describe('getRecords', () => {
    it('returns all records', () => {
      service.startImport({ source: 'linkedin', totalContacts: 10 });
      service.startImport({ source: 'csv', totalContacts: 20 });
      service.startImport({ source: 'hubspot', totalContacts: 30 });

      const records = service.getRecords();
      expect(records.length).toBe(3);
    });

    it('returns copy of records', () => {
      service.startImport({ source: 'linkedin', totalContacts: 10 });

      const records1 = service.getRecords();
      const records2 = service.getRecords();

      expect(records1).not.toBe(records2);
    });
  });

  describe('getLastImport', () => {
    it('returns most recent import', () => {
      service.startImport({ source: 'linkedin', totalContacts: 10 });
      const lastId = service.startImport({ source: 'csv', totalContacts: 20 });

      const lastImport = service.getLastImport();
      expect(lastImport?.id).toBe(lastId);
    });

    it('returns undefined when no imports', () => {
      expect(service.getLastImport()).toBeUndefined();
    });
  });

  describe('getImportsBySource', () => {
    it('filters by source', () => {
      service.startImport({ source: 'linkedin', totalContacts: 10 });
      service.startImport({ source: 'csv', totalContacts: 20 });
      service.startImport({ source: 'linkedin', totalContacts: 30 });

      const linkedinImports = service.getImportsBySource('linkedin');
      expect(linkedinImports.length).toBe(2);
      expect(linkedinImports.every((r) => r.source === 'linkedin')).toBe(true);
    });
  });

  describe('getImportsByDateRange', () => {
    it('filters by date range', () => {
      const now = Date.now();
      
      // Create imports at different times
      service.startImport({ source: 'linkedin', totalContacts: 10 });

      const startDate = new Date(now - 1000);
      const endDate = new Date(now + 1000);

      const imports = service.getImportsByDateRange(startDate, endDate);
      expect(imports.length).toBe(1);
    });
  });

  describe('getStats', () => {
    it('calculates statistics', () => {
      const id1 = service.startImport({ source: 'linkedin', totalContacts: 100 });
      service.completeImport(id1, {
        imported: 80,
        merged: 10,
        skipped: 5,
        failed: 5,
        prospectIds: [],
        mergedProspectIds: [],
        duration: 1000,
      });

      const id2 = service.startImport({ source: 'csv', totalContacts: 50 });
      service.completeImport(id2, {
        imported: 40,
        merged: 5,
        skipped: 3,
        failed: 2,
        prospectIds: [],
        mergedProspectIds: [],
        duration: 500,
      });

      const stats = service.getStats();

      expect(stats.totalImports).toBe(2);
      expect(stats.totalProspectsImported).toBe(120);
      expect(stats.totalMerged).toBe(15);
      expect(stats.totalSkipped).toBe(8);
      expect(stats.totalFailed).toBe(7);
      expect(stats.bySource.linkedin).toBe(1);
      expect(stats.bySource.csv).toBe(1);
    });

    it('counts undone imports', async () => {
      service.setCallbacks({ onDelete: vi.fn().mockResolvedValue(undefined) });

      const id = service.startImport({ source: 'linkedin', totalContacts: 10 });
      service.completeImport(id, {
        imported: 10,
        merged: 0,
        skipped: 0,
        failed: 0,
        prospectIds: ['p1'],
        mergedProspectIds: [],
        duration: 1000,
      });

      await service.undoImport(id);

      const stats = service.getStats();
      expect(stats.undoneCount).toBe(1);
    });
  });

  describe('clearHistory', () => {
    it('clears all records', () => {
      service.startImport({ source: 'linkedin', totalContacts: 10 });
      service.startImport({ source: 'csv', totalContacts: 20 });

      service.clearHistory();

      expect(service.getRecords().length).toBe(0);
      expect(service.getLastImport()).toBeUndefined();
    });
  });

  describe('deleteRecord', () => {
    it('deletes specific record', () => {
      const id1 = service.startImport({ source: 'linkedin', totalContacts: 10 });
      service.startImport({ source: 'csv', totalContacts: 20 });

      const result = service.deleteRecord(id1);

      expect(result).toBe(true);
      expect(service.getRecords().length).toBe(1);
      expect(service.getRecord(id1)).toBeUndefined();
    });

    it('returns false for non-existent record', () => {
      const result = service.deleteRecord('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('exportHistory', () => {
    it('exports as JSON string', () => {
      service.startImport({ source: 'linkedin', totalContacts: 10 });

      const exported = service.exportHistory();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
    });
  });

  describe('getUndoTimeRemaining', () => {
    it('returns remaining time', () => {
      const id = service.startImport({ source: 'linkedin', totalContacts: 10 });
      service.completeImport(id, {
        imported: 10,
        merged: 0,
        skipped: 0,
        failed: 0,
        prospectIds: ['p1'],
        mergedProspectIds: [],
        duration: 1000,
      });

      const remaining = service.getUndoTimeRemaining(id);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });

    it('returns 0 for non-completed imports', () => {
      const id = service.startImport({ source: 'linkedin', totalContacts: 10 });
      expect(service.getUndoTimeRemaining(id)).toBe(0);
    });
  });

  describe('formatUndoTimeRemaining', () => {
    it('formats remaining time', () => {
      const id = service.startImport({ source: 'linkedin', totalContacts: 10 });
      service.completeImport(id, {
        imported: 10,
        merged: 0,
        skipped: 0,
        failed: 0,
        prospectIds: ['p1'],
        mergedProspectIds: [],
        duration: 1000,
      });

      const formatted = service.formatUndoTimeRemaining(id);
      expect(formatted).toMatch(/\d+h \d+m remaining/);
    });

    it('returns Expired for non-undoable', () => {
      const id = service.startImport({ source: 'linkedin', totalContacts: 10 });
      expect(service.formatUndoTimeRemaining(id)).toBe('Expired');
    });
  });

  describe('localStorage persistence', () => {
    it('loads from localStorage on init', () => {
      const existingRecord: ImportRecord = {
        id: 'existing-import',
        timestamp: Date.now(),
        source: 'linkedin',
        status: 'completed',
        totalContacts: 50,
        imported: 50,
        merged: 0,
        skipped: 0,
        failed: 0,
        prospectIds: [],
        mergedProspectIds: [],
        duration: 1000,
      };

      mockLocalStorage.getItem.mockReturnValueOnce(
        JSON.stringify({ records: [existingRecord], lastImportId: 'existing-import' })
      );

      const newService = new ImportHistoryService();
      const records = newService.getRecords();

      expect(records.length).toBe(1);
      expect(records[0].id).toBe('existing-import');
    });
  });
});

// ============================================
// Singleton Tests
// ============================================

describe('Singleton Pattern', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    resetImportHistoryService();
  });

  it('getImportHistoryService returns singleton', () => {
    const service1 = getImportHistoryService();
    const service2 = getImportHistoryService();

    expect(service1).toBe(service2);
  });

  it('resetImportHistoryService clears singleton', () => {
    const service1 = getImportHistoryService();
    resetImportHistoryService();
    const service2 = getImportHistoryService();

    expect(service1).not.toBe(service2);
  });
});
