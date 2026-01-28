/**
 * HubSpot API Client Tests
 * Sprint 26 - T26.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHubSpotClient, type HubSpotClient } from '../../services/HubSpotClient';
import type { HubSpotAuthService } from '../../services/HubSpotAuthService';

// Mock fetch
vi.stubGlobal('fetch', vi.fn());

describe('HubSpot Client - T26.3', () => {
  let client: HubSpotClient;
  let mockAuthService: HubSpotAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockAuthService = {
      getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
      isConnected: vi.fn().mockReturnValue(true),
      getAuthUrl: vi.fn(),
      handleCallback: vi.fn(),
      refreshToken: vi.fn(),
      getTokens: vi.fn(),
      disconnect: vi.fn(),
    };

    client = createHubSpotClient({ authService: mockAuthService });
  });

  describe('Rate Limiter', () => {
    it('should track request count', () => {
      const status = client.getRateLimitStatus();
      expect(status.requestCount).toBe(0);
      expect(status.queueLength).toBe(0);
    });

    it('should queue requests when rate limited', async () => {
      // Make many parallel requests
      const mockResponse = {
        results: [],
        paging: {},
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers(),
      } as Response);

      // Start several requests in parallel
      const requests = Array(5).fill(null).map(() => client.getContacts());
      
      await Promise.all(requests);

      // All should complete
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(5);
    });
  });

  describe('Cache', () => {
    it('should cache GET responses', async () => {
      const mockResponse = {
        results: [{
          id: '123',
          properties: { email: 'test@example.com' },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers(),
      } as Response);

      // First call - should hit API
      await client.getContacts();
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await client.getContacts();
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache on mutations', async () => {
      const mockListResponse = {
        results: [{
          id: '123',
          properties: { email: 'test@example.com' },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }],
      };

      const mockCreateResponse = {
        id: '456',
        properties: { email: 'new@example.com' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockListResponse),
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCreateResponse),
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockListResponse),
          headers: new Headers(),
        } as Response);

      // First call - cache miss
      await client.getContacts();
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

      // Create - invalidates cache
      await client.createContact({ email: 'new@example.com' });
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);

      // Third call - cache was invalidated, should hit API
      await client.getContacts();
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
    });

    it('should allow manual cache invalidation', async () => {
      const mockResponse = {
        results: [],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers(),
      } as Response);

      await client.getContacts();
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

      client.invalidateCache('contacts');

      await client.getContacts();
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on 429 with backoff', async () => {
      const mockSuccessResponse = {
        results: [],
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '1' }),
          json: () => Promise.resolve({ message: 'Rate limited' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSuccessResponse),
          headers: new Headers(),
        } as Response);

      const result = await client.getContacts();
      
      expect(result.results).toEqual([]);
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx errors', async () => {
      const mockSuccessResponse = {
        results: [],
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ message: 'Service unavailable' }),
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSuccessResponse),
          headers: new Headers(),
        } as Response);

      const result = await client.getContacts();
      
      expect(result.results).toEqual([]);
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 401 errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
        headers: new Headers(),
      } as Response);

      await expect(client.getContacts()).rejects.toThrow('Unauthorized');
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    });
  });

  describe('Contacts API', () => {
    it('should fetch contacts with pagination', async () => {
      const mockResponse = {
        results: [
          {
            id: '1',
            properties: { email: 'a@example.com', firstname: 'A' },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: '2',
            properties: { email: 'b@example.com', firstname: 'B' },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        paging: {
          next: { after: 'cursor123' },
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers(),
      } as Response);

      const result = await client.getContacts({ limit: 10 });

      expect(result.results).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('cursor123');
    });

    it('should fetch single contact by ID', async () => {
      const mockContact = {
        id: '123',
        properties: { email: 'test@example.com' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockContact),
        headers: new Headers(),
      } as Response);

      const result = await client.getContact('123');

      expect(result?.id).toBe('123');
      expect(result?.properties.email).toBe('test@example.com');
    });

    it('should return null for non-existent contact', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Not found' }),
        headers: new Headers(),
      } as Response);

      const result = await client.getContact('nonexistent');

      expect(result).toBeNull();
    });

    it('should create contact', async () => {
      const mockCreated = {
        id: '789',
        properties: { email: 'new@example.com', firstname: 'New' },
        createdAt: '2026-01-28T00:00:00.000Z',
        updatedAt: '2026-01-28T00:00:00.000Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCreated),
        headers: new Headers(),
      } as Response);

      const result = await client.createContact({
        email: 'new@example.com',
        firstname: 'New',
      });

      expect(result.id).toBe('789');
      
      // Check request body
      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.properties.email).toBe('new@example.com');
    });

    it('should update contact', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response);

      await client.updateContact('123', { firstname: 'Updated' });

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/contacts/123'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('should search contacts', async () => {
      const mockSearchResponse = {
        total: 1,
        results: [{
          id: '123',
          properties: { email: 'found@example.com' },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse),
        headers: new Headers(),
      } as Response);

      const results = await client.searchContacts('found@example.com');

      expect(results).toHaveLength(1);
      expect(results[0].properties.email).toBe('found@example.com');
    });

    it('should batch create contacts', async () => {
      const mockBatchResponse = {
        results: [
          { id: '1' },
          { id: '2' },
          { id: '3' },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBatchResponse),
        headers: new Headers(),
      } as Response);

      const contacts = [
        { email: 'a@example.com' },
        { email: 'b@example.com' },
        { email: 'c@example.com' },
      ];

      const result = await client.batchCreateContacts(contacts);

      expect(result.status).toBe('COMPLETE');
      expect(result.results).toHaveLength(3);
      expect(result.numErrors).toBe(0);
    });
  });

  describe('Deals API', () => {
    it('should fetch deals', async () => {
      const mockResponse = {
        results: [{
          id: 'deal-1',
          properties: { dealname: 'Test Deal', dealstage: 'appointmentscheduled' },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers(),
      } as Response);

      const result = await client.getDeals();

      expect(result.results).toHaveLength(1);
      expect(result.results[0].properties.dealname).toBe('Test Deal');
    });

    it('should create deal', async () => {
      const mockDeal = {
        id: 'deal-new',
        properties: { dealname: 'New Deal', dealstage: 'qualifiedtobuy' },
        createdAt: '2026-01-28T00:00:00.000Z',
        updatedAt: '2026-01-28T00:00:00.000Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeal),
        headers: new Headers(),
      } as Response);

      const result = await client.createDeal({
        dealname: 'New Deal',
        dealstage: 'qualifiedtobuy',
      });

      expect(result.id).toBe('deal-new');
    });

    it('should associate contact to deal', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response);

      await client.associateContactToDeal('contact-123', 'deal-456');

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/contacts/contact-123/associations/deals/deal-456'),
        expect.any(Object)
      );
    });
  });

  describe('Engagements API', () => {
    it('should create note', async () => {
      const mockNote = {
        id: 'note-1',
        type: 'NOTE',
        properties: { hs_note_body: 'Test note' },
        createdAt: '2026-01-28T00:00:00.000Z',
        updatedAt: '2026-01-28T00:00:00.000Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNote),
        headers: new Headers(),
      } as Response);

      const result = await client.createNote('123', 'Test note');

      expect(result.id).toBe('note-1');
    });

    it('should create task', async () => {
      const mockTask = {
        id: 'task-1',
        type: 'TASK',
        properties: { hs_task_subject: 'Follow up' },
        createdAt: '2026-01-28T00:00:00.000Z',
        updatedAt: '2026-01-28T00:00:00.000Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTask),
        headers: new Headers(),
      } as Response);

      const result = await client.createTask('123', {
        subject: 'Follow up',
        priority: 'HIGH',
      });

      expect(result.id).toBe('task-1');
    });

    it('should log email', async () => {
      const mockEmail = {
        id: 'email-1',
        type: 'EMAIL',
        properties: { hs_email_subject: 'Re: Demo' },
        createdAt: '2026-01-28T00:00:00.000Z',
        updatedAt: '2026-01-28T00:00:00.000Z',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmail),
        headers: new Headers(),
      } as Response);

      const result = await client.logEmail('123', {
        subject: 'Re: Demo',
        body: 'Thanks for the call...',
      });

      expect(result.id).toBe('email-1');
    });
  });

  describe('Authentication', () => {
    it('should include authorization header in requests', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
        headers: new Headers(),
      } as Response);

      await client.getContacts();

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        })
      );
    });

    it('should throw when not authenticated', async () => {
      vi.mocked(mockAuthService.getAccessToken).mockResolvedValueOnce(null);

      await expect(client.getContacts()).rejects.toThrow('Not authenticated');
    });
  });
});
