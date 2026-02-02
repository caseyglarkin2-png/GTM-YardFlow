/**
 * YardFlow Type Definitions
 */

export interface Prospect {
  id: string;
  name: string;
  title: string;
  company: string;
  tier: string;
  score: number;
  isOps: boolean;
  isExec: boolean;
  status: 'new' | 'drafted' | 'contacted' | 'meeting_booked';
  notes?: string;
  lastEditedBy?: string;
  category?: 'Speaker' | 'Attendee' | 'Sponsor';
  qualified?: boolean;
  country?: string;
  revenue?: string;
  // Extended fields for import/sync
  email?: string;
  /**
   * Confidence level for the email address
   * - verified: Confirmed valid (from enriched data or bounce check)
   * - high: Strong pattern match with domain verification
   * - medium: Pattern match without verification
   * - low: Weak pattern match or guessed
   * - inferred: Generated from email pattern (not verified)
   */
  emailConfidence?: 'verified' | 'high' | 'medium' | 'low' | 'inferred';
  phone?: string;
  linkedinUrl?: string;
  source?: string;
  tags?: string[];
  industry?: string;
  location?: string;
  createdAt?: number;
  updatedAt?: number;
  
  // Company-level Primo Lookalike fields (from EnrichedCompany)
  companyFacilityCount?: number;
  companyIndustry?: string;
  companyPrimoScore?: number;
}

export interface MessageTemplate {
  id: string;
  label: string;
  subject: string;
  body: string;
  type: 'intro' | 'codev' | 'technical' | 'short_dm' | 'custom';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface CompanyInfo {
  tier: string;
  companyScore: number;
  attendees?: number;
  execOpsCount?: number;
  recommendedTargets?: string[];
}

/**
 * Company entity for import/matching
 */
export interface Company {
  id: string;
  name: string;
  domain?: string;
  normalizedName?: string;
  industry?: string;
  employees?: number;
  tier?: string;
  linkedinUrl?: string;
}

export type TierFilter = 'All' | 'Tier 1' | 'Tier 2' | 'Tier 3';
export type StatusFilter = 'All' | 'new' | 'drafted' | 'contacted' | 'meeting_booked';
