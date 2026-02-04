/**
 * useSavedFilters Hook Tests - Sprint V34
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSavedFilters } from '../../hooks/useSavedFilters';

describe('useSavedFilters', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('initializes with empty presets', () => {
    const { result } = renderHook(() => useSavedFilters());
    expect(result.current.presets).toEqual([]);
  });

  it('loads presets from localStorage on mount', () => {
    const stored = [
      {
        id: 'preset-1',
        name: 'Test Preset',
        tierFilter: 'Tier 1',
        emailFilter: 'has_email',
        tagFilter: null,
        searchQuery: '',
        createdAt: 1000,
      },
    ];
    localStorage.setItem('yardflow_filter_presets', JSON.stringify(stored));

    const { result } = renderHook(() => useSavedFilters());
    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].name).toBe('Test Preset');
  });

  it('saves a new preset', () => {
    const { result } = renderHook(() => useSavedFilters());

    act(() => {
      result.current.savePreset('My Filter', {
        tierFilter: 'Tier 1',
        emailFilter: 'has_email',
        tagFilter: 'Manifest 2026',
        searchQuery: 'test',
      });
    });

    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].name).toBe('My Filter');
    expect(result.current.presets[0].tierFilter).toBe('Tier 1');
    expect(result.current.presets[0].tagFilter).toBe('Manifest 2026');

    // Verify persisted to localStorage
    const stored = JSON.parse(localStorage.getItem('yardflow_filter_presets') || '[]');
    expect(stored).toHaveLength(1);
  });

  it('deletes a preset', () => {
    const { result } = renderHook(() => useSavedFilters());

    act(() => {
      result.current.savePreset('Filter 1', {
        tierFilter: 'Tier 1',
        emailFilter: 'all',
        tagFilter: null,
        searchQuery: '',
      });
    });

    const presetId = result.current.presets[0].id;

    act(() => {
      result.current.deletePreset(presetId);
    });

    expect(result.current.presets).toHaveLength(0);
  });

  it('loads a preset by id', () => {
    const { result } = renderHook(() => useSavedFilters());

    act(() => {
      result.current.savePreset('Test Filter', {
        tierFilter: 'Tier 2',
        emailFilter: 'no_email',
        tagFilter: 'VIP',
        searchQuery: 'foo',
      });
    });

    const presetId = result.current.presets[0].id;
    const loaded = result.current.loadPreset(presetId);

    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Test Filter');
    expect(loaded?.tierFilter).toBe('Tier 2');
    expect(loaded?.tagFilter).toBe('VIP');
  });

  it('returns null when loading non-existent preset', () => {
    const { result } = renderHook(() => useSavedFilters());
    const loaded = result.current.loadPreset('non-existent');
    expect(loaded).toBeNull();
  });

  it('limits presets to MAX_PRESETS (10)', () => {
    const { result } = renderHook(() => useSavedFilters());

    // Add 11 presets
    for (let i = 0; i < 11; i++) {
      act(() => {
        result.current.savePreset(`Filter ${i}`, {
          tierFilter: 'All',
          emailFilter: 'all',
          tagFilter: null,
          searchQuery: `search-${i}`,
        });
      });
    }

    expect(result.current.presets).toHaveLength(10);
    // First preset (Filter 0) should be removed
    expect(result.current.presets.find(p => p.name === 'Filter 0')).toBeUndefined();
    // Last preset (Filter 10) should exist
    expect(result.current.presets.find(p => p.name === 'Filter 10')).toBeDefined();
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('yardflow_filter_presets', 'not-valid-json');

    const { result } = renderHook(() => useSavedFilters());
    expect(result.current.presets).toEqual([]);
  });

  it('preserves existing presets when adding new one', () => {
    const { result } = renderHook(() => useSavedFilters());

    act(() => {
      result.current.savePreset('Filter A', {
        tierFilter: 'Tier 1',
        emailFilter: 'all',
        tagFilter: null,
        searchQuery: '',
      });
    });

    act(() => {
      result.current.savePreset('Filter B', {
        tierFilter: 'Tier 2',
        emailFilter: 'has_email',
        tagFilter: 'Test',
        searchQuery: 'query',
      });
    });

    expect(result.current.presets).toHaveLength(2);
    expect(result.current.presets[0].name).toBe('Filter A');
    expect(result.current.presets[1].name).toBe('Filter B');
  });
});
