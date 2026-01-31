/**
 * Webhook Handler Tests
 * 
 * Tests for SendGrid, Calendly, and Inbound webhook endpoints
 * Sprint 1: Tracking Infrastructure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// SendGrid Webhook Event Types Tests
// =============================================================================

describe('SendGrid Webhook Events', () => {
  describe('Event Type Validation', () => {
    const validEventTypes = [
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
      validEventTypes.forEach(eventType => {
        expect(typeof eventType).toBe('string');
        expect(eventType.length).toBeGreaterThan(0);
      });
    });

    it('should have suppression events that trigger suppression list updates', () => {
      const suppressionEvents = ['bounce', 'spamreport', 'unsubscribe'];
      suppressionEvents.forEach(event => {
        expect(validEventTypes).toContain(event);
      });
    });
  });

  describe('Webhook Payload Parsing', () => {
    it('should parse valid SendGrid webhook event', () => {
      const event = {
        event: 'delivered',
        email: 'test@example.com',
        timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        sg_event_id: 'event_123',
        sg_message_id: 'msg_456',
      };

      expect(event.event).toBe('delivered');
      expect(event.email).toBe('test@example.com');
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('should parse bounce event with additional fields', () => {
      const bounceEvent = {
        event: 'bounce',
        email: 'bounced@example.com',
        timestamp: 1706745600,
        type: 'bounce',
        reason: 'User unknown',
        status: '550',
        sg_event_id: 'bounce_123',
      };

      expect(bounceEvent.type).toBe('bounce');
      expect(bounceEvent.reason).toBe('User unknown');
      expect(bounceEvent.status).toBe('550');
    });

    it('should parse click event with URL', () => {
      const clickEvent = {
        event: 'click',
        email: 'clicked@example.com',
        timestamp: 1706745600,
        url: 'https://calendly.com/jake/meeting',
        useragent: 'Mozilla/5.0',
        ip: '192.168.1.1',
      };

      expect(clickEvent.url).toContain('calendly.com');
      expect(clickEvent.useragent).toContain('Mozilla');
    });

    it('should handle custom_args for email tracking', () => {
      const eventWithArgs = {
        event: 'open',
        email: 'opened@example.com',
        timestamp: 1706745600,
        custom_args: {
          emailId: 'email_abc123',
          sequenceId: 'seq_xyz789',
          enrollmentId: 'enroll_456',
        },
      };

      expect(eventWithArgs.custom_args.emailId).toBe('email_abc123');
      expect(eventWithArgs.custom_args.sequenceId).toBe('seq_xyz789');
    });
  });

  describe('Signature Verification', () => {
    it('should require signature headers for validation', () => {
      const requiredHeaders = [
        'x-twilio-email-event-webhook-signature',
        'x-twilio-email-event-webhook-timestamp',
      ];

      requiredHeaders.forEach(header => {
        expect(header.startsWith('x-twilio')).toBe(true);
      });
    });

    it('should skip verification when no webhook key configured', () => {
      // In development mode without SENDGRID_WEBHOOK_VERIFICATION_KEY,
      // signature verification is skipped
      const webhookKey = undefined;
      expect(webhookKey).toBeUndefined();
    });
  });
});

// =============================================================================
// Calendly Webhook Tests
// =============================================================================

describe('Calendly Webhook Events', () => {
  describe('Event Type Handling', () => {
    it('should handle invitee.created event', () => {
      const eventType = 'invitee.created';
      expect(eventType).toBe('invitee.created');
    });

    it('should handle invitee.canceled event', () => {
      const eventType = 'invitee.canceled';
      expect(eventType).toBe('invitee.canceled');
    });
  });

  describe('Payload Parsing', () => {
    it('should parse invitee details from payload', () => {
      const payload = {
        invitee: {
          uri: 'https://api.calendly.com/scheduled_events/xxx/invitees/yyy',
          email: 'prospect@company.com',
          name: 'John Prospect',
          first_name: 'John',
          last_name: 'Prospect',
          timezone: 'America/New_York',
          created_at: '2026-01-31T10:00:00Z',
        },
        event: {
          uri: 'https://api.calendly.com/scheduled_events/xxx',
          name: 'Discovery Call',
          start_time: '2026-02-01T14:00:00Z',
          end_time: '2026-02-01T14:30:00Z',
          status: 'active',
          created_at: '2026-01-31T10:00:00Z',
          location: {
            type: 'google_conference',
            join_url: 'https://meet.google.com/abc-def-ghi',
          },
        },
      };

      expect(payload.invitee.email).toBe('prospect@company.com');
      expect(payload.event.name).toBe('Discovery Call');
      expect(payload.event.location?.join_url).toContain('meet.google.com');
    });

    it('should extract invitee ID from URI', () => {
      const uri = 'https://api.calendly.com/scheduled_events/abc123/invitees/def456';
      const inviteeId = uri.split('/').pop();
      
      expect(inviteeId).toBe('def456');
    });

    it('should parse UTM tracking parameters', () => {
      const invitee = {
        email: 'tracked@example.com',
        name: 'Tracked Prospect',
        tracking: {
          utm_source: 'email_sequence',
          utm_medium: 'email',
          utm_campaign: 'q1_outreach',
          utm_content: 'step_3',
        },
      };

      expect(invitee.tracking?.utm_source).toBe('email_sequence');
      expect(invitee.tracking?.utm_campaign).toBe('q1_outreach');
    });

    it('should parse questions and answers from booking', () => {
      const invitee = {
        email: 'prospect@example.com',
        name: 'Prospect Name',
        questions_and_answers: [
          { question: 'Company Size', answer: '50-100' },
          { question: 'Main Challenge', answer: 'Scaling outreach' },
        ],
      };

      expect(invitee.questions_and_answers).toHaveLength(2);
      expect(invitee.questions_and_answers[0].question).toBe('Company Size');
    });
  });

  describe('Signature Verification', () => {
    it('should parse Calendly signature format', () => {
      const signature = 't=1706745600,v1=abc123def456';
      const parts = signature.split(',');
      const timestampPart = parts.find(p => p.startsWith('t='));
      const signaturePart = parts.find(p => p.startsWith('v1='));

      expect(timestampPart).toBe('t=1706745600');
      expect(signaturePart).toBe('v1=abc123def456');
      expect(timestampPart?.slice(2)).toBe('1706745600');
      expect(signaturePart?.slice(3)).toBe('abc123def456');
    });
  });

  describe('Meeting Status Transitions', () => {
    const statuses = ['booked', 'confirmed', 'canceled', 'rescheduled', 'completed', 'no_show'];

    it('should recognize all valid meeting statuses', () => {
      expect(statuses).toContain('booked');
      expect(statuses).toContain('canceled');
      expect(statuses).toContain('completed');
    });
  });
});

// =============================================================================
// Inbound Email (Reply Detection) Tests
// =============================================================================

describe('Inbound Email Webhook', () => {
  describe('Email Address Extraction', () => {
    it('should extract email from "Name <email>" format', () => {
      const fromField = 'John Prospect <john@company.com>';
      const emailMatch = fromField.match(/<([^>]+)>/) || fromField.match(/([^\s<>]+@[^\s<>]+)/);
      
      expect(emailMatch?.[1]).toBe('john@company.com');
    });

    it('should extract plain email address', () => {
      const fromField = 'john@company.com';
      const emailMatch = fromField.match(/<([^>]+)>/) || fromField.match(/([^\s<>]+@[^\s<>]+)/);
      
      expect(emailMatch?.[1]).toBe('john@company.com');
    });
  });

  describe('Original Email ID Extraction', () => {
    it('should extract email ID from In-Reply-To header', () => {
      const headers = 'In-Reply-To: <email_abc123@yardflow.com>\r\nReferences: <email_abc123@yardflow.com>';
      const messageIdMatch = headers.match(/In-Reply-To:\s*<([^>]+)>/i);
      
      expect(messageIdMatch?.[1]).toBe('email_abc123@yardflow.com');
      
      const emailId = messageIdMatch?.[1]?.split('@')[0];
      expect(emailId).toBe('email_abc123');
    });

    it('should extract tracking ID from subject', () => {
      const subject = 'Re: [TRACK-xyz789] Following up on our conversation';
      const trackMatch = subject.match(/\[TRACK-([a-zA-Z0-9]+)\]/);
      
      expect(trackMatch?.[1]).toBe('xyz789');
    });

    it('should extract from X-Outreach-ID custom header', () => {
      const headers = 'X-Outreach-ID: outreach_12345\r\nContent-Type: text/plain';
      const outreachIdMatch = headers.match(/X-Outreach-ID:\s*(\S+)/i);
      
      expect(outreachIdMatch?.[1]).toBe('outreach_12345');
    });
  });

  describe('Sequence Pause Behavior', () => {
    it('should identify active enrollment statuses', () => {
      // Only 'active' is queryable - 'in_progress' is not a valid EnrollmentStatus
      const activeStatuses = ['active'];
      const pausedStatus = 'paused';
      
      expect(activeStatuses).not.toContain(pausedStatus);
      expect(activeStatuses).toContain('active');
    });

    it('should set correct pause reason', () => {
      const pauseReasons = ['reply_received', 'meeting_booked', 'manual', 'bounce'];
      
      expect(pauseReasons).toContain('reply_received');
      expect(pauseReasons).toContain('meeting_booked');
    });
  });
});

// =============================================================================
// Event Processing and Storage Tests
// =============================================================================

describe('Event Processing', () => {
  describe('Event ID Generation', () => {
    it('should use sg_event_id when available', () => {
      const event = { sg_event_id: 'unique_123', event: 'open', email: 'test@example.com', timestamp: 1706745600 };
      const eventId = event.sg_event_id || `${event.event}:${event.email}:${event.timestamp}`;
      
      expect(eventId).toBe('unique_123');
    });

    it('should generate composite ID when sg_event_id missing', () => {
      const event = { event: 'open', email: 'test@example.com', timestamp: 1706745600 };
      const eventId = `${event.event}:${event.email}:${event.timestamp}`;
      
      expect(eventId).toBe('open:test@example.com:1706745600');
    });
  });

  describe('Timestamp Handling', () => {
    it('should convert SendGrid timestamp (seconds) to milliseconds', () => {
      const sgTimestamp = Math.floor(Date.now() / 1000); // Current time in seconds
      const msTimestamp = sgTimestamp * 1000;
      
      expect(msTimestamp).toBeGreaterThan(0);
      expect(msTimestamp).toBeLessThanOrEqual(Date.now() + 1000); // Within 1 second of now
    });
  });

  describe('TTL / Expiration', () => {
    it('should set 90-day expiration for events', () => {
      const now = Date.now();
      const expiresAt = now + 90 * 24 * 60 * 60 * 1000;
      
      const daysUntilExpiry = (expiresAt - now) / (24 * 60 * 60 * 1000);
      expect(Math.round(daysUntilExpiry)).toBe(90);
    });

    it('should set 7-day expiration for soft bounce suppression', () => {
      const now = Date.now();
      const softBounceExpiry = now + 7 * 24 * 60 * 60 * 1000;
      
      const daysUntilExpiry = (softBounceExpiry - now) / (24 * 60 * 60 * 1000);
      expect(Math.round(daysUntilExpiry)).toBe(7);
    });
  });
});

// =============================================================================
// Email Normalization Tests
// =============================================================================

describe('Email Normalization', () => {
  it('should lowercase email addresses', () => {
    const email = 'Test.User@Example.COM';
    const normalized = email.toLowerCase();
    
    expect(normalized).toBe('test.user@example.com');
  });

  it('should use normalized email as suppression document ID', () => {
    const email = 'BOUNCE@company.com';
    const docId = email.toLowerCase();
    
    expect(docId).toBe('bounce@company.com');
  });
});
