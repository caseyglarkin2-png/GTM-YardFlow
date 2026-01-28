/**
 * Social Channel Service Tests - YardFlow Hub
 * 
 * Tests for multi-channel social outreach:
 * - Message formatting
 * - Outreach tracking
 * - Cadence management
 * - Analytics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatForChannel,
  getChannelTips,
  checkBestPractices,
  createOutreach,
  updateOutreachStatus,
  createSocialProfile,
  updateProfileMetrics,
  recordTouchpoint,
  countTouchpoints,
  hasRecentContact,
  createCadence,
  getNextCadenceStep,
  calculateChannelPerformance,
  calculateOutreachAnalytics,
  SOCIAL_CHANNEL_CONFIG,
  CADENCE_TEMPLATES,
} from '../../services/SocialChannelService';
import type { SocialOutreach, Touchpoint, Cadence } from '../../types/socialChannel';
import type { EmailProspect } from '../../services/EmailSequenceService';

// ============================================
// Test Data
// ============================================

const mockProspect: EmailProspect = {
  id: 'p1',
  name: 'Sarah Johnson',
  email: 'sarah@acmelogistics.com',
  company: 'Acme Logistics',
  title: 'VP of Operations',
  industry: 'Transportation',
};

const mockSender = {
  name: 'John Smith',
  title: 'Account Executive',
  company: 'YardFlow',
};

const formatOptions = {
  prospect: mockProspect,
  sender: mockSender,
};

// ============================================
// Message Formatting Tests
// ============================================

describe('SocialChannelService', () => {
  describe('formatForChannel', () => {
    it('should personalize message with prospect data', () => {
      const message = 'Hi {{firstName}}, saw {{company}} is growing!';
      const { formatted } = formatForChannel(message, 'linkedin_dm', formatOptions);
      
      expect(formatted).toBe('Hi Sarah, saw Acme Logistics is growing!');
    });

    it('should replace all merge tags', () => {
      const message = '{{firstName}} {{lastName}} at {{company}} - {{title}}';
      const { formatted } = formatForChannel(message, 'linkedin_dm', formatOptions);
      
      expect(formatted).toContain('Sarah');
      expect(formatted).toContain('Johnson');
      expect(formatted).toContain('Acme Logistics');
      expect(formatted).toContain('VP of Operations');
    });

    it('should warn when message exceeds channel limit', () => {
      const longMessage = 'a'.repeat(400); // Over LinkedIn connection limit of 300
      const { warnings } = formatForChannel(longMessage, 'linkedin_connection', formatOptions);
      
      expect(warnings.some(w => w.includes('exceeds'))).toBe(true);
    });

    it('should warn about missing question for DM channels', () => {
      const noQuestion = 'Hi Sarah, just wanted to share something.';
      const { warnings } = formatForChannel(noQuestion, 'linkedin_dm', formatOptions);
      
      expect(warnings.some(w => w.includes('question'))).toBe(true);
    });

    it('should not warn about question for reply channels', () => {
      const noQuestion = 'Great insights! Totally agree.';
      const { warnings } = formatForChannel(noQuestion, 'twitter_reply', formatOptions);
      
      expect(warnings.some(w => w.includes('question'))).toBe(false);
    });

    it('should truncate message over limit', () => {
      const longMessage = 'a'.repeat(400);
      const { formatted } = formatForChannel(longMessage, 'linkedin_connection', formatOptions);
      
      expect(formatted.length).toBeLessThanOrEqual(300);
      expect(formatted.endsWith('...')).toBe(true);
    });
  });

  describe('getChannelTips', () => {
    it('should return tips for each channel', () => {
      const channels = [
        'linkedin_connection',
        'linkedin_dm',
        'linkedin_inmail',
        'twitter_dm',
        'twitter_reply',
        'twitter_quote',
      ] as const;

      for (const channel of channels) {
        const tips = getChannelTips(channel);
        expect(tips.length).toBeGreaterThan(0);
        expect(typeof tips[0]).toBe('string');
      }
    });
  });

  describe('checkBestPractices', () => {
    it('should pass message meeting best practices', () => {
      // LinkedIn DM optimal length is 100-300 chars
      const goodMessage = 'Hi Sarah, I noticed that Acme Logistics is running a large fleet of trailers. Quick question about yard operations - are detention fees a pain point?';
      const result = checkBestPractices(goodMessage, 'linkedin_dm');
      
      expect(result.passes).toBe(true);
      expect(result.feedback).toHaveLength(0);
    });

    it('should fail message too short', () => {
      const shortMessage = 'Hi';
      const result = checkBestPractices(shortMessage, 'linkedin_dm');
      
      expect(result.passes).toBe(false);
      expect(result.feedback.some(f => f.includes('too short'))).toBe(true);
    });

    it('should fail message too long', () => {
      const longMessage = 'a'.repeat(500);
      const result = checkBestPractices(longMessage, 'linkedin_dm');
      
      expect(result.passes).toBe(false);
      expect(result.feedback.some(f => f.includes('too long'))).toBe(true);
    });

    it('should require question for DM channels', () => {
      const noQuestion = 'Hi Sarah, this is a message without a question mark';
      const result = checkBestPractices(noQuestion, 'linkedin_dm');
      
      expect(result.feedback.some(f => f.includes('question'))).toBe(true);
    });
  });

  // ============================================
  // Outreach Management Tests
  // ============================================

  describe('createOutreach', () => {
    it('should create outreach with required fields', () => {
      const outreach = createOutreach('p1', 'Sarah Johnson', 'linkedin_dm', 'Hello!');
      
      expect(outreach.id).toBeDefined();
      expect(outreach.prospectId).toBe('p1');
      expect(outreach.prospectName).toBe('Sarah Johnson');
      expect(outreach.channel).toBe('linkedin_dm');
      expect(outreach.message).toBe('Hello!');
      expect(outreach.status).toBe('draft');
    });

    it('should include optional fields', () => {
      const outreach = createOutreach('p1', 'Sarah', 'linkedin_inmail', 'Hello!', {
        subject: 'Quick question',
        profileUrl: 'https://linkedin.com/in/sarah',
        campaignId: 'camp1',
        notes: 'Test note',
      });
      
      expect(outreach.subject).toBe('Quick question');
      expect(outreach.profileUrl).toBe('https://linkedin.com/in/sarah');
      expect(outreach.campaignId).toBe('camp1');
      expect(outreach.notes).toBe('Test note');
    });

    it('should initialize metrics to false', () => {
      const outreach = createOutreach('p1', 'Sarah', 'linkedin_dm', 'Hello!');
      
      expect(outreach.wasOpened).toBe(false);
      expect(outreach.wasClicked).toBe(false);
      expect(outreach.wasReplied).toBe(false);
    });
  });

  describe('updateOutreachStatus', () => {
    let outreach: SocialOutreach;

    beforeEach(() => {
      outreach = createOutreach('p1', 'Sarah', 'linkedin_dm', 'Hello!');
    });

    it('should update status to sent', () => {
      const updated = updateOutreachStatus(outreach, 'sent');
      
      expect(updated.status).toBe('sent');
      expect(updated.sentAt).toBeDefined();
    });

    it('should update status to opened', () => {
      const updated = updateOutreachStatus(outreach, 'opened');
      
      expect(updated.status).toBe('opened');
      expect(updated.openedAt).toBeDefined();
      expect(updated.wasOpened).toBe(true);
    });

    it('should update status to replied', () => {
      const updated = updateOutreachStatus(outreach, 'replied');
      
      expect(updated.status).toBe('replied');
      expect(updated.repliedAt).toBeDefined();
      expect(updated.wasReplied).toBe(true);
    });

    it('should preserve custom timestamp', () => {
      const customTime = '2024-01-15T10:00:00Z';
      const updated = updateOutreachStatus(outreach, 'sent', customTime);
      
      expect(updated.sentAt).toBe(customTime);
    });
  });

  // ============================================
  // Social Profile Tests
  // ============================================

  describe('createSocialProfile', () => {
    it('should create profile with LinkedIn URL', () => {
      const profile = createSocialProfile(
        'p1',
        'https://linkedin.com/in/sarah-johnson'
      );
      
      expect(profile.prospectId).toBe('p1');
      expect(profile.linkedinUrl).toBe('https://linkedin.com/in/sarah-johnson');
      expect(profile.linkedinUsername).toBe('sarah-johnson');
    });

    it('should create profile with Twitter handle', () => {
      const profile = createSocialProfile(
        'p1',
        undefined,
        'sarahjohnson'
      );
      
      expect(profile.twitterHandle).toBe('sarahjohnson');
      expect(profile.twitterUrl).toBe('https://twitter.com/sarahjohnson');
    });

    it('should initialize metrics', () => {
      const profile = createSocialProfile('p1');
      
      expect(profile.totalOutreaches).toBe(0);
      expect(profile.totalReplies).toBe(0);
      expect(profile.linkedinIsConnected).toBe(false);
    });
  });

  describe('updateProfileMetrics', () => {
    it('should increment outreach count', () => {
      const profile = createSocialProfile('p1');
      const outreach = createOutreach('p1', 'Sarah', 'linkedin_dm', 'Hello!');
      outreach.sentAt = new Date().toISOString();
      
      const updated = updateProfileMetrics(profile, outreach);
      
      expect(updated.totalOutreaches).toBe(1);
      expect(updated.lastContactedAt).toBe(outreach.sentAt);
    });

    it('should increment replies when replied', () => {
      const profile = createSocialProfile('p1');
      const outreach = createOutreach('p1', 'Sarah', 'linkedin_dm', 'Hello!');
      outreach.wasReplied = true;
      
      const updated = updateProfileMetrics(profile, outreach);
      
      expect(updated.totalReplies).toBe(1);
    });

    it('should set connected status', () => {
      const profile = createSocialProfile('p1');
      const outreach = createOutreach('p1', 'Sarah', 'linkedin_connection', 'Connect?');
      outreach.status = 'connected';
      
      const updated = updateProfileMetrics(profile, outreach);
      
      expect(updated.linkedinIsConnected).toBe(true);
    });
  });

  // ============================================
  // Touchpoint Tests
  // ============================================

  describe('recordTouchpoint', () => {
    it('should create touchpoint record', () => {
      const touchpoint = recordTouchpoint('p1', 'linkedin_dm', {
        content: 'Test message',
      });
      
      expect(touchpoint.id).toBeDefined();
      expect(touchpoint.prospectId).toBe('p1');
      expect(touchpoint.type).toBe('linkedin_dm');
      expect(touchpoint.channel).toBe('linkedin');
      expect(touchpoint.content).toBe('Test message');
    });

    it('should derive channel from type', () => {
      const linkedinTouchpoint = recordTouchpoint('p1', 'linkedin_like_post');
      const twitterTouchpoint = recordTouchpoint('p1', 'twitter_follow');
      const emailTouchpoint = recordTouchpoint('p1', 'email_sent');
      
      expect(linkedinTouchpoint.channel).toBe('linkedin');
      expect(twitterTouchpoint.channel).toBe('twitter');
      expect(emailTouchpoint.channel).toBe('email');
    });
  });

  describe('countTouchpoints', () => {
    it('should count touchpoints for a prospect', () => {
      const touchpoints: Touchpoint[] = [
        recordTouchpoint('p1', 'linkedin_dm'),
        recordTouchpoint('p1', 'linkedin_like_post'),
        recordTouchpoint('p2', 'linkedin_dm'),
      ];
      
      expect(countTouchpoints(touchpoints, 'p1')).toBe(2);
      expect(countTouchpoints(touchpoints, 'p2')).toBe(1);
    });
  });

  describe('hasRecentContact', () => {
    it('should return true for recent contact', () => {
      const touchpoints: Touchpoint[] = [
        recordTouchpoint('p1', 'linkedin_dm'),
      ];
      
      expect(hasRecentContact(touchpoints, 'p1', 7)).toBe(true);
    });

    it('should return false for old contact', () => {
      const oldTouchpoint = recordTouchpoint('p1', 'linkedin_dm');
      oldTouchpoint.timestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      
      expect(hasRecentContact([oldTouchpoint], 'p1', 7)).toBe(false);
    });
  });

  // ============================================
  // Cadence Tests
  // ============================================

  describe('createCadence', () => {
    it('should create cadence with steps', () => {
      const steps = [
        { order: 0, channel: 'linkedin_connection' as const, action: 'send_connection', delayDays: 0, messageTemplate: 'Hi!', skipIfReplied: false, skipIfConnected: false },
        { order: 1, channel: 'linkedin_dm' as const, action: 'send_dm', delayDays: 2, messageTemplate: 'Follow up', skipIfReplied: true, skipIfConnected: false },
      ];
      
      const cadence = createCadence('Test Cadence', steps);
      
      expect(cadence.id).toBeDefined();
      expect(cadence.name).toBe('Test Cadence');
      expect(cadence.steps).toHaveLength(2);
      expect(cadence.status).toBe('draft');
    });

    it('should assign unique IDs to steps', () => {
      const steps = [
        { order: 0, channel: 'linkedin_dm' as const, action: 'send_dm', delayDays: 0, skipIfReplied: false, skipIfConnected: false },
        { order: 1, channel: 'linkedin_dm' as const, action: 'send_dm', delayDays: 2, skipIfReplied: false, skipIfConnected: false },
      ];
      
      const cadence = createCadence('Test', steps);
      
      expect(cadence.steps[0].id).not.toBe(cadence.steps[1].id);
    });
  });

  describe('getNextCadenceStep', () => {
    let cadence: Cadence;

    beforeEach(() => {
      cadence = createCadence('Test', [
        { order: 0, channel: 'linkedin_connection' as const, action: 'send_connection', delayDays: 0, skipIfReplied: true, skipIfConnected: false },
        { order: 1, channel: 'linkedin_dm' as const, action: 'send_dm', delayDays: 2, skipIfReplied: true, skipIfConnected: false },
        { order: 2, channel: 'linkedin_dm' as const, action: 'send_dm', delayDays: 5, skipIfReplied: true, skipIfConnected: false },
      ]);
    });

    it('should return first step initially', () => {
      const next = getNextCadenceStep(cadence, 0, { replied: false, connected: false });
      
      expect(next?.order).toBe(0);
    });

    it('should skip to next step', () => {
      const next = getNextCadenceStep(cadence, 1, { replied: false, connected: false });
      
      expect(next?.order).toBe(1);
    });

    it('should return null when cadence complete', () => {
      const next = getNextCadenceStep(cadence, 3, { replied: false, connected: false });
      
      expect(next).toBeNull();
    });

    it('should skip steps when replied', () => {
      const next = getNextCadenceStep(cadence, 0, { replied: true, connected: false });
      
      // All steps have skipIfReplied, so should be null
      expect(next).toBeNull();
    });
  });

  describe('CADENCE_TEMPLATES', () => {
    it('should have tier1 multitouch template', () => {
      expect(CADENCE_TEMPLATES.tier1_multitouch).toBeDefined();
      expect(CADENCE_TEMPLATES.tier1_multitouch.steps.length).toBeGreaterThan(0);
    });

    it('should have quick connect template', () => {
      expect(CADENCE_TEMPLATES.quick_connect).toBeDefined();
      expect(CADENCE_TEMPLATES.quick_connect.steps.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Analytics Tests
  // ============================================

  describe('calculateChannelPerformance', () => {
    it('should calculate metrics for channel', () => {
      const outreaches: SocialOutreach[] = [
        { ...createOutreach('p1', 'A', 'linkedin_dm', 'Hi'), status: 'sent' },
        { ...createOutreach('p2', 'B', 'linkedin_dm', 'Hi'), status: 'opened', wasOpened: true },
        { ...createOutreach('p3', 'C', 'linkedin_dm', 'Hi'), status: 'replied', wasReplied: true },
        { ...createOutreach('p4', 'D', 'twitter_dm', 'Hi'), status: 'sent' },
      ];
      
      const performance = calculateChannelPerformance(outreaches, 'linkedin_dm');
      
      expect(performance.sent).toBe(3);
      expect(performance.opened).toBe(1);
      expect(performance.replied).toBe(1);
      expect(performance.replyRate).toBeCloseTo(33.33, 1);
    });

    it('should handle empty outreaches', () => {
      const performance = calculateChannelPerformance([], 'linkedin_dm');
      
      expect(performance.sent).toBe(0);
      expect(performance.replyRate).toBe(0);
    });
  });

  describe('calculateOutreachAnalytics', () => {
    it('should calculate overall analytics', () => {
      const now = new Date().toISOString();
      const outreaches: SocialOutreach[] = [
        { ...createOutreach('p1', 'A', 'linkedin_dm', 'Hi'), status: 'sent', createdAt: now },
        { ...createOutreach('p2', 'B', 'linkedin_dm', 'Hi'), status: 'replied', wasReplied: true, createdAt: now },
        { ...createOutreach('p3', 'C', 'twitter_dm', 'Hi'), status: 'sent', createdAt: now },
      ];
      
      const analytics = calculateOutreachAnalytics(outreaches, 'week');
      
      expect(analytics.totalOutreaches).toBe(3);
      expect(analytics.totalReplies).toBe(1);
      expect(analytics.overallReplyRate).toBeCloseTo(33.33, 1);
    });

    it('should group by channel', () => {
      const now = new Date().toISOString();
      const outreaches: SocialOutreach[] = [
        { ...createOutreach('p1', 'A', 'linkedin_dm', 'Hi'), status: 'sent', createdAt: now },
        { ...createOutreach('p2', 'B', 'linkedin_dm', 'Hi'), status: 'sent', createdAt: now },
        { ...createOutreach('p3', 'C', 'twitter_dm', 'Hi'), status: 'sent', createdAt: now },
      ];
      
      const analytics = calculateOutreachAnalytics(outreaches, 'week');
      
      const linkedinStats = analytics.byChannel.find(c => c.channel === 'linkedin_dm');
      const twitterStats = analytics.byChannel.find(c => c.channel === 'twitter_dm');
      
      expect(linkedinStats?.sent).toBe(2);
      expect(twitterStats?.sent).toBe(1);
    });

    it('should include day of week breakdown', () => {
      const analytics = calculateOutreachAnalytics([], 'week');
      
      expect(analytics.byDayOfWeek).toHaveLength(7);
      expect(analytics.byDayOfWeek[0].day).toBe('Sunday');
    });

    it('should include time of day breakdown', () => {
      const analytics = calculateOutreachAnalytics([], 'week');
      
      expect(analytics.byTimeOfDay).toHaveLength(24);
      expect(analytics.byTimeOfDay[0].hour).toBe(0);
    });
  });

  // ============================================
  // Configuration Tests
  // ============================================

  describe('SOCIAL_CHANNEL_CONFIG', () => {
    it('should have all channel configurations', () => {
      const channels = [
        'linkedin_connection',
        'linkedin_dm',
        'linkedin_inmail',
        'twitter_dm',
        'twitter_reply',
        'twitter_quote',
      ] as const;

      for (const channel of channels) {
        const config = SOCIAL_CHANNEL_CONFIG[channel];
        expect(config.name).toBeDefined();
        expect(config.maxChars).toBeGreaterThan(0);
        expect(config.tips.length).toBeGreaterThan(0);
        expect(config.bestPractices).toBeDefined();
      }
    });

    it('should have correct character limits', () => {
      expect(SOCIAL_CHANNEL_CONFIG.linkedin_connection.maxChars).toBe(300);
      expect(SOCIAL_CHANNEL_CONFIG.twitter_reply.maxChars).toBe(280);
      expect(SOCIAL_CHANNEL_CONFIG.twitter_dm.maxChars).toBe(10000);
    });
  });
});
