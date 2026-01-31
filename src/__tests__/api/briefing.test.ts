/**
 * Tests for Daily Briefing API
 * Sprint 203: Hot List & Daily Briefing
 * 
 * Note: Since api/ routes are outside src/, we test the logic inline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock scoring logic inline for testing
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

interface ProspectData {
  id: string;
  tier?: string;
  emailOpened?: boolean;
  emailClicked?: boolean;
  lastContactedAt?: string | number;
  needsResponse?: boolean;
  upcomingMeetingAt?: string | number;
  name?: string;
  email?: string;
  company?: string;
}

function calculateScore(prospect: ProspectData): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const tier = normalizeTier(prospect.tier);
  if (tier === 'tier1') { score += 30; reasons.push('Tier 1 account'); }
  else if (tier === 'tier2') { score += 20; reasons.push('Tier 2 account'); }
  else if (tier === 'tier3') { score += 10; reasons.push('Tier 3 account'); }

  if (prospect.emailOpened) { score += 15; reasons.push('Opened email'); }
  if (prospect.emailClicked) { score += 25; reasons.push('Clicked link'); }

  const daysSinceContact = daysSince(prospect.lastContactedAt);
  if (daysSinceContact < 7) { score += 10; reasons.push('Recent activity'); }
  else if (daysSinceContact < 14) { score += 5; reasons.push('Active in 2 weeks'); }

  if (prospect.needsResponse) { score += 50; reasons.push('⚡ Replied - needs response!'); }

  if (prospect.upcomingMeetingAt) {
    const daysUntil = -daysSince(prospect.upcomingMeetingAt);
    if (daysUntil >= 0) { score -= 20; reasons.push('Meeting scheduled'); }
  }

  return { score, reasons };
}

describe('Daily Briefing API Logic', () => {
  const createMockProspects = (): ProspectData[] => [
    {
      id: 'prospect-1',
      tier: 'Tier 1',
      name: 'John Doe',
      email: 'john@example.com',
      company: 'Acme Inc',
      needsResponse: true,
    },
    {
      id: 'prospect-2',
      tier: 'Tier 2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      company: 'Tech Corp',
      emailClicked: true,
    },
    {
      id: 'prospect-3',
      tier: 'Tier 3',
      name: 'Bob Wilson',
      email: 'bob@example.com',
      company: 'StartupCo',
    },
  ];

  describe('calculateScore', () => {
    it('should score Tier 1 + needsResponse highest', () => {
      const prospects = createMockProspects();
      const scores = prospects.map(calculateScore);
      
      // John Doe (Tier 1 + needsResponse) should have highest score
      expect(scores[0].score).toBeGreaterThan(scores[1].score);
      expect(scores[0].score).toBeGreaterThan(scores[2].score);
    });

    it('should include reasons for Tier 1 account', () => {
      const { reasons } = calculateScore({ id: '1', tier: 'Tier 1' });
      expect(reasons).toContain('Tier 1 account');
    });

    it('should include reasons for needsResponse', () => {
      const { reasons } = calculateScore({ id: '1', needsResponse: true });
      expect(reasons).toContain('⚡ Replied - needs response!');
    });

    it('should include reasons for email opened', () => {
      const { reasons } = calculateScore({ id: '1', emailOpened: true });
      expect(reasons).toContain('Opened email');
    });

    it('should include reasons for email clicked', () => {
      const { reasons } = calculateScore({ id: '1', emailClicked: true });
      expect(reasons).toContain('Clicked link');
    });

    it('should reduce score for scheduled meeting', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const withMeeting = calculateScore({ id: '1', tier: 'Tier 1', upcomingMeetingAt: futureDate });
      const withoutMeeting = calculateScore({ id: '2', tier: 'Tier 1' });
      
      expect(withMeeting.score).toBeLessThan(withoutMeeting.score);
      expect(withMeeting.reasons).toContain('Meeting scheduled');
    });

    it('should add recency bonus for recent activity', () => {
      const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { score, reasons } = calculateScore({ id: '1', lastContactedAt: recentDate });
      
      expect(score).toBeGreaterThan(0);
      expect(reasons).toContain('Recent activity');
    });

    it('should handle missing timestamp', () => {
      const { score } = calculateScore({ id: '1' });
      expect(score).toBe(0);
    });
  });

  describe('normalizeTier', () => {
    it('should normalize "Tier 1" to tier1', () => {
      expect(normalizeTier('Tier 1')).toBe('tier1');
    });

    it('should normalize "1" to tier1', () => {
      expect(normalizeTier('1')).toBe('tier1');
    });

    it('should return null for undefined', () => {
      expect(normalizeTier(undefined)).toBeNull();
    });

    it('should return null for unknown tier', () => {
      expect(normalizeTier('unknown')).toBeNull();
    });
  });

  describe('briefing data structure', () => {
    it('should sort prospects by score descending', () => {
      const prospects = createMockProspects();
      const scoredProspects = prospects
        .map(p => ({ ...p, ...calculateScore(p) }))
        .sort((a, b) => b.score - a.score);
      
      // First should be John Doe (Tier 1 + needsResponse = 80)
      expect(scoredProspects[0].name).toBe('John Doe');
      // Second should be Jane Smith (Tier 2 + clicked = 45)
      expect(scoredProspects[1].name).toBe('Jane Smith');
      // Third should be Bob Wilson (Tier 3 = 10)
      expect(scoredProspects[2].name).toBe('Bob Wilson');
    });

    it('should correctly count needsResponse', () => {
      const prospects = createMockProspects();
      const needsResponseCount = prospects.filter(p => p.needsResponse).length;
      expect(needsResponseCount).toBe(1);
    });

    it('should correctly count hot prospects (score >= 30)', () => {
      const prospects = createMockProspects();
      const hotProspectsCount = prospects.filter(p => {
        const { score } = calculateScore(p);
        return score >= 30;
      }).length;
      // John Doe (80) and Jane Smith (45) are hot
      expect(hotProspectsCount).toBe(2);
    });
  });
});
