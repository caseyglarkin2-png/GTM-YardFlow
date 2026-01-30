/**
 * T91.5: Railway Types Unit Tests
 */

import { describe, it, expect } from 'vitest';
import type {
  RailwayProspect,
  RailwaySequence,
  RailwayEnrollment,
  RailwayEmail,
  RailwayHealthResponse,
  ProspectStatus,
  ProspectTier,
  SequenceStatus,
  EnrollmentStatus,
  EmailStatus,
} from '@/types/railway';

describe('Railway Types', () => {
  describe('RailwayProspect', () => {
    it('accepts valid prospect data', () => {
      const prospect: RailwayProspect = {
        id: '123',
        firstName: 'John',
        lastName: 'Doe',
        name: 'John Doe',
        email: 'john@example.com',
        emailVerified: true,
        phone: '+1234567890',
        title: 'CEO',
        companyName: 'Acme Inc',
        companyId: null,
        linkedinUrl: 'https://linkedin.com/in/johndoe',
        status: 'new',
        tier: 'Tier 1',
        score: 85,
        notes: 'High value prospect',
        lastContactedAt: '2026-01-30T10:00:00Z',
        timezone: 'America/New_York',
        tags: ['enterprise', 'high-value'],
        customFields: { industry: 'Tech' },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-30T10:00:00Z',
      };

      expect(prospect.name).toBe('John Doe');
      expect(prospect.tier).toBe('Tier 1');
      expect(prospect.score).toBe(85);
    });

    it('supports all prospect statuses', () => {
      const statuses: ProspectStatus[] = [
        'new',
        'researching',
        'contacted',
        'replied',
        'meeting_scheduled',
        'closed_won',
        'closed_lost',
        'nurturing',
      ];

      expect(statuses).toHaveLength(8);
    });

    it('supports all prospect tiers', () => {
      const tiers: ProspectTier[] = ['Tier 1', 'Tier 2', 'Tier 3'];
      expect(tiers).toHaveLength(3);
    });
  });

  describe('RailwaySequence', () => {
    it('accepts valid sequence data', () => {
      const sequence: RailwaySequence = {
        id: 'seq-123',
        name: 'Outreach Sequence',
        description: 'Initial contact sequence',
        status: 'active',
        steps: [
          {
            id: 'step-1',
            order: 1,
            type: 'email',
            delayDays: 0,
            subject: 'Hello',
            body: 'Hi there!',
          },
          {
            id: 'step-2',
            order: 2,
            type: 'wait',
            delayDays: 3,
          },
          {
            id: 'step-3',
            order: 3,
            type: 'email',
            delayDays: 0,
            subject: 'Following up',
            body: 'Just checking in...',
          },
        ],
        enrollmentCount: 100,
        activeEnrollmentCount: 50,
        completedEnrollmentCount: 40,
        ownerId: 'user-123',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-30T10:00:00Z',
      };

      expect(sequence.steps).toHaveLength(3);
      expect(sequence.enrollmentCount).toBe(100);
    });

    it('supports all sequence statuses', () => {
      const statuses: SequenceStatus[] = ['draft', 'active', 'paused', 'completed'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('RailwayEnrollment', () => {
    it('accepts valid enrollment data', () => {
      const enrollment: RailwayEnrollment = {
        id: 'enroll-123',
        sequenceId: 'seq-123',
        prospectId: 'prospect-123',
        status: 'active',
        currentStepIndex: 2,
        nextStepAt: '2026-02-01T10:00:00Z',
        completedAt: null,
        pausedAt: null,
        pauseReason: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-30T10:00:00Z',
      };

      expect(enrollment.currentStepIndex).toBe(2);
      expect(enrollment.status).toBe('active');
    });

    it('supports all enrollment statuses', () => {
      const statuses: EnrollmentStatus[] = [
        'active',
        'paused',
        'completed',
        'cancelled',
        'failed',
        'replied',
      ];
      expect(statuses).toHaveLength(6);
    });
  });

  describe('RailwayEmail', () => {
    it('accepts valid email data', () => {
      const email: RailwayEmail = {
        id: 'email-123',
        prospectId: 'prospect-123',
        enrollmentId: 'enroll-123',
        sequenceId: 'seq-123',
        stepIndex: 1,
        to: 'john@example.com',
        from: 'sales@company.com',
        subject: 'Hello',
        body: 'Hi there!',
        htmlBody: '<p>Hi there!</p>',
        status: 'delivered',
        sentAt: '2026-01-30T10:00:00Z',
        deliveredAt: '2026-01-30T10:01:00Z',
        openedAt: '2026-01-30T11:00:00Z',
        clickedAt: null,
        bouncedAt: null,
        bounceReason: null,
        sendgridMessageId: 'sg-12345',
        createdAt: '2026-01-30T09:00:00Z',
        updatedAt: '2026-01-30T11:00:00Z',
      };

      expect(email.status).toBe('delivered');
      expect(email.openedAt).not.toBeNull();
    });

    it('supports all email statuses', () => {
      const statuses: EmailStatus[] = [
        'queued',
        'sending',
        'sent',
        'delivered',
        'opened',
        'clicked',
        'bounced',
        'failed',
        'complained',
      ];
      expect(statuses).toHaveLength(9);
    });
  });

  describe('RailwayHealthResponse', () => {
    it('accepts valid health response', () => {
      const health: RailwayHealthResponse = {
        status: 'healthy',
        timestamp: '2026-01-30T10:00:00Z',
        checks: {
          database: { status: 'ok', latencyMs: 2 },
          redis: { status: 'ok', latencyMs: 1 },
          queues: {
            enrichment: 'ready',
            outreach: 'ready',
            emails: 'ready',
            sequence: 'ready',
          },
        },
        version: '1.0.0',
        uptime: 86400,
      };

      expect(health.status).toBe('healthy');
      expect(health.checks.database.status).toBe('ok');
    });

    it('handles degraded status', () => {
      const health: RailwayHealthResponse = {
        status: 'degraded',
        timestamp: '2026-01-30T10:00:00Z',
        checks: {
          database: { status: 'ok', latencyMs: 2 },
          redis: { status: 'error', latencyMs: 0, message: 'Connection refused' },
          queues: {
            enrichment: 'error',
            outreach: 'ready',
            emails: 'ready',
            sequence: 'ready',
          },
        },
      };

      expect(health.status).toBe('degraded');
      expect(health.checks.redis.status).toBe('error');
    });
  });
});
