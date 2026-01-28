/**
 * BulkDeleteService - YardFlow Hub
 * 
 * Handles soft delete with recovery option, trash bin functionality,
 * and confirmation workflow for bulk prospect deletion.
 */

import type { Prospect } from '../types';

// ============================================
// Types
// ============================================

/**
 * Deleted item in trash
 */
export interface DeletedItem {
  id: string;
  prospect: Prospect;
  deletedAt: Date;
  deletedBy?: string;
  expiresAt: Date;
}

/**
 * Delete options
 */
export interface DeleteOptions {
  /** Soft delete (move to trash) vs hard delete */
  soft?: boolean;
  /** Custom expiration time in days (default: 30) */
  expirationDays?: number;
  /** User performing the deletion */
  deletedBy?: string;
}

/**
 * Delete result
 */
export interface DeleteResult {
  success: boolean;
  deleted: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
}

/**
 * Restore result
 */
export interface RestoreResult {
  success: boolean;
  restored: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
}

/**
 * Trash summary
 */
export interface TrashSummary {
  count: number;
  oldestItem?: Date;
  newestItem?: Date;
  expiringWithin7Days: number;
}

/**
 * Delete handler function
 */
export type DeleteHandler = (id: string) => Promise<void>;

/**
 * Restore handler function
 */
export type RestoreHandler = (prospect: Prospect) => Promise<void>;

// ============================================
// BulkDeleteService
// ============================================

export class BulkDeleteService {
  private trash: Map<string, DeletedItem> = new Map();
  private defaultExpirationDays = 30;
  private deleteHandler?: DeleteHandler;
  private restoreHandler?: RestoreHandler;

  /**
   * Set the delete handler
   */
  setDeleteHandler(handler: DeleteHandler): void {
    this.deleteHandler = handler;
  }

  /**
   * Set the restore handler
   */
  setRestoreHandler(handler: RestoreHandler): void {
    this.restoreHandler = handler;
  }

  /**
   * Soft delete prospects (move to trash)
   */
  async softDelete(
    prospects: Prospect[],
    options: DeleteOptions = {}
  ): Promise<DeleteResult> {
    const expirationDays = options.expirationDays ?? this.defaultExpirationDays;
    let deleted = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const prospect of prospects) {
      try {
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + expirationDays);

        const deletedItem: DeletedItem = {
          id: prospect.id,
          prospect,
          deletedAt: now,
          deletedBy: options.deletedBy,
          expiresAt,
        };

        this.trash.set(prospect.id, deletedItem);

        // Call external delete handler if provided
        if (this.deleteHandler) {
          await this.deleteHandler(prospect.id);
        }
        
        deleted++;
      } catch (e) {
        errors.push({
          id: prospect.id,
          error: e instanceof Error ? e.message : 'Delete failed',
        });
      }
    }

    return {
      success: errors.length === 0,
      deleted,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Hard delete prospects (permanent, bypass trash)
   */
  async hardDelete(prospects: Prospect[]): Promise<DeleteResult> {
    if (!this.deleteHandler) {
      return {
        success: false,
        deleted: 0,
        failed: prospects.length,
        errors: [{ id: '', error: 'No delete handler configured' }],
      };
    }

    let deleted = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const prospect of prospects) {
      try {
        await this.deleteHandler(prospect.id);
        deleted++;
      } catch (e) {
        errors.push({
          id: prospect.id,
          error: e instanceof Error ? e.message : 'Delete failed',
        });
      }
    }

    return {
      success: errors.length === 0,
      deleted,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Delete with options (soft or hard)
   */
  async delete(
    prospects: Prospect[],
    options: DeleteOptions = {}
  ): Promise<DeleteResult> {
    if (options.soft === false) {
      return this.hardDelete(prospects);
    }
    return this.softDelete(prospects, options);
  }

  /**
   * Get all items in trash
   */
  getTrash(): DeletedItem[] {
    return Array.from(this.trash.values()).sort(
      (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime()
    );
  }

  /**
   * Get item from trash by ID
   */
  getTrashItem(id: string): DeletedItem | undefined {
    return this.trash.get(id);
  }

  /**
   * Get trash summary
   */
  getTrashSummary(): TrashSummary {
    const items = this.getTrash();
    const now = new Date();
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);

    return {
      count: items.length,
      oldestItem: items.length > 0 ? items[items.length - 1].deletedAt : undefined,
      newestItem: items.length > 0 ? items[0].deletedAt : undefined,
      expiringWithin7Days: items.filter(item => item.expiresAt <= in7Days).length,
    };
  }

  /**
   * Restore items from trash
   */
  async restore(ids: string[]): Promise<RestoreResult> {
    let restored = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const id of ids) {
      const item = this.trash.get(id);
      if (!item) {
        errors.push({ id, error: 'Item not found in trash' });
        continue;
      }

      try {
        // Call external restore handler if provided
        if (this.restoreHandler) {
          await this.restoreHandler(item.prospect);
        }

        this.trash.delete(id);
        restored++;
      } catch (e) {
        errors.push({
          id,
          error: e instanceof Error ? e.message : 'Restore failed',
        });
      }
    }

    return {
      success: errors.length === 0,
      restored,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Restore all items from trash
   */
  async restoreAll(): Promise<RestoreResult> {
    const ids = Array.from(this.trash.keys());
    return this.restore(ids);
  }

  /**
   * Empty trash (permanently delete all items)
   */
  async emptyTrash(): Promise<DeleteResult> {
    const items = this.getTrash();
    let deleted = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const item of items) {
      try {
        // If we have a handler and the item wasn't already permanently deleted
        // This ensures cleanup
        this.trash.delete(item.id);
        deleted++;
      } catch (e) {
        errors.push({
          id: item.id,
          error: e instanceof Error ? e.message : 'Empty trash failed',
        });
      }
    }

    return {
      success: errors.length === 0,
      deleted,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Remove single item from trash permanently
   */
  async removeFromTrash(id: string): Promise<DeleteResult> {
    const item = this.trash.get(id);
    if (!item) {
      return {
        success: false,
        deleted: 0,
        failed: 1,
        errors: [{ id, error: 'Item not found in trash' }],
      };
    }

    this.trash.delete(id);
    return {
      success: true,
      deleted: 1,
      failed: 0,
    };
  }

  /**
   * Clean up expired items from trash
   */
  async cleanupExpired(): Promise<DeleteResult> {
    const now = new Date();
    const expired = this.getTrash().filter(item => item.expiresAt <= now);
    let deleted = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const item of expired) {
      try {
        this.trash.delete(item.id);
        deleted++;
      } catch (e) {
        errors.push({
          id: item.id,
          error: e instanceof Error ? e.message : 'Cleanup failed',
        });
      }
    }

    return {
      success: errors.length === 0,
      deleted,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get items expiring soon
   */
  getExpiringItems(withinDays: number = 7): DeletedItem[] {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + withinDays);

    return this.getTrash().filter(item => item.expiresAt <= threshold);
  }

  /**
   * Extend expiration for items
   */
  extendExpiration(ids: string[], additionalDays: number): number {
    let extended = 0;

    for (const id of ids) {
      const item = this.trash.get(id);
      if (item) {
        const newExpiry = new Date(item.expiresAt);
        newExpiry.setDate(newExpiry.getDate() + additionalDays);
        item.expiresAt = newExpiry;
        extended++;
      }
    }

    return extended;
  }

  /**
   * Search trash
   */
  searchTrash(query: string): DeletedItem[] {
    const lowerQuery = query.toLowerCase();
    return this.getTrash().filter(item => {
      const prospect = item.prospect;
      return (
        prospect.name?.toLowerCase().includes(lowerQuery) ||
        prospect.email?.toLowerCase().includes(lowerQuery) ||
        prospect.company?.toLowerCase().includes(lowerQuery)
      );
    });
  }

  /**
   * Clear trash (for testing)
   */
  clearTrash(): void {
    this.trash.clear();
  }

  /**
   * Get confirmation message for bulk delete
   */
  getConfirmationMessage(count: number, soft: boolean = true): string {
    if (soft) {
      return `Are you sure you want to move ${count} prospect${
        count > 1 ? 's' : ''
      } to trash? You can restore them within ${this.defaultExpirationDays} days.`;
    }
    return `Are you sure you want to permanently delete ${count} prospect${
      count > 1 ? 's' : ''
    }? This action cannot be undone.`;
  }

  /**
   * Check if item can be restored
   */
  canRestore(id: string): boolean {
    const item = this.trash.get(id);
    if (!item) return false;
    return item.expiresAt > new Date();
  }
}

// ============================================
// Singleton
// ============================================

let deleteServiceInstance: BulkDeleteService | null = null;

export function getBulkDeleteService(): BulkDeleteService {
  if (!deleteServiceInstance) {
    deleteServiceInstance = new BulkDeleteService();
  }
  return deleteServiceInstance;
}

export function resetBulkDeleteService(): void {
  deleteServiceInstance = null;
}
