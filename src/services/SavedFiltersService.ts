/**
 * SavedFiltersService
 * 
 * Manages saved filter segments - persisting, loading, and organizing
 * filter definitions for quick access.
 */

import {
  FilterDefinition,
  createFilterDefinition,
  serializeFilter,
  deserializeFilter,
  validateFilter,
} from './FilterBuilderService';

/**
 * Saved filter with metadata
 */
export interface SavedFilter extends FilterDefinition {
  isPinned?: boolean;
  isDefault?: boolean;
  usageCount: number;
  lastUsedAt?: Date;
  color?: string;
  icon?: string;
}

/**
 * Filter category for organization
 */
export interface FilterCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  filterIds: string[];
}

/**
 * Storage key for local storage
 */
const STORAGE_KEY = 'yardflow_saved_filters';
const CATEGORIES_KEY = 'yardflow_filter_categories';
const RECENT_KEY = 'yardflow_recent_filters';

/**
 * Maximum number of recent filters to track
 */
const MAX_RECENT_FILTERS = 10;

/**
 * SavedFiltersService class
 */
export class SavedFiltersService {
  private filters: Map<string, SavedFilter> = new Map();
  private categories: Map<string, FilterCategory> = new Map();
  private recentFilterIds: string[] = [];
  private storageKey: string;
  private categoriesKey: string;
  private recentKey: string;

  constructor(namespace: string = '') {
    this.storageKey = namespace ? `${namespace}_${STORAGE_KEY}` : STORAGE_KEY;
    this.categoriesKey = namespace ? `${namespace}_${CATEGORIES_KEY}` : CATEGORIES_KEY;
    this.recentKey = namespace ? `${namespace}_${RECENT_KEY}` : RECENT_KEY;
  }

  /**
   * Load filters from local storage
   */
  load(): void {
    try {
      // Load filters
      const filtersJson = localStorage.getItem(this.storageKey);
      if (filtersJson) {
        const parsed = JSON.parse(filtersJson) as SavedFilter[];
        this.filters.clear();
        for (const filter of parsed) {
          const restored: SavedFilter = {
            ...deserializeFilter(JSON.stringify(filter)),
            isPinned: filter.isPinned,
            isDefault: filter.isDefault,
            usageCount: filter.usageCount || 0,
            lastUsedAt: filter.lastUsedAt ? new Date(filter.lastUsedAt) : undefined,
            color: filter.color,
            icon: filter.icon,
          };
          this.filters.set(restored.id, restored);
        }
      }

      // Load categories
      const categoriesJson = localStorage.getItem(this.categoriesKey);
      if (categoriesJson) {
        const parsed = JSON.parse(categoriesJson) as FilterCategory[];
        this.categories.clear();
        for (const category of parsed) {
          this.categories.set(category.id, category);
        }
      }

      // Load recent filter IDs
      const recentJson = localStorage.getItem(this.recentKey);
      if (recentJson) {
        this.recentFilterIds = JSON.parse(recentJson);
      }
    } catch (error) {
      console.error('Failed to load saved filters:', error);
    }
  }

  /**
   * Save filters to local storage
   */
  save(): void {
    try {
      // Save filters
      const filters = Array.from(this.filters.values()).map(f => ({
        ...JSON.parse(serializeFilter(f)),
        isPinned: f.isPinned,
        isDefault: f.isDefault,
        usageCount: f.usageCount,
        lastUsedAt: f.lastUsedAt?.toISOString(),
        color: f.color,
        icon: f.icon,
      }));
      localStorage.setItem(this.storageKey, JSON.stringify(filters));

      // Save categories
      const categories = Array.from(this.categories.values());
      localStorage.setItem(this.categoriesKey, JSON.stringify(categories));

      // Save recent
      localStorage.setItem(this.recentKey, JSON.stringify(this.recentFilterIds));
    } catch (error) {
      console.error('Failed to save filters:', error);
    }
  }

  /**
   * Create a new saved filter
   */
  createFilter(name: string, baseFilter?: Partial<FilterDefinition>): SavedFilter {
    const filter = createFilterDefinition(name);
    const savedFilter: SavedFilter = {
      ...filter,
      ...baseFilter,
      id: filter.id,
      name,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.filters.set(savedFilter.id, savedFilter);
    this.save();

    return savedFilter;
  }

  /**
   * Save an existing filter
   */
  saveFilter(filter: FilterDefinition | SavedFilter): SavedFilter {
    const existing = this.filters.get(filter.id);
    const savedFilter: SavedFilter = {
      ...filter,
      usageCount: existing?.usageCount || 0,
      lastUsedAt: existing?.lastUsedAt,
      isPinned: (filter as SavedFilter).isPinned ?? existing?.isPinned,
      isDefault: (filter as SavedFilter).isDefault ?? existing?.isDefault,
      color: (filter as SavedFilter).color ?? existing?.color,
      icon: (filter as SavedFilter).icon ?? existing?.icon,
      updatedAt: new Date(),
    };

    this.filters.set(savedFilter.id, savedFilter);
    this.save();

    return savedFilter;
  }

  /**
   * Get a filter by ID
   */
  getFilter(id: string): SavedFilter | undefined {
    return this.filters.get(id);
  }

  /**
   * Get all saved filters
   */
  getAllFilters(): SavedFilter[] {
    return Array.from(this.filters.values());
  }

  /**
   * Delete a filter
   */
  deleteFilter(id: string): boolean {
    const deleted = this.filters.delete(id);
    if (deleted) {
      // Remove from categories
      for (const category of this.categories.values()) {
        category.filterIds = category.filterIds.filter(fid => fid !== id);
      }
      // Remove from recent
      this.recentFilterIds = this.recentFilterIds.filter(fid => fid !== id);
      this.save();
    }
    return deleted;
  }

  /**
   * Duplicate a filter
   */
  duplicateFilter(id: string, newName?: string): SavedFilter | undefined {
    const original = this.filters.get(id);
    if (!original) return undefined;

    const duplicate = this.createFilter(newName || `${original.name} (Copy)`, {
      rootGroup: JSON.parse(JSON.stringify(original.rootGroup)),
      description: original.description,
      isQuickFilter: original.isQuickFilter,
    });

    return duplicate;
  }

  /**
   * Record filter usage
   */
  recordUsage(id: string): void {
    const filter = this.filters.get(id);
    if (filter) {
      filter.usageCount += 1;
      filter.lastUsedAt = new Date();
      this.filters.set(id, filter);

      // Add to recent
      this.recentFilterIds = [
        id,
        ...this.recentFilterIds.filter(fid => fid !== id),
      ].slice(0, MAX_RECENT_FILTERS);

      this.save();
    }
  }

  /**
   * Get recent filters
   */
  getRecentFilters(limit: number = MAX_RECENT_FILTERS): SavedFilter[] {
    return this.recentFilterIds
      .slice(0, limit)
      .map(id => this.filters.get(id))
      .filter((f): f is SavedFilter => f !== undefined);
  }

  /**
   * Get pinned filters
   */
  getPinnedFilters(): SavedFilter[] {
    return this.getAllFilters().filter(f => f.isPinned);
  }

  /**
   * Pin/unpin a filter
   */
  togglePin(id: string): boolean {
    const filter = this.filters.get(id);
    if (filter) {
      filter.isPinned = !filter.isPinned;
      this.filters.set(id, filter);
      this.save();
      return filter.isPinned;
    }
    return false;
  }

  /**
   * Set default filter
   */
  setDefault(id: string | null): void {
    // Clear existing default
    for (const filter of this.filters.values()) {
      filter.isDefault = false;
    }

    // Set new default
    if (id) {
      const filter = this.filters.get(id);
      if (filter) {
        filter.isDefault = true;
      }
    }

    this.save();
  }

  /**
   * Get default filter
   */
  getDefaultFilter(): SavedFilter | undefined {
    return this.getAllFilters().find(f => f.isDefault);
  }

  /**
   * Get most used filters
   */
  getMostUsedFilters(limit: number = 5): SavedFilter[] {
    return this.getAllFilters()
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Search filters by name
   */
  searchFilters(query: string): SavedFilter[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllFilters().filter(
      f =>
        f.name.toLowerCase().includes(lowerQuery) ||
        f.description?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Create a category
   */
  createCategory(name: string, icon?: string, color?: string): FilterCategory {
    const category: FilterCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name,
      icon,
      color,
      filterIds: [],
    };

    this.categories.set(category.id, category);
    this.save();

    return category;
  }

  /**
   * Get all categories
   */
  getCategories(): FilterCategory[] {
    return Array.from(this.categories.values());
  }

  /**
   * Get a category by ID
   */
  getCategory(id: string): FilterCategory | undefined {
    return this.categories.get(id);
  }

  /**
   * Add filter to category
   */
  addFilterToCategory(filterId: string, categoryId: string): boolean {
    const category = this.categories.get(categoryId);
    if (!category) return false;

    if (!category.filterIds.includes(filterId)) {
      category.filterIds.push(filterId);
      this.save();
    }

    return true;
  }

  /**
   * Remove filter from category
   */
  removeFilterFromCategory(filterId: string, categoryId: string): boolean {
    const category = this.categories.get(categoryId);
    if (!category) return false;

    category.filterIds = category.filterIds.filter(id => id !== filterId);
    this.save();

    return true;
  }

  /**
   * Get filters in a category
   */
  getFiltersInCategory(categoryId: string): SavedFilter[] {
    const category = this.categories.get(categoryId);
    if (!category) return [];

    return category.filterIds
      .map(id => this.filters.get(id))
      .filter((f): f is SavedFilter => f !== undefined);
  }

  /**
   * Delete a category (filters are not deleted)
   */
  deleteCategory(id: string): boolean {
    const deleted = this.categories.delete(id);
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  /**
   * Update category
   */
  updateCategory(id: string, updates: Partial<Omit<FilterCategory, 'id'>>): FilterCategory | undefined {
    const category = this.categories.get(id);
    if (!category) return undefined;

    const updated = { ...category, ...updates };
    this.categories.set(id, updated);
    this.save();

    return updated;
  }

  /**
   * Export all filters and categories
   */
  exportAll(): string {
    return JSON.stringify({
      filters: Array.from(this.filters.values()).map(f => ({
        ...JSON.parse(serializeFilter(f)),
        isPinned: f.isPinned,
        isDefault: f.isDefault,
        usageCount: f.usageCount,
        lastUsedAt: f.lastUsedAt?.toISOString(),
        color: f.color,
        icon: f.icon,
      })),
      categories: Array.from(this.categories.values()),
      exportedAt: new Date().toISOString(),
      version: 1,
    });
  }

  /**
   * Import filters and categories
   */
  importAll(json: string, merge: boolean = false): { filters: number; categories: number } {
    try {
      const data = JSON.parse(json);

      if (!merge) {
        this.filters.clear();
        this.categories.clear();
        this.recentFilterIds = [];
      }

      let filtersImported = 0;
      let categoriesImported = 0;

      if (data.filters) {
        for (const filter of data.filters) {
          const restored: SavedFilter = {
            ...deserializeFilter(JSON.stringify(filter)),
            isPinned: filter.isPinned,
            isDefault: filter.isDefault,
            usageCount: filter.usageCount || 0,
            lastUsedAt: filter.lastUsedAt ? new Date(filter.lastUsedAt) : undefined,
            color: filter.color,
            icon: filter.icon,
          };

          if (merge && this.filters.has(restored.id)) {
            // Generate new ID for merge
            restored.id = `filter_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          }

          this.filters.set(restored.id, restored);
          filtersImported++;
        }
      }

      if (data.categories) {
        for (const category of data.categories) {
          if (merge && this.categories.has(category.id)) {
            category.id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          }
          this.categories.set(category.id, category);
          categoriesImported++;
        }
      }

      this.save();

      return { filters: filtersImported, categories: categoriesImported };
    } catch (error) {
      throw new Error(`Failed to import filters: ${error}`);
    }
  }

  /**
   * Clear all saved filters and categories
   */
  clear(): void {
    this.filters.clear();
    this.categories.clear();
    this.recentFilterIds = [];
    this.save();
  }

  /**
   * Get filter statistics
   */
  getStats(): {
    totalFilters: number;
    pinnedCount: number;
    categoriesCount: number;
    totalUsage: number;
    mostUsed: SavedFilter | undefined;
  } {
    const filters = this.getAllFilters();
    const totalUsage = filters.reduce((sum, f) => sum + f.usageCount, 0);

    return {
      totalFilters: filters.length,
      pinnedCount: filters.filter(f => f.isPinned).length,
      categoriesCount: this.categories.size,
      totalUsage,
      mostUsed: filters.sort((a, b) => b.usageCount - a.usageCount)[0],
    };
  }

  /**
   * Validate all filters
   */
  validateAllFilters(): { id: string; name: string; errors: string[] }[] {
    const results: { id: string; name: string; errors: string[] }[] = [];

    for (const filter of this.filters.values()) {
      const validation = validateFilter(filter);
      if (!validation.valid) {
        results.push({
          id: filter.id,
          name: filter.name,
          errors: validation.errors,
        });
      }
    }

    return results;
  }
}

/**
 * Singleton instance
 */
let globalSavedFiltersService: SavedFiltersService | null = null;

/**
 * Get or create the global saved filters service
 */
export function getSavedFiltersService(): SavedFiltersService {
  if (!globalSavedFiltersService) {
    globalSavedFiltersService = new SavedFiltersService();
    globalSavedFiltersService.load();
  }
  return globalSavedFiltersService;
}

/**
 * Reset the global service (for testing)
 */
export function resetSavedFiltersService(): void {
  globalSavedFiltersService = null;
}
