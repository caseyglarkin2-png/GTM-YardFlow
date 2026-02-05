/**
 * Quick Filter Presets Configuration
 * 
 * Sprint 36C: T36C.1 - Sales-oriented quick filter presets for common workflows.
 */

/**
 * QuickFilterPreset defines a reusable filter combination.
 */
export interface QuickFilterPreset {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Emoji icon */
  emoji: string;
  /** Brief description for tooltip */
  description: string;
  /** Filter values to apply */
  filters: {
    /** Company tiers to include (Railway format: 'Tier 1', 'Tier 2', etc.) */
    tiers?: string[];
    /** Email status filter */
    emailStatus?: 'has_email' | 'no_email' | 'all';
    /** Tags to filter by */
    tags?: string[];
    /** Minimum facility count */
    minFacilities?: number;
    /** Minimum Primo score */
    minScore?: number;
    /** Filter for confirmed gate issues */
    hasGateIssue?: boolean;
    /** Filter for AI research status (false = needs research) */
    hasAIResearch?: boolean;
  };
  /** Color scheme for button */
  color: {
    bg: string;
    bgActive: string;
    text: string;
  };
  /** Category for grouping (optional) */
  category?: 'priority' | 'workflow' | 'research';
}

/**
 * Quick filter presets for HitList filtering.
 * 
 * 8 presets covering common sales workflows:
 * - Manifest 2026: Conference attendees
 * - T1 Ready: Tier 1 with email (ready to contact)
 * - High Value: 60+ facilities (large accounts)
 * - Hot Leads: Score 70+ (best fit)
 * - Gate Issues: Confirmed yard problems
 * - Needs Email: Missing contact info
 * - Needs Research: Not yet AI researched
 * - T1 + T2: Top two tiers combined
 */
export const QUICK_FILTER_PRESETS: QuickFilterPreset[] = [
  {
    id: 'manifest-2026',
    label: 'Manifest 2026',
    emoji: '🎯',
    description: 'Conference attendees',
    filters: { tags: ['Manifest 2026'] },
    color: { bg: 'bg-purple-100', bgActive: 'bg-purple-600', text: 'text-purple-700' },
    category: 'priority',
  },
  {
    id: 't1-ready',
    label: 'T1 Ready',
    emoji: '⭐',
    description: 'Tier 1 with email - ready to contact',
    filters: { tiers: ['Tier 1'], emailStatus: 'has_email' },
    color: { bg: 'bg-amber-100', bgActive: 'bg-amber-600', text: 'text-amber-700' },
    category: 'priority',
  },
  {
    id: 'high-value',
    label: 'High Value',
    emoji: '💰',
    description: '60+ facilities - large accounts',
    filters: { minFacilities: 60 },
    color: { bg: 'bg-green-100', bgActive: 'bg-green-600', text: 'text-green-700' },
    category: 'priority',
  },
  {
    id: 'hot-leads',
    label: 'Hot Leads',
    emoji: '🔥',
    description: 'Score 70+ - best fit',
    filters: { minScore: 70 },
    color: { bg: 'bg-orange-100', bgActive: 'bg-orange-600', text: 'text-orange-700' },
    category: 'priority',
  },
  {
    id: 'gate-issues',
    label: 'Gate Issues',
    emoji: '🚛',
    description: 'Confirmed yard congestion problems',
    filters: { hasGateIssue: true },
    color: { bg: 'bg-red-100', bgActive: 'bg-red-600', text: 'text-red-700' },
    category: 'workflow',
  },
  {
    id: 'needs-email',
    label: 'Needs Email',
    emoji: '📧',
    description: 'Missing contact email address',
    filters: { emailStatus: 'no_email' },
    color: { bg: 'bg-slate-100', bgActive: 'bg-slate-600', text: 'text-slate-700' },
    category: 'workflow',
  },
  {
    id: 'needs-research',
    label: 'Needs Research',
    emoji: '🔬',
    description: 'Not yet AI researched',
    filters: { hasAIResearch: false },
    color: { bg: 'bg-blue-100', bgActive: 'bg-blue-600', text: 'text-blue-700' },
    category: 'research',
  },
  {
    id: 't1-t2',
    label: 'T1 + T2',
    emoji: '🏆',
    description: 'Top two priority tiers',
    filters: { tiers: ['Tier 1', 'Tier 2'] },
    color: { bg: 'bg-indigo-100', bgActive: 'bg-indigo-600', text: 'text-indigo-700' },
    category: 'priority',
  },
];

/**
 * Get a preset by ID.
 */
export function getQuickFilterPreset(id: string): QuickFilterPreset | undefined {
  return QUICK_FILTER_PRESETS.find(p => p.id === id);
}

/**
 * Check if a preset matches the current filter state.
 * Used to highlight active presets in the UI.
 */
export function isPresetActive(
  preset: QuickFilterPreset,
  currentFilters: {
    tierFilter?: string;
    emailFilter?: string;
    tagFilter?: string | null;
    minFacilities?: number;
    minScore?: number;
  }
): boolean {
  const { filters } = preset;
  
  // Check tier filter
  if (filters.tiers?.length === 1) {
    if (currentFilters.tierFilter !== filters.tiers[0]) return false;
  } else if (filters.tiers?.length && filters.tiers.length > 1) {
    // Multi-tier - check if current tier is in the list
    // (until S36D adds proper multi-tier support)
    if (!filters.tiers.includes(currentFilters.tierFilter || '')) return false;
  }
  
  // Check email filter
  if (filters.emailStatus && filters.emailStatus !== 'all') {
    if (currentFilters.emailFilter !== filters.emailStatus) return false;
  }
  
  // Check tag filter
  if (filters.tags?.length) {
    if (!filters.tags.includes(currentFilters.tagFilter || '')) return false;
  }
  
  // Check minFacilities
  if (filters.minFacilities && currentFilters.minFacilities !== filters.minFacilities) {
    return false;
  }
  
  // Check minScore
  if (filters.minScore && currentFilters.minScore !== filters.minScore) {
    return false;
  }
  
  return true;
}

export default QUICK_FILTER_PRESETS;
