/**
 * HotListScoringService
 * Sprint 203: Hot List & Daily Briefing
 * 
 * Scores prospects based on multiple factors to prioritize outreach:
 * - Tier (company importance)
 * - Engagement (email opens, clicks)
 * - Recency of activity
 * - Reply status
 * - Meeting status
 */

// =============================================================================
// Types
// =============================================================================

export interface ProspectScoreInput {
  id: string;
  tier?: string;
  emailOpened?: boolean;
  emailClicked?: boolean;
  lastContactedAt?: string | number;
  needsResponse?: boolean;
  upcomingMeetingAt?: string | number;
  lastReplyAt?: string | number;
  company?: string;
  name?: string;
  email?: string;
}

export interface HotListScore {
  prospectId: string;
  score: number;
  reasons: string[];
  prospect?: ProspectScoreInput;
}

export interface HotListConfig {
  tierWeights: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  engagementWeights: {
    opened: number;
    clicked: number;
    replied: number;
  };
  recencyWeights: {
    within7Days: number;
    within14Days: number;
    within30Days: number;
  };
  statusModifiers: {
    needsResponse: number;
    meetingScheduled: number;
  };
}

// =============================================================================
// Default Configuration
// =============================================================================

export const DEFAULT_HOTLIST_CONFIG: HotListConfig = {
  tierWeights: {
    tier1: 30,
    tier2: 20,
    tier3: 10,
  },
  engagementWeights: {
    opened: 15,
    clicked: 25,
    replied: 50,  // Highest priority
  },
  recencyWeights: {
    within7Days: 10,
    within14Days: 5,
    within30Days: 2,
  },
  statusModifiers: {
    needsResponse: 50,
    meetingScheduled: -20,  // Lower priority if already engaged
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calculate days since a timestamp
 */
function daysSince(timestamp: string | number | undefined | null): number {
  if (!timestamp) return 999; // Never = very old
  
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  if (isNaN(date.getTime())) return 999;
  
  return Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
}

/**
 * Normalize tier string
 */
function normalizeTier(tier: string | undefined): 'tier1' | 'tier2' | 'tier3' | null {
  if (!tier) return null;
  
  const normalized = tier.toLowerCase().replace(/\s+/g, '');
  if (normalized === 'tier1' || normalized === '1') return 'tier1';
  if (normalized === 'tier2' || normalized === '2') return 'tier2';
  if (normalized === 'tier3' || normalized === '3') return 'tier3';
  
  return null;
}

// =============================================================================
// Core Scoring Functions
// =============================================================================

/**
 * Calculate the hot list score for a single prospect
 */
export function calculateHotListScore(
  prospect: ProspectScoreInput,
  config: HotListConfig = DEFAULT_HOTLIST_CONFIG
): HotListScore {
  let score = 0;
  const reasons: string[] = [];

  // 1. Tier bonus
  const tier = normalizeTier(prospect.tier);
  if (tier === 'tier1') {
    score += config.tierWeights.tier1;
    reasons.push('Tier 1 account');
  } else if (tier === 'tier2') {
    score += config.tierWeights.tier2;
    reasons.push('Tier 2 account');
  } else if (tier === 'tier3') {
    score += config.tierWeights.tier3;
    reasons.push('Tier 3 account');
  }

  // 2. Engagement bonuses
  if (prospect.emailOpened) {
    score += config.engagementWeights.opened;
    reasons.push('Opened email');
  }
  if (prospect.emailClicked) {
    score += config.engagementWeights.clicked;
    reasons.push('Clicked link');
  }

  // 3. Recency bonus
  const daysSinceContact = daysSince(prospect.lastContactedAt);
  if (daysSinceContact < 7) {
    score += config.recencyWeights.within7Days;
    reasons.push('Recent activity');
  } else if (daysSinceContact < 14) {
    score += config.recencyWeights.within14Days;
    reasons.push('Active in 2 weeks');
  } else if (daysSinceContact < 30) {
    score += config.recencyWeights.within30Days;
    reasons.push('Active in 30 days');
  }

  // 4. Needs response is highest priority
  if (prospect.needsResponse) {
    score += config.statusModifiers.needsResponse;
    reasons.push('⚡ Replied - needs response!');
  }

  // 5. Has upcoming meeting (lower priority - already engaged)
  if (prospect.upcomingMeetingAt) {
    const daysUntilMeeting = -daysSince(prospect.upcomingMeetingAt);
    if (daysUntilMeeting >= 0) {
      score += config.statusModifiers.meetingScheduled;
      reasons.push('Meeting scheduled');
    }
  }

  return {
    prospectId: prospect.id,
    score,
    reasons,
    prospect,
  };
}

/**
 * Get top N prospects sorted by score
 */
export function getTopProspects(
  prospects: ProspectScoreInput[],
  limit: number = 10,
  config: HotListConfig = DEFAULT_HOTLIST_CONFIG
): HotListScore[] {
  return prospects
    .map(p => calculateHotListScore(p, config))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get prospects grouped by priority bucket
 */
export function getProspectsByPriority(
  prospects: ProspectScoreInput[],
  config: HotListConfig = DEFAULT_HOTLIST_CONFIG
): {
  critical: HotListScore[];  // Score >= 50 (needs immediate attention)
  high: HotListScore[];      // Score >= 30
  medium: HotListScore[];    // Score >= 15
  low: HotListScore[];       // Score < 15
} {
  const scored = prospects.map(p => calculateHotListScore(p, config));
  
  return {
    critical: scored.filter(s => s.score >= 50),
    high: scored.filter(s => s.score >= 30 && s.score < 50),
    medium: scored.filter(s => s.score >= 15 && s.score < 30),
    low: scored.filter(s => s.score < 15),
  };
}

/**
 * Summary stats for dashboard briefing
 */
export interface DailyBriefingSummary {
  topProspects: HotListScore[];
  stats: {
    needsResponse: number;
    hotProspects: number;
    meetingsScheduled: number;
    totalActive: number;
  };
}

/**
 * Generate daily briefing data
 */
export function generateDailyBriefing(
  prospects: ProspectScoreInput[],
  topN: number = 10,
  config: HotListConfig = DEFAULT_HOTLIST_CONFIG
): DailyBriefingSummary {
  const scored = prospects.map(p => calculateHotListScore(p, config));
  
  const needsResponse = prospects.filter(p => p.needsResponse).length;
  const hotProspects = scored.filter(s => s.score >= 30).length;
  const meetingsScheduled = prospects.filter(p => {
    if (!p.upcomingMeetingAt) return false;
    const daysUntil = -daysSince(p.upcomingMeetingAt);
    return daysUntil >= 0 && daysUntil <= 7; // Within next week
  }).length;

  return {
    topProspects: scored.sort((a, b) => b.score - a.score).slice(0, topN),
    stats: {
      needsResponse,
      hotProspects,
      meetingsScheduled,
      totalActive: prospects.length,
    },
  };
}

export default {
  calculateHotListScore,
  getTopProspects,
  getProspectsByPriority,
  generateDailyBriefing,
  DEFAULT_HOTLIST_CONFIG,
};
