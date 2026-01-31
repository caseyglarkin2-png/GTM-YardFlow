/**
 * Daily Briefing API Endpoint
 * Sprint 203: Hot List & Daily Briefing
 * 
 * Returns daily briefing data:
 * - Top 10 hot prospects
 * - Pending replies count
 * - Scheduled emails today
 * - Meeting stats
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';

// Duplicate scoring logic for server-side (avoid importing React services)
// These weights match HotListScoringService.ts

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface ProspectData {
  id: string;
  tier?: string;
  emailOpened?: boolean;
  emailClicked?: boolean;
  lastContactedAt?: string | number;
  needsResponse?: boolean;
  upcomingMeetingAt?: string | number;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
}

interface ScoredProspect {
  prospectId: string;
  score: number;
  reasons: string[];
  name: string;
  company: string;
  email: string;
  tier?: string;
  needsResponse?: boolean;
}

interface BriefingResponse {
  success: boolean;
  data?: {
    topProspects: ScoredProspect[];
    stats: {
      needsResponse: number;
      hotProspects: number;
      meetingsThisWeek: number;
      totalActive: number;
      emailsScheduledToday: number;
    };
    generatedAt: string;
  };
  error?: string;
}

function daysSince(timestamp: string | number | undefined | null): number {
  if (!timestamp) return 999;
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  if (isNaN(date.getTime())) return 999;
  return Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
}

function normalizeTier(tier: string | undefined): 'tier1' | 'tier2' | 'tier3' | null {
  if (!tier) return null;
  const normalized = tier.toLowerCase().replace(/\s+/g, '');
  if (normalized === 'tier1' || normalized === '1') return 'tier1';
  if (normalized === 'tier2' || normalized === '2') return 'tier2';
  if (normalized === 'tier3' || normalized === '3') return 'tier3';
  return null;
}

function calculateScore(prospect: ProspectData): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Tier bonus
  const tier = normalizeTier(prospect.tier);
  if (tier === 'tier1') { score += 30; reasons.push('Tier 1 account'); }
  else if (tier === 'tier2') { score += 20; reasons.push('Tier 2 account'); }
  else if (tier === 'tier3') { score += 10; reasons.push('Tier 3 account'); }

  // Engagement
  if (prospect.emailOpened) { score += 15; reasons.push('Opened email'); }
  if (prospect.emailClicked) { score += 25; reasons.push('Clicked link'); }

  // Recency
  const daysSinceContact = daysSince(prospect.lastContactedAt);
  if (daysSinceContact < 7) { score += 10; reasons.push('Recent activity'); }
  else if (daysSinceContact < 14) { score += 5; reasons.push('Active in 2 weeks'); }

  // Needs response
  if (prospect.needsResponse) { score += 50; reasons.push('⚡ Replied - needs response!'); }

  // Meeting scheduled (lower priority)
  if (prospect.upcomingMeetingAt) {
    const daysUntil = -daysSince(prospect.upcomingMeetingAt);
    if (daysUntil >= 0) { score -= 20; reasons.push('Meeting scheduled'); }
  }

  return { score, reasons };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow GET
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const db = getAdminDb();
    if (!db) {
      res.status(503).json({ success: false, error: 'Database not available' });
      return;
    }

    // 1. Get active prospects
    const prospectsSnapshot = await db
      .collection('prospects')
      .where('status', 'in', ['active', 'contacted', 'engaged'])
      .limit(200)
      .get();

    const prospects: ProspectData[] = prospectsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ProspectData[];

    // 2. Score and sort prospects
    const scoredProspects: ScoredProspect[] = prospects
      .map((p) => {
        const { score, reasons } = calculateScore(p);
        return {
          prospectId: p.id,
          score,
          reasons,
          name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown',
          company: p.company || 'Unknown',
          email: p.email || '',
          tier: p.tier,
          needsResponse: p.needsResponse,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // 3. Calculate stats
    const needsResponseCount = prospects.filter((p) => p.needsResponse).length;
    const hotProspectsCount = prospects.filter((p) => {
      const { score } = calculateScore(p);
      return score >= 30;
    }).length;

    // Count meetings this week
    const now = Date.now();
    const oneWeekFromNow = now + 7 * MS_PER_DAY;
    const meetingsThisWeek = prospects.filter((p) => {
      if (!p.upcomingMeetingAt) return false;
      const meetingTime = typeof p.upcomingMeetingAt === 'string'
        ? new Date(p.upcomingMeetingAt).getTime()
        : p.upcomingMeetingAt;
      return meetingTime >= now && meetingTime <= oneWeekFromNow;
    }).length;

    // 4. Count emails scheduled today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const scheduledEmailsSnapshot = await db
      .collection('email_queue')
      .where('status', '==', 'pending')
      .where('scheduledFor', '>=', todayStart.getTime())
      .where('scheduledFor', '<=', todayEnd.getTime())
      .get();

    const emailsScheduledToday = scheduledEmailsSnapshot.size;

    // 5. Return briefing
    const response: BriefingResponse = {
      success: true,
      data: {
        topProspects: scoredProspects,
        stats: {
          needsResponse: needsResponseCount,
          hotProspects: hotProspectsCount,
          meetingsThisWeek,
          totalActive: prospects.length,
          emailsScheduledToday,
        },
        generatedAt: new Date().toISOString(),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('[Briefing API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate briefing',
    });
  }
}
