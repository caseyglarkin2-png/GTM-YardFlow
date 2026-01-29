/**
 * Primo Lookalike Scoring Service - YardFlow Hub
 * 
 * Calculates how similar a company is to Primo Brands (ideal customer profile).
 * Primo Brands ICP: 260 facilities, beverage/CPG, national footprint, yard-intensive ops.
 * 
 * Sprint 53-54: Core scoring algorithm
 */

import type { EnrichedCompany } from '../types/marketing';

// ============================================
// Types
// ============================================

export type IndustryCategory = 
  | 'beverage' 
  | 'cpg' 
  | 'food_manufacturing' 
  | 'cold_chain' 
  | 'distribution' 
  | 'manufacturing' 
  | 'other';

export type DistributionFootprint = 'local' | 'regional' | 'national' | 'international';

export interface PrimoScoreBreakdown {
  totalScore: number; // 0-100
  facilityScore: number; // 0-30 pts (scaled, 260 facilities = max)
  industryScore: number; // 0-25 pts (beverage/cpg/food = max)
  opsIntensityScore: number; // 0-20 pts (based on opsShare)
  revenueScore: number; // 0-15 pts (scaled by revenue tier)
  footprintScore: number; // 0-10 pts (national = max)
  factors: string[]; // Human-readable factors
}

export interface PrimoLookalikeConfig {
  maxFacilities: number; // Reference for scaling (Primo = 260)
  primoIndustries: IndustryCategory[];
  partialMatchIndustries: IndustryCategory[];
}

// ============================================
// Constants
// ============================================

/**
 * Default configuration based on Primo Brands ICP
 */
export const DEFAULT_CONFIG: PrimoLookalikeConfig = {
  maxFacilities: 260, // Primo Brands benchmark
  primoIndustries: ['beverage', 'cpg', 'food_manufacturing', 'cold_chain'],
  partialMatchIndustries: ['distribution', 'manufacturing'],
};

/**
 * Revenue tier to score mapping
 */
const REVENUE_SCORES: Record<string, number> = {
  '$10B+': 15,
  '$5B-$10B': 13,
  '$1B-$5B': 11,
  '$500M-$1B': 9,
  '$100M-$500M': 7,
  '$50M-$100M': 5,
  '$10M-$50M': 3,
  'Under $10M': 1,
};

// ============================================
// Scoring Functions
// ============================================

/**
 * Calculate facility score (0-30 points)
 * Scaled to Primo's 260 facilities as maximum
 */
export function calculateFacilityScore(
  facilityCount: number | undefined,
  config: PrimoLookalikeConfig = DEFAULT_CONFIG
): number {
  if (!facilityCount || facilityCount <= 0) return 0;
  
  // Scale: 260 facilities = 30 points (max)
  const rawScore = (facilityCount / config.maxFacilities) * 30;
  return Math.min(30, Math.round(rawScore * 10) / 10);
}

/**
 * Calculate industry score (0-25 points)
 * Primo industries get full points, partial match industries get 15
 */
export function calculateIndustryScore(
  category: IndustryCategory | undefined,
  config: PrimoLookalikeConfig = DEFAULT_CONFIG
): number {
  if (!category) return 0;
  
  if (config.primoIndustries.includes(category)) return 25;
  if (config.partialMatchIndustries.includes(category)) return 15;
  return 0;
}

/**
 * Calculate ops intensity score (0-20 points)
 * Based on opsShare (percentage of attendees that are ops)
 */
export function calculateOpsIntensityScore(opsShare: number | undefined): number {
  if (opsShare === undefined || opsShare < 0) return 0;
  
  // opsShare is 0-1, multiply by 20 for 0-20 points
  const score = Math.min(1, opsShare) * 20;
  return Math.round(score * 10) / 10;
}

/**
 * Calculate revenue score (0-15 points)
 * Higher revenue tiers score higher
 */
export function calculateRevenueScore(revenue: string | number | undefined): number {
  if (revenue === undefined) return 0;
  
  // If it's a number, map to tier
  if (typeof revenue === 'number') {
    if (revenue >= 10_000_000_000) return 15;
    if (revenue >= 5_000_000_000) return 13;
    if (revenue >= 1_000_000_000) return 11;
    if (revenue >= 500_000_000) return 9;
    if (revenue >= 100_000_000) return 7;
    if (revenue >= 50_000_000) return 5;
    if (revenue >= 10_000_000) return 3;
    return 1;
  }
  
  // If it's a string tier, look it up
  const normalizedRevenue = revenue.trim();
  for (const [tier, score] of Object.entries(REVENUE_SCORES)) {
    if (normalizedRevenue.includes(tier) || tier.includes(normalizedRevenue)) {
      return score;
    }
  }
  
  return 0;
}

/**
 * Calculate footprint score (0-10 points)
 * National/international footprint is most valuable
 */
export function calculateFootprintScore(footprint: DistributionFootprint | undefined): number {
  if (!footprint) return 0;
  
  switch (footprint) {
    case 'international': return 10;
    case 'national': return 10;
    case 'regional': return 5;
    case 'local': return 2;
    default: return 0;
  }
}

/**
 * Generate human-readable factors for score breakdown
 */
export function generateFactors(company: Partial<EnrichedCompany>): string[] {
  const factors: string[] = [];
  
  if (company.facilityCount) {
    if (company.facilityCount >= 200) {
      factors.push(`Large facility network (${company.facilityCount} sites)`);
    } else if (company.facilityCount >= 100) {
      factors.push(`Medium facility network (${company.facilityCount} sites)`);
    } else if (company.facilityCount >= 20) {
      factors.push(`Growing facility network (${company.facilityCount} sites)`);
    }
  }
  
  if (company.industryCategory) {
    const primoIndustries = DEFAULT_CONFIG.primoIndustries;
    if (primoIndustries.includes(company.industryCategory)) {
      factors.push(`High-value industry: ${company.industryCategory.replace('_', ' ')}`);
    }
  }
  
  if (company.opsShare && company.opsShare > 0.5) {
    factors.push(`Ops-heavy organization (${Math.round(company.opsShare * 100)}% ops)`);
  }
  
  if (company.distributionFootprint === 'national' || company.distributionFootprint === 'international') {
    factors.push(`National/international distribution footprint`);
  }
  
  if (company.isYardIntensive) {
    factors.push('Yard-intensive operations');
  }
  
  if (company.megaBoost && company.megaBoost > 0) {
    factors.push('Mega account boost applied');
  }
  
  return factors;
}

/**
 * Calculate complete Primo Lookalike score with breakdown
 */
export function calculatePrimoLookalikeScore(
  company: Partial<EnrichedCompany>,
  config: PrimoLookalikeConfig = DEFAULT_CONFIG
): PrimoScoreBreakdown {
  const facilityScore = calculateFacilityScore(company.facilityCount, config);
  const industryScore = calculateIndustryScore(company.industryCategory as IndustryCategory | undefined, config);
  const opsIntensityScore = calculateOpsIntensityScore(company.opsShare);
  const revenueScore = calculateRevenueScore(company.maxRevenue);
  const footprintScore = calculateFootprintScore(company.distributionFootprint as DistributionFootprint | undefined);
  
  const totalScore = Math.min(100, Math.round(
    facilityScore + 
    industryScore + 
    opsIntensityScore + 
    revenueScore + 
    footprintScore
  ));
  
  const factors = generateFactors(company);
  
  return {
    totalScore,
    facilityScore,
    industryScore,
    opsIntensityScore,
    revenueScore,
    footprintScore,
    factors,
  };
}

/**
 * Batch calculate Primo Lookalike scores for multiple companies
 */
export function batchCalculatePrimoScores(
  companies: Partial<EnrichedCompany>[],
  config: PrimoLookalikeConfig = DEFAULT_CONFIG
): Map<string, PrimoScoreBreakdown> {
  const results = new Map<string, PrimoScoreBreakdown>();
  
  for (const company of companies) {
    const key = company.id || company.company || '';
    if (key) {
      results.set(key, calculatePrimoLookalikeScore(company, config));
    }
  }
  
  return results;
}

/**
 * Get companies sorted by Primo Lookalike score (highest first)
 */
export function sortByPrimoScore(
  companies: Partial<EnrichedCompany>[],
  config: PrimoLookalikeConfig = DEFAULT_CONFIG
): Array<{ company: Partial<EnrichedCompany>; breakdown: PrimoScoreBreakdown }> {
  return companies
    .map(company => ({
      company,
      breakdown: calculatePrimoLookalikeScore(company, config),
    }))
    .sort((a, b) => b.breakdown.totalScore - a.breakdown.totalScore);
}

/**
 * Filter companies by minimum Primo score
 */
export function filterByMinimumPrimoScore(
  companies: Partial<EnrichedCompany>[],
  minScore: number,
  config: PrimoLookalikeConfig = DEFAULT_CONFIG
): Partial<EnrichedCompany>[] {
  return companies.filter(company => {
    const { totalScore } = calculatePrimoLookalikeScore(company, config);
    return totalScore >= minScore;
  });
}

/**
 * Get Primo Lookalike tier based on score
 */
export function getPrimoTier(score: number): 'primo-match' | 'high-potential' | 'moderate' | 'low' {
  if (score >= 80) return 'primo-match';
  if (score >= 60) return 'high-potential';
  if (score >= 40) return 'moderate';
  return 'low';
}

/**
 * Create Primo Brands test fixture for golden test case
 */
export function createPrimoBrandsFixture(): Partial<EnrichedCompany> {
  return {
    id: 'primo-brands-fixture',
    company: 'Primo Brands',
    facilityCount: 260,
    industryCategory: 'beverage',
    distributionFootprint: 'national',
    isYardIntensive: true,
    opsShare: 0.75,
    maxRevenue: 5_000_000_000, // $5B
    megaBoost: 10,
    tier: 'Tier 1',
    attendees: 15,
    execOpsCount: 5,
  };
}
