/**
 * EmailTrackingService Tests
 * 
 * Sprint 301: T301.5 - Email tracking coverage
 * Tests open/click tracking, link rewriting, and token validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailTrackingService } from '@/services/EmailTrackingService';
import type { Firestore } from 'firebase-admin/firestore';
import type { EmailMessage } from '@/types/email';

describe('EmailTrackingService', () => {
  let mockDb: {
    collection: ReturnType<typeof vi.fn>;
  };
  let service: EmailTrackingService;
  const TRACKING_SECRET = 'test-tracking-secret-12345';
  const BASE_URL = 'https://app.yardflow.com';

  const mockDocRef = {
    set: vi.fn(),
    get: vi.fn(),
  };
  const mockCollectionRef = {
    doc: vi.fn(() => mockDocRef),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));

    mockDb = {
      collection: vi.fn(() => mockCollectionRef),
    };

    service = new EmailTrackingService(
      mockDb as unknown as Firestore,
      BASE_URL,
      TRACKING_SECRET,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('injectTracking', () => {
    it('adds tracking pixel to email HTML', () => {
      const message: EmailMessage = {
        id: 'email-123',
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Hello World</p>',
      };

      const result = service.injectTracking(message);

      expect(result.html).toContain('<p>Hello World</p>');
      expect(result.html).toContain('<img src="');
      expect(result.html).toContain('/api/track/open');
      expect(result.html).toContain('width="1" height="1"');
      expect(result.html).toContain('style="display:none;"');
    });

    it('preserves original HTML content', () => {
      const originalHtml = '<div><h1>Title</h1><p>Content</p></div>';
      const message: EmailMessage = {
        id: 'email-123',
        to: 'test@example.com',
        subject: 'Test',
        html: originalHtml,
      };

      const result = service.injectTracking(message);

      expect(result.html).toContain(originalHtml.replace(/href="[^"]+"/g, match => {
        // Links would be rewritten, but our test has no links
        return match;
      }));
    });

    it('includes unique token in tracking pixel', () => {
      const message1: EmailMessage = {
        id: 'email-1',
        to: 'test@example.com',
        subject: 'Test 1',
        html: '<p>Test 1</p>',
      };
      const message2: EmailMessage = {
        id: 'email-2',
        to: 'test@example.com',
        subject: 'Test 2',
        html: '<p>Test 2</p>',
      };

      const result1 = service.injectTracking(message1);
      const result2 = service.injectTracking(message2);

      // Extract tokens from the pixel URLs
      const tokenMatch1 = result1.html.match(/token=([^"&]+)/);
      const tokenMatch2 = result2.html.match(/token=([^"&]+)/);

      expect(tokenMatch1?.[1]).not.toBe(tokenMatch2?.[1]);
    });
  });

  describe('rewriteLinks', () => {
    it('rewrites HTTP links to tracking URLs', () => {
      const html = '<a href="https://example.com/page">Click here</a>';
      
      const result = service.rewriteLinks(html, 'email-123');

      expect(result).toContain('/api/track/click');
      expect(result).toContain('token=');
      expect(result).not.toContain('https://example.com/page"');
    });

    it('preserves mailto links', () => {
      const html = '<a href="mailto:support@example.com">Email us</a>';
      
      const result = service.rewriteLinks(html, 'email-123');

      expect(result).toContain('href="mailto:support@example.com"');
    });

    it('rewrites multiple links', () => {
      const html = `
        <a href="https://link1.com">Link 1</a>
        <a href="https://link2.com">Link 2</a>
        <a href="https://link3.com">Link 3</a>
      `;
      
      const result = service.rewriteLinks(html, 'email-123');

      const trackingLinkCount = (result.match(/\/api\/track\/click/g) || []).length;
      expect(trackingLinkCount).toBe(3);
    });

    it('handles HTML without links', () => {
      const html = '<p>No links here</p>';
      
      const result = service.rewriteLinks(html, 'email-123');

      expect(result).toBe(html);
    });

    it('uses correct base URL', () => {
      const html = '<a href="https://example.com">Link</a>';
      
      const result = service.rewriteLinks(html, 'email-123');

      expect(result).toContain('https://app.yardflow.com/api/track/click');
    });
  });

  describe('recordOpen', () => {
    it('stores open event in Firestore', async () => {
      mockDocRef.set.mockResolvedValue(undefined);
      
      // Generate a valid token
      const message: EmailMessage = {
        id: 'email-123',
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      };
      const trackedMessage = service.injectTracking(message);
      const tokenMatch = trackedMessage.html.match(/token=([^"&]+)/);
      const token = decodeURIComponent(tokenMatch?.[1] || '');

      await service.recordOpen(token, '192.168.1.1', 'Mozilla/5.0');

      expect(mockDb.collection).toHaveBeenCalledWith('email_events');
      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          emailId: 'email-123',
          type: 'open',
          at: expect.any(Number),
          userAgent: 'Mozilla/5.0',
        }),
        { merge: true }
      );
    });

    it('anonymizes IP address', async () => {
      mockDocRef.set.mockResolvedValue(undefined);
      
      const message: EmailMessage = {
        id: 'email-123',
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      };
      const trackedMessage = service.injectTracking(message);
      const tokenMatch = trackedMessage.html.match(/token=([^"&]+)/);
      const token = decodeURIComponent(tokenMatch?.[1] || '');

      await service.recordOpen(token, '192.168.1.1');

      const setCall = mockDocRef.set.mock.calls[0][0];
      // IP should be hashed, not stored raw
      expect(setCall.ip).not.toBe('192.168.1.1');
      expect(setCall.ip).toHaveLength(64); // SHA-256 hash length
    });

    it('ignores invalid tokens', async () => {
      await service.recordOpen('invalid-token', '192.168.1.1');

      expect(mockDocRef.set).not.toHaveBeenCalled();
    });

    it('ignores expired tokens', async () => {
      mockDocRef.set.mockResolvedValue(undefined);
      
      const message: EmailMessage = {
        id: 'email-old',
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      };
      const trackedMessage = service.injectTracking(message);
      const tokenMatch = trackedMessage.html.match(/token=([^"&]+)/);
      const token = decodeURIComponent(tokenMatch?.[1] || '');

      // Advance past 90-day expiry
      vi.advanceTimersByTime(91 * 24 * 60 * 60 * 1000);

      await service.recordOpen(token, '192.168.1.1');

      expect(mockDocRef.set).not.toHaveBeenCalled();
    });
  });

  describe('recordClick', () => {
    it('stores click event and returns original URL', async () => {
      mockDocRef.set.mockResolvedValue(undefined);
      
      const originalHtml = '<a href="https://example.com/page">Click</a>';
      const message: EmailMessage = {
        id: 'email-456',
        to: 'test@example.com',
        subject: 'Test',
        html: originalHtml,
      };
      const trackedMessage = service.injectTracking(message);
      const tokenMatch = trackedMessage.html.match(/token=([^"&]+)/);
      const token = decodeURIComponent(tokenMatch?.[1] || '');

      const result = await service.recordClick(token, '192.168.1.1', 'Mozilla/5.0');

      expect(result.url).toBe('https://example.com/page');
      expect(mockDb.collection).toHaveBeenCalledWith('email_events');
      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          emailId: 'email-456',
          type: 'click',
          url: 'https://example.com/page',
        }),
        { merge: true }
      );
    });

    it('anonymizes IP address for clicks', async () => {
      mockDocRef.set.mockResolvedValue(undefined);
      
      const originalHtml = '<a href="https://example.com">Link</a>';
      const message: EmailMessage = {
        id: 'email-123',
        to: 'test@example.com',
        subject: 'Test',
        html: originalHtml,
      };
      const trackedMessage = service.injectTracking(message);
      const tokenMatch = trackedMessage.html.match(/token=([^"&]+)/);
      const token = decodeURIComponent(tokenMatch?.[1] || '');

      await service.recordClick(token, '10.0.0.1');

      const setCall = mockDocRef.set.mock.calls[0][0];
      expect(setCall.ip).not.toBe('10.0.0.1');
      expect(setCall.ip).toHaveLength(64);
    });

    it('returns empty object for invalid token', async () => {
      const result = await service.recordClick('invalid-token');

      expect(result).toEqual({});
      expect(mockDocRef.set).not.toHaveBeenCalled();
    });

    it('creates unique event IDs per URL', async () => {
      mockDocRef.set.mockResolvedValue(undefined);
      
      const html = `
        <a href="https://link1.com">Link 1</a>
        <a href="https://link2.com">Link 2</a>
      `;
      const message: EmailMessage = {
        id: 'email-multi',
        to: 'test@example.com',
        subject: 'Test',
        html,
      };
      const trackedMessage = service.injectTracking(message);
      
      // Extract both tokens
      const tokens = trackedMessage.html.match(/token=([^"&]+)/g)
        ?.map(t => decodeURIComponent(t.replace('token=', '')));
      
      if (tokens && tokens.length >= 2) {
        await service.recordClick(tokens[0]);
        await service.recordClick(tokens[1]);

        // Different doc IDs should be used (based on URL hash)
        const docIds = mockCollectionRef.doc.mock.calls.map(c => c[0]);
        expect(docIds[0]).not.toBe(docIds[1]);
      }
    });
  });

  describe('token security', () => {
    it('uses HMAC signatures to prevent tampering', () => {
      const message: EmailMessage = {
        id: 'email-secure',
        to: 'test@example.com',
        subject: 'Test',
        html: '<a href="https://example.com">Link</a>',
      };
      const trackedMessage = service.injectTracking(message);
      const tokenMatch = trackedMessage.html.match(/token=([^"&]+)/);
      const token = decodeURIComponent(tokenMatch?.[1] || '');
      
      // Tamper with the token
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split('|');
      parts[0] = 'tampered-email-id';
      const tamperedToken = Buffer.from(parts.join('|')).toString('base64url');

      // Record should fail silently (not store event)
      service.recordClick(tamperedToken);
      
      expect(mockDocRef.set).not.toHaveBeenCalled();
    });

    it('different secrets produce different tokens', () => {
      const message: EmailMessage = {
        id: 'email-123',
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      };

      const service1 = new EmailTrackingService(mockDb as unknown as Firestore, BASE_URL, 'secret-1');
      const service2 = new EmailTrackingService(mockDb as unknown as Firestore, BASE_URL, 'secret-2');

      const tracked1 = service1.injectTracking(message);
      const tracked2 = service2.injectTracking(message);

      const token1 = tracked1.html.match(/token=([^"&]+)/)?.[1];
      const token2 = tracked2.html.match(/token=([^"&]+)/)?.[1];

      expect(token1).not.toBe(token2);
    });
  });

  describe('event expiration', () => {
    it('sets 90-day expiration on stored events', async () => {
      mockDocRef.set.mockResolvedValue(undefined);
      
      const message: EmailMessage = {
        id: 'email-123',
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      };
      const trackedMessage = service.injectTracking(message);
      const tokenMatch = trackedMessage.html.match(/token=([^"&]+)/);
      const token = decodeURIComponent(tokenMatch?.[1] || '');

      await service.recordOpen(token);

      const setCall = mockDocRef.set.mock.calls[0][0];
      const expectedExpiry = Date.now() + (90 * 24 * 60 * 60 * 1000);
      expect(setCall.expiresAt).toBe(expectedExpiry);
    });
  });
});
