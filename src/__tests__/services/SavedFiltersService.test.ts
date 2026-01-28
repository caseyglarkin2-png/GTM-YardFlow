/**
 * SavedFiltersService Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SavedFiltersService,
  SavedFilter,
  getSavedFiltersService,
  resetSavedFiltersService,
} from '../../services/SavedFiltersService';
import {
  createCondition,
  addConditionToGroup,
} from '../../services/FilterBuilderService';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
});

describe('SavedFiltersService', () => {
  let service: SavedFiltersService;

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    resetSavedFiltersService();
    service = new SavedFiltersService('test');
  });

  describe('createFilter', () => {
    it('creates a new saved filter', () => {
      const filter = service.createFilter('Test Filter');
      
      expect(filter.name).toBe('Test Filter');
      expect(filter.id).toBeDefined();
      expect(filter.usageCount).toBe(0);
      expect(filter.createdAt).toBeInstanceOf(Date);
    });

    it('creates filter with base filter', () => {
      const condition = createCondition('firstName', 'equals', 'John');
      const filter = service.createFilter('With Condition', {
        description: 'A description',
      });
      
      expect(filter.description).toBe('A description');
    });

    it('persists to localStorage', () => {
      service.createFilter('Persisted');
      
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('saveFilter', () => {
    it('saves an existing filter', () => {
      const filter = service.createFilter('Original');
      filter.name = 'Updated';
      
      const saved = service.saveFilter(filter);
      
      expect(saved.name).toBe('Updated');
      expect(service.getFilter(filter.id)?.name).toBe('Updated');
    });

    it('preserves usage count', () => {
      const filter = service.createFilter('Test');
      service.recordUsage(filter.id);
      service.recordUsage(filter.id);
      
      const updated = { ...filter, name: 'New Name' };
      const saved = service.saveFilter(updated);
      
      expect(saved.usageCount).toBe(2);
    });
  });

  describe('getFilter', () => {
    it('returns filter by ID', () => {
      const created = service.createFilter('Find Me');
      const found = service.getFilter(created.id);
      
      expect(found?.name).toBe('Find Me');
    });

    it('returns undefined for non-existent ID', () => {
      const found = service.getFilter('nonexistent');
      expect(found).toBeUndefined();
    });
  });

  describe('getAllFilters', () => {
    it('returns all filters', () => {
      service.createFilter('One');
      service.createFilter('Two');
      service.createFilter('Three');
      
      const all = service.getAllFilters();
      
      expect(all.length).toBe(3);
    });

    it('returns empty array when no filters', () => {
      expect(service.getAllFilters().length).toBe(0);
    });
  });

  describe('deleteFilter', () => {
    it('deletes a filter', () => {
      const filter = service.createFilter('To Delete');
      
      const deleted = service.deleteFilter(filter.id);
      
      expect(deleted).toBe(true);
      expect(service.getFilter(filter.id)).toBeUndefined();
    });

    it('returns false for non-existent filter', () => {
      expect(service.deleteFilter('nonexistent')).toBe(false);
    });

    it('removes from categories', () => {
      const filter = service.createFilter('Categorized');
      const category = service.createCategory('Cat');
      service.addFilterToCategory(filter.id, category.id);
      
      service.deleteFilter(filter.id);
      
      expect(service.getFiltersInCategory(category.id).length).toBe(0);
    });
  });

  describe('duplicateFilter', () => {
    it('duplicates a filter', () => {
      const original = service.createFilter('Original');
      const duplicate = service.duplicateFilter(original.id);
      
      expect(duplicate).toBeDefined();
      expect(duplicate?.name).toBe('Original (Copy)');
      expect(duplicate?.id).not.toBe(original.id);
    });

    it('uses custom name if provided', () => {
      const original = service.createFilter('Original');
      const duplicate = service.duplicateFilter(original.id, 'Custom Name');
      
      expect(duplicate?.name).toBe('Custom Name');
    });

    it('returns undefined for non-existent filter', () => {
      expect(service.duplicateFilter('nonexistent')).toBeUndefined();
    });
  });

  describe('recordUsage', () => {
    it('increments usage count', () => {
      const filter = service.createFilter('Track Me');
      
      service.recordUsage(filter.id);
      service.recordUsage(filter.id);
      service.recordUsage(filter.id);
      
      expect(service.getFilter(filter.id)?.usageCount).toBe(3);
    });

    it('sets lastUsedAt', () => {
      const filter = service.createFilter('Track Me');
      
      service.recordUsage(filter.id);
      
      expect(service.getFilter(filter.id)?.lastUsedAt).toBeInstanceOf(Date);
    });

    it('adds to recent filters', () => {
      const filter = service.createFilter('Recent');
      service.recordUsage(filter.id);
      
      const recent = service.getRecentFilters();
      
      expect(recent.length).toBe(1);
      expect(recent[0].id).toBe(filter.id);
    });
  });

  describe('getRecentFilters', () => {
    it('returns recent filters in order', () => {
      const f1 = service.createFilter('First');
      const f2 = service.createFilter('Second');
      const f3 = service.createFilter('Third');
      
      service.recordUsage(f1.id);
      service.recordUsage(f2.id);
      service.recordUsage(f3.id);
      
      const recent = service.getRecentFilters();
      
      expect(recent[0].id).toBe(f3.id); // Most recent first
      expect(recent[1].id).toBe(f2.id);
      expect(recent[2].id).toBe(f1.id);
    });

    it('respects limit', () => {
      for (let i = 0; i < 15; i++) {
        const f = service.createFilter(`Filter ${i}`);
        service.recordUsage(f.id);
      }
      
      expect(service.getRecentFilters(5).length).toBe(5);
    });
  });

  describe('pinning', () => {
    it('toggles pin status', () => {
      const filter = service.createFilter('Pin Me');
      
      const pinned = service.togglePin(filter.id);
      expect(pinned).toBe(true);
      expect(service.getFilter(filter.id)?.isPinned).toBe(true);
      
      const unpinned = service.togglePin(filter.id);
      expect(unpinned).toBe(false);
      expect(service.getFilter(filter.id)?.isPinned).toBe(false);
    });

    it('getPinnedFilters returns only pinned', () => {
      const f1 = service.createFilter('Pinned');
      const f2 = service.createFilter('Not Pinned');
      
      service.togglePin(f1.id);
      
      const pinned = service.getPinnedFilters();
      
      expect(pinned.length).toBe(1);
      expect(pinned[0].id).toBe(f1.id);
    });
  });

  describe('default filter', () => {
    it('sets default filter', () => {
      const filter = service.createFilter('Default');
      
      service.setDefault(filter.id);
      
      expect(service.getDefaultFilter()?.id).toBe(filter.id);
    });

    it('clears previous default', () => {
      const f1 = service.createFilter('Old Default');
      const f2 = service.createFilter('New Default');
      
      service.setDefault(f1.id);
      service.setDefault(f2.id);
      
      expect(service.getFilter(f1.id)?.isDefault).toBe(false);
      expect(service.getFilter(f2.id)?.isDefault).toBe(true);
    });

    it('can clear default', () => {
      const filter = service.createFilter('Default');
      service.setDefault(filter.id);
      service.setDefault(null);
      
      expect(service.getDefaultFilter()).toBeUndefined();
    });
  });

  describe('getMostUsedFilters', () => {
    it('returns most used filters sorted', () => {
      const f1 = service.createFilter('Low Usage');
      const f2 = service.createFilter('High Usage');
      const f3 = service.createFilter('Medium Usage');
      
      service.recordUsage(f1.id);
      
      service.recordUsage(f2.id);
      service.recordUsage(f2.id);
      service.recordUsage(f2.id);
      
      service.recordUsage(f3.id);
      service.recordUsage(f3.id);
      
      const mostUsed = service.getMostUsedFilters(3);
      
      expect(mostUsed[0].id).toBe(f2.id);
      expect(mostUsed[1].id).toBe(f3.id);
      expect(mostUsed[2].id).toBe(f1.id);
    });
  });

  describe('searchFilters', () => {
    it('searches by name', () => {
      service.createFilter('Active Prospects');
      service.createFilter('Inactive Leads');
      service.createFilter('Enterprise Accounts');
      
      const results = service.searchFilters('active');
      
      expect(results.length).toBe(2);
    });

    it('searches by description', () => {
      const filter = service.createFilter('Test');
      filter.description = 'Finds important contacts';
      service.saveFilter(filter);
      
      const results = service.searchFilters('important');
      
      expect(results.length).toBe(1);
    });
  });

  describe('categories', () => {
    it('creates a category', () => {
      const category = service.createCategory('My Category', 'folder', '#blue');
      
      expect(category.name).toBe('My Category');
      expect(category.icon).toBe('folder');
      expect(category.color).toBe('#blue');
    });

    it('adds filter to category', () => {
      const filter = service.createFilter('Categorized');
      const category = service.createCategory('Cat');
      
      const added = service.addFilterToCategory(filter.id, category.id);
      
      expect(added).toBe(true);
      expect(service.getFiltersInCategory(category.id).length).toBe(1);
    });

    it('removes filter from category', () => {
      const filter = service.createFilter('Categorized');
      const category = service.createCategory('Cat');
      service.addFilterToCategory(filter.id, category.id);
      
      service.removeFilterFromCategory(filter.id, category.id);
      
      expect(service.getFiltersInCategory(category.id).length).toBe(0);
    });

    it('getCategories returns all categories', () => {
      service.createCategory('One');
      service.createCategory('Two');
      
      expect(service.getCategories().length).toBe(2);
    });

    it('deletes category without deleting filters', () => {
      const filter = service.createFilter('Safe');
      const category = service.createCategory('Delete Me');
      service.addFilterToCategory(filter.id, category.id);
      
      service.deleteCategory(category.id);
      
      expect(service.getFilter(filter.id)).toBeDefined();
      expect(service.getCategory(category.id)).toBeUndefined();
    });

    it('updates category', () => {
      const category = service.createCategory('Original');
      
      const updated = service.updateCategory(category.id, { name: 'Updated' });
      
      expect(updated?.name).toBe('Updated');
    });
  });

  describe('export/import', () => {
    it('exports all data', () => {
      service.createFilter('Export Me');
      service.createCategory('My Category');
      
      const exported = service.exportAll();
      const data = JSON.parse(exported);
      
      expect(data.filters.length).toBe(1);
      expect(data.categories.length).toBe(1);
      expect(data.version).toBe(1);
    });

    it('imports data (replace)', () => {
      service.createFilter('Existing');
      
      const exportData = JSON.stringify({
        filters: [{
          id: 'imported_1',
          name: 'Imported Filter',
          rootGroup: { id: 'g1', type: 'and', conditions: [] },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 5,
        }],
        categories: [{
          id: 'cat_1',
          name: 'Imported Category',
          filterIds: [],
        }],
        version: 1,
      });
      
      const result = service.importAll(exportData, false);
      
      expect(result.filters).toBe(1);
      expect(result.categories).toBe(1);
      expect(service.getAllFilters().length).toBe(1); // Replaced, not merged
    });

    it('imports data (merge)', () => {
      service.createFilter('Existing');
      
      const exportData = JSON.stringify({
        filters: [{
          id: 'imported_1',
          name: 'Imported Filter',
          rootGroup: { id: 'g1', type: 'and', conditions: [] },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
        categories: [],
        version: 1,
      });
      
      service.importAll(exportData, true);
      
      expect(service.getAllFilters().length).toBe(2); // Merged
    });
  });

  describe('clear', () => {
    it('clears all data', () => {
      service.createFilter('One');
      service.createFilter('Two');
      service.createCategory('Cat');
      
      service.clear();
      
      expect(service.getAllFilters().length).toBe(0);
      expect(service.getCategories().length).toBe(0);
    });
  });

  describe('getStats', () => {
    it('returns correct statistics', () => {
      const f1 = service.createFilter('One');
      const f2 = service.createFilter('Two');
      service.togglePin(f1.id);
      service.recordUsage(f1.id);
      service.recordUsage(f2.id);
      service.recordUsage(f2.id);
      service.createCategory('Cat');
      
      const stats = service.getStats();
      
      expect(stats.totalFilters).toBe(2);
      expect(stats.pinnedCount).toBe(1);
      expect(stats.categoriesCount).toBe(1);
      expect(stats.totalUsage).toBe(3);
      expect(stats.mostUsed?.id).toBe(f2.id);
    });
  });

  describe('validateAllFilters', () => {
    it('returns invalid filters', () => {
      const valid = service.createFilter('Valid');
      valid.rootGroup = addConditionToGroup(
        valid.rootGroup,
        createCondition('name', 'equals', 'test')
      );
      service.saveFilter(valid);
      
      const invalid = service.createFilter('Invalid');
      invalid.rootGroup = addConditionToGroup(
        invalid.rootGroup,
        createCondition('', 'equals', 'test') // Missing field
      );
      service.saveFilter(invalid);
      
      const results = service.validateAllFilters();
      
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Invalid');
    });
  });

  describe('persistence', () => {
    it('loads from localStorage', () => {
      // Create and save a filter
      const filter = service.createFilter('Persisted');
      service.togglePin(filter.id);
      
      // Create new service instance and load
      const newService = new SavedFiltersService('test');
      newService.load();
      
      const loaded = newService.getFilter(filter.id);
      
      expect(loaded?.name).toBe('Persisted');
      expect(loaded?.isPinned).toBe(true);
    });
  });
});

describe('getSavedFiltersService', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    resetSavedFiltersService();
  });

  it('returns singleton instance', () => {
    const instance1 = getSavedFiltersService();
    const instance2 = getSavedFiltersService();
    
    expect(instance1).toBe(instance2);
  });

  it('creates new instance after reset', () => {
    const instance1 = getSavedFiltersService();
    resetSavedFiltersService();
    const instance2 = getSavedFiltersService();
    
    expect(instance1).not.toBe(instance2);
  });
});
