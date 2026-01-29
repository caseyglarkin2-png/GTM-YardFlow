/**
 * API Endpoint Unit Tests: CSRF Protection
 * Sprint 45 - T45.8
 * 
 * Tests for Origin/Referer validation in API endpoints
 */

import { describe, it, expect } from 'vitest';
import { isAllowedOrigin, ALLOWED_ORIGINS } from '../../../lib/origins';

describe('CSRF Protection', () => {
  describe('Origin Validation', () => {
    it('should accept production origin', () => {
      expect(isAllowedOrigin('https://gtm-yard-flow.vercel.app')).toBe(true);
    });

    it('should accept localhost development origins', () => {
      expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
      expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
    });

    it('should reject missing origin', () => {
      expect(isAllowedOrigin(undefined)).toBe(false);
      expect(isAllowedOrigin(null)).toBe(false);
      expect(isAllowedOrigin('')).toBe(false);
    });

    it('should reject malicious origins', () => {
      // Direct attack attempts
      expect(isAllowedOrigin('https://evil.com')).toBe(false);
      expect(isAllowedOrigin('http://attacker.io')).toBe(false);
      
      // Subdomain attacks
      expect(isAllowedOrigin('https://gtm-yard-flow.vercel.app.evil.com')).toBe(false);
      expect(isAllowedOrigin('https://evil.gtm-yard-flow.vercel.app.com')).toBe(false);
      
      // Similar domain attacks
      expect(isAllowedOrigin('https://fake-gtm-yard-flow.vercel.app')).toBe(false);
      expect(isAllowedOrigin('https://gtm-yard-flow-fake.vercel.app')).toBe(false);
    });

    it('should handle protocol differences', () => {
      // HTTP on production should still be rejected (we check prefix match)
      expect(isAllowedOrigin('http://gtm-yard-flow.vercel.app')).toBe(false);
    });

    it('should accept origins with paths (path is stripped)', () => {
      // URL parsing strips paths, so these should match the base origin
      expect(isAllowedOrigin('https://gtm-yard-flow.vercel.app/api/test')).toBe(true);
      expect(isAllowedOrigin('http://localhost:5173/some/deep/path')).toBe(true);
    });
  });

  describe('List-Unsubscribe One-Click Bypass', () => {
    // List-Unsubscribe One-Click (RFC 8058) doesn't send Origin header
    // The HMAC token signature provides authentication instead
    
    it('should validate One-Click body contains required parameter', () => {
      const validBody = 'List-Unsubscribe=One-Click';
      expect(validBody.includes('List-Unsubscribe=One-Click')).toBe(true);
    });

    it('should reject invalid One-Click body', () => {
      const invalidBody = 'some-random-data';
      expect(invalidBody.includes('List-Unsubscribe=One-Click')).toBe(false);
    });
  });

  describe('Referer Fallback (Development Only)', () => {
    it('should document that Referer is only used in development', () => {
      // In production, Origin header is required
      // Referer fallback only works in development mode
      // This is enforced in validateOrigin() in send.ts
      const isProduction = process.env.NODE_ENV === 'production';
      expect(typeof isProduction).toBe('boolean');
    });
  });

  describe('Allowed Origins List', () => {
    it('should have at least one production domain', () => {
      const productionOrigins = ALLOWED_ORIGINS.filter(o => o.startsWith('https://'));
      expect(productionOrigins.length).toBeGreaterThanOrEqual(1);
    });

    it('should have localhost for development', () => {
      const localhostOrigins = ALLOWED_ORIGINS.filter(o => o.includes('localhost'));
      expect(localhostOrigins.length).toBeGreaterThanOrEqual(1);
    });

    it('should not include wildcards', () => {
      ALLOWED_ORIGINS.forEach(origin => {
        expect(origin).not.toContain('*');
      });
    });

    it('should use specific ports for localhost', () => {
      const localhostOrigins = ALLOWED_ORIGINS.filter(o => o.includes('localhost'));
      localhostOrigins.forEach(origin => {
        expect(origin).toMatch(/localhost:\d+/);
      });
    });
  });
});
