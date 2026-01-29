/**
 * Company Enrichment Service - YardFlow Hub
 * 
 * Manages company data enrichment for Primo Lookalike scoring.
 * Supports manual entry and bulk CSV import.
 * 
 * Sprint 53: T53.4a-c
 */

import type { EnrichedCompany } from '../types/marketing';
import { 
  calculatePrimoLookalikeScore, 
  type IndustryCategory, 
  type DistributionFootprint,
  type PrimoScoreBreakdown
} from './PrimoLookalikeScoring';

// ============================================
// Types
// ============================================

export interface CompanyEnrichmentData {
  facilityCount?: number;
  industryCategory?: IndustryCategory;
  distributionFootprint?: DistributionFootprint;
  isYardIntensive?: boolean;
  estimatedTruckVolume?: number;
}

export interface EnrichmentResult {
  success: boolean;
  companyId: string;
  companyName: string;
  oldScore?: number;
  newScore?: number;
  error?: string;
}

export interface BulkEnrichmentResult {
  total: number;
  successful: number;
  failed: number;
  results: EnrichmentResult[];
}

export interface EnrichmentCompletion {
  total: number;
  enriched: number;
  percentage: number;
  missingFacilityCount: number;
  missingIndustry: number;
  missingFootprint: number;
}

export interface CompanyEnrichmentCSV {
  company: string;
  facility_count?: string | number;
  industry?: string;
  footprint?: string;
  is_yard_intensive?: string | boolean;
  truck_volume?: string | number;
}

// ============================================
// Storage (in-memory for now, can be replaced with Firestore)
// ============================================

let enrichmentStore: Map<string, CompanyEnrichmentData> = new Map();
let companyStore: Map<string, Partial<EnrichedCompany>> = new Map();
let companyIdIndex: Map<string, string> = new Map(); // id -> normalized name

/**
 * Initialize store with existing companies
 */
export function initializeCompanyStore(companies: Partial<EnrichedCompany>[]): void {
  companyStore.clear();
  companyIdIndex.clear();
  for (const company of companies) {
    const key = normalizeCompanyName(company.company || '');
    if (key) {
      companyStore.set(key, company);
      if (company.id) {
        companyIdIndex.set(company.id, key);
      }
    }
  }
}

/**
 * Normalize company name for matching
 */
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================
// CRUD Operations (T53.4a)
// ============================================

/**
 * Get enrichment data for a company
 */
export function getEnrichment(companyId: string): CompanyEnrichmentData | undefined {
  return enrichmentStore.get(companyId);
}

/**
 * Set facility count for a company
 */
export function setFacilityCount(companyId: string, count: number): EnrichmentResult {
  try {
    const existing = enrichmentStore.get(companyId) || {};
    enrichmentStore.set(companyId, { ...existing, facilityCount: count });
    
    return recalculateScore(companyId);
  } catch (error) {
    return {
      success: false,
      companyId,
      companyName: companyId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Set industry category for a company
 */
export function setIndustryCategory(companyId: string, category: IndustryCategory): EnrichmentResult {
  try {
    const existing = enrichmentStore.get(companyId) || {};
    enrichmentStore.set(companyId, { ...existing, industryCategory: category });
    
    return recalculateScore(companyId);
  } catch (error) {
    return {
      success: false,
      companyId,
      companyName: companyId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Set distribution footprint for a company
 */
export function setDistributionFootprint(companyId: string, footprint: DistributionFootprint): EnrichmentResult {
  try {
    const existing = enrichmentStore.get(companyId) || {};
    enrichmentStore.set(companyId, { ...existing, distributionFootprint: footprint });
    
    return recalculateScore(companyId);
  } catch (error) {
    return {
      success: false,
      companyId,
      companyName: companyId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Set yard intensive flag
 */
export function setYardIntensive(companyId: string, isYardIntensive: boolean): EnrichmentResult {
  try {
    const existing = enrichmentStore.get(companyId) || {};
    enrichmentStore.set(companyId, { ...existing, isYardIntensive });
    
    return recalculateScore(companyId);
  } catch (error) {
    return {
      success: false,
      companyId,
      companyName: companyId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Set all enrichment data at once
 */
export function setEnrichmentData(companyId: string, data: CompanyEnrichmentData): EnrichmentResult {
  try {
    const existing = enrichmentStore.get(companyId) || {};
    enrichmentStore.set(companyId, { ...existing, ...data });
    
    return recalculateScore(companyId);
  } catch (error) {
    return {
      success: false,
      companyId,
      companyName: companyId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete enrichment data for a company
 */
export function deleteEnrichment(companyId: string): boolean {
  return enrichmentStore.delete(companyId);
}

/**
 * Recalculate Primo score after enrichment update
 */
function recalculateScore(companyId: string): EnrichmentResult {
  // Look up by ID first, then by normalized name
  const normalizedKey = companyIdIndex.get(companyId) || normalizeCompanyName(companyId);
  const company = companyStore.get(normalizedKey);
  const enrichment = enrichmentStore.get(companyId);
  
  const companyName = company?.company || companyId;
  const oldScore = company?.primoLookalikeScore;
  
  if (company && enrichment) {
    // Merge enrichment data into company
    const enrichedCompany = {
      ...company,
      ...enrichment,
    };
    
    const breakdown = calculatePrimoLookalikeScore(enrichedCompany);
    
    // Update company store with new score
    companyStore.set(normalizedKey, {
      ...enrichedCompany,
      primoLookalikeScore: breakdown.totalScore,
    });
    
    return {
      success: true,
      companyId,
      companyName,
      oldScore,
      newScore: breakdown.totalScore,
    };
  }
  
  return {
    success: true,
    companyId,
    companyName,
    oldScore,
    newScore: oldScore,
  };
}

// ============================================
// Bulk Operations (T53.4b)
// ============================================

/**
 * Parse industry string to category
 */
function parseIndustryCategory(industry: string | undefined): IndustryCategory | undefined {
  if (!industry) return undefined;
  
  const normalized = industry.toLowerCase().trim();
  
  if (normalized.includes('beverage') || normalized.includes('drink')) return 'beverage';
  if (normalized.includes('cpg') || normalized.includes('consumer packaged')) return 'cpg';
  if (normalized.includes('food') && normalized.includes('manufact')) return 'food_manufacturing';
  if (normalized.includes('cold') || normalized.includes('refriger') || normalized.includes('frozen')) return 'cold_chain';
  if (normalized.includes('distribution') || normalized.includes('logistics') || normalized.includes('3pl')) return 'distribution';
  if (normalized.includes('manufactur')) return 'manufacturing';
  
  return 'other';
}

/**
 * Parse footprint string to enum
 */
function parseDistributionFootprint(footprint: string | undefined): DistributionFootprint | undefined {
  if (!footprint) return undefined;
  
  const normalized = footprint.toLowerCase().trim();
  
  if (normalized.includes('international') || normalized.includes('global')) return 'international';
  if (normalized.includes('national') || normalized.includes('nationwide')) return 'national';
  if (normalized.includes('regional') || normalized.includes('multi-state')) return 'regional';
  if (normalized.includes('local') || normalized.includes('single')) return 'local';
  
  return undefined;
}

/**
 * Parse boolean from various formats
 */
function parseBoolean(value: string | boolean | undefined): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (!value) return undefined;
  
  const normalized = String(value).toLowerCase().trim();
  if (['true', 'yes', '1', 'y'].includes(normalized)) return true;
  if (['false', 'no', '0', 'n'].includes(normalized)) return false;
  
  return undefined;
}

/**
 * Parse number from various formats
 */
function parseNumber(value: string | number | undefined): number | undefined {
  if (typeof value === 'number') return value;
  if (!value) return undefined;
  
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Bulk enrich from CSV data
 */
export function bulkEnrichFromCSV(data: CompanyEnrichmentCSV[]): BulkEnrichmentResult {
  const results: EnrichmentResult[] = [];
  let successful = 0;
  let failed = 0;
  
  for (const row of data) {
    try {
      const companyKey = normalizeCompanyName(row.company);
      
      // Find matching company in store
      const existingCompany = companyStore.get(companyKey);
      
      if (!existingCompany) {
        results.push({
          success: false,
          companyId: row.company,
          companyName: row.company,
          error: 'Company not found in database',
        });
        failed++;
        continue;
      }
      
      const enrichmentData: CompanyEnrichmentData = {
        facilityCount: parseNumber(row.facility_count),
        industryCategory: parseIndustryCategory(row.industry),
        distributionFootprint: parseDistributionFootprint(row.footprint),
        isYardIntensive: parseBoolean(row.is_yard_intensive),
        estimatedTruckVolume: parseNumber(row.truck_volume),
      };
      
      // Remove undefined values
      const cleanedData = Object.fromEntries(
        Object.entries(enrichmentData).filter(([_, v]) => v !== undefined)
      ) as CompanyEnrichmentData;
      
      const result = setEnrichmentData(existingCompany.id || companyKey, cleanedData);
      results.push(result);
      
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    } catch (error) {
      results.push({
        success: false,
        companyId: row.company,
        companyName: row.company,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      failed++;
    }
  }
  
  return {
    total: data.length,
    successful,
    failed,
    results,
  };
}

// ============================================
// Gap Detection (T53.4c)
// ============================================

/**
 * Get companies that are missing Primo Lookalike enrichment data
 */
export function getUnenrichedCompanies(): Partial<EnrichedCompany>[] {
  const unenriched: Partial<EnrichedCompany>[] = [];
  
  for (const company of companyStore.values()) {
    const enrichment = enrichmentStore.get(company.id || normalizeCompanyName(company.company || ''));
    
    // Check if missing key fields
    const hasFacilityCount = company.facilityCount !== undefined || enrichment?.facilityCount !== undefined;
    const hasIndustry = company.industryCategory !== undefined || enrichment?.industryCategory !== undefined;
    const hasFootprint = company.distributionFootprint !== undefined || enrichment?.distributionFootprint !== undefined;
    
    if (!hasFacilityCount || !hasIndustry || !hasFootprint) {
      unenriched.push(company);
    }
  }
  
  // Sort by tier (Tier 1 first) then by attendees (most first)
  return unenriched.sort((a, b) => {
    const tierOrder: Record<string, number> = { 'Tier 1': 0, 'Tier 2': 1, 'Tier 3': 2, 'Tier 4': 3, 'Unscored': 4 };
    const tierDiff = (tierOrder[a.tier || 'Unscored'] ?? 4) - (tierOrder[b.tier || 'Unscored'] ?? 4);
    if (tierDiff !== 0) return tierDiff;
    return (b.attendees || 0) - (a.attendees || 0);
  });
}

/**
 * Get enrichment completion stats
 */
export function getEnrichmentCompletion(): EnrichmentCompletion {
  let total = 0;
  let enriched = 0;
  let missingFacilityCount = 0;
  let missingIndustry = 0;
  let missingFootprint = 0;
  
  for (const company of companyStore.values()) {
    total++;
    
    const enrichment = enrichmentStore.get(company.id || normalizeCompanyName(company.company || ''));
    
    const hasFacilityCount = company.facilityCount !== undefined || enrichment?.facilityCount !== undefined;
    const hasIndustry = company.industryCategory !== undefined || enrichment?.industryCategory !== undefined;
    const hasFootprint = company.distributionFootprint !== undefined || enrichment?.distributionFootprint !== undefined;
    
    if (!hasFacilityCount) missingFacilityCount++;
    if (!hasIndustry) missingIndustry++;
    if (!hasFootprint) missingFootprint++;
    
    if (hasFacilityCount && hasIndustry && hasFootprint) {
      enriched++;
    }
  }
  
  return {
    total,
    enriched,
    percentage: total > 0 ? Math.round((enriched / total) * 100) : 0,
    missingFacilityCount,
    missingIndustry,
    missingFootprint,
  };
}

/**
 * Get all companies with their Primo scores
 */
export function getAllCompaniesWithScores(): Array<{
  company: Partial<EnrichedCompany>;
  breakdown: PrimoScoreBreakdown;
}> {
  const results: Array<{ company: Partial<EnrichedCompany>; breakdown: PrimoScoreBreakdown }> = [];
  
  for (const company of companyStore.values()) {
    const enrichment = enrichmentStore.get(company.id || normalizeCompanyName(company.company || ''));
    
    const enrichedCompany = enrichment ? { ...company, ...enrichment } : company;
    const breakdown = calculatePrimoLookalikeScore(enrichedCompany);
    
    results.push({ company: enrichedCompany, breakdown });
  }
  
  return results.sort((a, b) => b.breakdown.totalScore - a.breakdown.totalScore);
}

/**
 * Clear all enrichment data (for testing)
 */
export function clearEnrichmentStore(): void {
  enrichmentStore.clear();
}

/**
 * Clear company store (for testing)
 */
export function clearCompanyStore(): void {
  companyStore.clear();
  companyIdIndex.clear();
}

/**
 * Get company store size (for testing)
 */
export function getCompanyStoreSize(): number {
  return companyStore.size;
}

/**
 * Get enrichment store size (for testing)
 */
export function getEnrichmentStoreSize(): number {
  return enrichmentStore.size;
}
