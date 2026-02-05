/**
 * useSortableTable Hook
 * 
 * Reusable hook for managing sortable table state with persistence.
 * Sprint 36B: T36B.1 - Sortable columns hook
 */

import { useState, useCallback, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState<T extends string> {
  column: T;
  direction: SortDirection;
}

export interface UseSortableTableOptions<T extends string> {
  /** Default column to sort by */
  defaultColumn: T;
  /** Default sort direction */
  defaultDirection?: SortDirection;
  /** localStorage key for persistence (optional) */
  persistKey?: string;
}

export interface UseSortableTableReturn<T extends string> {
  /** Current sort state */
  sortState: SortState<T>;
  /** Toggle sort on a column (click handler) */
  toggleSort: (column: T) => void;
  /** Set sort explicitly */
  setSort: (column: T, direction: SortDirection) => void;
  /** Reset to default sort */
  resetSort: () => void;
  /** Get sort indicator for a column ('asc' | 'desc' | null) */
  getSortIndicator: (column: T) => SortDirection | null;
}

/**
 * Hook for managing sortable table state
 */
export function useSortableTable<T extends string>({
  defaultColumn,
  defaultDirection = 'desc',
  persistKey,
}: UseSortableTableOptions<T>): UseSortableTableReturn<T> {
  
  // Initialize from localStorage if available
  const getInitialState = (): SortState<T> => {
    if (persistKey && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(persistKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.column && parsed.direction) {
            return parsed as SortState<T>;
          }
        }
      } catch {
        // Ignore localStorage errors
      }
    }
    return { column: defaultColumn, direction: defaultDirection };
  };

  const [sortState, setSortState] = useState<SortState<T>>(getInitialState);

  // Persist to localStorage when state changes
  const persistState = useCallback((state: SortState<T>) => {
    if (persistKey && typeof window !== 'undefined') {
      try {
        localStorage.setItem(persistKey, JSON.stringify(state));
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [persistKey]);

  const toggleSort = useCallback((column: T) => {
    setSortState(prev => {
      let newState: SortState<T>;
      
      if (prev.column === column) {
        // Same column - toggle direction
        newState = {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      } else {
        // Different column - default to desc (show highest first)
        newState = { column, direction: 'desc' };
      }
      
      persistState(newState);
      return newState;
    });
  }, [persistState]);

  const setSort = useCallback((column: T, direction: SortDirection) => {
    const newState = { column, direction };
    setSortState(newState);
    persistState(newState);
  }, [persistState]);

  const resetSort = useCallback(() => {
    const newState = { column: defaultColumn, direction: defaultDirection };
    setSortState(newState);
    persistState(newState);
  }, [defaultColumn, defaultDirection, persistState]);

  const getSortIndicator = useCallback((column: T): SortDirection | null => {
    return sortState.column === column ? sortState.direction : null;
  }, [sortState]);

  return {
    sortState,
    toggleSort,
    setSort,
    resetSort,
    getSortIndicator,
  };
}

/**
 * Sort an array of items based on sort state
 * 
 * @param items - Array to sort
 * @param sortState - Current sort state
 * @param getters - Object mapping column names to getter functions
 * @returns Sorted array (new array, does not mutate original)
 */
export function sortItems<T, K extends string>(
  items: T[],
  sortState: SortState<K>,
  getters: Record<K, (item: T) => number | string | null | undefined>
): T[] {
  const getter = getters[sortState.column];
  if (!getter) return items;

  return [...items].sort((a, b) => {
    const aVal = getter(a);
    const bVal = getter(b);
    
    // Handle nulls/undefined - always sort to end
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    // Compare values
    let comparison: number;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    // Apply direction
    return sortState.direction === 'asc' ? comparison : -comparison;
  });
}

export default useSortableTable;
