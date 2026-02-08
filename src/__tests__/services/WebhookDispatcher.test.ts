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
    it('registers a webhook endpoint and returns new ID', () => {
      const endpoint = createEndpoint();
      const registered = dispatcher.registerEndpoint(endpoint);

      const endpoints = dispatcher.getEndpoints();
      expect(endpoints).toHaveLength(1);
      // Service generates new unique ID
      expect(registered.id).toBeDefined();
      expect(typeof registered.id).toBe('string');
      expect(endpoints[0].id).toBe(registered.id);
    });

    it('generates unique IDs for each registration', () => {
      const endpoint1 = createEndpoint({ name: 'Hook 1' });
      const endpoint2 = createEndpoint({ name: 'Hook 2' });
      const registered1 = dispatcher.registerEndpoint(endpoint1);
      const registered2 = dispatcher.registerEndpoint(endpoint2);

      expect(registered1.id).not.toBe(registered2.id);
      expect(dispatcher.getEndpoints()).toHaveLength(2);
    });
  });

  describe('removeEndpoint', () => {
    it('removes an endpoint by ID', () => {
      const registered = dispatcher.registerEndpoint(createEndpoint());
      const removed = dispatcher.removeEndpoint(registered.id);

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
      expect(options.headers).toHaveProperty('X-Webhook-Signature');
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
      
      // Zapier format flattens nested objects with underscore-separated keys
      expect(sentBody.prospect_name).toBe('John');
      expect(sentBody.prospect_company_name).toBe('Acme');
      expect(sentBody.event_type).toBe('prospect.created');
    });
  });

  describe('getEndpoints / getActiveEndpoints', () => {
    it('returns all endpoints via getEndpoints', () => {
      const active = dispatcher.registerEndpoint(createEndpoint({ isActive: true }));
      const inactive = dispatcher.registerEndpoint(createEndpoint({ isActive: false }));

      expect(dispatcher.getEndpoints()).toHaveLength(2);
      expect(dispatcher.getEndpoints().map(e => e.id)).toContain(active.id);
      expect(dispatcher.getEndpoints().map(e => e.id)).toContain(inactive.id);
    });

    it('returns only active endpoints via getActiveEndpoints', () => {
      const active = dispatcher.registerEndpoint(createEndpoint({ isActive: true }));
      dispatcher.registerEndpoint(createEndpoint({ isActive: false }));

      expect(dispatcher.getActiveEndpoints()).toHaveLength(1);
      expect(dispatcher.getActiveEndpoints()[0].id).toBe(active.id);
    });
  });
});
