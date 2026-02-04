/**
 * useSavedFilters Hook - Sprint V34
 * 
 * Simple hook for saving and loading filter presets
 * Uses localStorage for persistence
 */

import { useState, useCallback, useEffect } from 'react';

export interface SavedFilterPreset {
  id: string;
  name: string;
  tierFilter: string;
  emailFilter: string;
  tagFilter: string | null;
  searchQuery: string;
  createdAt: number;
}

const STORAGE_KEY = 'yardflow_filter_presets';
const MAX_PRESETS = 10;

export interface UseSavedFiltersReturn {
  /** List of saved filter presets */
  presets: SavedFilterPreset[];
  /** Save current filters as a preset */
  savePreset: (name: string, filters: Omit<SavedFilterPreset, 'id' | 'name' | 'createdAt'>) => void;
  /** Delete a preset */
  deletePreset: (id: string) => void;
  /** Load a preset's filters */
  loadPreset: (id: string) => SavedFilterPreset | null;
}

export function useSavedFilters(): UseSavedFiltersReturn {
  const [presets, setPresets] = useState<SavedFilterPreset[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SavedFilterPreset[];
        setPresets(parsed);
      }
    } catch (e) {
      console.warn('[useSavedFilters] Failed to load presets:', e);
    }
  }, []);

  // Persist to localStorage
  const persist = useCallback((newPresets: SavedFilterPreset[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets));
    } catch (e) {
      console.warn('[useSavedFilters] Failed to persist presets:', e);
    }
  }, []);

  const savePreset = useCallback((name: string, filters: Omit<SavedFilterPreset, 'id' | 'name' | 'createdAt'>) => {
    const newPreset: SavedFilterPreset = {
      id: `preset-${Date.now()}`,
      name,
      ...filters,
      createdAt: Date.now(),
    };

    setPresets(prev => {
      // Remove oldest if at max
      const updated = prev.length >= MAX_PRESETS 
        ? [...prev.slice(1), newPreset]
        : [...prev, newPreset];
      persist(updated);
      return updated;
    });
  }, [persist]);

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => {
      const updated = prev.filter(p => p.id !== id);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const loadPreset = useCallback((id: string): SavedFilterPreset | null => {
    return presets.find(p => p.id === id) || null;
  }, [presets]);

  return {
    presets,
    savePreset,
    deletePreset,
    loadPreset,
  };
}
