/**
 * Duplicate Detector Service - YardFlow Hub
 * 
 * Detects duplicate prospects/contacts using multiple matching strategies.
 * Supports exact matching, fuzzy matching, and configurable deduplication rules.
 */

import type { Prospect } from '../types';
import { 
  normalizeCompanyName, 
  extractDomain, 
  levenshteinDistance,
  jaroWinklerSimilarity,
} from './CompanyMatcher';

// ============================================
// Types
// ============================================

/**
 * Duplicate match confidence
 */
export type DuplicateConfidence = 'exact' | 'high' | 'medium' | 'low';

/**
 * Fields that can be used for duplicate detection
 */
export type DuplicateField = 
  | 'email'
  | 'linkedinUrl'
  | 'phone'
  | 'name'
  | 'nameAndCompany';

/**
 * A potential duplicate pair
 */
export interface DuplicatePair {
  original: Prospect;
  duplicate: Prospect;
  confidence: DuplicateConfidence;
  score: number;
  matchedFields: DuplicateField[];
  recommendation: 'merge' | 'review' | 'keep_both';
}

/**
 * Duplicate detection result for a single prospect
 */
export interface DuplicateResult {
  prospect: Prospect;
  duplicates: DuplicatePair[];
  hasDuplicates: boolean;
}

/**
 * Bulk duplicate detection result
 */
export interface BulkDuplicateResult {
  totalChecked: number;
  withDuplicates: number;
  duplicatePairs: DuplicatePair[];
  uniqueProspects: Prospect[];
}

/**
 * Duplicate detection configuration
 */
export interface DuplicateConfig {
  /** Enable email matching */
  matchEmail: boolean;
  /** Enable LinkedIn URL matching */
  matchLinkedIn: boolean;
  /** Enable phone matching */
  matchPhone: boolean;
  /** Enable fuzzy name matching */
  matchName: boolean;
  /** Minimum score for name matching (0-100) */
  nameMatchThreshold: number;
  /** Enable name + company combination matching */
  matchNameAndCompany: boolean;
  /** Case-insensitive matching */
  caseInsensitive: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: DuplicateConfig = {
  matchEmail: true,
  matchLinkedIn: true,
  matchPhone: true,
  matchName: true,
  nameMatchThreshold: 85,
  matchNameAndCompany: true,
  caseInsensitive: true,
};

// ============================================
// Normalization Utilities
// ============================================

/**
 * Normalize email address
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  
  let normalized = email.toLowerCase().trim();
  
  // Remove dots from Gmail addresses (Gmail ignores dots)
  const parts = normalized.split('@');
  if (parts.length === 2 && parts[1] === 'gmail.com') {
    parts[0] = parts[0].replace(/\./g, '');
  }
  
  // Remove plus aliases (user+alias@domain.com → user@domain.com)
  if (parts.length === 2) {
    const plusIndex = parts[0].indexOf('+');
    if (plusIndex !== -1) {
      parts[0] = parts[0].substring(0, plusIndex);
    }
    normalized = parts.join('@');
  }
  
  return normalized;
}

/**
 * Normalize phone number (extract digits only)
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Extract digits only
  let digits = phone.replace(/\D/g, '');
  
  // Remove leading 1 for US numbers
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.substring(1);
  }
  
  // Only return if it looks like a valid phone (at least 7 digits)
  return digits.length >= 7 ? digits : '';
}

/**
 * Normalize LinkedIn URL to extract profile ID
 */
export function normalizeLinkedInUrl(url: string): string {
  if (!url) return '';
  
  const lower = url.toLowerCase();
  
  // Extract profile path
  const patterns = [
    /linkedin\.com\/in\/([^/?\s]+)/i,
    /linkedin\.com\/pub\/([^/?\s]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      return match[1].replace(/-+$/, ''); // Remove trailing hyphens
    }
  }
  
  return '';
}

/**
 * Normalize name for comparison
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize spaces
    .trim();
}

/**
 * Calculate name similarity score (0-100)
 */
export function nameMatchScore(name1: string, name2: string): number {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 100;
  
  // Check for name component matches (first/last name swap)
  const parts1 = n1.split(' ');
  const parts2 = n2.split(' ');
  
  // Check if same parts in different order
  const sorted1 = [...parts1].sort().join(' ');
  const sorted2 = [...parts2].sort().join(' ');
  if (sorted1 === sorted2) return 95;
  
  // Jaro-Winkler similarity
  const jwScore = jaroWinklerSimilarity(n1, n2);
  
  // Levenshtein ratio
  const maxLen = Math.max(n1.length, n2.length);
  const levDistance = levenshteinDistance(n1, n2);
  const levScore = 1 - levDistance / maxLen;
  
  // Weighted combination
  return Math.round((jwScore * 0.6 + levScore * 0.4) * 100);
}

// ============================================
// Duplicate Detector Class
// ============================================

export class DuplicateDetector {
  private config: DuplicateConfig;
  
  // Indexes for fast lookups
  private emailIndex: Map<string, Prospect[]> = new Map();
  private linkedinIndex: Map<string, Prospect[]> = new Map();
  private phoneIndex: Map<string, Prospect[]> = new Map();
  private prospects: Prospect[] = [];
  
  constructor(config: Partial<DuplicateConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Load prospects for duplicate checking
   */
  loadProspects(prospects: Prospect[]): void {
    this.prospects = prospects;
    this.buildIndexes();
  }
  
  /**
   * Build lookup indexes for fast matching
   */
  private buildIndexes(): void {
    this.emailIndex.clear();
    this.linkedinIndex.clear();
    this.phoneIndex.clear();
    
    for (const prospect of this.prospects) {
      // Email index
      if (prospect.email) {
        const normalizedEmail = normalizeEmail(prospect.email);
        if (normalizedEmail) {
          const existing = this.emailIndex.get(normalizedEmail) || [];
          existing.push(prospect);
          this.emailIndex.set(normalizedEmail, existing);
        }
      }
      
      // LinkedIn index
      if (prospect.linkedinUrl) {
        const normalizedLinkedin = normalizeLinkedInUrl(prospect.linkedinUrl);
        if (normalizedLinkedin) {
          const existing = this.linkedinIndex.get(normalizedLinkedin) || [];
          existing.push(prospect);
          this.linkedinIndex.set(normalizedLinkedin, existing);
        }
      }
      
      // Phone index
      if (prospect.phone) {
        const normalizedPhone = normalizePhone(prospect.phone);
        if (normalizedPhone) {
          const existing = this.phoneIndex.get(normalizedPhone) || [];
          existing.push(prospect);
          this.phoneIndex.set(normalizedPhone, existing);
        }
      }
    }
  }
  
  /**
   * Find duplicates for a single prospect
   */
  findDuplicates(prospect: Prospect): DuplicateResult {
    const duplicateMap = new Map<string, DuplicatePair>();
    
    // 1. Email match (exact)
    if (this.config.matchEmail && prospect.email) {
      const normalizedEmail = normalizeEmail(prospect.email);
      const matches = this.emailIndex.get(normalizedEmail) || [];
      
      for (const match of matches) {
        if (match.id !== prospect.id) {
          this.addDuplicate(duplicateMap, prospect, match, 'email', 100);
        }
      }
    }
    
    // 2. LinkedIn match (exact)
    if (this.config.matchLinkedIn && prospect.linkedinUrl) {
      const normalizedLinkedin = normalizeLinkedInUrl(prospect.linkedinUrl);
      const matches = this.linkedinIndex.get(normalizedLinkedin) || [];
      
      for (const match of matches) {
        if (match.id !== prospect.id) {
          this.addDuplicate(duplicateMap, prospect, match, 'linkedinUrl', 100);
        }
      }
    }
    
    // 3. Phone match (exact)
    if (this.config.matchPhone && prospect.phone) {
      const normalizedPhone = normalizePhone(prospect.phone);
      const matches = this.phoneIndex.get(normalizedPhone) || [];
      
      for (const match of matches) {
        if (match.id !== prospect.id) {
          this.addDuplicate(duplicateMap, prospect, match, 'phone', 95);
        }
      }
    }
    
    // 4. Fuzzy name matching
    if (this.config.matchName && prospect.name) {
      for (const candidate of this.prospects) {
        if (candidate.id === prospect.id) continue;
        if (!candidate.name) continue;
        
        // Skip if already matched with high confidence
        const existing = duplicateMap.get(candidate.id);
        if (existing && existing.score >= 90) continue;
        
        const nameScore = nameMatchScore(prospect.name, candidate.name);
        
        if (nameScore >= this.config.nameMatchThreshold) {
          this.addDuplicate(duplicateMap, prospect, candidate, 'name', nameScore);
        }
      }
    }
    
    // 5. Name + Company combination
    if (this.config.matchNameAndCompany && prospect.name && prospect.company) {
      for (const candidate of this.prospects) {
        if (candidate.id === prospect.id) continue;
        if (!candidate.name || !candidate.company) continue;
        
        // Check if names are similar
        const nameScore = nameMatchScore(prospect.name, candidate.name);
        if (nameScore < 70) continue; // Names must be somewhat similar
        
        // Check if companies match
        const normalizedCompany1 = normalizeCompanyName(prospect.company);
        const normalizedCompany2 = normalizeCompanyName(candidate.company);
        
        if (normalizedCompany1 === normalizedCompany2) {
          // Same company + similar name = likely duplicate
          const combinedScore = Math.min(95, nameScore + 10);
          this.addDuplicate(duplicateMap, prospect, candidate, 'nameAndCompany', combinedScore);
        }
      }
    }
    
    const duplicates = Array.from(duplicateMap.values())
      .sort((a, b) => b.score - a.score);
    
    return {
      prospect,
      duplicates,
      hasDuplicates: duplicates.length > 0,
    };
  }
  
  /**
   * Add or update a duplicate in the map
   */
  private addDuplicate(
    map: Map<string, DuplicatePair>,
    original: Prospect,
    duplicate: Prospect,
    field: DuplicateField,
    score: number
  ): void {
    const existing = map.get(duplicate.id);
    
    if (existing) {
      // Update if higher score
      if (score > existing.score) {
        existing.score = score;
        existing.confidence = this.scoreToConfidence(score);
        existing.recommendation = this.getRecommendation(score);
      }
      // Add field if not present
      if (!existing.matchedFields.includes(field)) {
        existing.matchedFields.push(field);
      }
    } else {
      map.set(duplicate.id, {
        original,
        duplicate,
        confidence: this.scoreToConfidence(score),
        score,
        matchedFields: [field],
        recommendation: this.getRecommendation(score),
      });
    }
  }
  
  /**
   * Convert score to confidence level
   */
  private scoreToConfidence(score: number): DuplicateConfidence {
    if (score >= 95) return 'exact';
    if (score >= 85) return 'high';
    if (score >= 70) return 'medium';
    return 'low';
  }
  
  /**
   * Get merge recommendation based on score
   */
  private getRecommendation(score: number): 'merge' | 'review' | 'keep_both' {
    if (score >= 95) return 'merge';
    if (score >= 80) return 'review';
    return 'keep_both';
  }
  
  /**
   * Find all duplicates in a list of prospects
   */
  findAllDuplicates(newProspects: Prospect[]): BulkDuplicateResult {
    // Track which prospects have duplicates
    const duplicatePairs: DuplicatePair[] = [];
    const seenPairs = new Set<string>();
    const prospectsWithDuplicates = new Set<string>();
    
    // Check new prospects against loaded prospects
    for (const prospect of newProspects) {
      const result = this.findDuplicates(prospect);
      
      for (const pair of result.duplicates) {
        // Create a canonical pair key to avoid duplicate pairs
        const pairKey = [pair.original.id, pair.duplicate.id].sort().join('::');
        
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          duplicatePairs.push(pair);
          prospectsWithDuplicates.add(pair.original.id);
          prospectsWithDuplicates.add(pair.duplicate.id);
        }
      }
    }
    
    // Find unique prospects (those without duplicates)
    const uniqueProspects = newProspects.filter(
      p => !prospectsWithDuplicates.has(p.id)
    );
    
    return {
      totalChecked: newProspects.length,
      withDuplicates: prospectsWithDuplicates.size,
      duplicatePairs: duplicatePairs.sort((a, b) => b.score - a.score),
      uniqueProspects,
    };
  }
  
  /**
   * Check if a prospect is a duplicate of any loaded prospect
   */
  isDuplicate(prospect: Prospect): boolean {
    const result = this.findDuplicates(prospect);
    return result.hasDuplicates;
  }
  
  /**
   * Check against imported prospects (for import deduplication)
   * Returns duplicates from the import batch itself
   */
  findImportDuplicates(imports: Prospect[]): BulkDuplicateResult {
    // Temporarily load the imports
    const originalProspects = this.prospects;
    this.loadProspects([...originalProspects, ...imports]);
    
    const result = this.findAllDuplicates(imports);
    
    // Restore original prospects
    this.prospects = originalProspects;
    this.buildIndexes();
    
    return result;
  }
  
  /**
   * Merge two prospects (keep original, merge fields from duplicate)
   */
  mergeProspects(original: Prospect, duplicate: Prospect): Prospect {
    const merged = { ...original };
    
    // Merge empty fields from duplicate
    const fieldsToMerge: (keyof Prospect)[] = [
      'email', 'phone', 'linkedinUrl', 'title', 'company',
      'industry', 'location', 'notes', 'source',
    ];
    
    for (const field of fieldsToMerge) {
      if (!merged[field] && duplicate[field]) {
        // @ts-expect-error - Dynamic field assignment
        merged[field] = duplicate[field];
      }
    }
    
    // Merge tags (combine unique tags)
    if (duplicate.tags && duplicate.tags.length > 0) {
      const mergedTags = new Set([...(merged.tags || []), ...duplicate.tags]);
      merged.tags = Array.from(mergedTags);
    }
    
    // Keep the more recent updatedAt
    if (duplicate.updatedAt && (!merged.updatedAt || duplicate.updatedAt > merged.updatedAt)) {
      merged.updatedAt = duplicate.updatedAt;
    }
    
    // Add note about merge
    merged.notes = merged.notes 
      ? `${merged.notes}\n\n[Merged from duplicate: ${duplicate.id}]`
      : `[Merged from duplicate: ${duplicate.id}]`;
    
    return merged;
  }
  
  /**
   * Get configuration
   */
  getConfig(): DuplicateConfig {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<DuplicateConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get loaded prospect count
   */
  getProspectCount(): number {
    return this.prospects.length;
  }
}

// ============================================
// Singleton Instance
// ============================================

let detectorInstance: DuplicateDetector | null = null;

/**
 * Get the singleton detector instance
 */
export function getDuplicateDetector(config?: Partial<DuplicateConfig>): DuplicateDetector {
  if (!detectorInstance) {
    detectorInstance = new DuplicateDetector(config);
  } else if (config) {
    detectorInstance.updateConfig(config);
  }
  return detectorInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetDuplicateDetector(): void {
  detectorInstance = null;
}
