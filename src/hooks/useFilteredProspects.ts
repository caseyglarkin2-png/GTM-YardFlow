// src/hooks/useFilteredProspects.ts
import { useMemo, useEffect } from 'react';
import type { Prospect } from '@/types';

type Tier = 'Tier 1' | 'Tier 2' | 'Tier 3';
type EmailFilter = 'all' | 'has_email' | 'no_email';
import { FacilityInferenceService } from '@/services/FacilityInferenceService';
import { SearchIndexService, type SearchableProspect } from '@/services/SearchIndexService';

interface UseFilteredProspectsProps {
  prospects: Prospect[];
  filter: string;
  tierFilter: Tier | 'All';
  emailFilter: EmailFilter;
  hitlistDateRange: { start: Date; end: Date } | null;
}

export function useFilteredProspects({
  prospects,
  filter,
  tierFilter,
  emailFilter,
  hitlistDateRange
}: UseFilteredProspectsProps) {
  
  // Initialize search service once
  const searchIndexService = useMemo(() => new SearchIndexService<SearchableProspect>({
    keys: [
      { name: 'fullName', weight: 0.3 },
      { name: 'company', weight: 0.25 },
      { name: 'title', weight: 0.2 },
      { name: 'email', weight: 0.15 },
      { name: 'tags', weight: 0.1 },
    ],
    threshold: 0.4,
    distance: 100,
    minMatchCharLength: 2,
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
  }), []);

  // Update search index when prospects change
  useEffect(() => {
    const searchableProspects: SearchableProspect[] = prospects.map(p => ({
      id: p.id,
      firstName: p.name.split(' ')[0] || '',
      lastName: p.name.split(' ').slice(1).join(' ') || '',
      fullName: p.name,
      email: p.email || '',
      company: p.company,
      title: p.title,
      linkedInUrl: p.linkedinUrl,
      location: p.location,
      status: p.status,
      tags: p.tags,
      notes: p.notes,
    }));
    searchIndexService.loadItems(searchableProspects);
  }, [prospects, searchIndexService]);

  const filteredProspects = useMemo(() => {
    let matchingIds: Set<string> | null = null;
    
    // Perform fuzzy search if filter exists
    if (filter.trim()) {
      const searchResults = searchIndexService.search(filter, { limit: 100, threshold: 0.6 });
      matchingIds = new Set(searchResults.map(r => r.item.id));
    }

    return prospects
      .map(p => ({
        ...p,
        // Ensure facility count is ready for sorting
        estimatedFacilities: FacilityInferenceService.inferFacilities(p, (p as any).employees)
      }))
      .filter((p) => {
        // Search Filter
        if (matchingIds && !matchingIds.has(p.id)) {
            return false;
        }

        // Tier Filter
        if (tierFilter !== 'All' && p.tier !== tierFilter) {
            return false;
        }
        
        // Email status filter
        if (emailFilter === 'has_email' && !p.email) return false;
        if (emailFilter === 'no_email' && !!p.email) return false;
          
        // Date Range Filter
        if (hitlistDateRange && p.createdAt) {
          const prospectDate = new Date(p.createdAt);
          if (prospectDate < hitlistDateRange.start || prospectDate > hitlistDateRange.end) {
              return false;
          }
        }
        
        return true;
      })
      .sort((a, b) => {
        // Sprint 906: Prioritize high facility count (Manifest Lead Scoring)
        const facA = a.estimatedFacilities || 0;
        const facB = b.estimatedFacilities || 0;
        
        // Secondary sort by score
        if (facB !== facA) return facB - facA;
        return b.score - a.score;
      });
  }, [prospects, filter, tierFilter, emailFilter, hitlistDateRange, searchIndexService]);

  return { filteredProspects };
}
