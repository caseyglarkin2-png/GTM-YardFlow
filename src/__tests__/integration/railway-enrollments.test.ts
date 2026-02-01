/**
 * Sprint 307: Railway Enrollment API Integration Tests
 * 
 * T307.4: Integration tests for Vercel → Railway enrollment operations.
 * Tests the full flow of enrollment management through the Railway proxy.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type {
  RailwayEnrollment,
  RailwayApiResult,
  CreateEnrollmentRequest,
  BulkEnrollResponse,
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

const mockEnrollment: RailwayEnrollment = {
  id: 'enroll-123',
  sequenceId: 'seq-456',
  prospectId: 'prospect-789',
  status: 'active',
  currentStepIndex: 1,
  totalSteps: 5,
  nextStepAt: '2026-02-02T10:00:00Z',
  completedAt: null,
  pausedAt: null,
  pauseReason: null,
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-30T10:00:00Z',
};

const mockEnrollment2: RailwayEnrollment = {
  ...mockEnrollment,
  id: 'enroll-456',
  prospectId: 'prospect-111',
  status: 'paused',
  pausedAt: '2026-01-28T10:00:00Z',
  pauseReason: 'Out of office detected',
  nextStepAt: null,
};

const mockCompletedEnrollment: RailwayEnrollment = {
  ...mockEnrollment,
  id: 'enroll-789',
  prospectId: 'prospect-222',
  status: 'completed',
  currentStepIndex: 5,
  completedAt: '2026-01-25T10:00:00Z',
  nextStepAt: null,
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

describe('Railway Enrollment API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // List Enrollments (GET /api/enrollments)
  // ===========================================================================

  describe('enrollments.list', () => {
    it('fetches all enrollments', async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse([mockEnrollment, mockEnrollment2, mockCompletedEnrollment])
      );

      const result = await railwayClient.enrollments.list();

      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/enrollments'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('filters by sequenceId', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse([mockEnrollment]));

      await railwayClient.enrollments.list({ sequenceId: 'seq-456' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('sequenceId=seq-456'),
        expect.anything()
      );
    });

    it('filters by prospectId', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse([mockEnrollment]));

      await railwayClient.enrollments.list({ prospectId: 'prospect-789' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('prospectId=prospect-789'),
        expect.anything()
      );
    });

    it('filters by status', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse([mockEnrollment2]));

      await railwayClient.enrollments.list({ status: 'paused' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=paused'),
        expect.anything()
      );
    });

    it('handles empty results', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse([]));

      const result = await railwayClient.enrollments.list({ status: 'cancelled' });

      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Get Enrollment (GET /api/enrollments/:id)
  // ===========================================================================

  describe('enrollments.get', () => {
    it('fetches single enrollment by ID', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockEnrollment));

      const result = await railwayClient.enrollments.get('enroll-123');

      expect(result.ok).toBe(true);
      expect(result.data?.id).toBe('enroll-123');
      expect(result.data?.status).toBe('active');
      expect(result.data?.currentStepIndex).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/enrollments/enroll-123'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('handles not found', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Enrollment not found', 404));

      const result = await railwayClient.enrollments.get('nonexistent-id');

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(404);
    });
  });

  // ===========================================================================
  // Create Enrollment (POST /api/enrollments)
  // ===========================================================================

  describe('enrollments.create', () => {
    it('creates a new enrollment', async () => {
      const createRequest: CreateEnrollmentRequest = {
        sequenceId: 'seq-456',
        prospectId: 'prospect-new',
      };

      const createdEnrollment: RailwayEnrollment = {
        ...mockEnrollment,
        id: 'enroll-new',
        prospectId: 'prospect-new',
        currentStepIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(createdEnrollment, 201));

      const result = await railwayClient.enrollments.create(createRequest);

      expect(result.ok).toBe(true);
      expect(result.data?.id).toBe('enroll-new');
      expect(result.data?.status).toBe('active');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/enrollments'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('prospect-new'),
        })
      );
    });

    it('handles duplicate enrollment', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse('Prospect already enrolled in this sequence', 409)
      );

      const result = await railwayClient.enrollments.create({
        sequenceId: 'seq-456',
        prospectId: 'prospect-789', // Already enrolled
      });

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(409);
    });

    it('handles invalid sequence', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Sequence not found', 404));

      const result = await railwayClient.enrollments.create({
        sequenceId: 'invalid-seq',
        prospectId: 'prospect-123',
      });

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(404);
    });
  });

  // ===========================================================================
  // Bulk Enroll (POST /api/enrollments/bulk)
  // ===========================================================================

  describe('enrollments.bulkEnroll', () => {
    it('enrolls multiple prospects at once', async () => {
      const bulkResponse: BulkEnrollResponse = {
        enrolled: 3,
        skipped: 0,
        failed: 0,
        errors: [],
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(bulkResponse));

      const result = await railwayClient.enrollments.bulkEnroll({
        sequenceId: 'seq-456',
        prospectIds: ['prospect-a', 'prospect-b', 'prospect-c'],
      });

      expect(result.ok).toBe(true);
      expect(result.data?.enrolled).toBe(3);
      expect(result.data?.skipped).toBe(0);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/enrollments/bulk'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('handles partial failures', async () => {
      const bulkResponse: BulkEnrollResponse = {
        enrolled: 2,
        skipped: 0,
        failed: 1,
        errors: [{ prospectId: 'prospect-c', error: 'Already enrolled' }],
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(bulkResponse));

      const result = await railwayClient.enrollments.bulkEnroll({
        sequenceId: 'seq-456',
        prospectIds: ['prospect-a', 'prospect-b', 'prospect-c'],
      });

      expect(result.ok).toBe(true);
      expect(result.data?.enrolled).toBe(2);
      expect(result.data?.failed).toBe(1);
      expect(result.data?.errors).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Pause Enrollment (POST /api/enrollments/:id/pause)
  // ===========================================================================

  describe('enrollments.pause', () => {
    it('pauses an active enrollment', async () => {
      const pausedEnrollment: RailwayEnrollment = {
        ...mockEnrollment,
        status: 'paused',
        pausedAt: new Date().toISOString(),
        pauseReason: 'Manual pause',
        nextStepAt: null,
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(pausedEnrollment));

      const result = await railwayClient.enrollments.pause('enroll-123', 'Manual pause');

      expect(result.ok).toBe(true);
      expect(result.data?.status).toBe('paused');
      expect(result.data?.pauseReason).toBe('Manual pause');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/enrollments/enroll-123/pause'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Manual pause'),
        })
      );
    });

    it('handles already paused enrollment', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Enrollment already paused', 400));

      const result = await railwayClient.enrollments.pause('enroll-456'); // Already paused

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('handles completed enrollment', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse('Cannot pause completed enrollment', 400)
      );

      const result = await railwayClient.enrollments.pause('enroll-789'); // Completed

      expect(result.ok).toBe(false);
    });
  });

  // ===========================================================================
  // Resume Enrollment (POST /api/enrollments/:id/resume)
  // ===========================================================================

  describe('enrollments.resume', () => {
    it('resumes a paused enrollment', async () => {
      const resumedEnrollment: RailwayEnrollment = {
        ...mockEnrollment2,
        status: 'active',
        pausedAt: null,
        pauseReason: null,
        nextStepAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(resumedEnrollment));

      const result = await railwayClient.enrollments.resume('enroll-456');

      expect(result.ok).toBe(true);
      expect(result.data?.status).toBe('active');
      expect(result.data?.pausedAt).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/enrollments/enroll-456/resume'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('handles already active enrollment', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Enrollment is not paused', 400));

      const result = await railwayClient.enrollments.resume('enroll-123'); // Already active

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(400);
    });
  });

  // ===========================================================================
  // Cancel Enrollment (DELETE /api/enrollments/:id)
  // ===========================================================================

  describe('enrollments.cancel', () => {
    it('cancels an enrollment', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(undefined, 204));

      const result = await railwayClient.enrollments.cancel('enroll-123');

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/enrollments/enroll-123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('handles cancel of completed enrollment', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse('Cannot cancel completed enrollment', 400)
      );

      const result = await railwayClient.enrollments.cancel('enroll-789');

      expect(result.ok).toBe(false);
    });

    it('handles not found', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Enrollment not found', 404));

      const result = await railwayClient.enrollments.cancel('nonexistent-id');

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(404);
    });
  });

  // ===========================================================================
  // State Machine Transitions
  // ===========================================================================

  describe('state machine transitions', () => {
    it('validates active → paused transition', async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({ ...mockEnrollment, status: 'paused' })
      );

      const result = await railwayClient.enrollments.pause('enroll-123');

      expect(result.ok).toBe(true);
      expect(result.data?.status).toBe('paused');
    });

    it('validates paused → active transition', async () => {
      mockFetch.mockResolvedValueOnce(
        mockSuccessResponse({ ...mockEnrollment2, status: 'active' })
      );

      const result = await railwayClient.enrollments.resume('enroll-456');

      expect(result.ok).toBe(true);
      expect(result.data?.status).toBe('active');
    });

    it('prevents invalid transitions (completed → paused)', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse('Cannot pause completed enrollment', 400)
      );

      const result = await railwayClient.enrollments.pause('enroll-789');

      expect(result.ok).toBe(false);
    });

    it('prevents invalid transitions (cancelled → resume)', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse('Cannot resume cancelled enrollment', 400)
      );

      const result = await railwayClient.enrollments.resume('cancelled-enroll');

      expect(result.ok).toBe(false);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('handles network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await railwayClient.enrollments.list();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('handles timeout', async () => {
      mockFetch.mockImplementation(() => {
        const controller = new AbortController();
        controller.abort();
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      });

      const result = await railwayClient.enrollments.get('enroll-123');

      expect(result.ok).toBe(false);
    });
  });
});
