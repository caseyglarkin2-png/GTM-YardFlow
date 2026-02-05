/**
 * Tests for useColumnPreferences Hook
 * 
 * Sprint 36E: T36E.1 - Column preferences hook tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnPreferences, DEFAULT_COLUMNS, type ColumnConfig } from '@/hooks/useColumnPreferences';

describe('useColumnPreferences', () => {
  // Mock localStorage
  const mockLocalStorage: Record<string, string> = {};
  
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => mockLocalStorage[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      mockLocalStorage[key] = value;
    });
    // Clear mock storage
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default visible columns', () => {
    const { result } = renderHook(() => useColumnPreferences());

    // All defaultVisible columns should be visible
    DEFAULT_COLUMNS.filter(c => c.defaultVisible).forEach(col => {
      expect(result.current.isVisible(col.id)).toBe(true);
    });
  });

  it('returns all column configs', () => {
    const { result } = renderHook(() => useColumnPreferences());
    
    expect(result.current.columns).toEqual(DEFAULT_COLUMNS);
  });

  it('toggles column visibility', () => {
    const { result } = renderHook(() => useColumnPreferences());

    // Contacts is visible by default
    expect(result.current.isVisible('contacts')).toBe(true);

    // Toggle it off
    act(() => {
      result.current.toggleColumn('contacts');
    });
    expect(result.current.isVisible('contacts')).toBe(false);

    // Toggle it back on
    act(() => {
      result.current.toggleColumn('contacts');
    });
    expect(result.current.isVisible('contacts')).toBe(true);
  });

  it('does not allow hiding required columns', () => {
    const { result } = renderHook(() => useColumnPreferences());

    // Company is required
    expect(result.current.isVisible('company')).toBe(true);

    // Try to toggle it off
    act(() => {
      result.current.toggleColumn('company');
    });

    // Should still be visible
    expect(result.current.isVisible('company')).toBe(true);
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useColumnPreferences());

    act(() => {
      result.current.toggleColumn('contacts');
    });

    expect(localStorage.setItem).toHaveBeenCalled();
    const saved = JSON.parse(mockLocalStorage['company-list-columns']);
    expect(saved).not.toContain('contacts');
  });

  it('loads from localStorage', () => {
    // Set up localStorage with custom visibility
    mockLocalStorage['company-list-columns'] = JSON.stringify(['company', 'tier']);

    const { result } = renderHook(() => useColumnPreferences());

    expect(result.current.isVisible('company')).toBe(true);
    expect(result.current.isVisible('tier')).toBe(true);
    expect(result.current.isVisible('contacts')).toBe(false);
    expect(result.current.isVisible('facilities')).toBe(false);
  });

  it('ensures required columns from localStorage', () => {
    // Set up localStorage without the required 'company' column
    mockLocalStorage['company-list-columns'] = JSON.stringify(['tier', 'contacts']);

    const { result } = renderHook(() => useColumnPreferences());

    // Company should still be visible (required)
    expect(result.current.isVisible('company')).toBe(true);
    expect(result.current.isVisible('tier')).toBe(true);
    expect(result.current.isVisible('contacts')).toBe(true);
  });

  it('resets to defaults', () => {
    const { result } = renderHook(() => useColumnPreferences());

    // Toggle some columns off
    act(() => {
      result.current.toggleColumn('contacts');
      result.current.toggleColumn('facilities');
    });

    expect(result.current.isVisible('contacts')).toBe(false);
    expect(result.current.isVisible('facilities')).toBe(false);

    // Reset
    act(() => {
      result.current.resetToDefaults();
    });

    // All default visible should be back
    expect(result.current.isVisible('contacts')).toBe(true);
    expect(result.current.isVisible('facilities')).toBe(true);
  });

  it('handles invalid localStorage gracefully', () => {
    mockLocalStorage['company-list-columns'] = 'invalid json';

    const { result } = renderHook(() => useColumnPreferences());

    // Should fall back to defaults
    DEFAULT_COLUMNS.filter(c => c.defaultVisible).forEach(col => {
      expect(result.current.isVisible(col.id)).toBe(true);
    });
  });

  it('reports correct visible count', () => {
    const { result } = renderHook(() => useColumnPreferences());

    const initialCount = DEFAULT_COLUMNS.filter(c => c.defaultVisible).length;
    expect(result.current.visibleCount).toBe(initialCount);

    act(() => {
      result.current.toggleColumn('contacts');
    });

    expect(result.current.visibleCount).toBe(initialCount - 1);
  });

  it('accepts custom columns', () => {
    const customColumns: ColumnConfig[] = [
      { id: 'name', label: 'Name', defaultVisible: true, required: true },
      { id: 'email', label: 'Email', defaultVisible: true },
      { id: 'phone', label: 'Phone', defaultVisible: false },
    ];

    const { result } = renderHook(() => useColumnPreferences(customColumns));

    expect(result.current.columns).toEqual(customColumns);
    expect(result.current.isVisible('name')).toBe(true);
    expect(result.current.isVisible('email')).toBe(true);
    expect(result.current.isVisible('phone')).toBe(false);
  });

  it('filters invalid column IDs from localStorage', () => {
    // Include some invalid IDs
    mockLocalStorage['company-list-columns'] = JSON.stringify([
      'company', 'tier', 'invalid_column', 'another_invalid'
    ]);

    const { result } = renderHook(() => useColumnPreferences());

    // Only valid columns should be visible
    expect(result.current.isVisible('company')).toBe(true);
    expect(result.current.isVisible('tier')).toBe(true);
    // Other defaults should not be visible since they weren't in the saved list
    expect(result.current.isVisible('contacts')).toBe(false);
  });
});
