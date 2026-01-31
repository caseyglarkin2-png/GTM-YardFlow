/**
 * Tests for HotListScoringService
 * Sprint 203: Hot List & Daily Briefing
 */

import { describe, it, expect } from 'vitest';
import {
  calculateHotListScore,
  getTopProspects,
  getProspectsByPriority,
  generateDailyBriefing,
  DEFAULT_HOTLIST_CONFIG,
  type ProspectScoreInput,
} from '@/services/HotListScoringService';

describe('HotListScoringService', () => {
  describe('calculateHotListScore', () => {
    it('should return zero score for prospect with no attributes', () => {
      const prospect: ProspectScoreInput = { id: 'test-1' };
      const result = calculateHotListScore(prospect);
      
      expect(result.prospectId).toBe('test-1');
      expect(result.score).toBe(0);
      expect(result.reasons).toHaveLength(0);
    });

    it('should score Tier 1 higher than Tier 2', () => {
      const tier1: ProspectScoreInput = { id: 't1', tier: 'Tier 1' };
      const tier2: ProspectScoreInput = { id: 't2', tier: 'Tier 2' };
      
      const score1 = calculateHotListScore(tier1);
      const score2 = calculateHotListScore(tier2);
      
      expect(score1.score).toBeGreaterThan(score2.score);
      expect(score1.reasons).toContain('Tier 1 account');
      expect(score2.reasons).toContain('Tier 2 account');
    });

    it('should score Tier 2 higher than Tier 3', () => {
      const tier2: ProspectScoreInput = { id: 't2', tier: 'Tier 2' };
      const tier3: ProspectScoreInput = { id: 't3', tier: 'Tier 3' };
      
      const score2 = calculateHotListScore(tier2);
      const score3 = calculateHotListScore(tier3);
      
      expect(score2.score).toBeGreaterThan(score3.score);
    });

    it('should add bonus for email opened', () => {
      const opened: ProspectScoreInput = { id: 'o1', emailOpened: true };
      const notOpened: ProspectScoreInput = { id: 'o2', emailOpened: false };
      
      const scoreOpened = calculateHotListScore(opened);
      const scoreNotOpened = calculateHotListScore(notOpened);
      
      expect(scoreOpened.score).toBeGreaterThan(scoreNotOpened.score);
      expect(scoreOpened.reasons).toContain('Opened email');
    });

    it('should add higher bonus for email clicked', () => {
      const clicked: ProspectScoreInput = { id: 'c1', emailClicked: true };
      const opened: ProspectScoreInput = { id: 'o1', emailOpened: true };
      
      const scoreClicked = calculateHotListScore(clicked);
      const scoreOpened = calculateHotListScore(opened);
      
      expect(scoreClicked.score).toBeGreaterThan(scoreOpened.score);
      expect(scoreClicked.reasons).toContain('Clicked link');
    });

    it('should add highest bonus for needsResponse', () => {
      const needsResponse: ProspectScoreInput = { id: 'r1', needsResponse: true };
      const clicked: ProspectScoreInput = { id: 'c1', emailClicked: true };
      
      const scoreNeedsResponse = calculateHotListScore(needsResponse);
      const scoreClicked = calculateHotListScore(clicked);
      
      expect(scoreNeedsResponse.score).toBeGreaterThan(scoreClicked.score);
      expect(scoreNeedsResponse.reasons).toContain('⚡ Replied - needs response!');
    });

    it('should reduce score for scheduled meeting', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const withMeeting: ProspectScoreInput = { 
        id: 'm1', 
        tier: 'Tier 1',
        upcomingMeetingAt: futureDate 
      };
      const withoutMeeting: ProspectScoreInput = { id: 'm2', tier: 'Tier 1' };
      
      const scoreWithMeeting = calculateHotListScore(withMeeting);
      const scoreWithoutMeeting = calculateHotListScore(withoutMeeting);
      
      expect(scoreWithMeeting.score).toBeLessThan(scoreWithoutMeeting.score);
      expect(scoreWithMeeting.reasons).toContain('Meeting scheduled');
    });

    it('should add recency bonus for recent activity', () => {
      const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const recent: ProspectScoreInput = { id: 'r1', lastContactedAt: recentDate };
      const noContact: ProspectScoreInput = { id: 'r2' };
      
      const scoreRecent = calculateHotListScore(recent);
      const scoreNoContact = calculateHotListScore(noContact);
      
      expect(scoreRecent.score).toBeGreaterThan(scoreNoContact.score);
      expect(scoreRecent.reasons).toContain('Recent activity');
    });

    it('should handle numeric timestamps', () => {
      const recent: ProspectScoreInput = { 
        id: 'r1', 
        lastContactedAt: Date.now() - 2 * 24 * 60 * 60 * 1000 
      };
      
      const result = calculateHotListScore(recent);
      expect(result.reasons).toContain('Recent activity');
    });

    it('should use custom config if provided', () => {
      const customConfig = {
        ...DEFAULT_HOTLIST_CONFIG,
        tierWeights: { tier1: 100, tier2: 50, tier3: 25 },
      };
      
      const prospect: ProspectScoreInput = { id: 't1', tier: 'Tier 1' };
      
      const defaultScore = calculateHotListScore(prospect);
      const customScore = calculateHotListScore(prospect, customConfig);
      
      expect(customScore.score).toBe(100);
      expect(defaultScore.score).toBe(30);
    });
  });

  describe('getTopProspects', () => {
    it('should return top N prospects sorted by score', () => {
      const prospects: ProspectScoreInput[] = [
        { id: 'p1', tier: 'Tier 3' },
        { id: 'p2', tier: 'Tier 1', needsResponse: true },
        { id: 'p3', tier: 'Tier 2' },
        { id: 'p4', tier: 'Tier 1' },
      ];
      
      const top2 = getTopProspects(prospects, 2);
      
      expect(top2).toHaveLength(2);
      expect(top2[0].prospectId).toBe('p2'); // Tier 1 + needsResponse
      expect(top2[1].prospectId).toBe('p4'); // Tier 1 only
    });

    it('should handle empty array', () => {
      const result = getTopProspects([], 10);
      expect(result).toHaveLength(0);
    });

    it('should handle limit larger than array', () => {
      const prospects: ProspectScoreInput[] = [
        { id: 'p1' },
        { id: 'p2' },
      ];
      
      const result = getTopProspects(prospects, 10);
      expect(result).toHaveLength(2);
    });
  });

  describe('getProspectsByPriority', () => {
    it('should bucket prospects by score', () => {
      const prospects: ProspectScoreInput[] = [
        { id: 'p1', needsResponse: true }, // Score: 50 (critical)
        { id: 'p2', tier: 'Tier 1' }, // Score: 30 (high)
        { id: 'p3', tier: 'Tier 2' }, // Score: 20 (medium)
        { id: 'p4' }, // Score: 0 (low)
      ];
      
      const buckets = getProspectsByPriority(prospects);
      
      expect(buckets.critical.map(b => b.prospectId)).toContain('p1');
      expect(buckets.high.map(b => b.prospectId)).toContain('p2');
      expect(buckets.medium.map(b => b.prospectId)).toContain('p3');
      expect(buckets.low.map(b => b.prospectId)).toContain('p4');
    });
  });

  describe('generateDailyBriefing', () => {
    it('should generate briefing with stats', () => {
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const prospects: ProspectScoreInput[] = [
        { id: 'p1', needsResponse: true },
        { id: 'p2', tier: 'Tier 1' },
        { id: 'p3', upcomingMeetingAt: futureDate },
        { id: 'p4' },
      ];
      
      const briefing = generateDailyBriefing(prospects, 5);
      
      expect(briefing.stats.needsResponse).toBe(1);
      expect(briefing.stats.hotProspects).toBe(2); // p1 and p2 have score >= 30
      expect(briefing.stats.meetingsScheduled).toBe(1);
      expect(briefing.stats.totalActive).toBe(4);
      expect(briefing.topProspects).toHaveLength(4);
    });

    it('should respect topN limit', () => {
      const prospects: ProspectScoreInput[] = [
        { id: 'p1' },
        { id: 'p2' },
        { id: 'p3' },
        { id: 'p4' },
        { id: 'p5' },
      ];
      
      const briefing = generateDailyBriefing(prospects, 3);
      expect(briefing.topProspects).toHaveLength(3);
    });
  });
});
