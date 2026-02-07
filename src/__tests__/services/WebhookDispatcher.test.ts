/**
 * WebhookDispatcher Tests
 * Sprint 49D: Test coverage for S46 Pipeline Automation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  WebhookDispatcher, 
  type WebhookEndpoint, 
  type WebhookPayload,
  type WebhookEventType 
} from '../../services/WebhookDispatcher';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Factory for webhook endpoint
const createEndpoint = (overrides: Partial<WebhookEndpoint> = {}): WebhookEndpoint => ({
  id: 'hook-1',
  name: 'Test Webhook',
  url: 'https://example.com/webhook',
  events: ['prospect.created', 'meeting.booked'],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  successCount: 0,
  failureCount: 0,
  ...overrides,
});

describe('WebhookDispatcher', () => {
  let dispatcher: WebhookDispatcher;

  beforeEach(() => {
    dispatcher = new WebhookDispatcher();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registerEndpoint', () => {
    it('registers a webhook endpoint', () => {
      const endpoint = createEndpoint();
      dispatcher.registerEndpoint(endpoint);

      const endpoints = dispatcher.getEndpoints();
      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].id).toBe('hook-1');
    });

    it('throws on duplicate endpoint ID', () => {
      const endpoint = createEndpoint({ id: 'duplicate' });
      dispatcher.registerEndpoint(endpoint);

      expect(() => dispatcher.registerEndpoint(endpoint)).toThrow();
    });
  });

  describe('removeEndpoint', () => {
    it('removes an endpoint by ID', () => {
      dispatcher.registerEndpoint(createEndpoint({ id: 'to-remove' }));
      const removed = dispatcher.removeEndpoint('to-remove');

      expect(removed).toBe(true);
      expect(dispatcher.getEndpoints()).toHaveLength(0);
    });

    it('returns false for non-existent endpoint', () => {
      const result = dispatcher.removeEndpoint('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('dispatch', () => {
    it('sends payload to matching endpoints', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const endpoint = createEndpoint({ events: ['prospect.created'] });
      dispatcher.registerEndpoint(endpoint);

      const result = await dispatcher.dispatch('prospect.created', { id: 'p1', name: 'Test' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.succeeded).toBe(1);
    });

    it('skips endpoints not subscribed to event', async () => {
      const endpoint = createEndpoint({ events: ['meeting.booked'] });
      dispatcher.registerEndpoint(endpoint);

      const result = await dispatcher.dispatch('prospect.created', { id: 'p1' });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.dispatched).toBe(0);
    });

    it('skips inactive endpoints', async () => {
      const endpoint = createEndpoint({ isActive: false });
      dispatcher.registerEndpoint(endpoint);

      const result = await dispatcher.dispatch('prospect.created', { id: 'p1' });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.dispatched).toBe(0);
    });

    it('includes signature header when secret configured', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const endpoint = createEndpoint({ 
        secret: 'my-secret',
        events: ['prospect.created']
      });
      dispatcher.registerEndpoint(endpoint);

      await dispatcher.dispatch('prospect.created', { id: 'p1' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers).toHaveProperty('x-webhook-signature');
    });

    it('handles fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const endpoint = createEndpoint({ events: ['prospect.created'] });
      dispatcher.registerEndpoint(endpoint);

      const result = await dispatcher.dispatch('prospect.created', { id: 'p1' });

      expect(result.failed).toBe(1);
      expect(result.results[0].error).toContain('Network error');
    });

    it('reports non-2xx responses as failures', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const endpoint = createEndpoint({ events: ['prospect.created'] });
      dispatcher.registerEndpoint(endpoint);

      const result = await dispatcher.dispatch('prospect.created', { id: 'p1' });

      expect(result.failed).toBe(1);
      expect(result.results[0].statusCode).toBe(500);
    });
  });

  describe('Zapier format', () => {
    it('flattens nested data for Zapier compatibility', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const endpoint = createEndpoint({ 
        format: 'zapier',
        events: ['prospect.created']
      });
      dispatcher.registerEndpoint(endpoint);

      await dispatcher.dispatch('prospect.created', {
        prospect: {
          name: 'John',
          company: { name: 'Acme' },
        },
      });

      const [, options] = mockFetch.mock.calls[0];
      const sentBody = JSON.parse(options.body);
      
      // Zapier format should flatten nested objects
      expect(sentBody.data_prospect_name).toBe('John');
      expect(sentBody.data_prospect_company_name).toBe('Acme');
    });
  });

  describe('getEndpoints / getActiveEndpoints', () => {
    it('returns all endpoints via getEndpoints', () => {
      dispatcher.registerEndpoint(createEndpoint({ id: 'e1', isActive: true }));
      dispatcher.registerEndpoint(createEndpoint({ id: 'e2', isActive: false }));

      expect(dispatcher.getEndpoints()).toHaveLength(2);
    });

    it('returns only active endpoints via getActiveEndpoints', () => {
      dispatcher.registerEndpoint(createEndpoint({ id: 'e1', isActive: true }));
      dispatcher.registerEndpoint(createEndpoint({ id: 'e2', isActive: false }));

      expect(dispatcher.getActiveEndpoints()).toHaveLength(1);
      expect(dispatcher.getActiveEndpoints()[0].id).toBe('e1');
    });
  });
});
