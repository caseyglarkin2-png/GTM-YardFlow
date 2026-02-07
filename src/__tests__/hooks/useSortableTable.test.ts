/**
 * Tests for useSortableTable Hook
 * 
 * Sprint 36B: T36B.1 - Sortable table hook tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSortableTable, sortItems, type SortState } from '@/hooks/useSortableTable';

describe('useSortableTable', () => {
  // Type for test columns
  type TestColumn = 'name' | 'score';
  
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

  it('initializes with default column and direction', () => {
    const { result } = renderHook(() => 
      useSortableTable<TestColumn>({
        defaultColumn: 'name',
        defaultDirection: 'asc',
      })
    );

    expect(result.current.sortState).toEqual({
      column: 'name',
      direction: 'asc',
    });
  });

  it('defaults to desc direction if not specified', () => {
    const { result } = renderHook(() => 
      useSortableTable<TestColumn>({
        defaultColumn: 'score',
      })
    );

    expect(result.current.sortState.direction).toBe('desc');
  });

  it('toggles sort direction when clicking same column', () => {
    const { result } = renderHook(() => 
      useSortableTable<TestColumn>({
        defaultColumn: 'score',
        defaultDirection: 'desc',
      })
    );

    // Click same column
    act(() => {
      result.current.toggleSort('score');
    });

    expect(result.current.sortState).toEqual({
      column: 'score',
      direction: 'asc',
    });

    // Click again
    act(() => {
      result.current.toggleSort('score');
    });

    expect(result.current.sortState).toEqual({
      column: 'score',
      direction: 'desc',
    });
  });

  it('switches to new column with desc direction', () => {
    const { result } = renderHook(() => 
      useSortableTable<TestColumn>({
        defaultColumn: 'score',
        defaultDirection: 'asc',
      })
    );

    // Click different column
    act(() => {
      result.current.toggleSort('name');
    });

    expect(result.current.sortState).toEqual({
      column: 'name',
      direction: 'desc',
    });
  });

  it('setSort updates both column and direction', () => {
    const { result } = renderHook(() => 
      useSortableTable<TestColumn>({
        defaultColumn: 'score',
      })
    );

    act(() => {
      result.current.setSort('name', 'asc');
    });

    expect(result.current.sortState).toEqual({
      column: 'name',
      direction: 'asc',
    });
  });

  it('resetSort returns to default state', () => {
    const { result } = renderHook(() => 
      useSortableTable<TestColumn>({
        defaultColumn: 'score',
        defaultDirection: 'desc',
      })
    );

    // Change state
    act(() => {
      result.current.setSort('name', 'asc');
    });

    // Reset
    act(() => {
      result.current.resetSort();
    });

    expect(result.current.sortState).toEqual({
      column: 'score',
      direction: 'desc',
    });
  });

  it('getSortIndicator returns direction for active column', () => {
    const { result } = renderHook(() => 
      useSortableTable<TestColumn>({
        defaultColumn: 'score',
        defaultDirection: 'desc',
      })
    );

    expect(result.current.getSortIndicator('score')).toBe('desc');
    expect(result.current.getSortIndicator('name')).toBeNull();
  });

  describe('persistence', () => {
    it('persists state to localStorage when persistKey provided', () => {
      const { result } = renderHook(() => 
        useSortableTable<TestColumn>({
          defaultColumn: 'score',
          persistKey: 'test-sort',
        })
      );

      act(() => {
        result.current.toggleSort('name');
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'test-sort',
        JSON.stringify({ column: 'name', direction: 'desc' })
      );
    });

    it('loads initial state from localStorage', () => {
      mockLocalStorage['test-sort'] = JSON.stringify({ column: 'name', direction: 'asc' });

      const { result } = renderHook(() => 
        useSortableTable<TestColumn>({
          defaultColumn: 'score',
          persistKey: 'test-sort',
        })
      );

      expect(result.current.sortState).toEqual({
        column: 'name',
        direction: 'asc',
      });
    });

    it('falls back to defaults if localStorage is invalid', () => {
      mockLocalStorage['test-sort'] = 'invalid json';

      const { result } = renderHook(() => 
        useSortableTable<TestColumn>({
          defaultColumn: 'score',
          defaultDirection: 'desc',
          persistKey: 'test-sort',
        })
      );

      expect(result.current.sortState).toEqual({
        column: 'score',
        direction: 'desc',
      });
    });

    it('does not persist without persistKey', () => {
      const { result } = renderHook(() => 
        useSortableTable<TestColumn>({
          defaultColumn: 'score',
        })
      );

      act(() => {
        result.current.toggleSort('name');
      });

      // setItem should not be called with any key
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });
});

describe('sortItems', () => {
  const items = [
    { id: 1, name: 'Charlie', score: 75 },
    { id: 2, name: 'Alice', score: 90 },
    { id: 3, name: 'Bob', score: 85 },
    { id: 4, name: 'David', score: null },
  ];

  type Column = 'name' | 'score';

  const getters: Record<Column, (item: typeof items[0]) => number | string | null> = {
    name: (item) => item.name,
    score: (item) => item.score,
  };

  it('sorts by string column ascending', () => {
    const sortState: SortState<Column> = { column: 'name', direction: 'asc' };
    const sorted = sortItems(items, sortState, getters);

    expect(sorted.map(i => i.name)).toEqual(['Alice', 'Bob', 'Charlie', 'David']);
  });

  it('sorts by string column descending', () => {
    const sortState: SortState<Column> = { column: 'name', direction: 'desc' };
    const sorted = sortItems(items, sortState, getters);

    expect(sorted.map(i => i.name)).toEqual(['David', 'Charlie', 'Bob', 'Alice']);
  });

  it('sorts by numeric column ascending', () => {
    const sortState: SortState<Column> = { column: 'score', direction: 'asc' };
    const sorted = sortItems(items, sortState, getters);

    // Null sorts to end
    expect(sorted.map(i => i.score)).toEqual([75, 85, 90, null]);
  });

  it('sorts by numeric column descending', () => {
    const sortState: SortState<Column> = { column: 'score', direction: 'desc' };
    const sorted = sortItems(items, sortState, getters);

    // Null sorts to end even in descending
    expect(sorted.map(i => i.score)).toEqual([90, 85, 75, null]);
  });

  it('does not mutate original array', () => {
    const original = [...items];
    const sortState: SortState<Column> = { column: 'name', direction: 'asc' };
    sortItems(items, sortState, getters);

    expect(items).toEqual(original);
  });

  it('handles null values (sorts to end)', () => {
    const itemsWithNulls = [
      { id: 1, name: null, score: 75 },
      { id: 2, name: 'Alice', score: 90 },
      { id: 3, name: null, score: 85 },
    ];

    type NullColumn = 'name' | 'score';
    const nullGetters: Record<NullColumn, (item: typeof itemsWithNulls[0]) => number | string | null> = {
      name: (item) => item.name,
      score: (item) => item.score,
    };

    const sortState: SortState<NullColumn> = { column: 'name', direction: 'asc' };
    const sorted = sortItems(itemsWithNulls, sortState, nullGetters);

    // Non-null first, nulls at end
    expect(sorted[0].name).toBe('Alice');
    expect(sorted[1].name).toBeNull();
    expect(sorted[2].name).toBeNull();
  });

  it('returns original array if column not in getters', () => {
    const sortState = { column: 'unknown' as Column, direction: 'asc' as const };
    const sorted = sortItems(items, sortState, getters);

    expect(sorted).toEqual(items);
  });
});
