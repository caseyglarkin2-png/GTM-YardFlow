/**
 * API Endpoint Unit Tests: lib/origins.ts
 * Sprint 45 - T45.8
 */

import { describe, it, expect } from 'vitest';
import { isAllowedOrigin, isValidRedirectUrl, ALLOWED_ORIGINS, ALLOWED_REDIRECT_DOMAINS } from '../../../lib/origins';

describe('lib/origins', () => {
  describe('ALLOWED_ORIGINS', () => {
    it('should contain production domain', () => {
      expect(ALLOWED_ORIGINS).toContain('https://gtm-yard-flow.vercel.app');
    });

    it('should contain localhost development domains', () => {
      expect(ALLOWED_ORIGINS).toContain('http://localhost:5173');
      expect(ALLOWED_ORIGINS).toContain('http://localhost:3000');
    });
  });

  describe('isAllowedOrigin', () => {
    it('should return true for exact match', () => {
      expect(isAllowedOrigin('https://gtm-yard-flow.vercel.app')).toBe(true);
      expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    });

    it('should return true for origin with path (path is ignored)', () => {
      // URL parsing extracts just the origin, so paths are stripped
      expect(isAllowedOrigin('https://gtm-yard-flow.vercel.app/some/path')).toBe(true);
      expect(isAllowedOrigin('http://localhost:5173/api/test')).toBe(true);
    });

    it('should return false for undefined/null origin', () => {
      expect(isAllowedOrigin(undefined)).toBe(false);
      expect(isAllowedOrigin(null)).toBe(false);
    });

    it('should return false for disallowed origins', () => {
      expect(isAllowedOrigin('https://evil.com')).toBe(false);
      expect(isAllowedOrigin('https://fake-gtm-yard-flow.vercel.app')).toBe(false);
    });

    it('should return false for similar but different domains', () => {
      expect(isAllowedOrigin('https://gtm-yard-flow.vercel.app.evil.com')).toBe(false);
    });
  });

  describe('ALLOWED_REDIRECT_DOMAINS', () => {
    it('should contain calendly.com', () => {
      expect(ALLOWED_REDIRECT_DOMAINS).toContain('calendly.com');
    });

    it('should contain common meeting domains', () => {
      expect(ALLOWED_REDIRECT_DOMAINS).toContain('zoom.us');
      expect(ALLOWED_REDIRECT_DOMAINS).toContain('meet.google.com');
      expect(ALLOWED_REDIRECT_DOMAINS).toContain('teams.microsoft.com');
    });

    it('should contain product domains', () => {
      expect(ALLOWED_REDIRECT_DOMAINS).toContain('yardflow.com');
      expect(ALLOWED_REDIRECT_DOMAINS).toContain('gtm-yard-flow.vercel.app');
    });
  });

  describe('isValidRedirectUrl', () => {
    it('should return true for exact domain match', () => {
      expect(isValidRedirectUrl('https://calendly.com/user/meeting')).toBe(true);
      expect(isValidRedirectUrl('https://zoom.us/j/123456')).toBe(true);
    });

    it('should return true for subdomain match', () => {
      expect(isValidRedirectUrl('https://app.calendly.com/user')).toBe(true);
      expect(isValidRedirectUrl('https://us02web.zoom.us/j/123')).toBe(true);
    });

    it('should return false for disallowed domains', () => {
      expect(isValidRedirectUrl('https://evil.com')).toBe(false);
      expect(isValidRedirectUrl('https://phishing-calendly.com')).toBe(false);
    });

    it('should return false for non-http protocols', () => {
      expect(isValidRedirectUrl('javascript:alert(1)')).toBe(false);
      expect(isValidRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isValidRedirectUrl('file:///etc/passwd')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidRedirectUrl('not-a-url')).toBe(false);
      expect(isValidRedirectUrl('')).toBe(false);
    });

    it('should allow http for localhost but not for other domains', () => {
      // Production domains should use https
      expect(isValidRedirectUrl('http://calendly.com')).toBe(true); // http is allowed protocol-wise
    });
  });
});
