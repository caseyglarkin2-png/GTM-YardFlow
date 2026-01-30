/**
 * Company Aggregator Service
 * 
 * Aggregates prospects by company for the company-centric view.
 * Combines contact data with company enrichment for a unified view.
 * 
 * Sprint 72: T72.5 - Company Aggregation Service
 */

import type { Prospect } from '../types';
import type { EnrichedCompany, CompanyTier } from '../types/marketing';
import { calculatePrimoLookalikeScore } from './PrimoLookalikeScoring';
import { inferGateBottleneck, getGateLikelihoodLabel } from './GateBottleneckInference';

/**
 * Aggregated company row for the list view
 */
export interface CompanyRow {
  id: string;
  company: string;
  tier: CompanyTier;
  contactCount: number;
  facilityCount: number | null;
  hasGateBottleneck: boolean | null;
  gateConfidence: 'high' | 'medium' | 'low' | 'unknown';
  gateLabel: string;
  industryCategory: string | null;
  estimatedTruckVolume: number | null;
  distributionFootprint: string | null;
  primoLookalikeScore: number;
  roiPotential: number | null;
  contacts: Prospect[];
  // Aggregated persona counts
  execCount: number;
  opsCount: number;
  execOpsCount: number;
  // Enrichment metadata
  lastResearchedAt: string | null;
  needsResearch: boolean;
}

/**
 * Company metrics summary
 */
export interface CompanyMetrics {
  totalCompanies: number;
  companiesWithFacilities: number;
  companiesNeedingResearch: number;
  highPriorityCompanies: number; // 60+ facilities
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  avgPrimoScore: number;
}

/**
 * Options for aggregation
 */
export interface AggregationOptions {
  minContacts?: number;
  sortBy?: 'score' | 'facilities' | 'contacts' | 'roi';
  sortDirection?: 'asc' | 'desc';
  filterTiers?: CompanyTier[];
  filterMinFacilities?: number;
  filterHasGate?: boolean;
  searchTerm?: string;
}

/**
 * Aggregate prospects by company
 * 
 * @param prospects - Array of all prospects
 * @param enrichedCompanies - Optional array of enriched company data
 * @param options - Aggregation options
 * @returns Sorted array of CompanyRow objects
 */
export function aggregateByCompany(
  prospects: Prospect[],
  enrichedCompanies?: Partial<EnrichedCompany>[],
  options: AggregationOptions = {}
): CompanyRow[] {
  const {
    minContacts = 0,
    sortBy = 'score',
    sortDirection = 'desc',
    filterTiers,
    filterMinFacilities,
    filterHasGate,
    searchTerm,
  } = options;

  // Group prospects by normalized company name
  const companyMap = new Map<string, Prospect[]>();
  
  for (const prospect of prospects) {
    const normalizedName = normalizeCompanyName(prospect.company);
    if (!normalizedName) continue;
    
    const existing = companyMap.get(normalizedName) || [];
    existing.push(prospect);
    companyMap.set(normalizedName, existing);
  }

  // Create enrichment lookup
  const enrichmentMap = new Map<string, Partial<EnrichedCompany>>();
  if (enrichedCompanies) {
    for (const ec of enrichedCompanies) {
      if (ec.company) {
        const normalized = normalizeCompanyName(ec.company);
        enrichmentMap.set(normalized, ec);
      }
    }
  }

  // Build CompanyRow for each
  const rows: CompanyRow[] = [];

  for (const [normalizedName, contacts] of companyMap.entries()) {
    // Skip companies with too few contacts
    if (contacts.length < minContacts) continue;

    // Get enrichment data if available
    const enrichment = enrichmentMap.get(normalizedName);

    // Use the most common company name spelling from contacts
    const displayName = getMostCommonName(contacts);

    // Infer gate bottleneck
    const gateResult = inferGateBottleneck({
      industryCategory: enrichment?.industryCategory,
      facilityCount: enrichment?.facilityCount,
      estimatedTruckVolume: enrichment?.estimatedTruckVolume,
      distributionFootprint: enrichment?.distributionFootprint,
    });
    const gateLabel = getGateLikelihoodLabel(gateResult);

    // Calculate Primo-like score using EnrichedCompany format
    const primoScore = calculatePrimoLookalikeScore({
      facilityCount: enrichment?.facilityCount,
      industryCategory: enrichment?.industryCategory,
      opsShare: contacts.length > 0 ? countPersona(contacts, 'ops') / contacts.length : 0,
      maxRevenue: undefined,
      distributionFootprint: enrichment?.distributionFootprint,
    });

    // Calculate ROI potential (simplified: $1M per facility)
    const roiPerFacility = 1_000_000;
    const roiPotential = enrichment?.facilityCount 
      ? enrichment.facilityCount * roiPerFacility 
      : null;

    // Determine tier based on primo score
    const tier = determineTier(primoScore.totalScore, enrichment?.tier);

    // Check if needs research
    const needsResearch = !enrichment?.facilityCount || !enrichment?.industryCategory;

    const row: CompanyRow = {
      id: normalizedName,
      company: displayName,
      tier,
      contactCount: contacts.length,
      facilityCount: enrichment?.facilityCount ?? null,
      hasGateBottleneck: gateResult.isLikelyBottleneck,
      gateConfidence: gateResult.confidence,
      gateLabel: gateLabel.label,
      industryCategory: enrichment?.industryCategory ?? null,
      estimatedTruckVolume: enrichment?.estimatedTruckVolume ?? null,
      distributionFootprint: enrichment?.distributionFootprint ?? null,
      primoLookalikeScore: primoScore.totalScore,
      roiPotential,
      contacts,
      execCount: countPersona(contacts, 'exec'),
      opsCount: countPersona(contacts, 'ops'),
      execOpsCount: countPersona(contacts, 'execOps'),
      lastResearchedAt: null, // Will be set from localStorage
      needsResearch,
    };

    rows.push(row);
  }

  // Apply filters
  let filtered = rows;

  if (filterTiers && filterTiers.length > 0) {
    filtered = filtered.filter(r => filterTiers.includes(r.tier));
  }

  if (filterMinFacilities !== undefined) {
    filtered = filtered.filter(r => 
      r.facilityCount !== null && r.facilityCount >= filterMinFacilities
    );
  }

  if (filterHasGate !== undefined) {
    filtered = filtered.filter(r => r.hasGateBottleneck === filterHasGate);
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(r => 
      r.company.toLowerCase().includes(term) ||
      r.industryCategory?.toLowerCase().includes(term)
    );
  }

  // Sort
  filtered.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'score':
        comparison = a.primoLookalikeScore - b.primoLookalikeScore;
        break;
      case 'facilities':
        comparison = (a.facilityCount ?? -1) - (b.facilityCount ?? -1);
        break;
      case 'contacts':
        comparison = a.contactCount - b.contactCount;
        break;
      case 'roi':
        comparison = (a.roiPotential ?? -1) - (b.roiPotential ?? -1);
        break;
    }

    return sortDirection === 'desc' ? -comparison : comparison;
  });

  return filtered;
}

/**
 * Get contacts for a specific company
 */
export function getCompanyContacts(
  company: string,
  prospects: Prospect[]
): Prospect[] {
  const normalized = normalizeCompanyName(company);
  return prospects.filter(p => normalizeCompanyName(p.company) === normalized);
}

/**
 * Calculate aggregate metrics for all companies
 */
export function calculateCompanyMetrics(rows: CompanyRow[]): CompanyMetrics {
  const companiesWithFacilities = rows.filter(r => r.facilityCount !== null);
  const highPriority = rows.filter(r => r.facilityCount !== null && r.facilityCount >= 60);
  const needingResearch = rows.filter(r => r.needsResearch);

  const totalScore = rows.reduce((sum, r) => sum + r.primoLookalikeScore, 0);

  return {
    totalCompanies: rows.length,
    companiesWithFacilities: companiesWithFacilities.length,
    companiesNeedingResearch: needingResearch.length,
    highPriorityCompanies: highPriority.length,
    tier1Count: rows.filter(r => r.tier === 'Tier 1').length,
    tier2Count: rows.filter(r => r.tier === 'Tier 2').length,
    tier3Count: rows.filter(r => r.tier === 'Tier 3').length,
    avgPrimoScore: rows.length > 0 ? totalScore / rows.length : 0,
  };
}

/**
 * Normalize company name for matching
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    // Remove common suffixes
    .replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|company)$/i, '')
    // Remove punctuation
    .replace(/[.,'"]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get most common company name spelling from contacts
 */
function getMostCommonName(contacts: Prospect[]): string {
  const counts = new Map<string, number>();
  
  for (const contact of contacts) {
    const name = contact.company.trim();
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  let mostCommon = contacts[0]?.company || 'Unknown';
  let maxCount = 0;

  for (const [name, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = name;
    }
  }

  return mostCommon;
}

/**
 * Count contacts with a specific persona
 */
function countPersona(contacts: Prospect[], persona: 'exec' | 'ops' | 'execOps'): number {
  return contacts.filter(c => {
    switch (persona) {
      case 'exec':
        return c.isExec;
      case 'ops':
        return c.isOps;
      case 'execOps':
        return c.isExec && c.isOps;
      default:
        return false;
    }
  }).length;
}

/**
 * Determine tier based on score and existing tier
 */
function determineTier(score: number, existingTier?: CompanyTier): CompanyTier {
  // Use existing tier if available
  if (existingTier && existingTier !== 'Unscored') {
    return existingTier;
  }

  // Determine from primo score
  if (score >= 70) return 'Tier 1';
  if (score >= 50) return 'Tier 2';
  if (score >= 30) return 'Tier 3';
  return 'Tier 4';
}

/**
 * Quick filter presets
 */
export const QUICK_FILTERS = {
  SIXTY_PLUS_FACILITIES: {
    label: '60+ Facilities',
    filter: { filterMinFacilities: 60 },
  },
  PRIMO_LIKE: {
    label: 'Primo-like',
    filter: { filterTiers: ['Tier 1' as CompanyTier] },
  },
  MILLION_PLUS_POTENTIAL: {
    label: '$1M+ Potential',
    filter: { filterMinFacilities: 1 }, // 1+ facilities = $1M+
  },
  NEEDS_RESEARCH: {
    label: 'Needs Research',
    filter: {}, // Special handling - filter on needsResearch
  },
  GATE_BOTTLENECK: {
    label: 'Gate Bottleneck',
    filter: { filterHasGate: true },
  },
} as const;
