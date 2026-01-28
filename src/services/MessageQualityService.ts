/**
 * Message Quality Service - YardFlow Hub
 * 
 * Provides comprehensive message quality analysis:
 * - Channel-specific length validation
 * - Persona alignment scoring
 * - Compliance checking (CAN-SPAM, platform rules)
 * - Readability analysis
 */

import {
  CHANNEL_LIMITS,
  PERSONA_KEYWORDS,
  COMPLIANCE_RULES,
  type Channel,
  type Persona,
  type QualityScore,
  type QualityIssue,
  type MessageAnalysisInput,
  type MessageAnalysisOutput,
  type ReadabilityMetrics,
  type PersonaMatch,
  type ComplianceResult,
} from '../types/messageQuality';

// ============================================
// Constants
// ============================================

const WORDS_PER_MINUTE = 200;  // Average reading speed
const MINIMUM_PASSING_SCORE = 60;

// ============================================
// Core Analysis Function
// ============================================

/**
 * Analyze a message for quality across all dimensions
 */
export function analyzeMessage(input: MessageAnalysisInput): MessageAnalysisOutput {
  const { message, channel, persona } = input;
  
  // Calculate basic metrics
  const metrics = calculateMetrics(message);
  
  // Score each dimension
  const lengthScore = scoreLengthCompliance(message, channel);
  const personaScore = persona 
    ? scorePersonaAlignment(message, persona)
    : { score: 100, matchedTerms: [], persona };
  const complianceResult = checkCompliance(message, channel);
  const readabilityMetrics = analyzeReadability(message);
  
  // Convert readability to score (target: grade 8 = 100, adjust from there)
  const readabilityScore = Math.max(0, Math.min(100, 
    100 - Math.abs(readabilityMetrics.fleschKincaid - 8) * 10
  ));
  
  // Collect all issues
  const issues: QualityIssue[] = [];
  
  // Length issues
  const limits = CHANNEL_LIMITS[channel];
  if (metrics.charCount > limits.maxChars) {
    issues.push({
      type: 'error',
      category: 'length',
      message: `Message exceeds ${channel} character limit (${metrics.charCount}/${limits.maxChars})`,
      suggestion: `Reduce by ${metrics.charCount - limits.maxChars} characters`,
    });
  } else if (metrics.charCount > limits.idealChars) {
    issues.push({
      type: 'warning',
      category: 'length',
      message: `Message longer than ideal (${metrics.charCount}/${limits.idealChars} chars)`,
      suggestion: 'Consider trimming for better engagement',
    });
  }
  
  if (metrics.wordCount > limits.maxWords) {
    issues.push({
      type: 'error',
      category: 'length',
      message: `Message exceeds word limit (${metrics.wordCount}/${limits.maxWords})`,
    });
  }
  
  // Persona issues
  if (persona && personaScore.score < 50) {
    issues.push({
      type: 'warning',
      category: 'persona',
      message: `Low alignment with ${formatPersonaName(persona)} persona`,
      suggestion: `Try including terms like: ${getSuggestedTerms(persona).join(', ')}`,
    });
  }
  
  // Compliance issues
  complianceResult.violations.forEach(violation => {
    issues.push({
      type: violation.severity,
      category: 'compliance',
      message: violation.reason,
      suggestion: violation.rule,
    });
  });
  
  // Readability issues
  if (readabilityMetrics.fleschKincaid > 12) {
    issues.push({
      type: 'warning',
      category: 'readability',
      message: 'Message may be too complex',
      suggestion: 'Use shorter sentences and simpler words',
    });
  }
  
  if (readabilityMetrics.avgWordsPerSentence > 25) {
    issues.push({
      type: 'info',
      category: 'readability',
      message: 'Long sentences detected',
      suggestion: 'Break up sentences for easier reading',
    });
  }
  
  // Structure issues
  if (!message.includes('?') && channel.startsWith('linkedin')) {
    issues.push({
      type: 'info',
      category: 'structure',
      message: 'Consider adding a question to encourage response',
      suggestion: 'End with a soft question like "Worth a quick chat?"',
    });
  }
  
  // Calculate overall score (weighted average)
  const overall = Math.round(
    lengthScore.score * 0.25 +
    personaScore.score * 0.30 +
    complianceResult.score * 0.30 +
    readabilityScore * 0.15
  );
  
  // Generate suggestions
  const suggestions = generateSuggestions(issues, input);
  
  const score: QualityScore = {
    overall,
    breakdown: {
      length: lengthScore.score,
      persona: personaScore.score,
      compliance: complianceResult.score,
      readability: readabilityScore,
    },
    issues,
    grade: getGrade(overall),
    passesMinimum: overall >= MINIMUM_PASSING_SCORE,
  };
  
  return {
    input,
    score,
    metrics: {
      charCount: metrics.charCount,
      wordCount: metrics.wordCount,
      sentenceCount: metrics.sentenceCount,
      avgWordsPerSentence: metrics.avgWordsPerSentence,
      readingTimeSeconds: metrics.readingTimeSeconds,
      personalizationCount: countPersonalization(message, input),
    },
    suggestions,
    timestamp: new Date().toISOString(),
  };
}

// ============================================
// Metrics Calculation
// ============================================

interface BasicMetrics {
  charCount: number;
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  readingTimeSeconds: number;
}

/**
 * Calculate basic text metrics
 */
export function calculateMetrics(text: string): BasicMetrics {
  const trimmed = text.trim();
  const charCount = trimmed.length;
  
  // Word count (split on whitespace, filter empty)
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  // Sentence count (split on sentence-ending punctuation)
  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = Math.max(sentences.length, 1);
  
  const avgWordsPerSentence = wordCount / sentenceCount;
  const readingTimeSeconds = Math.ceil((wordCount / WORDS_PER_MINUTE) * 60);
  
  return {
    charCount,
    wordCount,
    sentenceCount,
    avgWordsPerSentence,
    readingTimeSeconds,
  };
}

// ============================================
// Length Scoring
// ============================================

interface LengthScore {
  score: number;
  charScore: number;
  wordScore: number;
}

/**
 * Score message length compliance for a channel
 */
export function scoreLengthCompliance(text: string, channel: Channel): LengthScore {
  const limits = CHANNEL_LIMITS[channel];
  const metrics = calculateMetrics(text);
  
  // Character score
  let charScore: number;
  if (metrics.charCount <= limits.idealChars) {
    // Perfect or under ideal
    charScore = 100;
  } else if (metrics.charCount <= limits.maxChars) {
    // Between ideal and max: linear decrease from 100 to 70
    const ratio = (metrics.charCount - limits.idealChars) / (limits.maxChars - limits.idealChars);
    charScore = 100 - (ratio * 30);
  } else {
    // Over max: steep penalty
    const overBy = metrics.charCount - limits.maxChars;
    charScore = Math.max(0, 70 - (overBy / 10));
  }
  
  // Word score (similar logic)
  let wordScore: number;
  if (metrics.wordCount <= limits.idealWords) {
    wordScore = 100;
  } else if (metrics.wordCount <= limits.maxWords) {
    const ratio = (metrics.wordCount - limits.idealWords) / (limits.maxWords - limits.idealWords);
    wordScore = 100 - (ratio * 30);
  } else {
    const overBy = metrics.wordCount - limits.maxWords;
    wordScore = Math.max(0, 70 - (overBy * 2));
  }
  
  return {
    score: Math.round((charScore * 0.6) + (wordScore * 0.4)),
    charScore: Math.round(charScore),
    wordScore: Math.round(wordScore),
  };
}

// ============================================
// Persona Scoring
// ============================================

/**
 * Score how well a message aligns with a persona
 */
export function scorePersonaAlignment(text: string, persona: Persona): PersonaMatch {
  const config = PERSONA_KEYWORDS[persona];
  const lowerText = text.toLowerCase();
  
  const matchedTerms: PersonaMatch['matchedTerms'] = [];
  let totalWeight = 0;
  let maxPossibleWeight = 0;
  
  // Check positive keywords
  for (const { term, weight } of config.positive) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = lowerText.match(regex);
    const count = matches?.length || 0;
    
    if (count > 0) {
      matchedTerms.push({ term, weight, count });
      // Diminishing returns for repeated terms
      totalWeight += weight * Math.min(count, 2);
    }
    maxPossibleWeight += weight;
  }
  
  // Check negative keywords (subtract from score)
  for (const { term, weight } of config.negative) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = lowerText.match(regex);
    const count = matches?.length || 0;
    
    if (count > 0) {
      matchedTerms.push({ term, weight, count });
      totalWeight += weight * count;  // weight is already negative
    }
  }
  
  // Normalize to 0-100 scale
  // Baseline of 50 if no terms matched (neutral), adjust based on matches
  let score: number;
  if (maxPossibleWeight === 0) {
    score = 50;
  } else {
    const ratio = totalWeight / maxPossibleWeight;
    score = Math.min(100, Math.max(0, 50 + (ratio * 50)));
  }
  
  return {
    persona,
    score: Math.round(score),
    matchedTerms,
  };
}

/**
 * Get suggested terms for a persona
 */
function getSuggestedTerms(persona: Persona): string[] {
  return PERSONA_KEYWORDS[persona].positive
    .slice(0, 5)
    .map(k => k.term);
}

/**
 * Format persona name for display
 */
function formatPersonaName(persona: Persona): string {
  return persona
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================
// Compliance Checking
// ============================================

/**
 * Check message for compliance issues
 * @param _channel - Reserved for future channel-specific rules
 */
export function checkCompliance(text: string, _channel: Channel): ComplianceResult {
  const violations: ComplianceResult['violations'] = [];
  
  // Check forbidden patterns
  for (const rule of COMPLIANCE_RULES.forbidden) {
    const match = text.match(rule.pattern);
    if (match) {
      violations.push({
        rule: `Avoid: "${match[0]}"`,
        reason: rule.reason,
        severity: rule.severity as 'error' | 'warning' | 'info',
        match: match[0],
      });
    }
  }
  
  // Check spam triggers (just informational)
  const lowerText = text.toLowerCase();
  const foundTriggers = COMPLIANCE_RULES.spamTriggers.filter(
    trigger => lowerText.includes(trigger.toLowerCase())
  );
  
  if (foundTriggers.length >= 3) {
    violations.push({
      rule: 'Multiple spam trigger words detected',
      reason: `Found: ${foundTriggers.slice(0, 3).join(', ')}`,
      severity: 'warning',
    });
  }
  
  // Calculate score based on violations
  let score = 100;
  for (const v of violations) {
    if (v.severity === 'error') score -= 25;
    else if (v.severity === 'warning') score -= 10;
    else score -= 5;
  }
  
  return {
    passes: score >= 70,
    score: Math.max(0, score),
    violations,
  };
}

// ============================================
// Readability Analysis
// ============================================

/**
 * Analyze text readability using Flesch-Kincaid metrics
 */
export function analyzeReadability(text: string): ReadabilityMetrics {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  const wordCount = words.length;
  const sentenceCount = Math.max(sentences.length, 1);
  const syllableCount = words.reduce((sum, word) => sum + countSyllables(word), 0);
  
  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = wordCount > 0 ? syllableCount / wordCount : 0;
  
  // Flesch-Kincaid Grade Level
  const fleschKincaid = wordCount > 0
    ? 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59
    : 0;
  
  // Flesch Reading Ease (0-100, higher = easier)
  const fleschReadingEase = wordCount > 0
    ? 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord
    : 100;
  
  return {
    fleschKincaid: Math.max(0, Math.round(fleschKincaid * 10) / 10),
    fleschReadingEase: Math.max(0, Math.min(100, Math.round(fleschReadingEase))),
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
  };
}

/**
 * Count syllables in a word (approximate)
 */
function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length <= 2) return 1;
  
  // Count vowel groups
  const vowelGroups = cleaned.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;
  
  // Subtract silent e at end
  if (cleaned.endsWith('e') && count > 1) {
    count--;
  }
  
  // Handle common patterns
  if (cleaned.endsWith('le') && count > 1 && !/[aeiouy]le$/.test(cleaned)) {
    count++;
  }
  
  return Math.max(1, count);
}

// ============================================
// Personalization Detection
// ============================================

/**
 * Count personalization elements in message
 */
function countPersonalization(text: string, input: MessageAnalysisInput): number {
  let count = 0;
  
  // Check for company name
  if (input.companyName && text.toLowerCase().includes(input.companyName.toLowerCase())) {
    count++;
  }
  
  // Check for prospect name
  if (input.prospectName && text.toLowerCase().includes(input.prospectName.toLowerCase())) {
    count++;
  }
  
  // Check for industry/role references
  const personalizationPatterns = [
    /your\s+(company|team|organization)/i,
    /at\s+\w+/i,  // "at [Company]"
    /noticed\s+(you|your)/i,
    /saw\s+(you|your)/i,
    /congrats on/i,
    /loved your/i,
    /read your/i,
  ];
  
  for (const pattern of personalizationPatterns) {
    if (pattern.test(text)) count++;
  }
  
  return count;
}

// ============================================
// Suggestion Generation
// ============================================

/**
 * Generate actionable suggestions based on issues
 */
function generateSuggestions(issues: QualityIssue[], input: MessageAnalysisInput): string[] {
  const suggestions: string[] = [];
  const issuesByCategory = new Map<string, QualityIssue[]>();
  
  // Group issues by category
  for (const issue of issues) {
    const existing = issuesByCategory.get(issue.category) || [];
    existing.push(issue);
    issuesByCategory.set(issue.category, existing);
  }
  
  // Generate category-specific suggestions
  if (issuesByCategory.has('length')) {
    const lengthIssues = issuesByCategory.get('length')!;
    if (lengthIssues.some(i => i.type === 'error')) {
      suggestions.push(`Shorten your message to fit ${input.channel} limits`);
    }
  }
  
  if (issuesByCategory.has('persona') && input.persona) {
    suggestions.push(`Include more ${formatPersonaName(input.persona)}-relevant language`);
  }
  
  if (issuesByCategory.has('compliance')) {
    suggestions.push('Review flagged phrases and consider alternatives');
  }
  
  if (issuesByCategory.has('readability')) {
    suggestions.push('Simplify complex sentences for easier reading');
  }
  
  if (!issuesByCategory.has('structure') && issues.length === 0) {
    suggestions.push('Great message! Consider A/B testing variations');
  }
  
  return suggestions;
}

// ============================================
// Grade Calculation
// ============================================

/**
 * Convert numeric score to letter grade
 */
function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// ============================================
// Quick Validation
// ============================================

/**
 * Quick check if message passes minimum requirements
 */
export function quickValidate(message: string, channel: Channel): {
  valid: boolean;
  errors: string[];
} {
  const limits = CHANNEL_LIMITS[channel];
  const metrics = calculateMetrics(message);
  const errors: string[] = [];
  
  if (metrics.charCount > limits.maxChars) {
    errors.push(`Exceeds ${limits.maxChars} character limit`);
  }
  
  if (metrics.wordCount > limits.maxWords) {
    errors.push(`Exceeds ${limits.maxWords} word limit`);
  }
  
  if (metrics.charCount < 10) {
    errors.push('Message too short');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// Export Utilities
// ============================================

export { CHANNEL_LIMITS, PERSONA_KEYWORDS, COMPLIANCE_RULES };
export type { Channel, Persona };
