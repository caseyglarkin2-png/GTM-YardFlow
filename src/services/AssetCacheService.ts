/**
 * Asset Cache Service - YardFlow Hub
 * 
 * Hash-based caching for generated assets with:
 * - TTL-based expiration
 * - LRU eviction when over size limit
 * - Invalidation by prospect or prompt hash
 */

import type { GeneratedAssets, CacheEntry, CacheStats } from '../types/assets';

// ============================================
// Configuration
// ============================================

const CACHE_CONFIG = {
  storageKey: 'yardflow_asset_cache',
  ttlDays: 7,
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  maxEntries: 500,
} as const;

// ============================================
// Hash Function
// ============================================

/**
 * Generate a simple hash for cache keys
 * Using a fast non-cryptographic hash for performance
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate cache key from prospect ID and prompt hash
 */
export function generateCacheKey(prospectId: string, promptHash: string): string {
  return `${simpleHash(prospectId)}_${simpleHash(promptHash)}`;
}

// ============================================
// Storage Operations
// ============================================

interface CacheStore {
  entries: Record<string, CacheEntry<GeneratedAssets>>;
  metadata: {
    lastCleanup: string;
    totalSize: number;
  };
}

function loadCache(): CacheStore {
  try {
    const stored = localStorage.getItem(CACHE_CONFIG.storageKey);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load asset cache:', e);
  }
  
  return {
    entries: {},
    metadata: {
      lastCleanup: new Date().toISOString(),
      totalSize: 0,
    },
  };
}

function saveCache(cache: CacheStore): void {
  try {
    const serialized = JSON.stringify(cache);
    cache.metadata.totalSize = serialized.length;
    localStorage.setItem(CACHE_CONFIG.storageKey, serialized);
  } catch (e) {
    console.warn('Failed to save asset cache:', e);
    // If storage is full, trigger cleanup
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      evictOldestEntries(cache, 10);
      saveCache(cache);
    }
  }
}

// ============================================
// Cache Operations
// ============================================

/**
 * Get cached asset by key
 */
export function getCached(key: string): GeneratedAssets | null {
  const cache = loadCache();
  const entry = cache.entries[key];
  
  if (!entry) {
    return null;
  }
  
  // Check expiration
  if (new Date(entry.expiresAt) < new Date()) {
    // Expired, remove and return null
    delete cache.entries[key];
    saveCache(cache);
    return null;
  }
  
  // Mark as cache hit
  const result = { ...entry.value, fromCache: true, cacheKey: key };
  return result;
}

/**
 * Store asset in cache
 */
export function setCache(
  key: string,
  value: GeneratedAssets,
  promptHash: string
): void {
  const cache = loadCache();
  
  // Clean up if over entry limit
  const entryCount = Object.keys(cache.entries).length;
  if (entryCount >= CACHE_CONFIG.maxEntries) {
    evictOldestEntries(cache, Math.floor(CACHE_CONFIG.maxEntries * 0.1));
  }
  
  // Calculate expiration
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_CONFIG.ttlDays * 24 * 60 * 60 * 1000);
  
  cache.entries[key] = {
    key,
    value,
    cachedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    promptHash,
  };
  
  saveCache(cache);
}

/**
 * Invalidate cache for a specific prospect
 */
export function invalidateProspect(prospectId: string): number {
  const cache = loadCache();
  const prospectHash = simpleHash(prospectId);
  let removed = 0;
  
  Object.keys(cache.entries).forEach(key => {
    if (key.startsWith(prospectHash + '_') || cache.entries[key].value.prospectId === prospectId) {
      delete cache.entries[key];
      removed++;
    }
  });
  
  if (removed > 0) {
    saveCache(cache);
  }
  
  return removed;
}

/**
 * Invalidate a specific cache entry
 */
export function invalidate(key: string): boolean {
  const cache = loadCache();
  
  if (cache.entries[key]) {
    delete cache.entries[key];
    saveCache(cache);
    return true;
  }
  
  return false;
}

/**
 * Clear all cached assets
 */
export function clearAll(): void {
  localStorage.removeItem(CACHE_CONFIG.storageKey);
}

// ============================================
// Maintenance Operations
// ============================================

/**
 * Remove expired entries
 */
export function cleanupExpired(): number {
  const cache = loadCache();
  const now = new Date();
  let removed = 0;
  
  Object.keys(cache.entries).forEach(key => {
    if (new Date(cache.entries[key].expiresAt) < now) {
      delete cache.entries[key];
      removed++;
    }
  });
  
  if (removed > 0) {
    cache.metadata.lastCleanup = now.toISOString();
    saveCache(cache);
  }
  
  return removed;
}

/**
 * Evict oldest entries (LRU)
 */
function evictOldestEntries(cache: CacheStore, count: number): void {
  const entries = Object.entries(cache.entries)
    .sort((a, b) => new Date(a[1].cachedAt).getTime() - new Date(b[1].cachedAt).getTime());
  
  entries.slice(0, count).forEach(([key]) => {
    delete cache.entries[key];
  });
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  const cache = loadCache();
  const entries = Object.values(cache.entries);
  
  if (entries.length === 0) {
    return {
      totalEntries: 0,
      totalSize: 0,
    };
  }
  
  const sorted = entries.sort(
    (a, b) => new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime()
  );
  
  return {
    totalEntries: entries.length,
    totalSize: cache.metadata.totalSize,
    oldestEntry: sorted[0]?.cachedAt,
    newestEntry: sorted[sorted.length - 1]?.cachedAt,
  };
}

/**
 * Check if a prospect has cached assets
 */
export function hasCachedAssets(prospectId: string): boolean {
  const cache = loadCache();
  const prospectHash = simpleHash(prospectId);
  
  return Object.keys(cache.entries).some(
    key => key.startsWith(prospectHash + '_') || cache.entries[key].value.prospectId === prospectId
  );
}

/**
 * Get all cached entries for a prospect
 */
export function getProspectCacheEntries(prospectId: string): CacheEntry<GeneratedAssets>[] {
  const cache = loadCache();
  const prospectHash = simpleHash(prospectId);
  
  return Object.values(cache.entries).filter(
    entry => entry.key.startsWith(prospectHash + '_') || entry.value.prospectId === prospectId
  );
}

/**
 * Get cache entry metadata (without full value)
 */
export function getCacheEntryInfo(key: string): { cachedAt: string; expiresAt: string; prospectId: string } | null {
  const cache = loadCache();
  const entry = cache.entries[key];
  
  if (!entry) return null;
  
  return {
    cachedAt: entry.cachedAt,
    expiresAt: entry.expiresAt,
    prospectId: entry.value.prospectId,
  };
}
