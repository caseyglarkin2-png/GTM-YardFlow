/**
 * Asset Types - YardFlow Hub
 * 
 * Type definitions for AI-generated assets.
 */

// ============================================
// Generated Asset Types
// ============================================

/**
 * Mini-Brief: 1-page prospect-specific ROI summary
 */
export interface MiniBrief {
  hook: string;             // 1-2 sentences, attention grabber
  painPoints: string[];     // 3 bullet points, prospect-specific
  valueProps: string[];     // 3 bullet points, mapped to pain
  roiSnapshot: string;      // ROI numbers if available
  cta: string;              // Call to action
}

/**
 * DM Variant: Short message variant for outreach
 */
export interface DMVariant {
  id: string;
  type: 'exec' | 'ops' | 'challenger';
  content: string;          // ≤250 characters
  characterCount: number;
}

/**
 * Email Step: Single email in a sequence
 */
export interface EmailStep {
  position: number;
  delayDays: number;        // Days after previous step
  subject: string;          // ≤60 chars
  body: string;             // ≤500 words
  persona: 'exec' | 'ops' | 'proc' | 'all';
}

/**
 * Email Sequence: Multi-step email campaign
 */
export interface EmailSequence {
  id: string;
  name: string;
  steps: EmailStep[];
  createdAt: string;
}

/**
 * Complete generated assets bundle
 */
export interface GeneratedAssets {
  prospectId: string;
  prospectName: string;
  companyName: string;
  
  miniBrief?: MiniBrief;
  dmVariants?: DMVariant[];
  emailSequence?: EmailSequence;
  
  generatedAt: string;
  cacheKey?: string;
  fromCache: boolean;
}

// ============================================
// Asset Generation Context
// ============================================

/**
 * Context for asset generation
 */
export interface AssetContext {
  prospectId: string;
  prospectName: string;
  prospectTitle: string;
  companyName: string;
  tier: string;
  
  // Persona flags
  isOps: boolean;
  isExec: boolean;
  isProc?: boolean;
  
  // ROI data from Sprint 18
  roiData?: {
    totalAnnualSavings?: number;
    paperSavings?: number;
    laborSavings?: number;
    detentionSavings?: number;
    paybackMonths?: number;
    networkMultiplier?: number;
  };
  
  // Asset-specific settings
  targetAssets: ('brief' | 'dms' | 'emails')[];
  existingDMForSequence?: string;
}

// ============================================
// Gemini API Types
// ============================================

export interface GeminiError {
  type: 'rate_limit' | 'auth_error' | 'content_filter' | 'network' | 'unknown';
  message: string;
  retryAfter?: number;  // seconds
}

export interface GeminiGenerateResult {
  success: boolean;
  data?: GeneratedAssets;
  error?: GeminiError;
  tokensUsed?: number;
}

// ============================================
// Email Template Types
// ============================================

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];      // e.g., ['firstName', 'company', 'roiSavings']
  persona: 'exec' | 'ops' | 'proc' | 'all';
  sequencePosition: number;
}

export interface EmailConfig {
  fromName: string;         // Default: "Jake at YardFlow"
  replyToEmail: string;
  unsubscribeText: string;  // Default: "Reply STOP to unsubscribe"
  complianceFooter: string;
}

// ============================================
// Cache Types
// ============================================

export interface CacheEntry<T> {
  key: string;
  value: T;
  cachedAt: string;
  expiresAt: string;
  promptHash: string;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  oldestEntry?: string;
  newestEntry?: string;
}
