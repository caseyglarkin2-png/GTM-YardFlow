/**
 * BulkActionService - YardFlow Hub
 * 
 * Handles bulk operations on prospects including tagging, status changes,
 * assignments, and other batch modifications.
 */

import type { Prospect } from '../types';

// ============================================
// Types
// ============================================

/**
 * Bulk action type
 */
export type BulkActionType = 
  | 'tag'
  | 'untag'
  | 'status'
  | 'tier'
  | 'assign'
  | 'unassign'
  | 'delete'
  | 'export'
  | 'sequence'
  | 'custom';

/**
 * Bulk action definition
 */
export interface BulkAction {
  type: BulkActionType;
  label: string;
  icon?: string;
  description?: string;
  /** Minimum selection required */
  minSelection?: number;
  /** Maximum selection allowed */
  maxSelection?: number;
  /** Requires confirmation dialog */
  requiresConfirmation?: boolean;
  /** Confirmation message */
  confirmationMessage?: string;
  /** Whether action is destructive (delete, etc.) */
  isDestructive?: boolean;
  /** Whether action is available */
  enabled?: boolean;
}

/**
 * Bulk action parameters
 */
export interface BulkActionParams {
  type: BulkActionType;
  prospectIds: string[];
  value?: string | string[] | Record<string, unknown>;
}

/**
 * Bulk action result
 */
export interface BulkActionResult {
  success: boolean;
  type: BulkActionType;
  processed: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
  data?: unknown;
}

/**
 * Action handler function
 */
export type BulkActionHandler = (
  prospectIds: string[],
  value?: unknown
) => Promise<BulkActionResult>;

/**
 * Bulk action progress
 */
export interface BulkActionProgress {
  total: number;
  completed: number;
  current?: string;
  percentage: number;
}

/**
 * Progress callback
 */
export type ProgressCallback = (progress: BulkActionProgress) => void;

// ============================================
// Default Actions
// ============================================

const defaultActions: BulkAction[] = [
  {
    type: 'tag',
    label: 'Add Tags',
    icon: '🏷️',
    description: 'Add tags to selected prospects',
    minSelection: 1,
  },
  {
    type: 'untag',
    label: 'Remove Tags',
    icon: '✂️',
    description: 'Remove tags from selected prospects',
    minSelection: 1,
  },
  {
    type: 'status',
    label: 'Change Status',
    icon: '📊',
    description: 'Update status for selected prospects',
    minSelection: 1,
  },
  {
    type: 'tier',
    label: 'Change Tier',
    icon: '⭐',
    description: 'Update tier for selected prospects',
    minSelection: 1,
  },
  {
    type: 'assign',
    label: 'Assign To',
    icon: '👤',
    description: 'Assign prospects to a team member',
    minSelection: 1,
  },
  {
    type: 'sequence',
    label: 'Add to Sequence',
    icon: '📧',
    description: 'Add prospects to an email sequence',
    minSelection: 1,
  },
  {
    type: 'export',
    label: 'Export',
    icon: '📥',
    description: 'Export selected prospects',
    minSelection: 1,
  },
  {
    type: 'delete',
    label: 'Delete',
    icon: '🗑️',
    description: 'Delete selected prospects',
    minSelection: 1,
    requiresConfirmation: true,
    confirmationMessage: 'Are you sure you want to delete the selected prospects? This action cannot be undone.',
    isDestructive: true,
  },
];

// ============================================
// BulkActionService
// ============================================

export class BulkActionService {
  private actions: Map<BulkActionType, BulkAction> = new Map();
  private handlers: Map<BulkActionType, BulkActionHandler> = new Map();
  private actionHistory: BulkActionResult[] = [];

  constructor() {
    // Register default actions
    for (const action of defaultActions) {
      this.registerAction(action);
    }
  }

  /**
   * Register a bulk action
   */
  registerAction(action: BulkAction): void {
    this.actions.set(action.type, action);
  }

  /**
   * Register a handler for an action type
   */
  registerHandler(type: BulkActionType, handler: BulkActionHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Get all available actions
   */
  getActions(): BulkAction[] {
    return Array.from(this.actions.values());
  }

  /**
   * Get available actions for current selection
   */
  getAvailableActions(selectedCount: number): BulkAction[] {
    return this.getActions().filter(action => {
      if (action.enabled === false) return false;
      if (action.minSelection && selectedCount < action.minSelection) return false;
      if (action.maxSelection && selectedCount > action.maxSelection) return false;
      return true;
    });
  }

  /**
   * Get a specific action
   */
  getAction(type: BulkActionType): BulkAction | undefined {
    return this.actions.get(type);
  }

  /**
   * Execute a bulk action
   */
  async execute(
    params: BulkActionParams,
    onProgress?: ProgressCallback
  ): Promise<BulkActionResult> {
    const { type, prospectIds, value } = params;

    if (prospectIds.length === 0) {
      return {
        success: false,
        type,
        processed: 0,
        failed: 0,
        errors: [{ id: '', error: 'No prospects selected' }],
      };
    }

    const handler = this.handlers.get(type);
    if (!handler) {
      return {
        success: false,
        type,
        processed: 0,
        failed: 0,
        errors: [{ id: '', error: `No handler registered for action: ${type}` }],
      };
    }

    try {
      // Report initial progress
      onProgress?.({
        total: prospectIds.length,
        completed: 0,
        percentage: 0,
      });

      const result = await handler(prospectIds, value);

      // Report completion
      onProgress?.({
        total: prospectIds.length,
        completed: result.processed,
        percentage: 100,
      });

      // Store in history
      this.actionHistory.push(result);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        type,
        processed: 0,
        failed: prospectIds.length,
        errors: [{ id: '', error: errorMessage }],
      };
    }
  }

  /**
   * Execute action with batching for large selections
   */
  async executeBatched(
    params: BulkActionParams,
    batchSize: number = 50,
    onProgress?: ProgressCallback
  ): Promise<BulkActionResult> {
    const { type, prospectIds, value } = params;
    const handler = this.handlers.get(type);

    if (!handler) {
      return {
        success: false,
        type,
        processed: 0,
        failed: 0,
        errors: [{ id: '', error: `No handler registered for action: ${type}` }],
      };
    }

    const total = prospectIds.length;
    let processed = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Process in batches
    for (let i = 0; i < total; i += batchSize) {
      const batch = prospectIds.slice(i, i + batchSize);

      try {
        const result = await handler(batch, value);
        processed += result.processed;
        failed += result.failed;
        if (result.errors) {
          errors.push(...result.errors);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failed += batch.length;
        for (const id of batch) {
          errors.push({ id, error: errorMessage });
        }
      }

      // Report progress
      onProgress?.({
        total,
        completed: processed + failed,
        percentage: Math.round(((processed + failed) / total) * 100),
      });
    }

    const result: BulkActionResult = {
      success: failed === 0,
      type,
      processed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };

    this.actionHistory.push(result);
    return result;
  }

  /**
   * Get action history
   */
  getHistory(): BulkActionResult[] {
    return [...this.actionHistory];
  }

  /**
   * Clear action history
   */
  clearHistory(): void {
    this.actionHistory = [];
  }

  /**
   * Create default handlers for common operations
   */
  static createDefaultHandlers(
    updateProspect: (id: string, updates: Partial<Prospect>) => Promise<void>,
    deleteProspect: (id: string) => Promise<void>
  ): Map<BulkActionType, BulkActionHandler> {
    const handlers = new Map<BulkActionType, BulkActionHandler>();

    // Tag handler
    handlers.set('tag', async (ids, value) => {
      const tags = value as string[];
      let processed = 0;
      const errors: Array<{ id: string; error: string }> = [];

      for (const id of ids) {
        try {
          await updateProspect(id, {
            tags: tags,
          });
          processed++;
        } catch (e) {
          errors.push({ id, error: e instanceof Error ? e.message : 'Failed to add tags' });
        }
      }

      return {
        success: errors.length === 0,
        type: 'tag',
        processed,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    });

    // Status handler
    handlers.set('status', async (ids, value) => {
      const status = value as Prospect['status'];
      let processed = 0;
      const errors: Array<{ id: string; error: string }> = [];

      for (const id of ids) {
        try {
          await updateProspect(id, { status });
          processed++;
        } catch (e) {
          errors.push({ id, error: e instanceof Error ? e.message : 'Failed to update status' });
        }
      }

      return {
        success: errors.length === 0,
        type: 'status',
        processed,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    });

    // Tier handler
    handlers.set('tier', async (ids, value) => {
      const tier = value as string;
      let processed = 0;
      const errors: Array<{ id: string; error: string }> = [];

      for (const id of ids) {
        try {
          await updateProspect(id, { tier });
          processed++;
        } catch (e) {
          errors.push({ id, error: e instanceof Error ? e.message : 'Failed to update tier' });
        }
      }

      return {
        success: errors.length === 0,
        type: 'tier',
        processed,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    });

    // Delete handler
    handlers.set('delete', async (ids) => {
      let processed = 0;
      const errors: Array<{ id: string; error: string }> = [];

      for (const id of ids) {
        try {
          await deleteProspect(id);
          processed++;
        } catch (e) {
          errors.push({ id, error: e instanceof Error ? e.message : 'Failed to delete' });
        }
      }

      return {
        success: errors.length === 0,
        type: 'delete',
        processed,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    });

    return handlers;
  }
}

// ============================================
// Singleton
// ============================================

let bulkActionInstance: BulkActionService | null = null;

export function getBulkActionService(): BulkActionService {
  if (!bulkActionInstance) {
    bulkActionInstance = new BulkActionService();
  }
  return bulkActionInstance;
}

export function resetBulkActionService(): void {
  bulkActionInstance = null;
}
