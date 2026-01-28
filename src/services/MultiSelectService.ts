/**
 * MultiSelectService - YardFlow Hub
 * 
 * Manages selection state for bulk operations across prospects.
 * Supports single/multi-select, range selection, and select all.
 */

// ============================================
// Types
// ============================================

/**
 * Selection mode
 */
export type SelectionMode = 'single' | 'multi' | 'range';

/**
 * Selection state
 */
export interface SelectionState<T = string> {
  /** Set of selected item IDs */
  selectedIds: Set<T>;
  /** Last selected item ID (for range selection) */
  lastSelectedId: T | null;
  /** Anchor point for range selection */
  anchorId: T | null;
  /** Whether all items are selected */
  isAllSelected: boolean;
  /** Total count of available items */
  totalCount: number;
}

/**
 * Selection event
 */
export interface SelectionEvent<T = string> {
  type: 'select' | 'deselect' | 'toggle' | 'range' | 'all' | 'none' | 'invert';
  ids: T[];
  modifiers?: {
    shift?: boolean;
    ctrl?: boolean;
    meta?: boolean;
  };
}

/**
 * Selection change callback
 */
export type SelectionChangeCallback<T = string> = (
  selection: SelectionState<T>,
  event: SelectionEvent<T>
) => void;

/**
 * Selection configuration
 */
export interface MultiSelectConfig {
  /** Maximum number of items that can be selected */
  maxSelection?: number;
  /** Whether to allow empty selection */
  allowEmpty?: boolean;
  /** Initial selection IDs */
  initialSelection?: string[];
}

// ============================================
// MultiSelectService
// ============================================

/**
 * Service for managing multi-selection state
 */
export class MultiSelectService<T = string> {
  private state: SelectionState<T>;
  private config: MultiSelectConfig;
  private itemOrder: T[] = [];
  private listeners: Set<SelectionChangeCallback<T>> = new Set();

  constructor(config: Partial<MultiSelectConfig> = {}) {
    this.config = {
      allowEmpty: true,
      ...config,
    };

    this.state = {
      selectedIds: new Set(config.initialSelection as T[] || []),
      lastSelectedId: null,
      anchorId: null,
      isAllSelected: false,
      totalCount: 0,
    };
  }

  /**
   * Set the ordered list of items (for range selection)
   */
  setItems(items: T[]): void {
    this.itemOrder = [...items];
    this.state.totalCount = items.length;
    
    // Update isAllSelected
    this.updateAllSelectedState();
    
    // Remove any selected items that are no longer in the list
    const validIds = new Set(items);
    for (const id of this.state.selectedIds) {
      if (!validIds.has(id)) {
        this.state.selectedIds.delete(id);
      }
    }
  }

  /**
   * Get current selection state
   */
  getState(): SelectionState<T> {
    return {
      ...this.state,
      selectedIds: new Set(this.state.selectedIds),
    };
  }

  /**
   * Get array of selected IDs
   */
  getSelectedIds(): T[] {
    return Array.from(this.state.selectedIds);
  }

  /**
   * Get count of selected items
   */
  getSelectedCount(): number {
    return this.state.selectedIds.size;
  }

  /**
   * Check if an item is selected
   */
  isSelected(id: T): boolean {
    return this.state.selectedIds.has(id);
  }

  /**
   * Select a single item
   */
  select(id: T, options?: { extend?: boolean; range?: boolean }): void {
    const event: SelectionEvent<T> = {
      type: 'select',
      ids: [id],
      modifiers: { shift: options?.range, ctrl: options?.extend },
    };

    if (options?.range && this.state.anchorId !== null) {
      // Range selection from anchor to id
      this.selectRange(this.state.anchorId, id);
      return;
    }

    if (options?.extend) {
      // Add to existing selection
      this.state.selectedIds.add(id);
    } else {
      // Replace selection
      this.state.selectedIds.clear();
      this.state.selectedIds.add(id);
    }

    this.state.lastSelectedId = id;
    this.state.anchorId = id;
    this.updateAllSelectedState();
    this.notifyListeners(event);
  }

  /**
   * Deselect a single item
   */
  deselect(id: T): void {
    if (!this.config.allowEmpty && this.state.selectedIds.size === 1) {
      return; // Cannot deselect last item if empty not allowed
    }

    const event: SelectionEvent<T> = {
      type: 'deselect',
      ids: [id],
    };

    this.state.selectedIds.delete(id);
    this.state.isAllSelected = false;
    this.notifyListeners(event);
  }

  /**
   * Toggle selection of a single item
   */
  toggle(id: T, options?: { extend?: boolean }): void {
    const event: SelectionEvent<T> = {
      type: 'toggle',
      ids: [id],
      modifiers: { ctrl: options?.extend },
    };

    if (this.state.selectedIds.has(id)) {
      if (!this.config.allowEmpty && this.state.selectedIds.size === 1) {
        return;
      }
      this.state.selectedIds.delete(id);
    } else {
      if (options?.extend) {
        this.state.selectedIds.add(id);
      } else {
        this.state.selectedIds.clear();
        this.state.selectedIds.add(id);
      }
    }

    this.state.lastSelectedId = id;
    this.state.anchorId = id;
    this.updateAllSelectedState();
    this.notifyListeners(event);
  }

  /**
   * Select a range of items between two IDs
   */
  selectRange(fromId: T, toId: T): void {
    const fromIndex = this.itemOrder.indexOf(fromId);
    const toIndex = this.itemOrder.indexOf(toId);

    if (fromIndex === -1 || toIndex === -1) return;

    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);

    const rangeIds = this.itemOrder.slice(startIndex, endIndex + 1);

    const event: SelectionEvent<T> = {
      type: 'range',
      ids: rangeIds,
      modifiers: { shift: true },
    };

    // Clear existing selection and select the range
    this.state.selectedIds.clear();
    for (const id of rangeIds) {
      this.state.selectedIds.add(id);
    }

    this.state.lastSelectedId = toId;
    this.updateAllSelectedState();
    this.notifyListeners(event);
  }

  /**
   * Extend range selection from anchor
   */
  extendRange(toId: T): void {
    if (this.state.anchorId === null) {
      this.select(toId);
      return;
    }
    this.selectRange(this.state.anchorId, toId);
  }

  /**
   * Select all items
   */
  selectAll(): void {
    const event: SelectionEvent<T> = {
      type: 'all',
      ids: [...this.itemOrder],
    };

    if (this.config.maxSelection && this.itemOrder.length > this.config.maxSelection) {
      // Select up to max
      for (let i = 0; i < this.config.maxSelection; i++) {
        this.state.selectedIds.add(this.itemOrder[i]);
      }
    } else {
      this.state.selectedIds = new Set(this.itemOrder);
    }

    this.state.isAllSelected = this.state.selectedIds.size === this.itemOrder.length;
    this.notifyListeners(event);
  }

  /**
   * Deselect all items
   */
  deselectAll(): void {
    if (!this.config.allowEmpty && this.state.selectedIds.size > 0) {
      return;
    }

    const event: SelectionEvent<T> = {
      type: 'none',
      ids: [],
    };

    this.state.selectedIds.clear();
    this.state.lastSelectedId = null;
    this.state.anchorId = null;
    this.state.isAllSelected = false;
    this.notifyListeners(event);
  }

  /**
   * Toggle select all / none
   */
  toggleAll(): void {
    if (this.state.isAllSelected || this.state.selectedIds.size === this.itemOrder.length) {
      this.deselectAll();
    } else {
      this.selectAll();
    }
  }

  /**
   * Invert selection
   */
  invertSelection(): void {
    const event: SelectionEvent<T> = {
      type: 'invert',
      ids: this.itemOrder.filter(id => !this.state.selectedIds.has(id)),
    };

    const newSelection = new Set<T>();
    for (const id of this.itemOrder) {
      if (!this.state.selectedIds.has(id)) {
        newSelection.add(id);
      }
    }

    if (!this.config.allowEmpty && newSelection.size === 0) {
      return;
    }

    this.state.selectedIds = newSelection;
    this.updateAllSelectedState();
    this.notifyListeners(event);
  }

  /**
   * Select specific IDs
   */
  setSelection(ids: T[]): void {
    const event: SelectionEvent<T> = {
      type: 'select',
      ids,
    };

    this.state.selectedIds = new Set(ids);
    this.state.anchorId = ids.length > 0 ? ids[0] : null;
    this.state.lastSelectedId = ids.length > 0 ? ids[ids.length - 1] : null;
    this.updateAllSelectedState();
    this.notifyListeners(event);
  }

  /**
   * Handle keyboard selection
   */
  handleKeyboardSelect(event: KeyboardEvent, currentId: T): void {
    if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.selectAll();
    } else if (event.key === ' ') {
      event.preventDefault();
      this.toggle(currentId, { extend: event.ctrlKey || event.metaKey });
    } else if (event.key === 'Escape') {
      this.deselectAll();
    }
  }

  /**
   * Handle click selection with modifiers
   */
  handleClick(id: T, event: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }): void {
    if (event.shiftKey && this.state.anchorId !== null) {
      this.selectRange(this.state.anchorId, id);
    } else if (event.ctrlKey || event.metaKey) {
      this.toggle(id, { extend: true });
    } else {
      this.select(id);
    }
  }

  /**
   * Subscribe to selection changes
   */
  subscribe(callback: SelectionChangeCallback<T>): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Update isAllSelected state
   */
  private updateAllSelectedState(): void {
    this.state.isAllSelected = 
      this.itemOrder.length > 0 && 
      this.state.selectedIds.size === this.itemOrder.length;
  }

  /**
   * Notify all listeners of selection change
   */
  private notifyListeners(event: SelectionEvent<T>): void {
    const state = this.getState();
    for (const callback of this.listeners) {
      callback(state, event);
    }
  }

  /**
   * Reset service state
   */
  reset(): void {
    this.state = {
      selectedIds: new Set(),
      lastSelectedId: null,
      anchorId: null,
      isAllSelected: false,
      totalCount: 0,
    };
    this.itemOrder = [];
    this.listeners.clear();
  }
}

// ============================================
// React Hook
// ============================================

import { useState, useCallback, useMemo, useEffect } from 'react';

/**
 * Hook for multi-selection management
 */
export function useMultiSelect<T = string>(
  items: T[],
  config?: Partial<MultiSelectConfig>
) {
  const service = useMemo(() => new MultiSelectService<T>(config), []);
  const [state, setState] = useState<SelectionState<T>>(service.getState());

  // Update items when they change
  useEffect(() => {
    service.setItems(items);
    setState(service.getState());
  }, [items, service]);

  // Subscribe to changes
  useEffect(() => {
    return service.subscribe((newState) => {
      setState(newState);
    });
  }, [service]);

  const select = useCallback((id: T, options?: { extend?: boolean; range?: boolean }) => {
    service.select(id, options);
  }, [service]);

  const deselect = useCallback((id: T) => {
    service.deselect(id);
  }, [service]);

  const toggle = useCallback((id: T, options?: { extend?: boolean }) => {
    service.toggle(id, options);
  }, [service]);

  const selectAll = useCallback(() => {
    service.selectAll();
  }, [service]);

  const deselectAll = useCallback(() => {
    service.deselectAll();
  }, [service]);

  const toggleAll = useCallback(() => {
    service.toggleAll();
  }, [service]);

  const invertSelection = useCallback(() => {
    service.invertSelection();
  }, [service]);

  const setSelection = useCallback((ids: T[]) => {
    service.setSelection(ids);
  }, [service]);

  const handleClick = useCallback((id: T, event: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => {
    service.handleClick(id, event);
  }, [service]);

  const isSelected = useCallback((id: T) => {
    return state.selectedIds.has(id);
  }, [state.selectedIds]);

  return {
    // State
    selectedIds: state.selectedIds,
    selectedCount: state.selectedIds.size,
    isAllSelected: state.isAllSelected,
    hasSelection: state.selectedIds.size > 0,
    
    // Actions
    select,
    deselect,
    toggle,
    selectAll,
    deselectAll,
    toggleAll,
    invertSelection,
    setSelection,
    handleClick,
    
    // Helpers
    isSelected,
    getSelectedIds: () => Array.from(state.selectedIds),
  };
}

// ============================================
// Singleton
// ============================================

let multiSelectInstance: MultiSelectService | null = null;

export function getMultiSelectService(config?: Partial<MultiSelectConfig>): MultiSelectService {
  if (!multiSelectInstance) {
    multiSelectInstance = new MultiSelectService(config);
  }
  return multiSelectInstance;
}

export function resetMultiSelectService(): void {
  if (multiSelectInstance) {
    multiSelectInstance.reset();
    multiSelectInstance = null;
  }
}
