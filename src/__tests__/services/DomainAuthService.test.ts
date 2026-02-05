/**
 * DomainAuthService Tests
 * 
 * Sprint 39B.1: Tests for domain authentication (SPF, DKIM, DMARC) validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import DomainAuthService from '../../services/DomainAuthService';
import type { DomainHealth, RecordStatus } from '../../services/DomainAuthService';

// Mock firebase
vi.mock('@/lib/firebase', () => ({
  db: null, // Disable caching for tests
}));

// Mock fetch for DNS-over-HTTPS
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DomainAuthService', () => {
  let service: DomainAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DomainAuthService(['selector1', 's1', 'google']);
  });

  describe('checkDomain', () => {
    it('returns healthy status for properly configured domain', async () => {
      // Mock all DNS responses
      mockFetch
        // SPF
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=spf1 include:_spf.google.com ~all"' }],
          }),
        })
        // DKIM (selector1)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=DKIM1; k=rsa; p=MIGfMA0..."' }],
          }),
        })
        // DMARC
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=DMARC1; p=reject; rua=mailto:dmarc@example.com"' }],
          }),
        });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.domain).toBe('example.com');
      expect(result.isHealthy).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.records.spf.status).toBe('valid');
      expect(result.records.dkim.status).toBe('valid');
      expect(result.records.dmarc.status).toBe('valid');
    });

    it('returns unhealthy status for missing records', async () => {
      // Mock empty DNS responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Status: 3 }), // NXDOMAIN
      });

      const result = await service.checkDomain('no-records.com', { forceRefresh: true });

      expect(result.isHealthy).toBe(false);
      expect(result.score).toBe(0);
      expect(result.records.spf.status).toBe('missing');
      expect(result.records.dkim.status).toBe('missing');
      expect(result.records.dmarc.status).toBe('missing');
    });

    it('normalizes domain to lowercase', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Status: 3 }),
      });

      const result = await service.checkDomain('EXAMPLE.COM  ', { forceRefresh: true });

      expect(result.domain).toBe('example.com');
    });
  });

  describe('SPF validation', () => {
    it('detects valid SPF with -all', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=spf1 include:_spf.google.com -all"' }],
          }),
        })
        .mockResolvedValue({ ok: true, json: () => Promise.resolve({ Status: 3 }) });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.records.spf.status).toBe('valid');
      expect(result.records.spf.message).toContain('properly configured');
    });

    it('warns on SPF without ~all or -all', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=spf1 include:_spf.google.com"' }],
          }),
        })
        .mockResolvedValue({ ok: true, json: () => Promise.resolve({ Status: 3 }) });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.records.spf.status).toBe('warning');
      expect(result.records.spf.details).toBeDefined();
    });

    it('flags dangerous +all SPF', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=spf1 +all"' }],
          }),
        })
        .mockResolvedValue({ ok: true, json: () => Promise.resolve({ Status: 3 }) });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.records.spf.status).toBe('invalid');
      expect(result.records.spf.message).toContain('dangerous');
    });

    it('warns on too many includes', async () => {
      const manyIncludes = 'v=spf1 ' + 
        'include:a.com include:b.com include:c.com ' +
        'include:d.com include:e.com include:f.com ' +
        'include:g.com include:h.com include:i.com ~all';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: `"${manyIncludes}"` }],
          }),
        })
        .mockResolvedValue({ ok: true, json: () => Promise.resolve({ Status: 3 }) });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.records.spf.status).toBe('warning');
      expect(result.records.spf.details?.some(d => d.includes('Too many includes'))).toBe(true);
    });
  });

  describe('DKIM validation', () => {
    it('finds DKIM with valid selector', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) }) // SPF
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3..."' }],
          }),
        })
        .mockResolvedValue({ ok: true, json: () => Promise.resolve({ Status: 3 }) }); // DMARC

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.records.dkim.status).toBe('valid');
      expect(result.records.dkim.value).toContain('selector1._domainkey');
    });

    it('detects revoked DKIM key', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=DKIM1; p="' }],
          }),
        })
        .mockResolvedValue({ ok: true, json: () => Promise.resolve({ Status: 3 }) });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.records.dkim.status).toBe('invalid');
      expect(result.records.dkim.message).toContain('revoked');
    });

    it('checks custom DKIM selector', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=DKIM1; k=rsa; p=ABC123..."' }],
          }),
        })
        .mockResolvedValue({ ok: true, json: () => Promise.resolve({ Status: 3 }) });

      const result = await service.checkDomain('example.com', { 
        forceRefresh: true, 
        dkimSelector: 'custom-selector' 
      });

      expect(result.records.dkim.status).toBe('valid');
      // Should have checked custom-selector first
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('custom-selector._domainkey'),
        expect.any(Object)
      );
    });
  });

  describe('DMARC validation', () => {
    it('validates strict DMARC policy', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) })
        .mockResolvedValue({ ok: true, json: () => Promise.resolve({ Status: 3 }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=DMARC1; p=reject; rua=mailto:dmarc@example.com"' }],
          }),
        });

      // Reset and setup fresh mocks
      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) }) // SPF
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) }) // DKIM selector1
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) }) // DKIM s1
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) }) // DKIM google
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=DMARC1; p=reject; rua=mailto:dmarc@example.com"' }],
          }),
        });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.records.dmarc.status).toBe('valid');
      expect(result.records.dmarc.message).toContain('reject');
    });

    it('warns on p=none policy', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=DMARC1; p=none"' }],
          }),
        });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.records.dmarc.status).toBe('warning');
      expect(result.records.dmarc.details?.some(d => d.includes('p=none'))).toBe(true);
    });

    it('warns on missing rua (reporting)', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Status: 3 }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=DMARC1; p=quarantine"' }],
          }),
        });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.records.dmarc.details?.some(d => d.includes('rua'))).toBe(true);
    });
  });

  describe('score calculation', () => {
    it('gives 100 for perfect configuration', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=spf1 include:_spf.google.com -all"' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=DKIM1; k=rsa; p=MIGfMA..."' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 16, data: '"v=DMARC1; p=reject; rua=mailto:dmarc@example.com"' }],
          }),
        });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.score).toBe(100);
    });

    it('penalizes missing records appropriately', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Status: 3 }),
      });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.score).toBe(0);
      expect(result.isHealthy).toBe(false);
    });
  });

  describe('recommendations', () => {
    it('provides actionable SPF recommendation when missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Status: 3 }),
      });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.recommendations.some(r => r.includes('SPF'))).toBe(true);
      expect(result.recommendations.some(r => r.includes('v=spf1'))).toBe(true);
    });

    it('recommends DKIM configuration when missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Status: 3 }),
      });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.recommendations.some(r => r.toLowerCase().includes('dkim'))).toBe(true);
    });

    it('recommends DMARC with domain-specific address', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Status: 3 }),
      });

      const result = await service.checkDomain('mycompany.com', { forceRefresh: true });

      expect(result.recommendations.some(r => r.includes('_dmarc.mycompany.com'))).toBe(true);
    });
  });

  describe('static helpers', () => {
    it('extracts domain from email', () => {
      expect(DomainAuthService.getDomainFromEmail('user@example.com')).toBe('example.com');
      expect(DomainAuthService.getDomainFromEmail('test@SUB.EXAMPLE.COM')).toBe('sub.example.com');
      expect(DomainAuthService.getDomainFromEmail('invalid')).toBe(null);
      expect(DomainAuthService.getDomainFromEmail('@')).toBe(null);
    });

    it('identifies free email providers', () => {
      expect(DomainAuthService.isFreeEmailProvider('gmail.com')).toBe(true);
      expect(DomainAuthService.isFreeEmailProvider('outlook.com')).toBe(true);
      expect(DomainAuthService.isFreeEmailProvider('protonmail.com')).toBe(true);
      expect(DomainAuthService.isFreeEmailProvider('mycompany.com')).toBe(false);
      expect(DomainAuthService.isFreeEmailProvider('GMAIL.COM')).toBe(true); // Case insensitive
    });
  });

  describe('error handling', () => {
    it('handles DNS lookup failure gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.records.spf.status).toBe('unknown');
      expect(result.records.dkim.status).toBe('unknown');
      expect(result.records.dmarc.status).toBe('unknown');
    });

    it('handles non-OK HTTP response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.checkDomain('example.com', { forceRefresh: true });

      expect(result.records.spf.status).toBe('unknown');
    });
  });
});
