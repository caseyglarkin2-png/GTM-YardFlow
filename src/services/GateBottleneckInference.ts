/**
 * Gate Bottleneck Inference Service
 * 
 * Infers whether a company is likely to have gate bottleneck issues
 * based on industry, truck volume, and other signals.
 * 
 * Gate bottleneck = the entrance/exit gate is the primary constraint
 * on yard throughput. This is common in:
 * - High-volume shipping (100+ trucks/day)
 * - Perishable goods (beverage, food, cold chain)
 * - Just-in-time operations (CPG, manufacturing)
 * 
 * Sprint 72: T72.0 - Gate Bottleneck Strategy
 */

import type { EnrichedCompany } from '../types/marketing';

/**
 * Industries where gate bottleneck is common
 * Based on Primo Brands and similar customers
 */
export const GATE_INTENSIVE_INDUSTRIES = [
  'beverage',
  'cpg',
  'food_manufacturing',
  'cold_chain',
  'distribution',
] as const;

/**
 * Industries where gate is rarely the bottleneck
 */
export const GATE_UNLIKELY_INDUSTRIES = [
  'technology',
  'software',
  'professional_services',
  'finance',
  'healthcare_non_logistics',
] as const;

/**
 * Truck volume thresholds
 */
export const VOLUME_THRESHOLDS = {
  HIGH: 100,    // 100+ trucks/day = almost certainly gate bottleneck
  MEDIUM: 50,   // 50-99 = likely gate bottleneck
  LOW: 20,      // 20-49 = possible gate bottleneck
} as const;

/**
 * Gate bottleneck inference result
 */
export interface GateBottleneckResult {
  isLikelyBottleneck: boolean | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  reasoning: string;
  signals: GateSignal[];
}

/**
 * Individual signal contributing to inference
 */
export interface GateSignal {
  type: 'industry' | 'volume' | 'facilities' | 'footprint';
  value: string | number | boolean;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number; // 0-1
}

/**
 * Infer gate bottleneck likelihood from company data
 * 
 * @param company - Enriched company data
 * @returns Gate bottleneck inference result
 */
export function inferGateBottleneck(
  company: Partial<EnrichedCompany>
): GateBottleneckResult {
  const signals: GateSignal[] = [];
  let score = 0;
  let maxScore = 0;

  // Signal 1: Industry category (weight: 0.4)
  const industryWeight = 0.4;
  maxScore += industryWeight;
  
  if (company.industryCategory) {
    const industry = company.industryCategory.toLowerCase();
    
    if (GATE_INTENSIVE_INDUSTRIES.some(gi => industry.includes(gi))) {
      score += industryWeight;
      signals.push({
        type: 'industry',
        value: company.industryCategory,
        impact: 'positive',
        weight: industryWeight,
      });
    } else if (GATE_UNLIKELY_INDUSTRIES.some(gi => industry.includes(gi))) {
      signals.push({
        type: 'industry',
        value: company.industryCategory,
        impact: 'negative',
        weight: industryWeight,
      });
    } else {
      score += industryWeight * 0.5; // Unknown = partial credit
      signals.push({
        type: 'industry',
        value: company.industryCategory,
        impact: 'neutral',
        weight: industryWeight * 0.5,
      });
    }
  }

  // Signal 2: Truck volume (weight: 0.3)
  const volumeWeight = 0.3;
  maxScore += volumeWeight;
  
  if (company.estimatedTruckVolume) {
    const volume = company.estimatedTruckVolume;
    
    if (volume >= VOLUME_THRESHOLDS.HIGH) {
      score += volumeWeight;
      signals.push({
        type: 'volume',
        value: volume,
        impact: 'positive',
        weight: volumeWeight,
      });
    } else if (volume >= VOLUME_THRESHOLDS.MEDIUM) {
      score += volumeWeight * 0.7;
      signals.push({
        type: 'volume',
        value: volume,
        impact: 'positive',
        weight: volumeWeight * 0.7,
      });
    } else if (volume >= VOLUME_THRESHOLDS.LOW) {
      score += volumeWeight * 0.3;
      signals.push({
        type: 'volume',
        value: volume,
        impact: 'neutral',
        weight: volumeWeight * 0.3,
      });
    } else {
      signals.push({
        type: 'volume',
        value: volume,
        impact: 'negative',
        weight: 0,
      });
    }
  }

  // Signal 3: Facility count (weight: 0.2)
  const facilityWeight = 0.2;
  maxScore += facilityWeight;
  
  if (company.facilityCount && company.facilityCount > 0) {
    // More facilities = more likely to have gate issues at some
    if (company.facilityCount >= 60) {
      score += facilityWeight;
      signals.push({
        type: 'facilities',
        value: company.facilityCount,
        impact: 'positive',
        weight: facilityWeight,
      });
    } else if (company.facilityCount >= 20) {
      score += facilityWeight * 0.6;
      signals.push({
        type: 'facilities',
        value: company.facilityCount,
        impact: 'positive',
        weight: facilityWeight * 0.6,
      });
    } else {
      score += facilityWeight * 0.2;
      signals.push({
        type: 'facilities',
        value: company.facilityCount,
        impact: 'neutral',
        weight: facilityWeight * 0.2,
      });
    }
  }

  // Signal 4: Distribution footprint (weight: 0.1)
  const footprintWeight = 0.1;
  maxScore += footprintWeight;
  
  if (company.distributionFootprint) {
    if (company.distributionFootprint === 'national' || 
        company.distributionFootprint === 'international') {
      score += footprintWeight;
      signals.push({
        type: 'footprint',
        value: company.distributionFootprint,
        impact: 'positive',
        weight: footprintWeight,
      });
    } else if (company.distributionFootprint === 'regional') {
      score += footprintWeight * 0.5;
      signals.push({
        type: 'footprint',
        value: company.distributionFootprint,
        impact: 'neutral',
        weight: footprintWeight * 0.5,
      });
    }
  }

  // Calculate result
  if (signals.length === 0) {
    return {
      isLikelyBottleneck: null,
      confidence: 'unknown',
      reasoning: 'Insufficient data to determine gate bottleneck likelihood.',
      signals: [],
    };
  }

  const normalizedScore = maxScore > 0 ? score / maxScore : 0;
  
  // Determine confidence based on how many signals we have
  let confidence: 'high' | 'medium' | 'low' | 'unknown';
  if (signals.length >= 3 && maxScore >= 0.7) {
    confidence = 'high';
  } else if (signals.length >= 2 && maxScore >= 0.4) {
    confidence = 'medium';
  } else if (signals.length >= 1) {
    confidence = 'low';
  } else {
    confidence = 'unknown';
  }

  // Determine likelihood
  const isLikelyBottleneck = normalizedScore >= 0.5;

  // Generate reasoning
  const reasoning = generateReasoning(signals, normalizedScore, isLikelyBottleneck);

  return {
    isLikelyBottleneck,
    confidence,
    reasoning,
    signals,
  };
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(
  signals: GateSignal[],
  _score: number,
  isLikely: boolean
): string {
  const parts: string[] = [];

  const industrySignal = signals.find(s => s.type === 'industry');
  const volumeSignal = signals.find(s => s.type === 'volume');
  const facilitySignal = signals.find(s => s.type === 'facilities');

  if (isLikely) {
    parts.push('Gate bottleneck is likely:');
    
    if (industrySignal?.impact === 'positive') {
      parts.push(`${industrySignal.value} is a gate-intensive industry`);
    }
    if (volumeSignal?.impact === 'positive') {
      parts.push(`${volumeSignal.value} trucks/day indicates high volume`);
    }
    if (facilitySignal?.impact === 'positive') {
      parts.push(`${facilitySignal.value} facilities suggests network complexity`);
    }
  } else {
    parts.push('Gate bottleneck is unlikely or unknown:');
    
    if (industrySignal?.impact === 'negative') {
      parts.push(`${industrySignal.value} is not typically gate-constrained`);
    }
    if (!volumeSignal) {
      parts.push('truck volume unknown');
    }
    if (!facilitySignal) {
      parts.push('facility count unknown');
    }
  }

  return parts.join('; ');
}

/**
 * Check if industry is gate-intensive
 */
export function isGateIntensiveIndustry(industry: string): boolean {
  const normalized = industry.toLowerCase();
  return GATE_INTENSIVE_INDUSTRIES.some(gi => normalized.includes(gi));
}

/**
 * Get gate likelihood label for UI
 */
export function getGateLikelihoodLabel(
  result: GateBottleneckResult
): { label: string; color: string } {
  if (result.isLikelyBottleneck === null) {
    return { label: 'Unknown', color: 'gray' };
  }
  
  if (result.isLikelyBottleneck) {
    switch (result.confidence) {
      case 'high':
        return { label: 'Yes ✓', color: 'green' };
      case 'medium':
        return { label: 'Likely', color: 'emerald' };
      case 'low':
        return { label: 'Maybe', color: 'yellow' };
      default:
        return { label: 'Maybe', color: 'yellow' };
    }
  } else {
    switch (result.confidence) {
      case 'high':
        return { label: 'No', color: 'red' };
      case 'medium':
        return { label: 'Unlikely', color: 'orange' };
      default:
        return { label: 'Unknown', color: 'gray' };
    }
  }
}
