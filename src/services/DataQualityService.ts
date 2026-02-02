/**
 * Data Quality Service
 * 
 * Sprint 1004: Comprehensive data quality assessment for prospect data
 * 
 * Features:
 * - Field completeness scoring
 * - Email quality assessment (verified vs inferred)
 * - Duplicate risk scoring
 * - Data freshness tracking
 * - Actionable recommendations
 */

import type { Prospect } from '../types';
import { isValidEmail } from '../utils/emailValidator';
import { 
  DuplicateDetector, 
  normalizeEmail as normEmail,
  type DuplicateConfig,
  type DuplicatePair,
} from './DuplicateDetector';

// ============================================
// Types
// ============================================

export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

export interface FieldCompleteness {
  field: string;
  present: number;
  missing: number;
  percentage: number;
}

export interface QualityScore {
  overall: number; // 0-100
  level: QualityLevel;
  breakdown: {
    completeness: number;
    emailQuality: number;
    duplicateRisk: number;
    dataFreshness: number;
  };
}

export interface ProspectQuality {
  prospect: Prospect;
  score: number;
  level: QualityLevel;
  issues: string[];
  recommendations: string[];
}

export interface DataQualityReport {
  totalProspects: number;
  qualityScore: QualityScore;
  fieldCompleteness: FieldCompleteness[];
  emailBreakdown: {
    total: number;
    verified: number;
    inferred: number;
    missing: number;
    verifiedPercentage: number;
    contactable: number;
    contactablePercentage: number;
  };
  duplicateAnalysis: {
    checked: number;
    withDuplicates: number;
    duplicatePairs: number;
    estimatedDuplicates: number;
  };
  tierDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  recommendations: string[];
  generatedAt: Date;
}

// ============================================
// Quality Scoring Functions
// ============================================

/**
 * Calculate completeness score for a prospect
 */
function calculateCompletenessScore(prospect: Prospect): number {
  const weights = {
    name: 15,
    email: 25,
    company: 15,
    title: 10,
    tier: 10,
    linkedinUrl: 10,
    country: 5,
    revenue: 5,
    score: 5,
  };

  let earned = 0;
  let total = 0;

  for (const [field, weight] of Object.entries(weights)) {
    total += weight;
    const value = prospect[field as keyof Prospect];
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'string' && value.trim() === '') continue;
      earned += weight;
    }
  }

  return Math.round((earned / total) * 100);
}

/**
 * Calculate email quality score
 */
function calculateEmailQualityScore(prospect: Prospect): number {
  if (!prospect.email) return 0;
  if (!isValidEmail(prospect.email)) return 0;

  switch (prospect.emailConfidence) {
    case 'verified':
      return 100;
    case 'high':
      return 85;
    case 'medium':
      return 70;
    case 'inferred':
      return 60;
    case 'low':
      return 40;
    default:
      return 50;
  }
}

/**
 * Calculate quality level from score
 */
function scoreToLevel(score: number): QualityLevel {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

/**
 * Get issues for a prospect
 */
function getProspectIssues(prospect: Prospect): string[] {
  const issues: string[] = [];

  if (!prospect.name || prospect.name.trim() === '') {
    issues.push('Missing name');
  }

  if (!prospect.email) {
    issues.push('No email address');
  } else if (prospect.emailConfidence === 'inferred') {
    issues.push('Email is inferred (not verified)');
  }

  if (!prospect.company || prospect.company.trim() === '') {
    issues.push('Missing company');
  }

  if (!prospect.title || prospect.title.trim() === '') {
    issues.push('Missing job title');
  }

  if (!prospect.tier || prospect.tier === 'Tier 4') {
    issues.push('Low priority tier');
  }

  if (!prospect.linkedinUrl) {
    issues.push('No LinkedIn URL');
  }

  return issues;
}

/**
 * Get recommendations for a prospect
 */
function getProspectRecommendations(prospect: Prospect): string[] {
  const recommendations: string[] = [];

  if (!prospect.email) {
    if (prospect.company) {
      recommendations.push('Research email using company domain pattern');
    }
    if (prospect.linkedinUrl) {
      recommendations.push('Use LinkedIn to find email');
    }
  } else if (prospect.emailConfidence === 'inferred') {
    recommendations.push('Verify email before outreach');
  }

  if (!prospect.linkedinUrl && prospect.name && prospect.company) {
    recommendations.push('Search LinkedIn for profile');
  }

  if (!prospect.title) {
    recommendations.push('Research current role on LinkedIn');
  }

  return recommendations;
}

// ============================================
// Data Quality Service
// ============================================

export class DataQualityService {
  private duplicateDetector: DuplicateDetector;
  private duplicateConfig: DuplicateConfig;

  constructor(duplicateConfig?: Partial<DuplicateConfig>) {
    this.duplicateConfig = {
      matchEmail: true,
      matchLinkedIn: true,
      matchPhone: false, // Phone not commonly available
      matchName: true,
      nameMatchThreshold: 85,
      matchNameAndCompany: true,
      caseInsensitive: true,
      ...duplicateConfig,
    };
    this.duplicateDetector = new DuplicateDetector(this.duplicateConfig);
  }

  /**
   * Assess quality of a single prospect
   */
  assessProspect(prospect: Prospect): ProspectQuality {
    const completeness = calculateCompletenessScore(prospect);
    const emailQuality = calculateEmailQualityScore(prospect);
    
    // Weight completeness more heavily, email quality is bonus
    const score = Math.round(completeness * 0.6 + emailQuality * 0.4);
    const level = scoreToLevel(score);
    const issues = getProspectIssues(prospect);
    const recommendations = getProspectRecommendations(prospect);

    return { prospect, score, level, issues, recommendations };
  }

  /**
   * Assess quality of multiple prospects
   */
  assessProspects(prospects: Prospect[]): ProspectQuality[] {
    return prospects.map(p => this.assessProspect(p));
  }

  /**
   * Calculate field completeness across all prospects
   */
  calculateFieldCompleteness(prospects: Prospect[]): FieldCompleteness[] {
    const fields = ['name', 'email', 'company', 'title', 'tier', 'linkedinUrl', 'country', 'revenue'];
    
    return fields.map(field => {
      let present = 0;
      let missing = 0;

      for (const p of prospects) {
        const value = p[field as keyof Prospect];
        if (value !== undefined && value !== null && value !== '') {
          present++;
        } else {
          missing++;
        }
      }

      return {
        field,
        present,
        missing,
        percentage: prospects.length > 0 ? Math.round((present / prospects.length) * 100) : 0,
      };
    });
  }

  /**
   * Analyze email quality distribution
   */
  analyzeEmailQuality(prospects: Prospect[]): DataQualityReport['emailBreakdown'] {
    let verified = 0;
    let inferred = 0;
    let missing = 0;
    let total = 0;

    for (const p of prospects) {
      if (p.email && isValidEmail(p.email)) {
        total++;
        if (p.emailConfidence === 'verified') {
          verified++;
        } else if (p.emailConfidence === 'inferred') {
          inferred++;
        }
      } else {
        missing++;
      }
    }

    const contactable = verified + inferred;

    return {
      total,
      verified,
      inferred,
      missing,
      verifiedPercentage: prospects.length > 0 ? Math.round((verified / prospects.length) * 100) : 0,
      contactable,
      contactablePercentage: prospects.length > 0 ? Math.round((contactable / prospects.length) * 100) : 0,
    };
  }

  /**
   * Find duplicate prospects
   */
  findDuplicates(prospects: Prospect[]): DuplicatePair[] {
    // Load prospects into detector first, then search for internal duplicates
    this.duplicateDetector.loadProspects(prospects);
    const result = this.duplicateDetector.findAllDuplicates(prospects);
    return result.duplicatePairs;
  }

  /**
   * Generate comprehensive data quality report
   */
  generateReport(prospects: Prospect[]): DataQualityReport {
    // Field completeness
    const fieldCompleteness = this.calculateFieldCompleteness(prospects);
    const avgCompleteness = fieldCompleteness.length > 0 
      ? fieldCompleteness.reduce((sum, f) => sum + f.percentage, 0) / fieldCompleteness.length
      : 0;

    // Email analysis
    const emailBreakdown = this.analyzeEmailQuality(prospects);

    // Duplicate analysis (sample-based for large datasets)
    const sampleSize = Math.min(prospects.length, 1000);
    const sample = prospects.slice(0, sampleSize);
    
    // Load prospects before finding duplicates
    this.duplicateDetector.loadProspects(sample);
    const duplicateResult = this.duplicateDetector.findAllDuplicates(sample);
    const duplicatePairs = duplicateResult.duplicatePairs;
    const duplicateRatio = sampleSize > 0 ? duplicatePairs.length / sampleSize : 0;
    const estimatedDuplicates = Math.round(duplicateRatio * prospects.length);
    
    // Tier distribution
    const tierDistribution: Record<string, number> = {};
    const statusDistribution: Record<string, number> = {};
    
    for (const p of prospects) {
      tierDistribution[p.tier] = (tierDistribution[p.tier] || 0) + 1;
      statusDistribution[p.status] = (statusDistribution[p.status] || 0) + 1;
    }

    // Calculate overall quality score
    const completenessScore = avgCompleteness;
    const emailQualityScore = emailBreakdown.contactablePercentage;
    const duplicateRiskScore = prospects.length > 0 
      ? 100 - Math.min(estimatedDuplicates / prospects.length * 100 * 5, 50)
      : 100;
    const dataFreshnessScore = 80; // Placeholder - would need createdAt analysis

    const overallScore = Math.round(
      completenessScore * 0.3 +
      emailQualityScore * 0.4 +
      duplicateRiskScore * 0.2 +
      dataFreshnessScore * 0.1
    );

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (emailBreakdown.missing > prospects.length * 0.5) {
      recommendations.push(`${emailBreakdown.missing} prospects missing email - consider email enrichment`);
    }
    
    if (emailBreakdown.inferred > 0) {
      recommendations.push(`${emailBreakdown.inferred} inferred emails should be verified before cold outreach`);
    }
    
    if (estimatedDuplicates > prospects.length * 0.05) {
      recommendations.push(`~${estimatedDuplicates} potential duplicates detected - run deduplication`);
    }

    const linkedinField = fieldCompleteness.find(f => f.field === 'linkedinUrl');
    if (linkedinField && linkedinField.percentage < 50) {
      recommendations.push('LinkedIn profiles missing for most prospects - enrich for better targeting');
    }

    const titleField = fieldCompleteness.find(f => f.field === 'title');
    if (titleField && titleField.percentage < 80) {
      recommendations.push('Job titles incomplete - verify for accurate ICP targeting');
    }

    return {
      totalProspects: prospects.length,
      qualityScore: {
        overall: overallScore,
        level: scoreToLevel(overallScore),
        breakdown: {
          completeness: Math.round(completenessScore),
          emailQuality: Math.round(emailQualityScore),
          duplicateRisk: Math.round(duplicateRiskScore),
          dataFreshness: Math.round(dataFreshnessScore),
        },
      },
      fieldCompleteness,
      emailBreakdown,
      duplicateAnalysis: {
        checked: sampleSize,
        withDuplicates: duplicatePairs.length,
        duplicatePairs: duplicatePairs.length,
        estimatedDuplicates,
      },
      tierDistribution,
      statusDistribution,
      recommendations,
      generatedAt: new Date(),
    };
  }

  /**
   * Get high-quality prospects (score >= 70)
   */
  getHighQualityProspects(prospects: Prospect[]): Prospect[] {
    return prospects.filter(p => {
      const quality = this.assessProspect(p);
      return quality.score >= 70;
    });
  }

  /**
   * Get prospects needing attention (score < 50)
   */
  getProspectsNeedingAttention(prospects: Prospect[]): ProspectQuality[] {
    return prospects
      .map(p => this.assessProspect(p))
      .filter(q => q.score < 50)
      .sort((a, b) => a.score - b.score);
  }

  /**
   * Get contactable prospects (has verified or inferred email)
   */
  getContactableProspects(prospects: Prospect[]): Prospect[] {
    return prospects.filter(p => 
      p.email && 
      isValidEmail(p.email) && 
      (p.emailConfidence === 'verified' || p.emailConfidence === 'inferred')
    );
  }

  /**
   * Get verified-only prospects (safest for cold outreach)
   */
  getVerifiedOnlyProspects(prospects: Prospect[]): Prospect[] {
    return prospects.filter(p => 
      p.email && 
      isValidEmail(p.email) && 
      p.emailConfidence === 'verified'
    );
  }
}

// Singleton instance
let serviceInstance: DataQualityService | null = null;

export function getDataQualityService(): DataQualityService {
  if (!serviceInstance) {
    serviceInstance = new DataQualityService();
  }
  return serviceInstance;
}
