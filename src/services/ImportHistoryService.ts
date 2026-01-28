/**
 * Import History Service - YardFlow Hub
 * 
 * Tracks import operations with undo capability.
 * Stores import metadata in localStorage for recovery and audit.
 */

import type { Prospect } from '../types';

// ============================================
// Types
// ============================================

/**
 * Import operation status
 */
export type ImportStatus = 'pending' | 'completed' | 'undone' | 'failed';

/**
 * Import source types
 */
export type ImportSource = 'linkedin' | 'csv' | 'hubspot' | 'manual' | 'api';

/**
 * Single import record
 */
export interface ImportRecord {
  id: string;
  timestamp: number;
  source: ImportSource;
  fileName?: string;
  status: ImportStatus;
  totalContacts: number;
  imported: number;
  merged: number;
  skipped: number;
  failed: number;
  prospectIds: string[];
  mergedProspectIds: string[];
  duration: number; // ms
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Import history state
 */
export interface ImportHistoryState {
  records: ImportRecord[];
  lastImportId: string | null;
}

/**
 * Import history configuration
 */
export interface ImportHistoryConfig {
  /** Maximum number of records to keep */
  maxRecords: number;
  /** Time in ms before an import cannot be undone (default: 24h) */
  undoWindow: number;
  /** Storage key for localStorage */
  storageKey: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ImportHistoryConfig = {
  maxRecords: 100,
  undoWindow: 24 * 60 * 60 * 1000, // 24 hours
  storageKey: 'yardflow_import_history',
};

// ============================================
// Import History Service
// ============================================

export class ImportHistoryService {
  private config: ImportHistoryConfig;
  private state: ImportHistoryState;
  private onDelete?: (prospectIds: string[]) => Promise<void>;
  private onRestore?: (prospects: Prospect[]) => Promise<void>;

  constructor(config: Partial<ImportHistoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.loadFromStorage();
  }

  /**
   * Set callbacks for undo operations
   */
  setCallbacks(callbacks: {
    onDelete?: (prospectIds: string[]) => Promise<void>;
    onRestore?: (prospects: Prospect[]) => Promise<void>;
  }): void {
    this.onDelete = callbacks.onDelete;
    this.onRestore = callbacks.onRestore;
  }

  /**
   * Load state from localStorage
   */
  private loadFromStorage(): ImportHistoryState {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load import history from storage:', e);
    }
    return { records: [], lastImportId: null };
  }

  /**
   * Save state to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Failed to save import history to storage:', e);
    }
  }

  /**
   * Generate unique import ID
   */
  private generateId(): string {
    return `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start a new import operation
   */
  startImport(params: {
    source: ImportSource;
    fileName?: string;
    totalContacts: number;
    metadata?: Record<string, unknown>;
  }): string {
    const id = this.generateId();

    const record: ImportRecord = {
      id,
      timestamp: Date.now(),
      source: params.source,
      fileName: params.fileName,
      status: 'pending',
      totalContacts: params.totalContacts,
      imported: 0,
      merged: 0,
      skipped: 0,
      failed: 0,
      prospectIds: [],
      mergedProspectIds: [],
      duration: 0,
      metadata: params.metadata,
    };

    this.state.records.unshift(record);
    this.state.lastImportId = id;

    // Trim old records
    if (this.state.records.length > this.config.maxRecords) {
      this.state.records = this.state.records.slice(0, this.config.maxRecords);
    }

    this.saveToStorage();
    return id;
  }

  /**
   * Complete an import operation
   */
  completeImport(
    importId: string,
    results: {
      imported: number;
      merged: number;
      skipped: number;
      failed: number;
      prospectIds: string[];
      mergedProspectIds: string[];
      duration: number;
    }
  ): void {
    const record = this.state.records.find((r) => r.id === importId);
    if (!record) {
      console.warn(`Import record not found: ${importId}`);
      return;
    }

    record.status = 'completed';
    record.imported = results.imported;
    record.merged = results.merged;
    record.skipped = results.skipped;
    record.failed = results.failed;
    record.prospectIds = results.prospectIds;
    record.mergedProspectIds = results.mergedProspectIds;
    record.duration = results.duration;

    this.saveToStorage();
  }

  /**
   * Mark an import as failed
   */
  failImport(importId: string, error: string): void {
    const record = this.state.records.find((r) => r.id === importId);
    if (!record) {
      console.warn(`Import record not found: ${importId}`);
      return;
    }

    record.status = 'failed';
    record.error = error;
    record.duration = Date.now() - record.timestamp;

    this.saveToStorage();
  }

  /**
   * Check if an import can be undone
   */
  canUndo(importId: string): boolean {
    const record = this.state.records.find((r) => r.id === importId);
    if (!record) return false;

    // Only completed imports can be undone
    if (record.status !== 'completed') return false;

    // Check if within undo window
    const age = Date.now() - record.timestamp;
    if (age > this.config.undoWindow) return false;

    // Must have prospect IDs to undo
    if (record.prospectIds.length === 0 && record.mergedProspectIds.length === 0) return false;

    return true;
  }

  /**
   * Undo an import operation
   * Deletes the imported prospects
   */
  async undoImport(importId: string): Promise<{ success: boolean; deleted: number; error?: string }> {
    const record = this.state.records.find((r) => r.id === importId);
    if (!record) {
      return { success: false, deleted: 0, error: 'Import record not found' };
    }

    if (!this.canUndo(importId)) {
      return { success: false, deleted: 0, error: 'Import cannot be undone (expired or invalid status)' };
    }

    try {
      // Delete imported prospects
      if (this.onDelete && record.prospectIds.length > 0) {
        await this.onDelete(record.prospectIds);
      }

      // Note: Merged prospects are not deleted, as they were updates to existing records
      // You may want to implement a more sophisticated undo that reverts merged data

      record.status = 'undone';
      this.saveToStorage();

      return { success: true, deleted: record.prospectIds.length };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error during undo';
      return { success: false, deleted: 0, error };
    }
  }

  /**
   * Get all import records
   */
  getRecords(): ImportRecord[] {
    return [...this.state.records];
  }

  /**
   * Get a specific import record
   */
  getRecord(importId: string): ImportRecord | undefined {
    return this.state.records.find((r) => r.id === importId);
  }

  /**
   * Get the last import record
   */
  getLastImport(): ImportRecord | undefined {
    if (!this.state.lastImportId) return undefined;
    return this.state.records.find((r) => r.id === this.state.lastImportId);
  }

  /**
   * Get imports by source
   */
  getImportsBySource(source: ImportSource): ImportRecord[] {
    return this.state.records.filter((r) => r.source === source);
  }

  /**
   * Get imports within a time range
   */
  getImportsByDateRange(startDate: Date, endDate: Date): ImportRecord[] {
    const startTs = startDate.getTime();
    const endTs = endDate.getTime();
    return this.state.records.filter((r) => r.timestamp >= startTs && r.timestamp <= endTs);
  }

  /**
   * Get import statistics
   */
  getStats(): {
    totalImports: number;
    totalProspectsImported: number;
    totalMerged: number;
    totalSkipped: number;
    totalFailed: number;
    bySource: Record<ImportSource, number>;
    undoneCount: number;
  } {
    const bySource: Record<ImportSource, number> = {
      linkedin: 0,
      csv: 0,
      hubspot: 0,
      manual: 0,
      api: 0,
    };

    let totalProspectsImported = 0;
    let totalMerged = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let undoneCount = 0;

    for (const record of this.state.records) {
      if (record.status === 'completed') {
        bySource[record.source]++;
        totalProspectsImported += record.imported;
        totalMerged += record.merged;
        totalSkipped += record.skipped;
        totalFailed += record.failed;
      } else if (record.status === 'undone') {
        undoneCount++;
      }
    }

    return {
      totalImports: this.state.records.filter((r) => r.status === 'completed').length,
      totalProspectsImported,
      totalMerged,
      totalSkipped,
      totalFailed,
      bySource,
      undoneCount,
    };
  }

  /**
   * Clear all import history
   */
  clearHistory(): void {
    this.state = { records: [], lastImportId: null };
    this.saveToStorage();
  }

  /**
   * Delete a specific import record
   */
  deleteRecord(importId: string): boolean {
    const index = this.state.records.findIndex((r) => r.id === importId);
    if (index === -1) return false;

    this.state.records.splice(index, 1);
    
    if (this.state.lastImportId === importId) {
      this.state.lastImportId = this.state.records[0]?.id || null;
    }

    this.saveToStorage();
    return true;
  }

  /**
   * Export history as JSON
   */
  exportHistory(): string {
    return JSON.stringify(this.state.records, null, 2);
  }

  /**
   * Get remaining undo time for an import
   */
  getUndoTimeRemaining(importId: string): number {
    const record = this.state.records.find((r) => r.id === importId);
    if (!record || record.status !== 'completed') return 0;

    const age = Date.now() - record.timestamp;
    const remaining = this.config.undoWindow - age;
    return Math.max(0, remaining);
  }

  /**
   * Format undo time remaining as human readable string
   */
  formatUndoTimeRemaining(importId: string): string {
    const remaining = this.getUndoTimeRemaining(importId);
    if (remaining === 0) return 'Expired';

    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  }
}

// ============================================
// Singleton Instance
// ============================================

let serviceInstance: ImportHistoryService | null = null;

/**
 * Get the singleton import history service
 */
export function getImportHistoryService(config?: Partial<ImportHistoryConfig>): ImportHistoryService {
  if (!serviceInstance) {
    serviceInstance = new ImportHistoryService(config);
  }
  return serviceInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetImportHistoryService(): void {
  serviceInstance = null;
}
