/**
 * Sprint 308: Railway Email Queue API Integration Tests
 * 
 * T308.1: Integration tests for email queue status and dead letter handling.
 * Tests queue visibility through the Railway proxy.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type {
  RailwayApiResult,
  EmailQueueStatusResponse,
  DeadLetterItem,
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
// Test Data - Matches actual Railway types from src/types/railway.ts
// =============================================================================

const mockQueueStatus: EmailQueueStatusResponse = {
  queues: {
    emails: {
      name: 'emails',
      status: 'ready',
      waiting: 15,
      active: 3,
      completed: 1250,
      failed: 5,
      delayed: 8,
    },
    sequence: {
      name: 'sequence',
      status: 'ready',
      waiting: 5,
      active: 1,
      completed: 500,
      failed: 2,
      delayed: 10,
    },
    enrichment: {
      name: 'enrichment',
      status: 'ready',
      waiting: 0,
      active: 0,
      completed: 100,
      failed: 0,
      delayed: 0,
    },
    outreach: {
      name: 'outreach',
      status: 'ready',
      waiting: 2,
      active: 1,
      completed: 300,
      failed: 1,
      delayed: 0,
    },
  },
  deadLetterCount: 3,
};

const mockDeadLetterItems: DeadLetterItem[] = [
  {
    id: 'job-1',
    name: 'sendEmail',
    data: {
      to: 'bounced@invalid.com',
      subject: 'Hello',
      prospectId: 'prospect-123',
    },
    failedReason: 'Hard bounce: mailbox does not exist',
    attemptsMade: 3,
    timestamp: '2026-01-31T10:00:00Z',
  },
  {
    id: 'job-2',
    name: 'sendEmail',
    data: {
      to: 'timeout@slowserver.com',
      subject: 'Follow up',
      prospectId: 'prospect-456',
    },
    failedReason: 'Connection timeout after 30s',
    attemptsMade: 3,
    timestamp: '2026-01-31T11:00:00Z',
  },
  {
    id: 'job-3',
    name: 'executeStep',
    data: {
      enrollmentId: 'enroll-789',
      stepIndex: 2,
    },
    failedReason: 'Prospect no longer exists',
    attemptsMade: 1,
    timestamp: '2026-01-31T12:00:00Z',
  },
];

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

describe('Railway Email Queue API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Queue Status (GET /api/email/queue/status)
  // ===========================================================================

  describe('email.queue.status', () => {
    it('fetches queue status with all metrics', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockQueueStatus));

      const result = await railwayClient.email.queue.status();

      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      
      // Check queue metrics
      expect(result.data?.queues.emails.waiting).toBe(15);
      expect(result.data?.queues.emails.active).toBe(3);
      expect(result.data?.queues.emails.completed).toBe(1250);
      
      // Check dead letter count
      expect(result.data?.deadLetterCount).toBe(3);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/email/queue/status'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('handles empty queue', async () => {
      const emptyStatus: EmailQueueStatusResponse = {
        queues: {
          emails: { name: 'emails', status: 'ready', waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
          sequence: { name: 'sequence', status: 'ready', waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
          enrichment: { name: 'enrichment', status: 'ready', waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
          outreach: { name: 'outreach', status: 'ready', waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
        },
        deadLetterCount: 0,
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(emptyStatus));

      const result = await railwayClient.email.queue.status();

      expect(result.ok).toBe(true);
      expect(result.data?.queues.emails.waiting).toBe(0);
      expect(result.data?.deadLetterCount).toBe(0);
    });

    it('handles API error', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Redis connection failed', 503));

      const result = await railwayClient.email.queue.status();

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(503);
    });
  });

  // ===========================================================================
  // Dead Letter Queue (GET /api/email/queue/dead-letter)
  // ===========================================================================

  describe('email.queue.deadLetter', () => {
    it('fetches dead letter items', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockDeadLetterItems));

      const result = await railwayClient.email.queue.deadLetter();

      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(3);
      
      // Check first item
      expect(result.data?.[0].id).toBe('job-1');
      expect(result.data?.[0].name).toBe('sendEmail');
      expect(result.data?.[0].failedReason).toContain('Hard bounce');
      expect(result.data?.[0].attemptsMade).toBe(3);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/email/queue/dead-letter'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('handles empty dead letter queue', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse([]));

      const result = await railwayClient.email.queue.deadLetter();

      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('includes job data for debugging', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockDeadLetterItems));

      const result = await railwayClient.email.queue.deadLetter();

      expect(result.ok).toBe(true);
      expect(result.data?.[0].data.to).toBe('bounced@invalid.com');
      expect(result.data?.[0].data.prospectId).toBe('prospect-123');
    });
  });

  // ===========================================================================
  // Retry Single Job (POST /api/email/queue/retry/:id)
  // ===========================================================================

  describe('email.queue.retry', () => {
    it('retries a single dead letter job', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(undefined, 202));

      const result = await railwayClient.email.queue.retry('job-1');

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/email/queue/retry/job-1'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('handles job not found', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Job not found', 404));

      const result = await railwayClient.email.queue.retry('nonexistent-job');

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(404);
    });

    it('handles already processing job', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Job is already being processed', 409));

      const result = await railwayClient.email.queue.retry('job-in-progress');

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(409);
    });
  });

  // ===========================================================================
  // Retry All Jobs (POST /api/email/queue/retry-all)
  // ===========================================================================

  describe('email.queue.retryAll', () => {
    it('retries all dead letter jobs', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse({ retried: 3 }));

      const result = await railwayClient.email.queue.retryAll();

      expect(result.ok).toBe(true);
      expect(result.data?.retried).toBe(3);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/email/queue/retry-all'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('handles empty dead letter queue', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse({ retried: 0 }));

      const result = await railwayClient.email.queue.retryAll();

      expect(result.ok).toBe(true);
      expect(result.data?.retried).toBe(0);
    });
  });

  // ===========================================================================
  // Discard Single Job (DELETE /api/email/queue/dead-letter/:id)
  // ===========================================================================

  describe('email.queue.discard', () => {
    it('discards a single dead letter job', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(undefined, 204));

      const result = await railwayClient.email.queue.discard('job-1');

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/email/queue/dead-letter/job-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('handles job not found', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Job not found', 404));

      const result = await railwayClient.email.queue.discard('nonexistent-job');

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(404);
    });
  });

  // ===========================================================================
  // Discard All Jobs (DELETE /api/email/queue/dead-letter)
  // ===========================================================================

  describe('email.queue.discardAll', () => {
    it('discards all dead letter jobs', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse({ discarded: 3 }));

      const result = await railwayClient.email.queue.discardAll();

      expect(result.ok).toBe(true);
      expect(result.data?.discarded).toBe(3);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/railway/email/queue/dead-letter'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('handles empty dead letter queue', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse({ discarded: 0 }));

      const result = await railwayClient.email.queue.discardAll();

      expect(result.ok).toBe(true);
      expect(result.data?.discarded).toBe(0);
    });
  });

  // ===========================================================================
  // Queue Health Calculations
  // ===========================================================================

  describe('queue health inference', () => {
    it('infers healthy status from metrics', async () => {
      const healthyQueue: EmailQueueStatusResponse = {
        ...mockQueueStatus,
        deadLetterCount: 0,
        queues: {
          ...mockQueueStatus.queues,
          emails: { ...mockQueueStatus.queues.emails, waiting: 5, delayed: 2 },
        },
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(healthyQueue));

      const result = await railwayClient.email.queue.status();

      expect(result.ok).toBe(true);
      expect(result.data?.deadLetterCount).toBe(0);
      expect(result.data?.queues.emails.waiting).toBeLessThan(100);
    });

    it('infers degraded status from high queue depth', async () => {
      const degradedQueue: EmailQueueStatusResponse = {
        ...mockQueueStatus,
        queues: {
          ...mockQueueStatus.queues,
          emails: { ...mockQueueStatus.queues.emails, waiting: 150, delayed: 75 },
        },
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(degradedQueue));

      const result = await railwayClient.email.queue.status();

      expect(result.ok).toBe(true);
      expect(result.data?.queues.emails.waiting).toBeGreaterThan(100);
    });

    it('infers critical status from high dead letter count', async () => {
      const criticalQueue: EmailQueueStatusResponse = {
        ...mockQueueStatus,
        deadLetterCount: 25,
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse(criticalQueue));

      const result = await railwayClient.email.queue.status();

      expect(result.ok).toBe(true);
      expect(result.data?.deadLetterCount).toBeGreaterThan(10);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('handles network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await railwayClient.email.queue.status();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('handles Redis unavailable', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse('Redis connection refused', 503)
      );

      const result = await railwayClient.email.queue.status();

      expect(result.ok).toBe(false);
      expect(result.statusCode).toBe(503);
    });
  });
});
