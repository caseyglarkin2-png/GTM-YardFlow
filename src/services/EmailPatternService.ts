/**
 * Email Pattern Inference Service
 * 
 * Sprint 1001: Infers email addresses based on company email patterns
 * 
 * Pattern Types (ordered by frequency from enriched data):
 * - first.last@domain.com  (36% - most common)
 * - first@domain.com       (33%)
 * - f+last@domain.com      (25% - first initial + last name)
 * - f.last@domain.com      (2.5%)
 * - firstlast@domain.com   (2%)
 * - first_last@domain.com  (1%)
 * - last@domain.com        (<1%)
 */

export type EmailPattern = 
  | 'first.last'    // john.doe@company.com
  | 'first'         // john@company.com
  | 'flast'         // jdoe@company.com (first initial + last)
  | 'f.last'        // j.doe@company.com
  | 'firstlast'     // johndoe@company.com
  | 'first_last'    // john_doe@company.com
  | 'last'          // doe@company.com
  | 'lastf'         // doej@company.com (last + first initial)
  | 'last.first'    // doe.john@company.com
  | 'unknown';

export interface PatternMatch {
  email: string;
  pattern: EmailPattern;
  confidence: number; // 0-100
  domain: string;
}

export interface DomainPatternData {
  pattern: EmailPattern;
  sampleCount: number;
  confidence: number;
}

/**
 * Normalize name for pattern matching
 * Removes accents, special chars, converts to lowercase
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z]/g, ''); // Keep only letters
}

/**
 * Extract domain from email
 */
function extractDomain(email: string): string {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : '';
}

/**
 * Detect which pattern an email follows given first/last name
 */
export function detectPattern(
  email: string,
  firstName: string,
  lastName: string
): EmailPattern {
  const local = email.split('@')[0]?.toLowerCase() || '';
  const first = normalizeName(firstName);
  const last = normalizeName(lastName);
  
  if (!local || !first || !last) return 'unknown';
  
  // Check patterns in order of specificity
  if (local === `${first}.${last}`) return 'first.last';
  if (local === `${first}${last}`) return 'firstlast';
  if (local === `${first}_${last}`) return 'first_last';
  if (local === `${first[0]}${last}`) return 'flast';
  if (local === `${first[0]}.${last}`) return 'f.last';
  if (local === `${last}.${first}`) return 'last.first';
  if (local === `${last}${first[0]}`) return 'lastf';
  if (local === first) return 'first';
  if (local === last) return 'last';
  
  return 'unknown';
}

/**
 * Generate an email based on pattern
 */
export function generateEmail(
  firstName: string,
  lastName: string,
  domain: string,
  pattern: EmailPattern
): string {
  const first = normalizeName(firstName);
  const last = normalizeName(lastName);
  
  if (!first || !last || !domain) return '';
  
  switch (pattern) {
    case 'first.last':
      return `${first}.${last}@${domain}`;
    case 'first':
      return `${first}@${domain}`;
    case 'flast':
      return `${first[0]}${last}@${domain}`;
    case 'f.last':
      return `${first[0]}.${last}@${domain}`;
    case 'firstlast':
      return `${first}${last}@${domain}`;
    case 'first_last':
      return `${first}_${last}@${domain}`;
    case 'last':
      return `${last}@${domain}`;
    case 'lastf':
      return `${last}${first[0]}@${domain}`;
    case 'last.first':
      return `${last}.${first}@${domain}`;
    default:
      // Default to most common pattern
      return `${first}.${last}@${domain}`;
  }
}

/**
 * Email Pattern Service
 * 
 * Maintains a database of known domain patterns and can infer emails
 * for prospects at companies where we've seen email patterns before.
 */
export class EmailPatternService {
  private domainPatterns: Map<string, DomainPatternData> = new Map();
  
  constructor(patternData?: Record<string, DomainPatternData>) {
    if (patternData) {
      for (const [domain, data] of Object.entries(patternData)) {
        this.domainPatterns.set(domain.toLowerCase(), data);
      }
    }
  }
  
  /**
   * Get the number of domains with known patterns
   */
  get domainCount(): number {
    return this.domainPatterns.size;
  }
  
  /**
   * Check if we have a pattern for a domain
   */
  hasPattern(domain: string): boolean {
    return this.domainPatterns.has(domain.toLowerCase());
  }
  
  /**
   * Get pattern data for a domain
   */
  getPattern(domain: string): DomainPatternData | null {
    return this.domainPatterns.get(domain.toLowerCase()) || null;
  }
  
  /**
   * Learn patterns from a set of known emails
   */
  learnFromSamples(
    samples: Array<{ email: string; firstName: string; lastName: string }>
  ): void {
    // Group samples by domain
    const domainSamples = new Map<string, Array<{ email: string; firstName: string; lastName: string }>>();
    
    for (const sample of samples) {
      const domain = extractDomain(sample.email);
      if (!domain) continue;
      
      const existing = domainSamples.get(domain) || [];
      existing.push(sample);
      domainSamples.set(domain, existing);
    }
    
    // Detect pattern for each domain
    for (const [domain, domainData] of domainSamples) {
      const patterns: EmailPattern[] = [];
      
      for (const sample of domainData) {
        const pattern = detectPattern(sample.email, sample.firstName, sample.lastName);
        if (pattern !== 'unknown') {
          patterns.push(pattern);
        }
      }
      
      if (patterns.length === 0) continue;
      
      // Count occurrences of each pattern
      const patternCounts = new Map<EmailPattern, number>();
      for (const p of patterns) {
        patternCounts.set(p, (patternCounts.get(p) || 0) + 1);
      }
      
      // Find most common pattern
      let bestPattern: EmailPattern = 'first.last';
      let bestCount = 0;
      for (const [pattern, count] of patternCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestPattern = pattern;
        }
      }
      
      // Calculate confidence based on consistency
      const confidence = Math.round((bestCount / patterns.length) * 100);
      
      this.domainPatterns.set(domain, {
        pattern: bestPattern,
        sampleCount: patterns.length,
        confidence,
      });
    }
  }
  
  /**
   * Infer email for a prospect
   * Returns null if domain pattern is unknown or confidence is too low
   */
  inferEmail(
    firstName: string,
    lastName: string,
    companyDomain: string,
    minConfidence: number = 70
  ): PatternMatch | null {
    const domain = companyDomain.toLowerCase();
    const patternData = this.domainPatterns.get(domain);
    
    if (!patternData) return null;
    if (patternData.confidence < minConfidence) return null;
    
    const email = generateEmail(firstName, lastName, domain, patternData.pattern);
    if (!email) return null;
    
    return {
      email,
      pattern: patternData.pattern,
      confidence: patternData.confidence,
      domain,
    };
  }
  
  /**
   * Infer email with fallback patterns
   * If no domain pattern known, returns best guess with low confidence
   */
  inferEmailWithFallback(
    firstName: string,
    lastName: string,
    companyDomain: string
  ): PatternMatch {
    const domain = companyDomain.toLowerCase();
    const patternData = this.domainPatterns.get(domain);
    
    if (patternData) {
      const email = generateEmail(firstName, lastName, domain, patternData.pattern);
      return {
        email,
        pattern: patternData.pattern,
        confidence: patternData.confidence,
        domain,
      };
    }
    
    // Fallback: use most common pattern (first.last) with low confidence
    const email = generateEmail(firstName, lastName, domain, 'first.last');
    return {
      email,
      pattern: 'first.last',
      confidence: 30, // Low confidence for guessed patterns
      domain,
    };
  }
  
  /**
   * Export pattern database to JSON
   */
  exportPatterns(): Record<string, DomainPatternData> {
    const result: Record<string, DomainPatternData> = {};
    for (const [domain, data] of this.domainPatterns) {
      result[domain] = data;
    }
    return result;
  }
  
  /**
   * Get statistics about the pattern database
   */
  getStats(): {
    totalDomains: number;
    patternDistribution: Record<EmailPattern, number>;
    avgConfidence: number;
    highConfidenceCount: number;
  } {
    const distribution: Record<EmailPattern, number> = {
      'first.last': 0,
      'first': 0,
      'flast': 0,
      'f.last': 0,
      'firstlast': 0,
      'first_last': 0,
      'last': 0,
      'lastf': 0,
      'last.first': 0,
      'unknown': 0,
    };
    
    let totalConfidence = 0;
    let highConfidenceCount = 0;
    
    for (const data of this.domainPatterns.values()) {
      distribution[data.pattern]++;
      totalConfidence += data.confidence;
      if (data.confidence >= 80) highConfidenceCount++;
    }
    
    return {
      totalDomains: this.domainPatterns.size,
      patternDistribution: distribution,
      avgConfidence: this.domainPatterns.size > 0 
        ? Math.round(totalConfidence / this.domainPatterns.size) 
        : 0,
      highConfidenceCount,
    };
  }
}

// Singleton instance for app-wide use
let serviceInstance: EmailPatternService | null = null;

/**
 * Get the singleton EmailPatternService instance
 */
export function getEmailPatternService(): EmailPatternService {
  if (!serviceInstance) {
    serviceInstance = new EmailPatternService();
  }
  return serviceInstance;
}

/**
 * Initialize the service with pattern data
 */
export function initializeEmailPatternService(
  patternData: Record<string, DomainPatternData>
): EmailPatternService {
  serviceInstance = new EmailPatternService(patternData);
  return serviceInstance;
}
