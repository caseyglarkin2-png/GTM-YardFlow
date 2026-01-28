/**
 * Segmentation Service - YardFlow Hub
 * 
 * Composable filters for prospect segmentation with high performance.
 */

import type { EnrichedPerson, SegmentFilter, SavedSegment } from '../types/marketing';

// ============================================
// Filter Functions
// ============================================

/**
 * Apply all filters to a list of prospects
 * Performance target: <100ms for 10K records
 */
export function applyFilters(
  prospects: EnrichedPerson[],
  filters: SegmentFilter
): EnrichedPerson[] {
  // Early return if no filters
  if (isEmptyFilter(filters)) {
    return prospects;
  }
  
  return prospects.filter((prospect) => matchesAllFilters(prospect, filters));
}

/**
 * Check if a prospect matches all active filters
 */
export function matchesAllFilters(
  prospect: EnrichedPerson,
  filters: SegmentFilter
): boolean {
  // Tier filter (OR within tiers)
  if (filters.tiers && filters.tiers.length > 0) {
    // Need to look up company tier - for now, skip if no tier data
    // This would normally be joined with company data
  }
  
  // Persona filter (OR within personas)
  if (filters.personas && filters.personas.length > 0) {
    const matchesPersona = filters.personas.some((persona) => {
      switch (persona) {
        case 'exec': return prospect.isExec;
        case 'ops': return prospect.isOps;
        case 'execOps': return prospect.isExecOps;
        case 'proc': return prospect.isProc;
        case 'sales': return prospect.isSales;
        case 'tech': return prospect.isTech;
        default: return false;
      }
    });
    if (!matchesPersona) return false;
  }
  
  // Category filter (OR within categories)
  if (filters.categories && filters.categories.length > 0) {
    if (!filters.categories.includes(prospect.category)) {
      return false;
    }
  }
  
  // Score range (inclusive)
  if (filters.scoreMin !== undefined && prospect.personScore < filters.scoreMin) {
    return false;
  }
  if (filters.scoreMax !== undefined && prospect.personScore > filters.scoreMax) {
    return false;
  }
  
  // Has email filter
  if (filters.hasEmail === true) {
    if (!prospect.email || prospect.email.trim() === '') {
      return false;
    }
  } else if (filters.hasEmail === false) {
    if (prospect.email && prospect.email.trim() !== '') {
      return false;
    }
  }
  
  // Has LinkedIn filter
  if (filters.hasLinkedIn === true) {
    if (!prospect.linkedinUrl || prospect.linkedinUrl.trim() === '') {
      return false;
    }
  }
  
  // Qualified filter
  if (filters.qualified !== undefined && prospect.qualified !== filters.qualified) {
    return false;
  }
  
  // Has sequence filter
  if (filters.hasSequence !== undefined) {
    if (filters.hasSequence && !prospect.sequenceAssigned) return false;
    if (!filters.hasSequence && prospect.sequenceAssigned) return false;
  }
  
  // Search filter (fuzzy match on name/company/title)
  if (filters.search && filters.search.trim() !== '') {
    const searchLower = filters.search.toLowerCase().trim();
    const matches =
      prospect.name.toLowerCase().includes(searchLower) ||
      prospect.company.toLowerCase().includes(searchLower) ||
      prospect.jobTitle.toLowerCase().includes(searchLower);
    if (!matches) return false;
  }
  
  return true;
}

/**
 * Check if filter is effectively empty (no active filters)
 */
export function isEmptyFilter(filters: SegmentFilter): boolean {
  return (
    (!filters.tiers || filters.tiers.length === 0) &&
    (!filters.personas || filters.personas.length === 0) &&
    (!filters.categories || filters.categories.length === 0) &&
    filters.scoreMin === undefined &&
    filters.scoreMax === undefined &&
    filters.hasEmail === undefined &&
    filters.hasLinkedIn === undefined &&
    filters.qualified === undefined &&
    filters.hasSequence === undefined &&
    (!filters.search || filters.search.trim() === '')
  );
}

/**
 * Count prospects matching filters (optimized)
 */
export function countMatches(
  prospects: EnrichedPerson[],
  filters: SegmentFilter
): number {
  if (isEmptyFilter(filters)) {
    return prospects.length;
  }
  
  let count = 0;
  for (const prospect of prospects) {
    if (matchesAllFilters(prospect, filters)) {
      count++;
    }
  }
  return count;
}

/**
 * Get filter summary text
 */
export function getFilterSummary(filters: SegmentFilter): string {
  const parts: string[] = [];
  
  if (filters.tiers && filters.tiers.length > 0) {
    parts.push(filters.tiers.join(', '));
  }
  
  if (filters.personas && filters.personas.length > 0) {
    parts.push(filters.personas.join(' | '));
  }
  
  if (filters.categories && filters.categories.length > 0) {
    parts.push(filters.categories.join(', '));
  }
  
  if (filters.scoreMin !== undefined || filters.scoreMax !== undefined) {
    const min = filters.scoreMin ?? 0;
    const max = filters.scoreMax ?? 100;
    parts.push(`Score ${min}-${max}`);
  }
  
  if (filters.hasEmail) {
    parts.push('Has Email');
  }
  
  if (filters.qualified) {
    parts.push('Qualified');
  }
  
  if (filters.search) {
    parts.push(`"${filters.search}"`);
  }
  
  return parts.length > 0 ? parts.join(' + ') : 'All Prospects';
}

// ============================================
// Saved Segments
// ============================================

const SEGMENTS_STORAGE_KEY = 'yardflow_saved_segments';

/**
 * Save a segment
 */
export function saveSegment(
  name: string,
  filters: SegmentFilter,
  prospectCount?: number
): SavedSegment {
  const segments = loadAllSegments();
  
  const segment: SavedSegment = {
    id: crypto.randomUUID(),
    name,
    filters,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    prospectCount,
  };
  
  segments.push(segment);
  localStorage.setItem(SEGMENTS_STORAGE_KEY, JSON.stringify(segments));
  
  return segment;
}

/**
 * Update an existing segment
 */
export function updateSegment(
  id: string,
  updates: Partial<Pick<SavedSegment, 'name' | 'filters' | 'prospectCount'>>
): SavedSegment | null {
  const segments = loadAllSegments();
  const index = segments.findIndex((s) => s.id === id);
  
  if (index === -1) return null;
  
  segments[index] = {
    ...segments[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  localStorage.setItem(SEGMENTS_STORAGE_KEY, JSON.stringify(segments));
  return segments[index];
}

/**
 * Load all saved segments
 */
export function loadAllSegments(): SavedSegment[] {
  try {
    const stored = localStorage.getItem(SEGMENTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Load a specific segment
 */
export function loadSegment(id: string): SavedSegment | null {
  const segments = loadAllSegments();
  return segments.find((s) => s.id === id) || null;
}

/**
 * Delete a segment
 */
export function deleteSegment(id: string): boolean {
  const segments = loadAllSegments();
  const filtered = segments.filter((s) => s.id !== id);
  
  if (filtered.length === segments.length) return false;
  
  localStorage.setItem(SEGMENTS_STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

// ============================================
// Segment Statistics
// ============================================

/**
 * Get statistics for a segment
 */
export function getSegmentStats(prospects: EnrichedPerson[]): {
  total: number;
  withEmail: number;
  withLinkedIn: number;
  qualified: number;
  withSequence: number;
  byCategory: Record<string, number>;
  byPersona: Record<string, number>;
  avgScore: number;
} {
  const stats = {
    total: prospects.length,
    withEmail: 0,
    withLinkedIn: 0,
    qualified: 0,
    withSequence: 0,
    byCategory: {} as Record<string, number>,
    byPersona: {
      exec: 0,
      ops: 0,
      execOps: 0,
      proc: 0,
      sales: 0,
      tech: 0,
    },
    avgScore: 0,
  };
  
  let totalScore = 0;
  
  for (const p of prospects) {
    if (p.email && p.email.trim() !== '') stats.withEmail++;
    if (p.linkedinUrl && p.linkedinUrl.trim() !== '') stats.withLinkedIn++;
    if (p.qualified) stats.qualified++;
    if (p.sequenceAssigned) stats.withSequence++;
    
    // Category count
    stats.byCategory[p.category] = (stats.byCategory[p.category] || 0) + 1;
    
    // Persona counts (a person can have multiple)
    if (p.isExec) stats.byPersona.exec++;
    if (p.isOps) stats.byPersona.ops++;
    if (p.isExecOps) stats.byPersona.execOps++;
    if (p.isProc) stats.byPersona.proc++;
    if (p.isSales) stats.byPersona.sales++;
    if (p.isTech) stats.byPersona.tech++;
    
    totalScore += p.personScore;
  }
  
  stats.avgScore = prospects.length > 0 ? totalScore / prospects.length : 0;
  
  return stats;
}
