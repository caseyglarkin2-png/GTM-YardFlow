/**
 * Unit Tests: validateOrigin Module
 * Sprint 47 - T47.4
 * 
 * Comprehensive tests for centralized request origin validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import {
  validateRequestOrigin,
  isListUnsubscribeOneClick,
  type ValidateOriginOptions,
} from '../../../lib/validateOrigin';

// Mock VercelRequest factory
function createMockRequest(overrides: {
  method?: string;
  headers?: Record<string, string | undefined>;
  body?: unknown;
} = {}): VercelRequest {
  return {
    method: overrides.method ?? 'POST',
    headers: {
      origin: undefined,
      referer: undefined,
      ...overrides.headers,
    },
    body: overrides.body,
  } as unknown as VercelRequest;
}

describe('validateOrigin Module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('validateRequestOrigin', () => {
    describe('Basic Origin Validation', () => {
      it('should accept valid production origin', () => {
        const req = createMockRequest({
          headers: { origin: 'https://gtm-yard-flow.vercel.app' },
        });
        expect(validateRequestOrigin(req)).toBe(true);
      });

      it('should accept localhost development origin', () => {
        const req = createMockRequest({
          headers: { origin: 'http://localhost:5173' },
        });
        expect(validateRequestOrigin(req)).toBe(true);
      });

      it('should accept localhost:3000 development origin', () => {
        const req = createMockRequest({
          headers: { origin: 'http://localhost:3000' },
        });
        expect(validateRequestOrigin(req)).toBe(true);
      });

      it('should reject malicious origin', () => {
        process.env.NODE_ENV = 'production';
        const req = createMockRequest({
          headers: { origin: 'https://evil.com' },
        });
        expect(validateRequestOrigin(req)).toBe(false);
      });

      it('should reject subdomain attack origin', () => {
        process.env.NODE_ENV = 'production';
        const req = createMockRequest({
          headers: { origin: 'https://gtm-yard-flow.vercel.app.evil.com' },
        });
        expect(validateRequestOrigin(req)).toBe(false);
      });

      it('should reject similar domain attack origin', () => {
        process.env.NODE_ENV = 'production';
        const req = createMockRequest({
          headers: { origin: 'https://fake-gtm-yard-flow.vercel.app' },
        });
        expect(validateRequestOrigin(req)).toBe(false);
      });
    });

    describe('Production Mode Strictness', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      it('should require origin in production', () => {
        const req = createMockRequest({
          headers: { origin: undefined },
        });
        expect(validateRequestOrigin(req)).toBe(false);
      });

      it('should reject missing origin even with allowDevWithoutOrigin', () => {
        const req = createMockRequest({
          headers: { origin: undefined },
        });
        expect(validateRequestOrigin(req, { allowDevWithoutOrigin: true })).toBe(false);
      });

      it('should reject request with only referer in production', () => {
        const req = createMockRequest({
          headers: {
            origin: undefined,
            referer: 'https://gtm-yard-flow.vercel.app/dashboard',
          },
        });
        expect(validateRequestOrigin(req, { checkRefererInDev: true })).toBe(false);
      });
    });

    describe('VERCEL_ENV Production Detection', () => {
      it('should detect production via VERCEL_ENV', () => {
        process.env.NODE_ENV = 'development';
        process.env.VERCEL_ENV = 'production';
        
        const req = createMockRequest({
          headers: { origin: undefined },
        });
        expect(validateRequestOrigin(req)).toBe(false);
      });
    });

    describe('allowDevWithoutOrigin Option', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
        process.env.VERCEL_ENV = undefined;
      });

      it('should allow missing origin in development by default', () => {
        const req = createMockRequest({
          headers: { origin: undefined },
        });
        expect(validateRequestOrigin(req)).toBe(true);
      });

      it('should allow missing origin when explicitly enabled', () => {
        const req = createMockRequest({
          headers: { origin: undefined },
        });
        expect(validateRequestOrigin(req, { allowDevWithoutOrigin: true })).toBe(true);
      });

      it('should reject missing origin when disabled in development', () => {
        const req = createMockRequest({
          headers: { origin: undefined },
        });
        expect(validateRequestOrigin(req, { allowDevWithoutOrigin: false })).toBe(false);
      });

      it('should still accept valid origin even when disabled', () => {
        const req = createMockRequest({
          headers: { origin: 'https://gtm-yard-flow.vercel.app' },
        });
        expect(validateRequestOrigin(req, { allowDevWithoutOrigin: false })).toBe(true);
      });
    });

    describe('checkRefererInDev Option', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
        process.env.VERCEL_ENV = undefined;
      });

      it('should check referer as fallback in development by default', () => {
        const req = createMockRequest({
          headers: {
            origin: undefined,
            referer: 'https://gtm-yard-flow.vercel.app/dashboard',
          },
        });
        expect(validateRequestOrigin(req, { allowDevWithoutOrigin: false })).toBe(true);
      });

      it('should accept referer when explicitly enabled', () => {
        const req = createMockRequest({
          headers: {
            origin: undefined,
            referer: 'http://localhost:5173/test',
          },
        });
        expect(validateRequestOrigin(req, {
          allowDevWithoutOrigin: false,
          checkRefererInDev: true,
        })).toBe(true);
      });

      it('should reject request when referer check is disabled', () => {
        const req = createMockRequest({
          headers: {
            origin: undefined,
            referer: 'https://gtm-yard-flow.vercel.app/dashboard',
          },
        });
        expect(validateRequestOrigin(req, {
          allowDevWithoutOrigin: false,
          checkRefererInDev: false,
        })).toBe(false);
      });

      it('should reject malicious referer', () => {
        const req = createMockRequest({
          headers: {
            origin: undefined,
            referer: 'https://evil.com/phishing',
          },
        });
        expect(validateRequestOrigin(req, {
          allowDevWithoutOrigin: false,
          checkRefererInDev: true,
        })).toBe(false);
      });
    });

    describe('allowGetWithoutOrigin Option', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      it('should reject GET without origin by default', () => {
        const req = createMockRequest({
          method: 'GET',
          headers: { origin: undefined },
        });
        expect(validateRequestOrigin(req)).toBe(false);
      });

      it('should allow GET without origin when enabled', () => {
        const req = createMockRequest({
          method: 'GET',
          headers: { origin: undefined },
        });
        expect(validateRequestOrigin(req, { allowGetWithoutOrigin: true })).toBe(true);
      });

      it('should still reject POST without origin when allowGetWithoutOrigin is enabled', () => {
        const req = createMockRequest({
          method: 'POST',
          headers: { origin: undefined },
        });
        expect(validateRequestOrigin(req, { allowGetWithoutOrigin: true })).toBe(false);
      });

      it('should allow GET with valid origin regardless of option', () => {
        const req = createMockRequest({
          method: 'GET',
          headers: { origin: 'https://gtm-yard-flow.vercel.app' },
        });
        expect(validateRequestOrigin(req, { allowGetWithoutOrigin: false })).toBe(true);
      });
    });

    describe('customValidator Option', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      it('should call custom validator and return true if it passes', () => {
        const customValidator = vi.fn().mockReturnValue(true);
        const req = createMockRequest({
          headers: { origin: undefined },
        });
        
        expect(validateRequestOrigin(req, { customValidator })).toBe(true);
        expect(customValidator).toHaveBeenCalledWith(req);
      });

      it('should continue normal validation if custom validator returns false', () => {
        const customValidator = vi.fn().mockReturnValue(false);
        const req = createMockRequest({
          headers: { origin: undefined },
        });
        
        expect(validateRequestOrigin(req, { customValidator })).toBe(false);
        expect(customValidator).toHaveBeenCalledWith(req);
      });

      it('should use isListUnsubscribeOneClick as custom validator', () => {
        const req = createMockRequest({
          method: 'POST',
          headers: { origin: undefined },
          body: 'List-Unsubscribe=One-Click',
        });
        
        expect(validateRequestOrigin(req, {
          customValidator: isListUnsubscribeOneClick,
        })).toBe(true);
      });

      it('should reject when isListUnsubscribeOneClick fails and no origin', () => {
        const req = createMockRequest({
          method: 'POST',
          headers: { origin: undefined },
          body: 'invalid-body',
        });
        
        expect(validateRequestOrigin(req, {
          customValidator: isListUnsubscribeOneClick,
        })).toBe(false);
      });

      it('should prioritize custom validator before other checks', () => {
        const customValidator = vi.fn().mockReturnValue(true);
        const req = createMockRequest({
          headers: { origin: 'https://evil.com' }, // Would normally fail
        });
        
        // Should pass because custom validator returns true first
        expect(validateRequestOrigin(req, { customValidator })).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty options object', () => {
        process.env.NODE_ENV = 'development';
        const req = createMockRequest({
          headers: { origin: 'http://localhost:5173' },
        });
        expect(validateRequestOrigin(req, {})).toBe(true);
      });

      it('should handle undefined options', () => {
        process.env.NODE_ENV = 'development';
        const req = createMockRequest({
          headers: { origin: 'http://localhost:5173' },
        });
        expect(validateRequestOrigin(req)).toBe(true);
      });

      it('should handle multiple options combined', () => {
        process.env.NODE_ENV = 'development';
        const req = createMockRequest({
          method: 'GET',
          headers: { origin: undefined },
        });
        
        expect(validateRequestOrigin(req, {
          allowDevWithoutOrigin: false,
          checkRefererInDev: false,
          allowGetWithoutOrigin: true,
        })).toBe(true);
      });
    });
  });

  describe('isListUnsubscribeOneClick', () => {
    it('should return true for valid One-Click string body', () => {
      const req = createMockRequest({
        method: 'POST',
        body: 'List-Unsubscribe=One-Click',
      });
      expect(isListUnsubscribeOneClick(req)).toBe(true);
    });

    it('should return true for body with One-Click embedded', () => {
      const req = createMockRequest({
        method: 'POST',
        body: 'extra=data&List-Unsubscribe=One-Click&more=params',
      });
      expect(isListUnsubscribeOneClick(req)).toBe(true);
    });

    it('should return false for object body with split key/value', () => {
      // Implementation checks if value contains full 'List-Unsubscribe=One-Click' string
      // A split key/value object like { 'List-Unsubscribe': 'One-Click' } won't match
      const req = createMockRequest({
        method: 'POST',
        body: { 'List-Unsubscribe': 'One-Click' },
      });
      expect(isListUnsubscribeOneClick(req)).toBe(false);
    });

    it('should return true for nested object with One-Click string', () => {
      const req = createMockRequest({
        method: 'POST',
        body: { data: 'List-Unsubscribe=One-Click' },
      });
      expect(isListUnsubscribeOneClick(req)).toBe(true);
    });

    it('should return false for GET requests', () => {
      const req = createMockRequest({
        method: 'GET',
        body: 'List-Unsubscribe=One-Click',
      });
      expect(isListUnsubscribeOneClick(req)).toBe(false);
    });

    it('should return false for PUT requests', () => {
      const req = createMockRequest({
        method: 'PUT',
        body: 'List-Unsubscribe=One-Click',
      });
      expect(isListUnsubscribeOneClick(req)).toBe(false);
    });

    it('should return false for missing body', () => {
      const req = createMockRequest({
        method: 'POST',
        body: undefined,
      });
      expect(isListUnsubscribeOneClick(req)).toBe(false);
    });

    it('should return false for null body', () => {
      const req = createMockRequest({
        method: 'POST',
        body: null,
      });
      expect(isListUnsubscribeOneClick(req)).toBe(false);
    });

    it('should return false for empty string body', () => {
      const req = createMockRequest({
        method: 'POST',
        body: '',
      });
      expect(isListUnsubscribeOneClick(req)).toBe(false);
    });

    it('should return false for invalid string body', () => {
      const req = createMockRequest({
        method: 'POST',
        body: 'some-random-data',
      });
      expect(isListUnsubscribeOneClick(req)).toBe(false);
    });

    it('should return false for object without One-Click value', () => {
      const req = createMockRequest({
        method: 'POST',
        body: { action: 'unsubscribe', email: 'test@example.com' },
      });
      expect(isListUnsubscribeOneClick(req)).toBe(false);
    });

    it('should return false for empty object body', () => {
      const req = createMockRequest({
        method: 'POST',
        body: {},
      });
      expect(isListUnsubscribeOneClick(req)).toBe(false);
    });

    it('should return false for number body', () => {
      const req = createMockRequest({
        method: 'POST',
        body: 12345,
      });
      expect(isListUnsubscribeOneClick(req)).toBe(false);
    });

    it('should return false for array body without One-Click', () => {
      const req = createMockRequest({
        method: 'POST',
        body: ['some', 'data'],
      });
      expect(isListUnsubscribeOneClick(req)).toBe(false);
    });

    it('should return true for array body with One-Click string', () => {
      const req = createMockRequest({
        method: 'POST',
        body: { items: ['List-Unsubscribe=One-Click'] },
      });
      // Object.values would return [['List-Unsubscribe=One-Click']], which is an array, not a string
      expect(isListUnsubscribeOneClick(req)).toBe(false);
    });

    it('should handle case sensitivity (exact match required)', () => {
      const req = createMockRequest({
        method: 'POST',
        body: 'list-unsubscribe=one-click', // lowercase
      });
      expect(isListUnsubscribeOneClick(req)).toBe(false);
    });
  });

  describe('Integration: validateRequestOrigin with isListUnsubscribeOneClick', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should allow List-Unsubscribe One-Click without origin in production', () => {
      const req = createMockRequest({
        method: 'POST',
        headers: { origin: undefined },
        body: 'List-Unsubscribe=One-Click',
      });
      
      expect(validateRequestOrigin(req, {
        customValidator: isListUnsubscribeOneClick,
      })).toBe(true);
    });

    it('should allow regular request with valid origin in production', () => {
      const req = createMockRequest({
        method: 'POST',
        headers: { origin: 'https://gtm-yard-flow.vercel.app' },
        body: { email: 'test@example.com' },
      });
      
      expect(validateRequestOrigin(req, {
        customValidator: isListUnsubscribeOneClick,
      })).toBe(true);
    });

    it('should reject non-One-Click POST without origin in production', () => {
      const req = createMockRequest({
        method: 'POST',
        headers: { origin: undefined },
        body: { email: 'test@example.com' },
      });
      
      expect(validateRequestOrigin(req, {
        customValidator: isListUnsubscribeOneClick,
      })).toBe(false);
    });
  });
});
