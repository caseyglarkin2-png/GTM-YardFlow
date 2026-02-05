/**
 * useColumnPreferences Hook
 * 
 * Manages column visibility preferences with localStorage persistence.
 * Sprint 36E: T36E.1 - Column customization
 */

import { useState, useCallback, useMemo } from 'react';

export interface ColumnConfig {
  /** Unique column identifier */
  id: string;
  /** Display label */
  label: string;
  /** Whether visible by default */
  defaultVisible: boolean;
  /** Column cannot be hidden */
  required?: boolean;
}

/**
 * Default column configuration for the Company HitList
 * Sprint S36F: Added dataQuality column (hidden by default)
 */
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'company', label: 'Company', defaultVisible: true, required: true },
  { id: 'tier', label: 'Tier', defaultVisible: true },
  { id: 'contacts', label: 'Contacts', defaultVisible: true },
  { id: 'facilities', label: 'Facilities', defaultVisible: true },
  { id: 'gate', label: 'Gate Issue', defaultVisible: true },
  { id: 'roi', label: 'ROI Potential', defaultVisible: true },
  { id: 'score', label: 'Score', defaultVisible: true },
  { id: 'dataQuality', label: 'Data Quality', defaultVisible: false },
];

const STORAGE_KEY = 'company-list-columns';

export interface UseColumnPreferencesReturn {
  /** All available columns */
  columns: ColumnConfig[];
  /** Currently visible column IDs */
  visibleColumns: Set<string>;
  /** Toggle column visibility */
  toggleColumn: (columnId: string) => void;
  /** Check if column is visible */
  isVisible: (columnId: string) => boolean;
  /** Reset to default visibility */
  resetToDefaults: () => void;
  /** Number of visible columns */
  visibleCount: number;
}

/**
 * Hook to manage column visibility preferences with persistence
 */
export function useColumnPreferences(
  customColumns?: ColumnConfig[]
): UseColumnPreferencesReturn {
  const columns = customColumns || DEFAULT_COLUMNS;
  
  // Initialize from localStorage or defaults
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') {
      return new Set(columns.filter(c => c.defaultVisible).map(c => c.id));
    }
    
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Ensure required columns are always included
          const requiredIds = columns.filter(c => c.required).map(c => c.id);
          const validIds = parsed.filter((id: string) => 
            columns.some(c => c.id === id)
          );
          return new Set([...requiredIds, ...validIds]);
        }
      } catch {
        // Fall through to defaults
      }
    }
    return new Set(columns.filter(c => c.defaultVisible).map(c => c.id));
  });

  // Toggle column visibility
  const toggleColumn = useCallback((columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    
    // Don't allow hiding required columns
    if (column?.required) return;
    
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      }
      
      return next;
    });
  }, [columns]);

  // Check if a column is visible
  const isVisible = useCallback((columnId: string) => {
    return visibleColumns.has(columnId);
  }, [visibleColumns]);

  // Reset to default visibility
  const resetToDefaults = useCallback(() => {
    const defaults = new Set(columns.filter(c => c.defaultVisible).map(c => c.id));
    setVisibleColumns(defaults);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...defaults]));
    }
  }, [columns]);

  // Count of visible columns
  const visibleCount = useMemo(() => visibleColumns.size, [visibleColumns]);

  return {
    columns,
    visibleColumns,
    toggleColumn,
    isVisible,
    resetToDefaults,
    visibleCount,
  };
}

export default useColumnPreferences;
