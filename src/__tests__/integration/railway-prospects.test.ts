/**
 * Sprint 306: Railway Prospect API Integration Tests
 * 
 * T306.4: Integration tests for Vercel → Railway prospect operations.
 * Tests the full flow of prospect CRUD operations through the Railway proxy.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type {
  RailwayProspect,
  RailwayApiResult,
  PaginatedResponse,
  CreateProspectRequest,
  UpdateProspectRequest,
  BatchUpsertProspectResponse,
} from '@/types/railway';

// =============================================================================
// Mock Setup
// =============================================================================

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock feature flags to enable Railway
vi.mock('@/config/featureFlags', () => ({
  featureFlags: {
    RAILWAY_ENABLED: true,
    RAILWAY_DATA_ENABLED: true,
    DEBUG_RAILWAY_REQUESTS: false,
  },
}));

// Import after mocks
import { railwayClient } from '@/services/RailwayApiClient';

// =============================================================================
// Test Data
// =============================================================================

const mockProspect: RailwayProspect = {
  id: 'prospect-123',
  firstName: 'John',
  lastName: 'Doe',
  name: 'John Doe',
  email: 'john@acmelogistics.com',
  emailVerified: true,
  phone: '+15551234567',
  title: 'VP of Operations',
  companyName: 'Acme Logistics',
  companyId: 'company-456',
  linkedinUrl: 'https://linkedin.com/in/johndoe',
  status: 'new',
  tier: 'Tier 1',
  score: 85,
  notes: 'High-value prospect',
  lastContactedAt: null,
  timezone: 'America/New_York',
  tags: ['manifest-2026', 'beverage'],
  customFields: { industry: 'Logistics' },
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-30T10:00:00Z',
};

const mockProspect2: RailwayProspect = {
  ...mockProspect,
  id: 'prospect-456',
  firstName: 'Jane',
  lastName: 'Smith',
  name: 'Jane Smith',
  email: 'jane@primobeverages.com',
  companyName: 'Primo Beverages',
  tier: 'Tier 2',
  score: 72,
};

// =============================================================================
// Helper Functions
// =============================================================================

function mockSuccessResponse<T>(data: T, status = 200) {
  return {
    ok: true,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(data),
  };
}

function mockErrorResponse(message: string, status = 400) {
  return {
    ok: false,
    status,
    statusText: message,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({ error: message, message }),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Railway Prospect API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // List Prospects (GET /api/prospects)
  // ===========================================================================

  describe('prospects.list', () => {
    it('fetches paginated prospect list', async () => {
      const paginatedResponse: PaginatedResponse<RailwayProspect> = {
        data: [mockProspect, mockProspect2],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 2,
          totalPages: 1,
        },
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(paginatedResponse));

      const result = await railwayClient.prospects.list({ page: 1, pageSize: 20 });

      expect(result.ok).toBe(true);
      expect(result.data?.data).toHaveLength(2);
      expect(result.data?.pagination.total).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/prospects'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('filters by status', async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          data: [mockProspect],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        })
      );

      await railwayClient.prospects.list({ status: 'new' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=new'),
        expect.anything()
      );
    });

    it('filters by tier', async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          data: [mockProspect],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        })
      );

      await railwayClient.prospects.list({ tier: 'Tier 1' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('tier=Tier'),
        expect.anything()
      );
    });

    it('handles empty results', async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          data: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        })
      );

      const result = await railwayClient.prospects.list({ status: 'closed_won' });

      expect(result.ok).toBe(true);
      expect(result.data?.data).toHaveLength(0);
    });

    it('handles API error', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Internal Server Error', 500));

      const result = await railwayClient.prospects.list();

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ===========================================================================
  // Get Prospect (GET /api/prospects/:id)
  // ===========================================================================

  describe('prospects.get', () => {
    it('fetches single prospect by ID', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockProspect));

      const result = await railwayClient.prospects.get('prospect-123');

      expect(result.ok).toBe(true);
      expect(result.data?.id).toBe('prospect-123');
      expect(result.data?.name).toBe('John Doe');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/prospects/prospect-123'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('handles not found', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Prospect not found', 404));

      const result = await railwayClient.prospects.get('nonexistent-id');

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(404);
    });
  });

  // ===========================================================================
  // Create Prospect (POST /api/prospects)
  // ===========================================================================

  describe('prospects.create', () => {
    it('creates a new prospect', async () => {
      const createRequest: CreateProspectRequest = {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@newcorp.com',
        companyName: 'NewCorp',
        title: 'Director',
        tier: 'Tier 2',
      };

      const createdProspect: RailwayProspect = {
        ...mockProspect,
        id: 'prospect-new',
        ...createRequest,
        name: 'Alice Johnson',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(createdProspect, 201));

      const result = await railwayClient.prospects.create(createRequest);

      expect(result.ok).toBe(true);
      expect(result.data?.id).toBe('prospect-new');
      expect(result.data?.email).toBe('alice@newcorp.com');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/prospects'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('alice@newcorp.com'),
        })
      );
    });

    it('handles validation error', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Email is required', 400));

      const result = await railwayClient.prospects.create({
        firstName: 'Test',
        lastName: 'User',
        email: '', // Invalid
        companyName: 'Test',
      });

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('handles duplicate email', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Email already exists', 409));

      const result = await railwayClient.prospects.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@acmelogistics.com', // Duplicate
        companyName: 'Acme',
      });

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(409);
    });
  });

  // ===========================================================================
  // Update Prospect (PUT/PATCH /api/prospects/:id)
  // ===========================================================================

  describe('prospects.update', () => {
    it('updates prospect fields', async () => {
      const updateRequest: UpdateProspectRequest = {
        status: 'contacted',
        score: 90,
        notes: 'Had a great call',
      };

      const updatedProspect: RailwayProspect = {
        ...mockProspect,
        ...updateRequest,
        updatedAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(updatedProspect));

      const result = await railwayClient.prospects.update('prospect-123', updateRequest);

      expect(result.ok).toBe(true);
      expect(result.data?.status).toBe('contacted');
      expect(result.data?.score).toBe(90);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/prospects/prospect-123'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('handles partial updates', async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({ ...mockProspect, tier: 'Tier 1' })
      );

      const result = await railwayClient.prospects.update('prospect-123', { tier: 'Tier 1' });

      expect(result.ok).toBe(true);
      expect(result.data?.tier).toBe('Tier 1');
    });
  });

  // ===========================================================================
  // Delete Prospect (DELETE /api/prospects/:id)
  // ===========================================================================

  describe('prospects.delete', () => {
    it('soft deletes a prospect', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(undefined, 204));

      const result = await railwayClient.prospects.delete('prospect-123');

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/prospects/prospect-123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('handles delete of non-existent prospect', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Prospect not found', 404));

      const result = await railwayClient.prospects.delete('nonexistent-id');

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(404);
    });
  });

  // ===========================================================================
  // Search Prospects (GET /api/prospects/search)
  // ===========================================================================

  describe('prospects.search', () => {
    it('searches by query string', async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          data: [mockProspect],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        })
      );

      const result = await railwayClient.prospects.search('John');

      expect(result.ok).toBe(true);
      expect(result.data?.data).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('query=John'),
        expect.anything()
      );
    });

    it('searches with filters', async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({
          data: [mockProspect],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        })
      );

      await railwayClient.prospects.search('operations', {
        tier: 'Tier 1',
        minScore: 80,
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('query=operations');
      expect(url).toContain('minScore=80');
    });
  });

  // ===========================================================================
  // Batch Upsert (POST /api/prospects/batch)
  // ===========================================================================

  describe('prospects.batchUpsert', () => {
    it('creates/updates multiple prospects', async () => {
      const batchResponse: BatchUpsertProspectResponse = {
        created: 2,
        updated: 1,
        failed: 0,
        errors: [],
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(batchResponse));

      const result = await railwayClient.prospects.batchUpsert({
        prospects: [
          { firstName: 'New', lastName: 'Person1', email: 'new1@test.com', companyName: 'TestCo' },
          { firstName: 'New', lastName: 'Person2', email: 'new2@test.com', companyName: 'TestCo' },
          { firstName: 'Update', lastName: 'Existing', email: 'john@acmelogistics.com', companyName: 'Acme' },
        ],
        updateOnConflict: true,
      });

      expect(result.ok).toBe(true);
      expect(result.data?.created).toBe(2);
      expect(result.data?.updated).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/prospects/batch'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('handles partial failures', async () => {
      const batchResponse: BatchUpsertProspectResponse = {
        created: 1,
        updated: 0,
        failed: 2,
        errors: [
          { index: 1, error: 'Invalid email' },
          { index: 2, error: 'Duplicate detected' },
        ],
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(batchResponse));

      const result = await railwayClient.prospects.batchUpsert({
        prospects: [
          { firstName: 'Good', lastName: 'Entry', email: 'good@test.com', companyName: 'Test' },
          { firstName: 'Bad', lastName: 'Email', email: 'invalid', companyName: 'Test' },
          { firstName: 'Dup', lastName: 'Entry', email: 'dup@test.com', companyName: 'Test' },
        ],
      });

      expect(result.ok).toBe(true);
      expect(result.data?.failed).toBe(2);
      expect(result.data?.errors).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Error Handling & Retries
  // ===========================================================================

  describe('error handling', () => {
    it('handles network timeout', async () => {
      mockFetch.mockImplementation(() => {
        const controller = new AbortController();
        controller.abort();
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      });

      const result = await railwayClient.prospects.list();

      expect(result.ok).toBe(false);
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await railwayClient.prospects.get('prospect-123');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });
});
