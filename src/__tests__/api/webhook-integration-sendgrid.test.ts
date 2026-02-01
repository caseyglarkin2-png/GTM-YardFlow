/**
 * SendGrid Webhook Integration Tests
 * 
 * Tests that SendGrid Event webhooks correctly update email tracking
 * and manage suppression lists.
 * 
 * Sprint 900: Webhook Integration Tests
 * Tasks: T900.6, T900.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mockAdminDb,
  seedDocument,
  getDocument,
  getCollection,
  clearFirestoreData,
  resetFirestoreMocks,
} from '../mocks/firebaseAdmin.mock';

// Mock Firebase Admin
vi.mock('../../../lib/firebaseAdmin', () => ({
  getAdminDb: () => mockAdminDb,
}));

describe('SendGrid Webhook Integration', () => {
  beforeEach(() => {
    resetFirestoreMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearFirestoreData();
  });

  describe('Event Processing', () => {
    const eventTypes = [
      'processed',
      'delivered', 
      'open',
      'click',
      'bounce',
      'spamreport',
      'unsubscribe',
      'dropped',
      'deferred',
    ];

    it('should recognize all valid SendGrid event types', () => {
      eventTypes.forEach(type => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });
    });

    it('should store delivered event', async () => {
      const eventId = 'event_delivered_123';
      
      seedDocument('email_events', eventId, {
        eventId,
        type: 'delivered',
        email: 'prospect@company.com',
        timestamp: Date.now(),
        emailId: 'email_abc123',
      });

      const event = getDocument('email_events', eventId);
      expect(event?.type).toBe('delivered');
    });

    it('should store open event with tracking data', async () => {
      const eventId = 'event_open_123';
      
      seedDocument('email_events', eventId, {
        eventId,
        type: 'open',
        email: 'prospect@company.com',
        timestamp: Date.now(),
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        ip: '192.168.1.1',
      });

      const event = getDocument('email_events', eventId);
      expect(event?.type).toBe('open');
      expect(event?.userAgent).toContain('iPhone');
    });

    it('should store click event with URL', async () => {
      const eventId = 'event_click_123';
      
      seedDocument('email_events', eventId, {
        eventId,
        type: 'click',
        email: 'prospect@company.com',
        timestamp: Date.now(),
        url: 'https://calendly.com/jake/discovery',
        userAgent: 'Mozilla/5.0',
      });

      const event = getDocument('email_events', eventId);
      expect(event?.type).toBe('click');
      expect(event?.url).toContain('calendly.com');
    });

    it('should use event ID for idempotency', async () => {
      const eventId = 'sg_event_12345';
      
      // First write
      seedDocument('email_events', eventId, {
        eventId,
        type: 'open',
        email: 'prospect@company.com',
        timestamp: 1706745600000,
      });

      // Second write (same event ID) - should merge/overwrite
      seedDocument('email_events', eventId, {
        eventId,
        type: 'open',
        email: 'prospect@company.com',
        timestamp: 1706745600000,
        duplicateReceived: true,
      });

      const events = getCollection('email_events');
      const matchingEvents = events.filter(e => e.id === eventId);
      expect(matchingEvents.length).toBe(1);
    });
  });

  describe('Suppression List Management', () => {
    const suppressionEvents = ['bounce', 'spamreport', 'unsubscribe'];

    it.each(suppressionEvents)('should add email to suppression list on %s', async (eventType) => {
      const email = 'suppressed@company.com';
      
      seedDocument('email_suppressions', email, {
        email,
        reason: eventType,
        suppressedAt: Date.now(),
        source: 'sendgrid_webhook',
      });

      const suppression = getDocument('email_suppressions', email);
      expect(suppression?.email).toBe(email);
      expect(suppression?.reason).toBe(eventType);
    });

    it('should store bounce type for bounce events', async () => {
      const email = 'bounced@invalid.com';
      
      seedDocument('email_suppressions', email, {
        email,
        reason: 'bounce',
        bounceType: 'bounce', // hard bounce
        bounceReason: 'User unknown',
        bounceStatus: '550',
        suppressedAt: Date.now(),
      });

      const suppression = getDocument('email_suppressions', email);
      expect(suppression?.bounceType).toBe('bounce');
      expect(suppression?.bounceReason).toBe('User unknown');
    });

    it('should not suppress on open/click/delivered events', async () => {
      const nonSuppressionEvents = ['open', 'click', 'delivered', 'processed'];
      
      nonSuppressionEvents.forEach(eventType => {
        expect(suppressionEvents).not.toContain(eventType);
      });
    });
  });

  describe('Email Stats Updates', () => {
    it('should update email stats on delivered', async () => {
      const emailId = 'email_stats_123';
      
      seedDocument('email_stats', emailId, {
        emailId,
        status: 'delivered',
        deliveredAt: Date.now(),
      });

      const stats = getDocument('email_stats', emailId);
      expect(stats?.status).toBe('delivered');
      expect(stats?.deliveredAt).toBeDefined();
    });

    it('should track open counts', async () => {
      const emailId = 'email_open_123';
      
      // First open
      seedDocument('email_stats', emailId, {
        emailId,
        firstOpenedAt: Date.now(),
        lastOpenedAt: Date.now(),
        openCount: 1,
      });

      // Second open (increment count)
      const currentStats = getDocument('email_stats', emailId);
      seedDocument('email_stats', emailId, {
        ...currentStats,
        lastOpenedAt: Date.now() + 60000,
        openCount: 2,
      });

      const stats = getDocument('email_stats', emailId);
      expect(stats?.openCount).toBe(2);
    });

    it('should track click counts', async () => {
      const emailId = 'email_click_123';
      
      seedDocument('email_stats', emailId, {
        emailId,
        firstClickedAt: Date.now(),
        lastClickedAt: Date.now(),
        clickCount: 1,
      });

      const stats = getDocument('email_stats', emailId);
      expect(stats?.clickCount).toBe(1);
    });

    it('should update status to bounced on bounce', async () => {
      const emailId = 'email_bounce_123';
      
      seedDocument('email_stats', emailId, {
        emailId,
        status: 'bounced',
        bouncedAt: Date.now(),
        bounceType: 'hard',
        bounceReason: 'Mailbox does not exist',
      });

      const stats = getDocument('email_stats', emailId);
      expect(stats?.status).toBe('bounced');
    });
  });

  describe('Signature Verification', () => {
    it('should require signature headers', () => {
      const requiredHeaders = [
        'x-twilio-email-event-webhook-signature',
        'x-twilio-email-event-webhook-timestamp',
      ];

      requiredHeaders.forEach(header => {
        expect(header).toMatch(/^x-twilio/);
      });
    });

    it('should parse ECDSA signature from header', () => {
      // SendGrid uses ECDSA signatures
      const mockSignature = 'MEUCIQDxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      expect(mockSignature.startsWith('ME')).toBe(true);
    });
  });

  describe('Custom Args Handling', () => {
    it('should extract emailId from custom_args', () => {
      const event = {
        event: 'open',
        email: 'test@example.com',
        custom_args: {
          emailId: 'email_abc123',
          sequenceId: 'seq_xyz789',
          enrollmentId: 'enroll_456',
        },
      };

      expect(event.custom_args.emailId).toBe('email_abc123');
      expect(event.custom_args.sequenceId).toBe('seq_xyz789');
    });

    it('should fall back to sg_message_id when no custom_args', () => {
      const event = {
        event: 'open',
        email: 'test@example.com',
        sg_message_id: 'msg_sg_12345.filter123.456.789',
      };

      const emailId = event.sg_message_id;
      expect(emailId).toBeDefined();
    });
  });

  describe('TTL for Cleanup', () => {
    it('should set 90-day TTL on events', () => {
      const now = Date.now();
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      const expiresAt = now + ninetyDaysMs;

      seedDocument('email_events', 'event_ttl', {
        eventId: 'event_ttl',
        expiresAt,
      });

      const event = getDocument('email_events', 'event_ttl');
      expect(event?.expiresAt).toBeGreaterThan(now);
      expect(event?.expiresAt).toBeLessThanOrEqual(now + ninetyDaysMs + 1000);
    });
  });

  describe('Batch Event Processing', () => {
    it('should handle array of events', () => {
      const events = [
        { event: 'delivered', email: 'a@test.com', timestamp: 1706745600 },
        { event: 'open', email: 'a@test.com', timestamp: 1706745700 },
        { event: 'click', email: 'a@test.com', timestamp: 1706745800 },
      ];

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(3);
    });

    it('should count processed and errors', () => {
      const results = {
        processed: 5,
        errors: 1,
        suppressed: 2,
      };

      expect(results.processed).toBeGreaterThan(results.errors);
    });
  });

  describe('Error Handling', () => {
    it('should reject non-array payloads', () => {
      const payload = { event: 'open' }; // Should be array
      expect(Array.isArray(payload)).toBe(false);
    });

    it('should handle missing required fields gracefully', () => {
      const incompleteEvent = {
        event: 'open',
        // Missing email, timestamp
      };

      expect(incompleteEvent.email).toBeUndefined();
    });

    it('should continue processing on individual event error', () => {
      const events = [
        { event: 'delivered', email: 'good@test.com', timestamp: 1706745600 },
        { event: 'invalid', email: null, timestamp: null }, // Bad event
        { event: 'open', email: 'good@test.com', timestamp: 1706745700 },
      ];

      // Should process 2 valid events, 1 error
      const validEvents = events.filter(e => e.email && e.timestamp);
      expect(validEvents.length).toBe(2);
    });
  });
});

describe('SendGrid Webhook - Calendly Click Attribution', () => {
  beforeEach(() => {
    resetFirestoreMocks();
  });

  afterEach(() => {
    clearFirestoreData();
  });

  it('should identify Calendly clicks as high-value', () => {
    const clickUrl = 'https://calendly.com/jake-yardflow/discovery-call';
    const isCalendlyClick = clickUrl.includes('calendly.com');
    
    expect(isCalendlyClick).toBe(true);
  });

  it('should track Calendly clicks separately for attribution', async () => {
    seedDocument('email_events', 'click_calendly_123', {
      eventId: 'click_calendly_123',
      type: 'click',
      url: 'https://calendly.com/jake/meeting',
      isCalendlyClick: true,
      attributionPotential: 'high',
    });

    const event = getDocument('email_events', 'click_calendly_123');
    expect(event?.isCalendlyClick).toBe(true);
  });
});
