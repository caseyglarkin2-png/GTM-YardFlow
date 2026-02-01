/**
 * EmailComplianceService Tests
 * 
 * Sprint 301: T301.4 - Email compliance coverage
 * Tests email validation, unsubscribe tokens, suppression list, and bounce classification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailComplianceService } from '@/services/EmailComplianceService';
import type { Firestore } from 'firebase-admin/firestore';
import type { SendGridClient } from '@/services/SendGridClient';
import type { EmailMessage, SendGridWebhookEvent } from '@/types/email';

describe('EmailComplianceService', () => {
  let mockDb: {
    collection: ReturnType<typeof vi.fn>;
  };
  let mockSendGrid: {
    addToSuppression: ReturnType<typeof vi.fn>;
  };
  let service: EmailComplianceService;

  const mockDocRef = {
    get: vi.fn(),
    set: vi.fn(),
  };
  const mockCollectionRef = {
    doc: vi.fn(() => mockDocRef),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('UNSUBSCRIBE_HMAC_SECRET', 'test-secret-12345');
    vi.stubEnv('PUBLIC_BASE_URL', 'https://app.yardflow.com');
    vi.stubEnv('SUPPORT_EMAIL', 'support@yardflow.com');
    vi.stubEnv('COMPLIANCE_POSTAL_ADDRESS', '123 Main St, San Francisco, CA');

    mockDb = {
      collection: vi.fn(() => mockCollectionRef),
    };

    mockSendGrid = {
      addToSuppression: vi.fn(),
    };

    service = new EmailComplianceService(
      mockDb as unknown as Firestore,
      mockSendGrid as unknown as SendGridClient,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('validateEmail', () => {
    it('returns valid for properly formatted email', async () => {
      mockDocRef.get.mockResolvedValue({ exists: false });

      const result = await service.validateEmail('test@example.com');

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects invalid email format', async () => {
      const result = await service.validateEmail('not-an-email');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_format');
    });

    it('rejects email missing @ symbol', async () => {
      const result = await service.validateEmail('testexample.com');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_format');
    });

    it('rejects email missing domain', async () => {
      const result = await service.validateEmail('test@');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_format');
    });

    it('rejects suppressed email', async () => {
      mockDocRef.get.mockResolvedValue({ exists: true });

      const result = await service.validateEmail('suppressed@example.com');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('suppressed');
    });
  });

  describe('injectComplianceElements', () => {
    it('adds List-Unsubscribe header', () => {
      const message: EmailMessage = {
        id: 'email-123',
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      };

      const result = service.injectComplianceElements(message);

      expect(result.headers?.['List-Unsubscribe']).toContain('mailto:support@yardflow.com');
      expect(result.headers?.['List-Unsubscribe']).toContain('https://app.yardflow.com/api/email/unsubscribe');
    });

    it('adds List-Unsubscribe-Post header for one-click', () => {
      const message: EmailMessage = {
        id: 'email-123',
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      };

      const result = service.injectComplianceElements(message);

      expect(result.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });

    it('appends unsubscribe footer to HTML', () => {
      const message: EmailMessage = {
        id: 'email-123',
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hello World</p>',
      };

      const result = service.injectComplianceElements(message);

      expect(result.html).toContain('<p>Hello World</p>');
      expect(result.html).toContain('Unsubscribe');
      expect(result.html).toContain('123 Main St, San Francisco, CA');
    });

    it('preserves existing headers', () => {
      const message: EmailMessage = {
        id: 'email-123',
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      };

      const result = service.injectComplianceElements(message);

      expect(result.headers?.['X-Custom-Header']).toBe('custom-value');
      expect(result.headers?.['List-Unsubscribe']).toBeDefined();
    });
  });

  describe('generateUnsubscribeToken / validateUnsubscribeToken', () => {
    it('generates valid token that can be validated', () => {
      const emailId = 'email-abc-123';

      const token = service.generateUnsubscribeToken(emailId);
      const result = service.validateUnsubscribeToken(token);

      expect(result.valid).toBe(true);
      expect(result.emailId).toBe(emailId);
    });

    it('rejects token with wrong signature', () => {
      const emailId = 'email-test';
      const token = service.generateUnsubscribeToken(emailId);
      
      // Tamper with the token
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      parts[0] = 'tampered-email-id'; // Change the email ID
      const tamperedToken = Buffer.from(parts.join(':')).toString('base64url');

      const result = service.validateUnsubscribeToken(tamperedToken);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('signature_mismatch');
    });

    it('rejects expired token', () => {
      vi.useFakeTimers();
      const emailId = 'email-expire-test';

      const token = service.generateUnsubscribeToken(emailId);
      
      // Advance time past expiration (30 days + 1 minute)
      vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);

      const result = service.validateUnsubscribeToken(token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('expired');

      vi.useRealTimers();
    });

    it('rejects malformed token', () => {
      const result = service.validateUnsubscribeToken('not-a-valid-token');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_token');
    });

    it('rejects empty token', () => {
      const result = service.validateUnsubscribeToken('');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_token');
    });

    it('throws when UNSUBSCRIBE_HMAC_SECRET is missing', () => {
      vi.stubEnv('UNSUBSCRIBE_HMAC_SECRET', '');

      expect(() => service.generateUnsubscribeToken('email-123'))
        .toThrow('UNSUBSCRIBE_HMAC_SECRET environment variable is required');
    });
  });

  describe('isOnSuppressionList', () => {
    it('returns true when email is suppressed', async () => {
      mockDocRef.get.mockResolvedValue({ exists: true });

      const result = await service.isOnSuppressionList('suppressed@example.com');

      expect(result).toBe(true);
      expect(mockDb.collection).toHaveBeenCalledWith('email_suppressions');
      expect(mockCollectionRef.doc).toHaveBeenCalledWith('suppressed@example.com');
    });

    it('returns false when email is not suppressed', async () => {
      mockDocRef.get.mockResolvedValue({ exists: false });

      const result = await service.isOnSuppressionList('active@example.com');

      expect(result).toBe(false);
    });

    it('normalizes email to lowercase', async () => {
      mockDocRef.get.mockResolvedValue({ exists: false });

      await service.isOnSuppressionList('TEST@EXAMPLE.COM');

      expect(mockCollectionRef.doc).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('addToSuppressionList', () => {
    it('adds entry to Firestore', async () => {
      mockDocRef.set.mockResolvedValue(undefined);
      mockSendGrid.addToSuppression.mockResolvedValue(undefined);

      await service.addToSuppressionList({
        email: 'bounce@example.com',
        reason: 'hard_bounce',
        createdAt: Date.now(),
        source: 'webhook',
      });

      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'bounce@example.com',
          reason: 'hard_bounce',
          source: 'webhook',
          updatedAt: expect.any(Number),
        }),
        { merge: true }
      );
    });

    it('syncs to SendGrid when client available', async () => {
      mockDocRef.set.mockResolvedValue(undefined);
      mockSendGrid.addToSuppression.mockResolvedValue(undefined);

      await service.addToSuppressionList({
        email: 'test@example.com',
        reason: 'unsubscribe',
        createdAt: Date.now(),
        source: 'manual',
      });

      expect(mockSendGrid.addToSuppression).toHaveBeenCalledWith('test@example.com', 'unsubscribe');
    });

    it('handles SendGrid sync failure gracefully', async () => {
      mockDocRef.set.mockResolvedValue(undefined);
      mockSendGrid.addToSuppression.mockRejectedValue(new Error('SendGrid error'));

      // Should not throw
      await expect(service.addToSuppressionList({
        email: 'test@example.com',
        reason: 'bounce',
        createdAt: Date.now(),
        source: 'webhook',
      })).resolves.toBeUndefined();
    });

    it('normalizes email to lowercase', async () => {
      mockDocRef.set.mockResolvedValue(undefined);
      mockSendGrid.addToSuppression.mockResolvedValue(undefined);

      await service.addToSuppressionList({
        email: 'UPPER@EXAMPLE.COM',
        reason: 'manual',
        createdAt: Date.now(),
        source: 'manual',
      });

      expect(mockCollectionRef.doc).toHaveBeenCalledWith('upper@example.com');
    });
  });

  describe('respectDoNotTrack', () => {
    it('returns true when doNotTrack is set', () => {
      const message: EmailMessage = {
        id: 'email-1',
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        metadata: { doNotTrack: true },
      };

      expect(service.respectDoNotTrack(message)).toBe(true);
    });

    it('returns false when doNotTrack is false', () => {
      const message: EmailMessage = {
        id: 'email-1',
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        metadata: { doNotTrack: false },
      };

      expect(service.respectDoNotTrack(message)).toBe(false);
    });

    it('returns false when metadata is missing', () => {
      const message: EmailMessage = {
        id: 'email-1',
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      };

      expect(service.respectDoNotTrack(message)).toBe(false);
    });
  });

  describe('classifyBounce', () => {
    it('classifies "invalid" bounces as hard', () => {
      const event: SendGridWebhookEvent = {
        event: 'bounce',
        email: 'test@example.com',
        reason: 'Invalid email address',
        timestamp: Date.now(),
      };

      expect(service.classifyBounce(event)).toBe('hard');
    });

    it('classifies "user unknown" as hard bounce', () => {
      const event: SendGridWebhookEvent = {
        event: 'bounce',
        email: 'test@example.com',
        reason: 'User unknown',
        timestamp: Date.now(),
      };

      expect(service.classifyBounce(event)).toBe('hard');
    });

    it('classifies "mailbox" errors as hard bounce', () => {
      const event: SendGridWebhookEvent = {
        event: 'bounce',
        email: 'test@example.com',
        reason: 'Mailbox not found',
        timestamp: Date.now(),
      };

      expect(service.classifyBounce(event)).toBe('hard');
    });

    it('classifies "no such" as hard bounce', () => {
      const event: SendGridWebhookEvent = {
        event: 'bounce',
        email: 'test@example.com',
        reason: 'No such user',
        timestamp: Date.now(),
      };

      expect(service.classifyBounce(event)).toBe('hard');
    });

    it('classifies "full" as soft bounce', () => {
      const event: SendGridWebhookEvent = {
        event: 'bounce',
        email: 'test@example.com',
        reason: 'Storage full - retry later',
        timestamp: Date.now(),
      };

      expect(service.classifyBounce(event)).toBe('soft');
    });

    it('classifies "quota" exceeded as soft bounce', () => {
      const event: SendGridWebhookEvent = {
        event: 'bounce',
        email: 'test@example.com',
        reason: 'Quota exceeded',
        timestamp: Date.now(),
      };

      expect(service.classifyBounce(event)).toBe('soft');
    });

    it('classifies "rate limit" as soft bounce', () => {
      const event: SendGridWebhookEvent = {
        event: 'bounce',
        email: 'test@example.com',
        reason: 'Rate limit exceeded',
        timestamp: Date.now(),
      };

      expect(service.classifyBounce(event)).toBe('soft');
    });

    it('classifies 5xx status bounces as hard', () => {
      const event: SendGridWebhookEvent = {
        event: 'bounce',
        email: 'test@example.com',
        reason: 'Unknown error',
        status: '550',
        timestamp: Date.now(),
      };

      expect(service.classifyBounce(event)).toBe('hard');
    });

    it('classifies unknown bounce as soft (conservative)', () => {
      const event: SendGridWebhookEvent = {
        event: 'bounce',
        email: 'test@example.com',
        reason: 'Some other reason',
        status: '400',
        timestamp: Date.now(),
      };

      expect(service.classifyBounce(event)).toBe('soft');
    });
  });
});
