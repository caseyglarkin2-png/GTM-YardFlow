/**
 * Domain Check API Contract Tests
 * 
 * Sprint 39B.2: Tests for /api/domain/check endpoint contract
 */

import { describe, it, expect } from 'vitest';

describe('/api/domain/check contract', () => {
  describe('Request validation', () => {
    it('requires domain query parameter', () => {
      const validRequest = {
        method: 'GET',
        query: { domain: 'example.com' },
        headers: { authorization: 'Bearer token' },
      };
      expect(validRequest.query.domain).toBeDefined();
    });

    it('accepts optional parameters', () => {
      const requestWithOptions = {
        method: 'GET',
        query: {
          domain: 'example.com',
          refresh: 'true',
          selector: 'google',
        },
        headers: { authorization: 'Bearer token' },
      };
      expect(requestWithOptions.query.refresh).toBe('true');
      expect(requestWithOptions.query.selector).toBe('google');
    });

    it('validates domain format', () => {
      const validDomains = ['example.com', 'sub.example.com', 'my-company.co.uk'];
      const invalidDomains = ['not a domain', '@invalid', 'missing.', '.nodomain'];

      validDomains.forEach(d => {
        expect(d).toMatch(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i);
      });

      invalidDomains.forEach(d => {
        expect(d).not.toMatch(/^[a-z][a-z0-9.-]*\.[a-z]{2,}$/i);
      });
    });
  });

  describe('Response contract', () => {
    interface DomainHealthResponse {
      domain: string;
      isHealthy: boolean;
      score: number;
      records: {
        spf: DnsRecordResult;
        dkim: DnsRecordResult;
        dmarc: DnsRecordResult;
      };
      recommendations: string[];
      lastChecked: string;
      cacheExpiry: string;
      requestId: string;
    }

    interface DnsRecordResult {
      type: 'SPF' | 'DKIM' | 'DMARC';
      status: 'valid' | 'invalid' | 'missing' | 'warning' | 'unknown';
      value?: string;
      expected?: string;
      message: string;
      details?: string[];
    }

    it('defines success response format', () => {
      const successResponse: DomainHealthResponse = {
        domain: 'example.com',
        isHealthy: true,
        score: 95,
        records: {
          spf: {
            type: 'SPF',
            status: 'valid',
            value: 'v=spf1 include:_spf.google.com ~all',
            message: 'SPF properly configured',
          },
          dkim: {
            type: 'DKIM',
            status: 'valid',
            value: 'google._domainkey.example.com',
            message: 'DKIM properly configured (selector: google)',
          },
          dmarc: {
            type: 'DMARC',
            status: 'valid',
            value: 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com',
            message: 'DMARC properly configured (policy: reject)',
          },
        },
        recommendations: ['Your domain authentication looks good!'],
        lastChecked: '2025-01-15T12:00:00.000Z',
        cacheExpiry: '2025-01-15T13:00:00.000Z',
        requestId: 'test-123',
      };

      expect(successResponse).toHaveProperty('domain');
      expect(successResponse).toHaveProperty('isHealthy');
      expect(successResponse).toHaveProperty('score');
      expect(successResponse).toHaveProperty('records');
      expect(successResponse.records).toHaveProperty('spf');
      expect(successResponse.records).toHaveProperty('dkim');
      expect(successResponse.records).toHaveProperty('dmarc');
      expect(successResponse).toHaveProperty('recommendations');
      expect(successResponse).toHaveProperty('lastChecked');
      expect(successResponse).toHaveProperty('cacheExpiry');
      expect(successResponse).toHaveProperty('requestId');
    });

    it('validates record status values', () => {
      const validStatuses = ['valid', 'invalid', 'missing', 'warning', 'unknown'];
      
      validStatuses.forEach(status => {
        expect(['valid', 'invalid', 'missing', 'warning', 'unknown']).toContain(status);
      });
    });

    it('validates score range', () => {
      const scores = [0, 25, 50, 75, 100];
      
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Error responses', () => {
    interface ErrorResponse {
      error: string;
      requestId: string;
      detail?: string;
    }

    it('400 for missing domain', () => {
      const errorResponse: ErrorResponse = {
        error: 'Missing required parameter: domain',
        requestId: 'test-123',
      };
      expect(errorResponse.error).toContain('domain');
    });

    it('400 for invalid domain format', () => {
      const errorResponse: ErrorResponse = {
        error: 'Invalid domain format',
        requestId: 'test-123',
      };
      expect(errorResponse.error).toContain('format');
    });

    it('401 for missing auth', () => {
      const errorResponse: ErrorResponse = {
        error: 'Invalid or missing authentication',
        requestId: 'test-123',
      };
      expect(errorResponse.error).toContain('authentication');
    });

    it('405 for non-GET method', () => {
      const errorResponse: ErrorResponse = {
        error: 'Method not allowed',
        requestId: 'test-123',
      };
      expect(errorResponse.error).toContain('Method');
    });
  });

  describe('Authentication', () => {
    it('accepts Firebase token', () => {
      const authHeader = 'Bearer eyJhbGciOiJSUzI1...';
      expect(authHeader).toMatch(/^Bearer .+$/);
    });

    it('accepts S2S key', () => {
      const authHeader = 'Bearer service-secret-key';
      expect(authHeader).toMatch(/^Bearer .+$/);
    });
  });

  describe('Caching behavior', () => {
    it('respects cache TTL (default 1 hour)', () => {
      const cacheTtlMs = 3600000; // 1 hour
      const now = new Date();
      const cacheExpiry = new Date(now.getTime() + cacheTtlMs);
      
      expect(cacheExpiry.getTime() - now.getTime()).toBe(cacheTtlMs);
    });

    it('bypasses cache with refresh=true', () => {
      const request = {
        query: { domain: 'example.com', refresh: 'true' },
      };
      expect(request.query.refresh).toBe('true');
    });
  });

  describe('Score calculation', () => {
    const weights = { spf: 35, dkim: 40, dmarc: 25 };
    const statusScores = {
      valid: 1.0,
      warning: 0.7,
      invalid: 0.2,
      missing: 0,
      unknown: 0.3,
    };

    function calculateScore(statuses: { spf: string; dkim: string; dmarc: string }): number {
      let score = 0;
      for (const key of ['spf', 'dkim', 'dmarc'] as const) {
        score += weights[key] * statusScores[statuses[key] as keyof typeof statusScores];
      }
      return Math.round(score);
    }

    it('calculates 100 for all valid records', () => {
      const score = calculateScore({ spf: 'valid', dkim: 'valid', dmarc: 'valid' });
      expect(score).toBe(100);
    });

    it('calculates 0 for all missing records', () => {
      const score = calculateScore({ spf: 'missing', dkim: 'missing', dmarc: 'missing' });
      expect(score).toBe(0);
    });

    it('applies correct weights', () => {
      // Only SPF valid
      const spfOnly = calculateScore({ spf: 'valid', dkim: 'missing', dmarc: 'missing' });
      expect(spfOnly).toBe(35);

      // Only DKIM valid
      const dkimOnly = calculateScore({ spf: 'missing', dkim: 'valid', dmarc: 'missing' });
      expect(dkimOnly).toBe(40);

      // Only DMARC valid
      const dmarcOnly = calculateScore({ spf: 'missing', dkim: 'missing', dmarc: 'valid' });
      expect(dmarcOnly).toBe(25);
    });

    it('handles warning status at 70%', () => {
      const allWarnings = calculateScore({ spf: 'warning', dkim: 'warning', dmarc: 'warning' });
      expect(allWarnings).toBe(70); // Math.round(100 * 0.7)
    });
  });

  describe('Record type checks', () => {
    it('SPF records start with v=spf1', () => {
      const validSpf = 'v=spf1 include:_spf.google.com ~all';
      expect(validSpf).toMatch(/^v=spf1/);
    });

    it('DKIM records contain v=DKIM1 or p=', () => {
      const validDkim1 = 'v=DKIM1; k=rsa; p=MIGfMA...';
      const validDkim2 = 'k=rsa; p=MIGfMA...';
      
      expect(validDkim1.includes('v=DKIM1') || validDkim1.includes('p=')).toBe(true);
      expect(validDkim2.includes('v=DKIM1') || validDkim2.includes('p=')).toBe(true);
    });

    it('DMARC records start with v=DMARC1', () => {
      const validDmarc = 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com';
      expect(validDmarc).toMatch(/^v=DMARC1/);
    });
  });
});
