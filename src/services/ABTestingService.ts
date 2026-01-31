/**
 * ABTestingService
 * Sprint 205: Template A/B Testing Framework
 * 
 * Service to assign variants to recipients and manage A/B test data.
 */

import type { EmailTemplateVariant } from '@/types/emailSequence';

// =============================================================================
// Types
// =============================================================================

export interface VariantStats {
  id: string;
  name: string;
  sends: number;
  opens: number;
  clicks: number;
  replies: number;
  meetings: number;
}

export interface SignificanceResult {
  significant: boolean;
  confidence: number;
  winner: 'A' | 'B' | null;
  zScore: number;
}

export interface ABTestResult {
  templateId: string;
  variantA: VariantStats;
  variantB: VariantStats;
  openSignificance: SignificanceResult;
  clickSignificance: SignificanceResult;
  replySignificance: SignificanceResult;
  recommendation: string;
  status: 'running' | 'concluded' | 'insufficient_data';
}

// =============================================================================
// Hash Function for Deterministic Assignment
// =============================================================================

/**
 * Simple string hash function for deterministic variant assignment.
 * Same email always gets the same hash.
 */
export function hashCode(str: string): number {
  let hash = 0;
  if (str.length === 0) return hash;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return hash;
}

// =============================================================================
// Variant Assignment
// =============================================================================

/**
 * Assigns a variant to a recipient based on their email address.
 * Uses deterministic hashing so the same recipient always gets the same variant.
 * 
 * @param templateId - The ID of the template being tested
 * @param variants - Array of variants with traffic weights
 * @param recipientEmail - The recipient's email address
 * @returns The assigned variant
 */
export function assignVariant(
  templateId: string,
  variants: EmailTemplateVariant[],
  recipientEmail: string
): EmailTemplateVariant | null {
  if (!variants || variants.length === 0) {
    return null;
  }
  
  // For single variant, always return it
  if (variants.length === 1) {
    return variants[0];
  }
  
  // Create deterministic assignment key
  const assignmentKey = `${templateId}:${recipientEmail.toLowerCase()}`;
  const hash = hashCode(assignmentKey);
  const normalized = Math.abs(hash) % 100;
  
  // Calculate cumulative traffic and assign
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.traffic;
    if (normalized < cumulative) {
      return variant;
    }
  }
  
  // Fallback to first variant if traffic doesn't sum to 100
  return variants[0];
}

/**
 * Validates that variant traffic percentages sum to 100.
 */
export function validateVariantTraffic(variants: EmailTemplateVariant[]): {
  valid: boolean;
  error?: string;
} {
  if (!variants || variants.length === 0) {
    return { valid: true };
  }
  
  const total = variants.reduce((sum, v) => sum + v.traffic, 0);
  
  if (total !== 100) {
    return {
      valid: false,
      error: `Traffic must sum to 100%, currently ${total}%`,
    };
  }
  
  return { valid: true };
}

// =============================================================================
// Statistical Significance
// =============================================================================

/**
 * Z-test for proportion comparison.
 * Returns significance at various confidence levels.
 * 
 * - z > 1.645: 90% confidence
 * - z > 1.96: 95% confidence
 * - z > 2.58: 99% confidence
 */
export function calculateSignificance(
  a: VariantStats,
  b: VariantStats,
  metric: 'opens' | 'clicks' | 'replies' | 'meetings'
): SignificanceResult {
  // Need minimum sample size for valid statistics
  const MIN_SAMPLE_SIZE = 30;
  
  if (a.sends < MIN_SAMPLE_SIZE || b.sends < MIN_SAMPLE_SIZE) {
    return {
      significant: false,
      confidence: 0,
      winner: null,
      zScore: 0,
    };
  }
  
  const p1 = a[metric] / a.sends;
  const p2 = b[metric] / b.sends;
  
  // Pooled proportion
  const p = (a[metric] + b[metric]) / (a.sends + b.sends);
  
  // Standard error
  const se = Math.sqrt(p * (1 - p) * (1 / a.sends + 1 / b.sends));
  
  // Handle edge case of zero standard error
  if (se === 0) {
    return {
      significant: false,
      confidence: 0,
      winner: null,
      zScore: 0,
    };
  }
  
  const z = Math.abs(p1 - p2) / se;
  
  // Convert z-score to confidence percentage
  const confidence = z > 2.58 ? 99 : z > 1.96 ? 95 : z > 1.645 ? 90 : Math.round(z * 50);
  
  return {
    significant: z > 1.96,
    confidence,
    winner: z > 1.96 ? (p1 > p2 ? 'A' : 'B') : null,
    zScore: Math.round(z * 100) / 100,
  };
}

// =============================================================================
// AB Test Analysis
// =============================================================================

/**
 * Analyzes A/B test results and provides recommendation.
 */
export function analyzeABTest(
  templateId: string,
  variantA: VariantStats,
  variantB: VariantStats
): ABTestResult {
  const openSignificance = calculateSignificance(variantA, variantB, 'opens');
  const clickSignificance = calculateSignificance(variantA, variantB, 'clicks');
  const replySignificance = calculateSignificance(variantA, variantB, 'replies');
  
  // Determine overall status
  const hasEnoughData = variantA.sends >= 30 && variantB.sends >= 30;
  const hasConclusion = openSignificance.significant || clickSignificance.significant || replySignificance.significant;
  
  const status: ABTestResult['status'] = 
    !hasEnoughData ? 'insufficient_data' :
    hasConclusion ? 'concluded' :
    'running';
  
  // Generate recommendation
  let recommendation: string;
  
  if (!hasEnoughData) {
    const needed = Math.max(30 - Math.min(variantA.sends, variantB.sends), 0);
    recommendation = `Need ~${needed} more sends per variant for statistical significance.`;
  } else if (replySignificance.significant) {
    recommendation = `Variant ${replySignificance.winner} has significantly higher reply rate. Consider promoting.`;
  } else if (clickSignificance.significant) {
    recommendation = `Variant ${clickSignificance.winner} has significantly higher click rate.`;
  } else if (openSignificance.significant) {
    recommendation = `Variant ${openSignificance.winner} has significantly higher open rate.`;
  } else {
    recommendation = 'No significant difference detected yet. Continue running the test.';
  }
  
  return {
    templateId,
    variantA,
    variantB,
    openSignificance,
    clickSignificance,
    replySignificance,
    recommendation,
    status,
  };
}

// =============================================================================
// Variant Stats Aggregation
// =============================================================================

/**
 * Aggregates email events into variant statistics.
 */
export function aggregateVariantStats(
  variantId: string,
  variantName: string,
  events: Array<{
    type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'meeting_booked';
    variantId?: string;
  }>
): VariantStats {
  const variantEvents = events.filter(e => e.variantId === variantId);
  
  return {
    id: variantId,
    name: variantName,
    sends: variantEvents.filter(e => e.type === 'sent' || e.type === 'delivered').length,
    opens: variantEvents.filter(e => e.type === 'opened').length,
    clicks: variantEvents.filter(e => e.type === 'clicked').length,
    replies: variantEvents.filter(e => e.type === 'replied').length,
    meetings: variantEvents.filter(e => e.type === 'meeting_booked').length,
  };
}

/**
 * Creates empty variant stats for a new variant.
 */
export function createEmptyVariantStats(variantId: string, name: string): VariantStats {
  return {
    id: variantId,
    name,
    sends: 0,
    opens: 0,
    clicks: 0,
    replies: 0,
    meetings: 0,
  };
}

export default {
  hashCode,
  assignVariant,
  validateVariantTraffic,
  calculateSignificance,
  analyzeABTest,
  aggregateVariantStats,
  createEmptyVariantStats,
};
