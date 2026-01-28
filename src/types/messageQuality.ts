/**
 * Message Quality Types - YardFlow Hub
 * 
 * Type definitions for message quality scoring, compliance checking,
 * and channel-specific constraints.
 */

import { z } from 'zod';

// ============================================
// Channel Limits Configuration
// ============================================

/**
 * Character and word limits per channel
 * Based on platform best practices and API limits
 */
export const CHANNEL_LIMITS = {
  linkedin_dm: {
    maxChars: 300,      // LinkedIn InMail sweet spot (max is ~1900)
    maxWords: 50,
    idealChars: 200,    // Optimal engagement range
    idealWords: 35,
  },
  linkedin_connection: {
    maxChars: 300,      // LinkedIn connection note limit
    maxWords: 50,
    idealChars: 250,
    idealWords: 40,
  },
  email_cold: {
    maxChars: 750,      // Cold email sweet spot
    maxWords: 125,
    idealChars: 500,
    idealWords: 80,
  },
  email_followup: {
    maxChars: 500,      // Follow-up should be shorter
    maxWords: 85,
    idealChars: 350,
    idealWords: 60,
  },
  twitter_dm: {
    maxChars: 10000,    // X DM limit
    maxWords: 150,
    idealChars: 280,    // Keep it tweet-length for impact
    idealWords: 50,
  },
  sms: {
    maxChars: 160,      // Single SMS segment
    maxWords: 25,
    idealChars: 140,
    idealWords: 20,
  },
} as const;

export type Channel = keyof typeof CHANNEL_LIMITS;

// ============================================
// Persona Scoring Configuration
// ============================================

/**
 * Persona-specific keyword weights and patterns
 * Higher weight = more relevant to persona
 */
export const PERSONA_KEYWORDS = {
  ops_director: {
    positive: [
      { term: 'detention', weight: 3 },
      { term: 'dwell time', weight: 3 },
      { term: 'truck', weight: 2 },
      { term: 'driver', weight: 2 },
      { term: 'gate', weight: 2 },
      { term: 'yard visibility', weight: 3 },
      { term: 'trailer', weight: 2 },
      { term: 'dock', weight: 2 },
      { term: 'scheduling', weight: 2 },
      { term: 'throughput', weight: 2 },
      { term: 'manual', weight: 1 },
      { term: 'spreadsheet', weight: 2 },
      { term: 'chaos', weight: 2 },
    ],
    negative: [
      { term: 'investment', weight: -1 },
      { term: 'capital', weight: -1 },
      { term: 'board', weight: -2 },
      { term: 'shareholders', weight: -2 },
    ],
    tone: 'operational',
  },
  cfo: {
    positive: [
      { term: 'roi', weight: 3 },
      { term: 'payback', weight: 3 },
      { term: 'cost', weight: 2 },
      { term: 'savings', weight: 3 },
      { term: '$', weight: 2 },
      { term: 'million', weight: 2 },
      { term: 'quarterly', weight: 2 },
      { term: 'annual', weight: 2 },
      { term: 'margin', weight: 2 },
      { term: 'revenue', weight: 2 },
      { term: 'budget', weight: 1 },
      { term: 'capex', weight: 2 },
      { term: 'opex', weight: 2 },
    ],
    negative: [
      { term: 'truck', weight: -1 },
      { term: 'driver', weight: -1 },
      { term: 'dock', weight: -1 },
    ],
    tone: 'financial',
  },
  cio: {
    positive: [
      { term: 'integration', weight: 3 },
      { term: 'api', weight: 3 },
      { term: 'tms', weight: 3 },
      { term: 'wms', weight: 3 },
      { term: 'erp', weight: 2 },
      { term: 'sap', weight: 2 },
      { term: 'oracle', weight: 2 },
      { term: 'real-time', weight: 2 },
      { term: 'automation', weight: 2 },
      { term: 'visibility', weight: 2 },
      { term: 'data', weight: 1 },
      { term: 'analytics', weight: 2 },
      { term: 'security', weight: 2 },
      { term: 'cloud', weight: 1 },
    ],
    negative: [
      { term: 'manual', weight: 1 },  // Actually positive for CIO (pain point)
    ],
    tone: 'technical',
  },
  vp_supply_chain: {
    positive: [
      { term: 'supply chain', weight: 3 },
      { term: 'network', weight: 2 },
      { term: 'visibility', weight: 3 },
      { term: 'carrier', weight: 2 },
      { term: 'freight', weight: 2 },
      { term: 'logistics', weight: 2 },
      { term: 'distribution', weight: 2 },
      { term: 'multi-site', weight: 3 },
      { term: 'scale', weight: 2 },
      { term: 'efficiency', weight: 2 },
      { term: 'strategic', weight: 2 },
    ],
    negative: [],
    tone: 'strategic',
  },
} as const;

export type Persona = keyof typeof PERSONA_KEYWORDS;

// ============================================
// Compliance Rules
// ============================================

/**
 * Compliance rules for outreach messages
 * Based on CAN-SPAM, GDPR, and platform policies
 */
export const COMPLIANCE_RULES = {
  // Forbidden phrases and patterns
  forbidden: [
    { pattern: /\bguarantee[ds]?\b/i, reason: 'Avoid unsubstantiated guarantees', severity: 'warning' },
    { pattern: /\b100%\b/i, reason: 'Avoid absolute claims without proof', severity: 'warning' },
    { pattern: /\brisk[- ]?free\b/i, reason: 'Avoid unsubstantiated risk claims', severity: 'warning' },
    { pattern: /\bno obligation\b/i, reason: 'May trigger spam filters', severity: 'info' },
    { pattern: /\bact now\b/i, reason: 'High-pressure language', severity: 'warning' },
    { pattern: /\blimited time\b/i, reason: 'Creates false urgency', severity: 'info' },
    { pattern: /\bfree (trial|demo)\b/i, reason: 'May trigger spam filters', severity: 'info' },
    { pattern: /\bcongratulations\b/i, reason: 'Common spam pattern', severity: 'warning' },
    { pattern: /\bclick here\b/i, reason: 'Avoid generic CTAs', severity: 'info' },
    { pattern: /\bunsubscribe\b/i, reason: 'Handled by email platform', severity: 'info' },
  ],
  
  // Required elements for compliance
  required: {
    email: [
      { check: 'has_clear_sender', description: 'Clear sender identification' },
      { check: 'has_opt_out', description: 'Unsubscribe option (handled by ESP)' },
      { check: 'no_deceptive_subject', description: 'Non-deceptive subject line' },
    ],
    linkedin: [
      { check: 'professional_tone', description: 'Professional tone maintained' },
      { check: 'no_spam_patterns', description: 'No spam-like patterns' },
    ],
  },
  
  // Spam trigger words (lower weight, just informational)
  spamTriggers: [
    'amazing', 'incredible', 'revolutionary', 'breakthrough',
    'exclusive', 'secret', 'special', 'urgent', 'winner',
    'congratulations', 'selected', 'chosen', 'opportunity',
  ],
} as const;

// ============================================
// Zod Schemas
// ============================================

export const ChannelLimitSchema = z.object({
  maxChars: z.number(),
  maxWords: z.number(),
  idealChars: z.number(),
  idealWords: z.number(),
});

export const QualityIssueSchema = z.object({
  type: z.enum(['error', 'warning', 'info', 'success']),
  category: z.enum(['length', 'persona', 'compliance', 'readability', 'structure']),
  message: z.string(),
  suggestion: z.string().optional(),
  position: z.object({
    start: z.number(),
    end: z.number(),
  }).optional(),
});

export type QualityIssue = z.infer<typeof QualityIssueSchema>;

export const QualityScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  breakdown: z.object({
    length: z.number().min(0).max(100),
    persona: z.number().min(0).max(100),
    compliance: z.number().min(0).max(100),
    readability: z.number().min(0).max(100),
  }),
  issues: z.array(QualityIssueSchema),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  passesMinimum: z.boolean(),
});

export type QualityScore = z.infer<typeof QualityScoreSchema>;

export const MessageAnalysisInputSchema = z.object({
  message: z.string(),
  channel: z.enum(['linkedin_dm', 'linkedin_connection', 'email_cold', 'email_followup', 'twitter_dm', 'sms']),
  persona: z.enum(['ops_director', 'cfo', 'cio', 'vp_supply_chain']).optional(),
  companyName: z.string().optional(),
  prospectName: z.string().optional(),
});

export type MessageAnalysisInput = z.infer<typeof MessageAnalysisInputSchema>;

export const MessageAnalysisOutputSchema = z.object({
  input: MessageAnalysisInputSchema,
  score: QualityScoreSchema,
  metrics: z.object({
    charCount: z.number(),
    wordCount: z.number(),
    sentenceCount: z.number(),
    avgWordsPerSentence: z.number(),
    readingTimeSeconds: z.number(),
    personalizationCount: z.number(),
  }),
  suggestions: z.array(z.string()),
  timestamp: z.string(),
});

export type MessageAnalysisOutput = z.infer<typeof MessageAnalysisOutputSchema>;

// ============================================
// Utility Types
// ============================================

export interface ReadabilityMetrics {
  fleschKincaid: number;      // Grade level (lower = easier)
  fleschReadingEase: number;  // 0-100 (higher = easier)
  avgSyllablesPerWord: number;
  avgWordsPerSentence: number;
}

export interface PersonaMatch {
  persona: Persona;
  score: number;
  matchedTerms: Array<{ term: string; weight: number; count: number }>;
}

export interface ComplianceResult {
  passes: boolean;
  score: number;
  violations: Array<{
    rule: string;
    reason: string;
    severity: 'error' | 'warning' | 'info';
    match?: string;
  }>;
}
