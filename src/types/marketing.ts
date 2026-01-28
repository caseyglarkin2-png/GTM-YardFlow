/**
 * Marketing Module Types - YardFlow Hub
 * 
 * Types for enriched hitlist data, segmentation, campaigns, and exports.
 * Based on actual CSV structures from Manifest 2026 hitlists.
 */

import { z } from 'zod';

// ============================================
// Enriched Person Types
// ============================================

/**
 * Person category from event
 */
export const PersonCategorySchema = z.enum(['Speaker', 'Attendee', 'Sponsor', 'Unknown']);
export type PersonCategory = z.infer<typeof PersonCategorySchema>;

/**
 * Enriched Person from hitlist CSV
 * Maps to: YardFlow_Manifest2026_Hitlist_v3.xlsx - People Hitlist
 */
export const EnrichedPersonSchema = z.object({
  // Core fields
  id: z.string().uuid().optional(), // Generated on import
  name: z.string().min(1, 'Name is required'),
  category: PersonCategorySchema.default('Unknown'),
  jobTitle: z.string().default(''),
  company: z.string().default(''),
  country: z.string().optional(),
  
  // Qualification
  qualified: z.boolean().default(false),
  revenue: z.string().optional(),
  
  // Scoring
  personScore: z.number().min(0).max(100).default(0),
  
  // Persona flags (from hitlist scoring)
  isOps: z.boolean().default(false),
  isExec: z.boolean().default(false),
  isExecOps: z.boolean().default(false), // Combined exec + ops
  isProc: z.boolean().default(false),
  isSales: z.boolean().default(false),
  isTech: z.boolean().default(false),
  
  // Contact info (from Speakers Enriched when available)
  email: z.string().email().optional().or(z.literal('')),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  
  // Company enrichment (when merged with company data)
  employeeCount: z.number().optional(),
  annualRevenue: z.string().optional(),
  
  // Import metadata
  importedAt: z.string().datetime().optional(),
  importSource: z.string().optional(),
  
  // User-added data (preserved on merge)
  userNotes: z.string().optional(),
  userTags: z.array(z.string()).optional(),
  
  // Campaign tracking
  sequenceAssigned: z.boolean().default(false),
  sequenceId: z.string().optional(),
  sequenceAssignedAt: z.string().datetime().optional(),
});

export type EnrichedPerson = z.infer<typeof EnrichedPersonSchema>;

// ============================================
// Enriched Company Types
// ============================================

/**
 * Company tier from scoring
 */
export const CompanyTierSchema = z.enum(['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Unscored']);
export type CompanyTier = z.infer<typeof CompanyTierSchema>;

/**
 * Enriched Company from hitlist CSV
 * Maps to: YardFlow_Manifest2026_Hitlist_v3.xlsx - Company Hitlist
 */
export const EnrichedCompanySchema = z.object({
  // Core fields
  id: z.string().uuid().optional(),
  company: z.string().min(1, 'Company name is required'),
  
  // Attendee composition
  attendees: z.number().min(0).default(0),
  execOpsCount: z.number().min(0).default(0),
  opsCount: z.number().min(0).default(0),
  procCount: z.number().min(0).default(0),
  salesCount: z.number().min(0).default(0),
  techCount: z.number().min(0).default(0),
  nonOps: z.number().min(0).default(0),
  
  // Scoring factors
  opsShare: z.number().min(0).max(1).default(0),
  vendorPenalty: z.number().default(0),
  megaBoost: z.number().default(0),
  maxRevenue: z.number().optional(),
  
  // Final scoring
  score: z.number().default(0),
  tier: CompanyTierSchema.default('Unscored'),
  
  // Recommendations
  recommendedTargets: z.string().default(''),
  topTitles: z.string().default(''),
  
  // Import metadata
  importedAt: z.string().datetime().optional(),
  importSource: z.string().optional(),
});

export type EnrichedCompany = z.infer<typeof EnrichedCompanySchema>;

// ============================================
// Segmentation Types
// ============================================

/**
 * Persona filter options
 */
export type PersonaFilter = 'exec' | 'ops' | 'execOps' | 'proc' | 'sales' | 'tech';

/**
 * Filter configuration for segmentation
 */
export const SegmentFilterSchema = z.object({
  // Tier filter (multi-select)
  tiers: z.array(CompanyTierSchema).optional(),
  
  // Persona filter (multi-select, OR logic within, AND with other filters)
  personas: z.array(z.enum(['exec', 'ops', 'execOps', 'proc', 'sales', 'tech'])).optional(),
  
  // Category filter
  categories: z.array(PersonCategorySchema).optional(),
  
  // Score range (inclusive)
  scoreMin: z.number().min(0).max(100).optional(),
  scoreMax: z.number().min(0).max(100).optional(),
  
  // Contact filters
  hasEmail: z.boolean().optional(),
  hasLinkedIn: z.boolean().optional(),
  
  // Qualification filter
  qualified: z.boolean().optional(),
  
  // Sequence filter
  hasSequence: z.boolean().optional(),
  
  // Free text search (fuzzy match on name/company/title)
  search: z.string().optional(),
});

export type SegmentFilter = z.infer<typeof SegmentFilterSchema>;

/**
 * Saved segment with name and filters
 */
export const SavedSegmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  filters: SegmentFilterSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  prospectCount: z.number().optional(), // Last known count
});

export type SavedSegment = z.infer<typeof SavedSegmentSchema>;

// ============================================
// Campaign Types
// ============================================

/**
 * Campaign assignment record
 */
export const CampaignAssignmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  segmentId: z.string().uuid().optional(),
  segmentName: z.string().optional(),
  sequenceId: z.string(),
  sequenceName: z.string(),
  prospectIds: z.array(z.string()),
  prospectCount: z.number(),
  assignedAt: z.string().datetime(),
  assignedBy: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).default('draft'),
});

export type CampaignAssignment = z.infer<typeof CampaignAssignmentSchema>;

// ============================================
// Import Types
// ============================================

/**
 * CSV parse error
 */
export interface CsvParseError {
  row: number;
  field?: string;
  message: string;
  type: 'error' | 'warning';
}

/**
 * CSV parse result
 */
export interface CsvParseResult<T> {
  data: T[];
  errors: CsvParseError[];
  warnings: string[];
  rowCount: number;
  parsedCount: number;
}

/**
 * Column mapping configuration
 */
export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  confidence: number; // 0-1
  transform?: 'string' | 'number' | 'boolean' | 'date';
}

/**
 * Import history record
 */
export const ImportHistorySchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  importedAt: z.string().datetime(),
  rowCount: z.number(),
  addedCount: z.number(),
  updatedCount: z.number(),
  skippedCount: z.number(),
  errorCount: z.number(),
  type: z.enum(['people', 'companies', 'speakers']),
  // Snapshot for rollback (stored separately to save memory)
  snapshotId: z.string().uuid().optional(),
});

export type ImportHistory = z.infer<typeof ImportHistorySchema>;

// ============================================
// HubSpot Export Types
// ============================================

/**
 * HubSpot contact for export
 */
export const HubSpotContactSchema = z.object({
  Email: z.string().email(),
  'First Name': z.string(),
  'Last Name': z.string(),
  Company: z.string(),
  'Job Title': z.string(),
  'Lead Status': z.string().default('NEW'),
  
  // Custom YardFlow properties
  yf_tier: z.string().optional(),
  yf_persona: z.string().optional(),
  yf_score: z.number().optional(),
  yf_sequence_id: z.string().optional(),
  yf_sequence_name: z.string().optional(),
  yf_category: z.string().optional(),
  yf_linkedin_url: z.string().optional(),
});

export type HubSpotContact = z.infer<typeof HubSpotContactSchema>;

// ============================================
// Validation Helpers
// ============================================

export function parseEnrichedPerson(data: unknown): EnrichedPerson {
  return EnrichedPersonSchema.parse(data);
}

export function safeParseEnrichedPerson(data: unknown) {
  return EnrichedPersonSchema.safeParse(data);
}

export function parseEnrichedCompany(data: unknown): EnrichedCompany {
  return EnrichedCompanySchema.parse(data);
}

export function safeParseEnrichedCompany(data: unknown) {
  return EnrichedCompanySchema.safeParse(data);
}

// ============================================
// Default Values
// ============================================

export function getDefaultSegmentFilter(): SegmentFilter {
  return {};
}

export function createEmptyEnrichedPerson(): Partial<EnrichedPerson> {
  return {
    name: '',
    category: 'Unknown',
    jobTitle: '',
    company: '',
    personScore: 0,
    isOps: false,
    isExec: false,
    isExecOps: false,
    isProc: false,
    isSales: false,
    isTech: false,
    qualified: false,
    sequenceAssigned: false,
  };
}
