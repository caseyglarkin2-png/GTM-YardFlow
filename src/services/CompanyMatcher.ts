/**
 * Company Matcher Service - YardFlow Hub
 * 
 * Fuzzy matching algorithm to match imported contacts to existing companies.
 * Uses multiple matching strategies: exact, normalized, domain, and fuzzy.
 */

import type { Company } from '../types';

// ============================================
// Types
// ============================================

/**
 * Match confidence levels
 */
export type MatchConfidence = 'exact' | 'high' | 'medium' | 'low' | 'none';

/**
 * Match result for a single company
 */
export interface CompanyMatch {
  company: Company;
  confidence: MatchConfidence;
  score: number; // 0-100
  matchedOn: MatchField[];
}

/**
 * Fields that can be matched on
 */
export type MatchField = 'name' | 'domain' | 'linkedinUrl' | 'alias';

/**
 * Input for company matching
 */
export interface MatchInput {
  companyName?: string;
  domain?: string;
  linkedinUrl?: string;
  website?: string;
}

/**
 * Matcher configuration
 */
export interface MatcherConfig {
  /** Minimum score threshold (0-100) for considering a match */
  minScore: number;
  /** Maximum number of matches to return */
  maxResults: number;
  /** Weight multipliers for different match types */
  weights: {
    exactName: number;
    normalizedName: number;
    domain: number;
    linkedinUrl: number;
    fuzzyName: number;
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: MatcherConfig = {
  minScore: 40,
  maxResults: 5,
  weights: {
    exactName: 100,
    normalizedName: 90,
    domain: 95,
    linkedinUrl: 100,
    fuzzyName: 70,
  },
};

// ============================================
// Normalization Utilities
// ============================================

/**
 * Common company suffixes to strip for normalization
 */
const COMPANY_SUFFIXES = [
  'inc', 'inc.', 'incorporated',
  'llc', 'l.l.c.', 'llc.',
  'ltd', 'ltd.', 'limited',
  'corp', 'corp.', 'corporation',
  'co', 'co.', 'company',
  'plc', 'plc.',
  'gmbh', 'ag', 'sa', 'srl',
  'pty', 'pty ltd', 'pty. ltd.',
  'pvt', 'pvt.', 'private',
  'holdings', 'group', 'partners',
  'international', 'intl', 'intl.',
  'technologies', 'technology', 'tech',
  'solutions', 'services',
];

/**
 * Common words to ignore in matching
 */
const STOP_WORDS = ['the', 'a', 'an', 'and', '&'];

/**
 * Normalize company name for comparison
 * - Lowercase
 * - Remove punctuation
 * - Remove common suffixes
 * - Remove stop words
 * - Collapse whitespace
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  
  let normalized = name.toLowerCase();
  
  // Remove punctuation except alphanumeric and spaces
  normalized = normalized.replace(/[^\w\s]/g, ' ');
  
  // Split into words
  const words = normalized.split(/\s+/).filter(Boolean);
  
  // Remove stop words
  const filteredWords = words.filter(w => !STOP_WORDS.includes(w));
  
  // Remove company suffixes from the end
  while (filteredWords.length > 1) {
    const lastWord = filteredWords[filteredWords.length - 1];
    if (COMPANY_SUFFIXES.includes(lastWord)) {
      filteredWords.pop();
    } else {
      break;
    }
  }
  
  // Join and collapse spaces
  return filteredWords.join(' ').trim();
}

/**
 * Extract domain from a URL or email
 */
export function extractDomain(urlOrEmail: string): string {
  if (!urlOrEmail) return '';
  
  let input = urlOrEmail.toLowerCase().trim();
  
  // Handle email addresses
  if (input.includes('@')) {
    const parts = input.split('@');
    input = parts[parts.length - 1];
  }
  
  // Remove protocol
  input = input.replace(/^(https?:\/\/)?(www\.)?/, '');
  
  // Remove path and query
  input = input.split('/')[0];
  input = input.split('?')[0];
  input = input.split('#')[0];
  
  // Remove port
  input = input.split(':')[0];
  
  return input;
}

/**
 * Extract LinkedIn company ID from URL
 */
export function extractLinkedInCompanyId(url: string): string | null {
  if (!url) return null;
  
  const patterns = [
    /linkedin\.com\/company\/([^/?\s]+)/i,
    /linkedin\.com\/in\/([^/?\s]+)/i, // Sometimes people URLs are used
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  
  return null;
}

/**
 * Generate name variations for fuzzy matching
 */
export function generateNameVariations(name: string): string[] {
  const variations: string[] = [];
  const normalized = normalizeCompanyName(name);
  
  if (!normalized) return variations;
  
  variations.push(normalized);
  
  // Add abbreviation (first letters of each word)
  const words = normalized.split(' ');
  if (words.length > 1) {
    variations.push(words.map(w => w[0]).join(''));
  }
  
  // Add without common industry terms
  const industryTerms = ['software', 'systems', 'labs', 'studio', 'digital', 'media', 'network'];
  const withoutIndustry = words.filter(w => !industryTerms.includes(w)).join(' ');
  if (withoutIndustry && withoutIndustry !== normalized) {
    variations.push(withoutIndustry);
  }
  
  return variations;
}

// ============================================
// Fuzzy Matching Algorithms
// ============================================

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix: number[][] = [];
  
  // Initialize first column
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  
  // Initialize first row
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill in the rest
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[a.length][b.length];
}

/**
 * Calculate Jaro-Winkler similarity (0-1)
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0;
  
  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  
  // Jaro similarity
  const jaro = (
    matches / s1.length +
    matches / s2.length +
    (matches - transpositions / 2) / matches
  ) / 3;
  
  // Winkler modification (bonus for common prefix)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Calculate fuzzy match score (0-100)
 */
export function fuzzyMatchScore(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  
  const normalized1 = normalizeCompanyName(s1);
  const normalized2 = normalizeCompanyName(s2);
  
  if (!normalized1 || !normalized2) return 0;
  
  // Exact normalized match
  if (normalized1 === normalized2) return 100;
  
  // Contains check (one is substring of other)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    const shorter = Math.min(normalized1.length, normalized2.length);
    const longer = Math.max(normalized1.length, normalized2.length);
    return Math.round((shorter / longer) * 90);
  }
  
  // Jaro-Winkler similarity
  const jaroScore = jaroWinklerSimilarity(normalized1, normalized2);
  
  // Levenshtein distance as a ratio
  const maxLen = Math.max(normalized1.length, normalized2.length);
  const levDistance = levenshteinDistance(normalized1, normalized2);
  const levScore = 1 - levDistance / maxLen;
  
  // Combined score (weight Jaro-Winkler more heavily)
  const combinedScore = (jaroScore * 0.7 + levScore * 0.3) * 100;
  
  return Math.round(combinedScore);
}

// ============================================
// Main Matcher Class
// ============================================

/**
 * Company Matcher - finds matching companies from a corpus
 */
export class CompanyMatcher {
  private companies: Company[] = [];
  private config: MatcherConfig;
  
  // Indexed data for fast lookups
  private domainIndex: Map<string, Company[]> = new Map();
  private linkedinIndex: Map<string, Company[]> = new Map();
  private normalizedNameIndex: Map<string, Company[]> = new Map();
  
  constructor(config: Partial<MatcherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Load companies into the matcher and build indexes
   */
  loadCompanies(companies: Company[]): void {
    this.companies = companies;
    this.buildIndexes();
  }
  
  /**
   * Build lookup indexes for fast matching
   */
  private buildIndexes(): void {
    this.domainIndex.clear();
    this.linkedinIndex.clear();
    this.normalizedNameIndex.clear();
    
    for (const company of this.companies) {
      // Domain index
      if (company.domain) {
        const domain = extractDomain(company.domain);
        if (domain) {
          const existing = this.domainIndex.get(domain) || [];
          existing.push(company);
          this.domainIndex.set(domain, existing);
        }
      }
      
      // LinkedIn index
      if (company.linkedinUrl) {
        const linkedinId = extractLinkedInCompanyId(company.linkedinUrl);
        if (linkedinId) {
          const existing = this.linkedinIndex.get(linkedinId) || [];
          existing.push(company);
          this.linkedinIndex.set(linkedinId, existing);
        }
      }
      
      // Normalized name index
      const normalizedName = normalizeCompanyName(company.name);
      if (normalizedName) {
        const existing = this.normalizedNameIndex.get(normalizedName) || [];
        existing.push(company);
        this.normalizedNameIndex.set(normalizedName, existing);
      }
    }
  }
  
  /**
   * Find matches for a given input
   */
  findMatches(input: MatchInput): CompanyMatch[] {
    const matches: Map<string, CompanyMatch> = new Map();
    
    // 1. Exact LinkedIn URL match (highest priority)
    if (input.linkedinUrl) {
      const linkedinId = extractLinkedInCompanyId(input.linkedinUrl);
      if (linkedinId) {
        const companies = this.linkedinIndex.get(linkedinId) || [];
        for (const company of companies) {
          this.addOrUpdateMatch(matches, company, 'linkedinUrl', this.config.weights.linkedinUrl);
        }
      }
    }
    
    // 2. Domain match (very reliable)
    const domain = input.domain 
      ? extractDomain(input.domain) 
      : (input.website ? extractDomain(input.website) : null);
    
    if (domain) {
      const companies = this.domainIndex.get(domain) || [];
      for (const company of companies) {
        this.addOrUpdateMatch(matches, company, 'domain', this.config.weights.domain);
      }
    }
    
    // 3. Exact normalized name match
    if (input.companyName) {
      const normalizedName = normalizeCompanyName(input.companyName);
      if (normalizedName) {
        const companies = this.normalizedNameIndex.get(normalizedName) || [];
        for (const company of companies) {
          this.addOrUpdateMatch(matches, company, 'name', this.config.weights.normalizedName);
        }
      }
    }
    
    // 4. Fuzzy name matching (for unmatched companies)
    if (input.companyName && matches.size < this.config.maxResults) {
      const inputVariations = generateNameVariations(input.companyName);
      
      for (const company of this.companies) {
        // Skip if already matched with high confidence
        const existing = matches.get(company.id);
        if (existing && existing.score >= this.config.weights.normalizedName) {
          continue;
        }
        
        const companyVariations = generateNameVariations(company.name);
        let bestScore = 0;
        
        for (const inputVar of inputVariations) {
          for (const companyVar of companyVariations) {
            const score = fuzzyMatchScore(inputVar, companyVar);
            bestScore = Math.max(bestScore, score);
          }
        }
        
        // Apply fuzzy weight
        const weightedScore = Math.round(bestScore * this.config.weights.fuzzyName / 100);
        
        if (weightedScore >= this.config.minScore) {
          this.addOrUpdateMatch(matches, company, 'alias', weightedScore);
        }
      }
    }
    
    // Convert to array, filter by min score, sort by score, limit results
    const results = Array.from(matches.values())
      .filter(m => m.score >= this.config.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxResults);
    
    return results;
  }
  
  /**
   * Add or update a match in the results map
   */
  private addOrUpdateMatch(
    matches: Map<string, CompanyMatch>,
    company: Company,
    field: MatchField,
    score: number
  ): void {
    const existing = matches.get(company.id);
    
    if (existing) {
      // Keep the higher score
      if (score > existing.score) {
        existing.score = score;
        existing.confidence = this.scoreToConfidence(score);
      }
      // Add field if not already present
      if (!existing.matchedOn.includes(field)) {
        existing.matchedOn.push(field);
      }
    } else {
      matches.set(company.id, {
        company,
        confidence: this.scoreToConfidence(score),
        score,
        matchedOn: [field],
      });
    }
  }
  
  /**
   * Convert score to confidence level
   */
  private scoreToConfidence(score: number): MatchConfidence {
    if (score >= 95) return 'exact';
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'low';
    return 'none';
  }
  
  /**
   * Find the best single match (or null if no good match)
   */
  findBestMatch(input: MatchInput, minConfidence: MatchConfidence = 'medium'): CompanyMatch | null {
    const matches = this.findMatches(input);
    
    if (matches.length === 0) return null;
    
    const best = matches[0];
    
    // Check if best match meets minimum confidence
    const confidenceLevels: MatchConfidence[] = ['none', 'low', 'medium', 'high', 'exact'];
    const minIndex = confidenceLevels.indexOf(minConfidence);
    const bestIndex = confidenceLevels.indexOf(best.confidence);
    
    if (bestIndex < minIndex) return null;
    
    return best;
  }
  
  /**
   * Batch match multiple inputs
   */
  batchMatch(inputs: MatchInput[]): Map<number, CompanyMatch[]> {
    const results = new Map<number, CompanyMatch[]>();
    
    for (let i = 0; i < inputs.length; i++) {
      results.set(i, this.findMatches(inputs[i]));
    }
    
    return results;
  }
  
  /**
   * Get company count
   */
  getCompanyCount(): number {
    return this.companies.length;
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<MatcherConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): MatcherConfig {
    return { ...this.config };
  }
}

// ============================================
// Singleton Instance
// ============================================

let matcherInstance: CompanyMatcher | null = null;

/**
 * Get the singleton matcher instance
 */
export function getCompanyMatcher(config?: Partial<MatcherConfig>): CompanyMatcher {
  if (!matcherInstance) {
    matcherInstance = new CompanyMatcher(config);
  } else if (config) {
    matcherInstance.updateConfig(config);
  }
  return matcherInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetCompanyMatcher(): void {
  matcherInstance = null;
}
