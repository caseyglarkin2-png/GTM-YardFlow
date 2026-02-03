/**
 * RailwayEmailService Tests
 * 
 * Sprint 301: T301.1 - Critical email path coverage
 * Tests Railway email operations including health checks, fallback logic, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock featureFlags before importing the service
vi.mock('@/config/featureFlags', () => ({
  shouldUseRailwayEmail: vi.fn(() => true),
  featureFlags: {
    RAILWAY_ENABLED: true,
    RAILWAY_EMAIL_ENABLED: true,
  },
}));

import {
  checkRailwayHealth,
  isRailwayAvailable,
  sendEmailViaRailway,
  generateAIContent,
  enrichEmailViaRailway,
  type RailwayEmailRequest,
} from '@/services/RailwayEmailService';
import { shouldUseRailwayEmail } from '@/config/featureFlags';

describe('RailwayEmailService', () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    vi.mocked(shouldUseRailwayEmail).mockReturnValue(true);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('checkRailwayHealth', () => {
    it('returns health status when Railway is healthy', async () => {
      const healthResponse = {
        status: 'healthy',
        checks: {
          database: { status: 'ok', latencyMs: 5 },
          redis: { status: 'ok', latencyMs: 2 },
          queues: { status: 'ok', queues: {} },
        },
        timestamp: '2026-01-31T12:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => healthResponse,
      });

      const result = await checkRailwayHealth();

      expect(mockFetch).toHaveBeenCalledWith('/api/railway/health');
      expect(result).toEqual(healthResponse);
      expect(result?.status).toBe('healthy');
    });

    it('returns null when health check fails with non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await checkRailwayHealth();

      expect(result).toBeNull();
    });

    it('returns null when health check throws network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await checkRailwayHealth();

      expect(result).toBeNull();
    });

    it('returns unhealthy status from Railway', async () => {
      const unhealthyResponse = {
        status: 'unhealthy',
        checks: {
          database: { status: 'error', latencyMs: 0 },
          redis: { status: 'ok', latencyMs: 2 },
          queues: { status: 'ok', queues: {} },
        },
        timestamp: '2026-01-31T12:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => unhealthyResponse,
      });

      const result = await checkRailwayHealth();

      expect(result?.status).toBe('unhealthy');
    });
  });

  describe('isRailwayAvailable', () => {
    it('returns false when feature flag is disabled', async () => {
      vi.mocked(shouldUseRailwayEmail).mockReturnValue(false);

      const result = await isRailwayAvailable();

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled(); // Should not even check health
    });

    it('returns true when feature flag enabled and Railway is healthy', async () => {
      vi.mocked(shouldUseRailwayEmail).mockReturnValue(true);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy', checks: {}, timestamp: '' }),
      });

      const result = await isRailwayAvailable();

      expect(result).toBe(true);
    });

    it('returns false when feature flag enabled but Railway is unhealthy', async () => {
      vi.mocked(shouldUseRailwayEmail).mockReturnValue(true);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'unhealthy', checks: {}, timestamp: '' }),
      });

      const result = await isRailwayAvailable();

      expect(result).toBe(false);
    });

    it('returns false when health check fails', async () => {
      vi.mocked(shouldUseRailwayEmail).mockReturnValue(true);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await isRailwayAvailable();

      expect(result).toBe(false);
    });
  });

  describe('sendEmailViaRailway', () => {
    const validRequest: RailwayEmailRequest = {
      to: 'test@example.com',
      toName: 'Test User',
      subject: 'Test Subject',
      htmlBody: '<p>Test body</p>',
      textBody: 'Test body',
      prospectId: 'prospect-123',
      campaignId: 'campaign-456',
    };

    it('sends email successfully using two-step flow', async () => {
      // Step 1: Create outreach record
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'outreach-abc',
          personId: 'prospect-123',
          status: 'pending',
        }),
      });
      // Step 2: Trigger send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'outreach-abc',
          status: 'queued',
        }),
      });

      const result = await sendEmailViaRailway(validRequest);

      // First call: POST /api/railway/outreach
      expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/railway/outreach', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      }));
      // Second call: POST /api/railway/outreach/send-email
      expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/railway/outreach/send-email', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ outreachId: 'outreach-abc', force: false }),
      }));
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('outreach-abc');
      expect(result.queuedForProcessing).toBe(true);
    });

    it('returns success with queued flag when email is queued', async () => {
      // Step 1: Create outreach record
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'outreach-xyz' }),
      });
      // Step 2: Trigger send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'outreach-xyz',
          status: 'queued',
        }),
      });

      const result = await sendEmailViaRailway(validRequest);

      expect(result.success).toBe(true);
      expect(result.queuedForProcessing).toBe(true);
    });

    it('returns error when outreach record creation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid personId' }),
      });

      const result = await sendEmailViaRailway(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid personId');
    });

    it('returns error when Railway send returns non-OK response', async () => {
      // Step 1: Create succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'outreach-fail' }),
      });
      // Step 2: Send fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Email address bounced' }),
      });

      const result = await sendEmailViaRailway(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email address bounced');
    });

    it('returns error when Railway returns 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      const result = await sendEmailViaRailway(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('returns error when Railway returns 500', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const result = await sendEmailViaRailway(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('handles network error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await sendEmailViaRailway(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('handles unknown error type', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const result = await sendEmailViaRailway(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('generateAIContent', () => {
    it('generates email content successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: {
            subject: 'Generated Subject',
            body: 'Generated body content',
          },
        }),
      });

      const result = await generateAIContent(
        'John Doe',
        'Acme Corp',
        'email',
        'Follow up on our conversation'
      );

      expect(mockFetch).toHaveBeenCalledWith('/api/railway/ai/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientName: 'John Doe',
          companyName: 'Acme Corp',
          channel: 'email',
          context: 'Follow up on our conversation',
        }),
      });
      expect(result.success).toBe(true);
      expect(result.content?.subject).toBe('Generated Subject');
      expect(result.content?.body).toBe('Generated body content');
    });

    it('generates LinkedIn content without subject', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: {
            body: 'LinkedIn message body',
          },
        }),
      });

      const result = await generateAIContent('Jane Doe', 'Tech Inc', 'linkedin');

      expect(result.success).toBe(true);
      expect(result.content?.subject).toBeUndefined();
      expect(result.content?.body).toBe('LinkedIn message body');
    });

    it('handles generation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'AI service unavailable' }),
      });

      const result = await generateAIContent('John', 'Corp', 'email');

      expect(result.success).toBe(false);
      expect(result.error).toBe('AI service unavailable');
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const result = await generateAIContent('John', 'Corp', 'email');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout');
    });
  });

  describe('enrichEmailViaRailway', () => {
    it('enriches email successfully with high confidence', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          email: 'john.doe@acme.com',
          confidence: 0.95,
        }),
      });

      const result = await enrichEmailViaRailway('person-123');

      expect(mockFetch).toHaveBeenCalledWith('/api/railway/enrichment/smart-guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ personId: 'person-123' }),
      });
      expect(result.success).toBe(true);
      expect(result.email).toBe('john.doe@acme.com');
      expect(result.confidence).toBe(0.95);
    });

    it('handles enrichment failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Person not found' }),
      });

      const result = await enrichEmailViaRailway('invalid-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Person not found');
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await enrichEmailViaRailway('person-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });
});
