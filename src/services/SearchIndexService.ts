/**
 * SearchIndexService
 * 
 * Provides fast fuzzy search across prospects and companies using Fuse.js.
 * Supports indexing, search, highlighting, and search result ranking.
 */

import Fuse, { IFuseOptions, FuseIndex } from 'fuse.js';

/**
 * Searchable prospect fields
 */
export interface SearchableProspect {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  company: string;
  title: string;
  linkedInUrl?: string;
  phone?: string;
  location?: string;
  status?: string;
  tags?: string[];
  notes?: string;
}

/**
 * Searchable company fields
 */
export interface SearchableCompany {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  location?: string;
  description?: string;
  linkedInUrl?: string;
  website?: string;
  tags?: string[];
}

/**
 * Search result with highlights
 */
export interface SearchResult<T> {
  item: T;
  score: number;
  matches: SearchMatch[];
}

/**
 * Match details for highlighting
 */
export interface SearchMatch {
  key: string;
  value: string;
  indices: [number, number][];
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  threshold?: number;
  keys?: string[];
  includeMatches?: boolean;
  sortBy?: 'score' | 'field';
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * Search index configuration
 */
export interface SearchIndexConfig {
  keys: string[];
  threshold?: number;
  distance?: number;
  minMatchCharLength?: number;
  ignoreLocation?: boolean;
}

/**
 * Default Fuse.js options for prospects
 */
const DEFAULT_PROSPECT_OPTIONS: IFuseOptions<SearchableProspect> = {
  keys: [
    { name: 'fullName', weight: 0.3 },
    { name: 'firstName', weight: 0.2 },
    { name: 'lastName', weight: 0.2 },
    { name: 'email', weight: 0.25 },
    { name: 'company', weight: 0.2 },
    { name: 'title', weight: 0.15 },
    { name: 'location', weight: 0.1 },
    { name: 'tags', weight: 0.15 },
    { name: 'notes', weight: 0.1 },
  ],
  threshold: 0.3,
  distance: 100,
  minMatchCharLength: 2,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  useExtendedSearch: true,
};

/**
 * Default Fuse.js options for companies
 */
const DEFAULT_COMPANY_OPTIONS: IFuseOptions<SearchableCompany> = {
  keys: [
    { name: 'name', weight: 0.4 },
    { name: 'domain', weight: 0.2 },
    { name: 'industry', weight: 0.2 },
    { name: 'location', weight: 0.15 },
    { name: 'description', weight: 0.1 },
    { name: 'tags', weight: 0.15 },
  ],
  threshold: 0.3,
  distance: 100,
  minMatchCharLength: 2,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  useExtendedSearch: true,
};

/**
 * Highlights matching text in a string
 */
export function highlightMatches(
  text: string,
  indices: [number, number][],
  highlightTag = 'mark'
): string {
  if (!indices || indices.length === 0) {
    return text;
  }

  // Sort indices in reverse order to avoid offset issues
  const sortedIndices = [...indices].sort((a, b) => b[0] - a[0]);
  
  let result = text;
  for (const [start, end] of sortedIndices) {
    const before = result.substring(0, start);
    const match = result.substring(start, end + 1);
    const after = result.substring(end + 1);
    result = `${before}<${highlightTag}>${match}</${highlightTag}>${after}`;
  }
  
  return result;
}

/**
 * Parses a search query into tokens
 */
export function parseSearchQuery(query: string): {
  terms: string[];
  exact: string[];
  excluded: string[];
  fieldFilters: Record<string, string>;
} {
  const terms: string[] = [];
  const exact: string[] = [];
  const excluded: string[] = [];
  const fieldFilters: Record<string, string> = {};
  
  // Match quoted strings, field:value pairs, and regular terms
  const regex = /"([^"]+)"|(\w+):(\w+)|(-\w+)|(\S+)/g;
  let match;
  
  while ((match = regex.exec(query)) !== null) {
    if (match[1]) {
      // Quoted exact match
      exact.push(match[1]);
    } else if (match[2] && match[3]) {
      // Field filter
      fieldFilters[match[2].toLowerCase()] = match[3];
    } else if (match[4]) {
      // Excluded term
      excluded.push(match[4].substring(1));
    } else if (match[5]) {
      // Regular term
      terms.push(match[5]);
    }
  }
  
  return { terms, exact, excluded, fieldFilters };
}

/**
 * Builds an extended search pattern for Fuse.js
 */
export function buildExtendedSearchPattern(query: string): string {
  const { terms, exact, excluded, fieldFilters } = parseSearchQuery(query);
  
  const patterns: string[] = [];
  
  // Add exact matches with single quotes
  for (const term of exact) {
    patterns.push(`'${term}`);
  }
  
  // Add fuzzy terms
  for (const term of terms) {
    patterns.push(term);
  }
  
  // Add excluded terms
  for (const term of excluded) {
    patterns.push(`!${term}`);
  }
  
  // Field filters need to be handled separately
  // Just include the values for now
  for (const value of Object.values(fieldFilters)) {
    patterns.push(value);
  }
  
  return patterns.join(' ');
}

/**
 * Search index for fast fuzzy searching
 */
export class SearchIndexService<T extends { id: string }> {
  private fuse: Fuse<T> | null = null;
  private items: T[] = [];
  private index: FuseIndex<T> | null = null;
  private options: IFuseOptions<T>;

  constructor(options: IFuseOptions<T>) {
    this.options = options;
  }

  /**
   * Create a pre-built index for faster initialization
   */
  static createIndex<T>(
    keys: IFuseOptions<T>['keys'],
    items: T[]
  ): FuseIndex<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Fuse.createIndex(keys as any, items);
  }

  /**
   * Load items into the search index
   */
  loadItems(items: T[], prebuiltIndex?: FuseIndex<T>): void {
    this.items = items;
    this.index = prebuiltIndex || null;
    
    if (prebuiltIndex) {
      this.fuse = new Fuse(items, this.options, prebuiltIndex);
    } else {
      this.fuse = new Fuse(items, this.options);
    }
  }

  /**
   * Add items to the index
   */
  addItems(items: T[]): void {
    if (!this.fuse) {
      this.loadItems(items);
      return;
    }

    for (const item of items) {
      const existingIndex = this.items.findIndex(i => i.id === item.id);
      if (existingIndex >= 0) {
        this.items[existingIndex] = item;
      } else {
        this.items.push(item);
      }
    }

    // Rebuild index
    this.fuse = new Fuse(this.items, this.options);
  }

  /**
   * Remove items from the index
   */
  removeItems(ids: string[]): void {
    if (!this.fuse) return;

    const idSet = new Set(ids);
    this.items = this.items.filter(item => !idSet.has(item.id));
    this.fuse = new Fuse(this.items, this.options);
  }

  /**
   * Update an item in the index
   */
  updateItem(item: T): void {
    if (!this.fuse) {
      this.loadItems([item]);
      return;
    }

    const index = this.items.findIndex(i => i.id === item.id);
    if (index >= 0) {
      this.items[index] = item;
    } else {
      this.items.push(item);
    }

    // Rebuild index
    this.fuse = new Fuse(this.items, this.options);
  }

  /**
   * Search the index
   */
  search(query: string, options?: SearchOptions): SearchResult<T>[] {
    if (!this.fuse || !query.trim()) {
      return [];
    }

    const limit = options?.limit || 50;
    const threshold = options?.threshold;
    
    // Build search options
    const searchOptions = {
      limit,
    };

    // Use extended search if query contains operators
    const hasOperators = /"|\s-|:/.test(query);
    const searchPattern = hasOperators ? buildExtendedSearchPattern(query) : query;

    let results = this.fuse.search(searchPattern, searchOptions);

    // Apply threshold filter if specified
    if (threshold !== undefined) {
      results = results.filter(r => (r.score || 0) <= threshold);
    }

    // Convert to SearchResult format
    const searchResults: SearchResult<T>[] = results.map(r => ({
      item: r.item,
      score: 1 - (r.score || 0), // Invert score so higher is better
      matches: (r.matches || []).map(m => ({
        key: m.key || '',
        value: m.value || '',
        indices: m.indices as [number, number][],
      })),
    }));

    // Apply custom sorting if specified
    if (options?.sortBy === 'field' && options.sortField) {
      const field = options.sortField as keyof T;
      const direction = options.sortDirection === 'desc' ? -1 : 1;
      
      searchResults.sort((a, b) => {
        const aVal = String(a.item[field] || '');
        const bVal = String(b.item[field] || '');
        return aVal.localeCompare(bVal) * direction;
      });
    }

    return searchResults;
  }

  /**
   * Get all items (for filtering without search)
   */
  getAllItems(): T[] {
    return [...this.items];
  }

  /**
   * Get item by ID
   */
  getItemById(id: string): T | undefined {
    return this.items.find(item => item.id === id);
  }

  /**
   * Get the number of indexed items
   */
  getItemCount(): number {
    return this.items.length;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.items = [];
    this.fuse = null;
    this.index = null;
  }

  /**
   * Export the current index for storage
   */
  exportIndex(): { items: T[]; indexData: object | null } {
    return {
      items: this.items,
      indexData: this.index ? (this.index as unknown as object) : null,
    };
  }
}

/**
 * Create a prospect search index with default configuration
 */
export function createProspectSearchIndex(): SearchIndexService<SearchableProspect> {
  return new SearchIndexService<SearchableProspect>(DEFAULT_PROSPECT_OPTIONS);
}

/**
 * Create a company search index with default configuration
 */
export function createCompanySearchIndex(): SearchIndexService<SearchableCompany> {
  return new SearchIndexService<SearchableCompany>(DEFAULT_COMPANY_OPTIONS);
}

/**
 * Combined search index for searching across multiple types
 */
export class UnifiedSearchIndex {
  private prospectIndex: SearchIndexService<SearchableProspect>;
  private companyIndex: SearchIndexService<SearchableCompany>;

  constructor() {
    this.prospectIndex = createProspectSearchIndex();
    this.companyIndex = createCompanySearchIndex();
  }

  /**
   * Load prospects into the index
   */
  loadProspects(prospects: SearchableProspect[]): void {
    this.prospectIndex.loadItems(prospects);
  }

  /**
   * Load companies into the index
   */
  loadCompanies(companies: SearchableCompany[]): void {
    this.companyIndex.loadItems(companies);
  }

  /**
   * Search across all types
   */
  searchAll(
    query: string,
    options?: SearchOptions
  ): {
    prospects: SearchResult<SearchableProspect>[];
    companies: SearchResult<SearchableCompany>[];
  } {
    const prospectResults = this.prospectIndex.search(query, options);
    const companyResults = this.companyIndex.search(query, options);

    return {
      prospects: prospectResults,
      companies: companyResults,
    };
  }

  /**
   * Search only prospects
   */
  searchProspects(
    query: string,
    options?: SearchOptions
  ): SearchResult<SearchableProspect>[] {
    return this.prospectIndex.search(query, options);
  }

  /**
   * Search only companies
   */
  searchCompanies(
    query: string,
    options?: SearchOptions
  ): SearchResult<SearchableCompany>[] {
    return this.companyIndex.search(query, options);
  }

  /**
   * Get statistics about the index
   */
  getStats(): { prospectCount: number; companyCount: number } {
    return {
      prospectCount: this.prospectIndex.getItemCount(),
      companyCount: this.companyIndex.getItemCount(),
    };
  }

  /**
   * Clear all indexes
   */
  clear(): void {
    this.prospectIndex.clear();
    this.companyIndex.clear();
  }
}

/**
 * Singleton instance for global access
 */
let globalSearchIndex: UnifiedSearchIndex | null = null;

/**
 * Get or create the global search index
 */
export function getGlobalSearchIndex(): UnifiedSearchIndex {
  if (!globalSearchIndex) {
    globalSearchIndex = new UnifiedSearchIndex();
  }
  return globalSearchIndex;
}

/**
 * Reset the global search index
 */
export function resetGlobalSearchIndex(): void {
  globalSearchIndex = null;
}
