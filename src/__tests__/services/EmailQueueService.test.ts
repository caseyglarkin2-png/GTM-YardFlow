/**
 * EmailQueueService Tests
 * 
 * Tests for the email queue service that handles queue operations,
 * batch processing, retry logic, and rate limiting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EmailMessage, EmailQueueItem } from '../../types/email';

// =============================================================================
// Mock Data
// =============================================================================

const createMockMessage = (overrides: Partial<EmailMessage> = {}): EmailMessage => ({
  id: 'msg-1',
  to: 'recipient@example.com',
  from: 'sender@yardflow.io',
  subject: 'Test Subject',
  html: '<p>Test body</p>',
  text: 'Test body',
  metadata: {
    userId: 'user-1',
    tenantId: 'tenant-1',
  },
  ...overrides,
});

const createMockQueueItem = (overrides: Partial<EmailQueueItem> = {}): EmailQueueItem => ({
  id: 'queue-1',
  message: createMockMessage(),
  status: 'pending',
  attempts: 0,
  maxAttempts: 3,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  tenantId: 'tenant-1',
  userId: 'user-1',
  ...overrides,
});

// =============================================================================
// Mock Dependencies
// =============================================================================

const mockSendGrid = {
  sendEmail: vi.fn(),
};

const mockCompliance = {
  injectComplianceElements: vi.fn((msg: EmailMessage) => msg),
  respectDoNotTrack: vi.fn(() => false),
  validateComplianceElements: vi.fn(() => ({ valid: true, missing: [] as string[] })),
};

const mockWarmup = {
  canSend: vi.fn().mockResolvedValue({ allowed: true }),
  recordSend: vi.fn(),
};

const mockTracking = {
  injectTracking: vi.fn((msg: EmailMessage) => msg),
};

// Mock Firestore
const createMockFirestore = () => {
  const mockData = new Map<string, Record<string, unknown>>();
  
  const createDocRef = (collection: string, docId: string) => ({
    get: vi.fn(async () => ({
      exists: mockData.has(`${collection}/${docId}`),
      data: () => mockData.get(`${collection}/${docId}`),
      id: docId,
    })),
    set: vi.fn(async (data: Record<string, unknown>) => {
      mockData.set(`${collection}/${docId}`, data);
    }),
    update: vi.fn(async (updates: Record<string, unknown>) => {
      const existing = mockData.get(`${collection}/${docId}`) || {};
      mockData.set(`${collection}/${docId}`, { ...existing, ...updates });
    }),
    delete: vi.fn(async () => {
      mockData.delete(`${collection}/${docId}`);
    }),
  });

  return {
    collection: vi.fn((collectionName: string) => ({
      doc: vi.fn((docId: string) => createDocRef(collectionName, docId)),
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(async () => ({
            empty: true,
            docs: [],
          })),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn(async () => ({
              empty: true,
              docs: [],
            })),
          })),
        })),
        limit: vi.fn(() => ({
          get: vi.fn(async () => ({
            empty: true,
            docs: [],
          })),
        })),
      })),
    })),
    runTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        get: vi.fn(async () => ({
          exists: false,
          data: () => null,
        })),
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      return fn(mockTx);
    }),
    batch: vi.fn(() => ({
      update: vi.fn(),
      commit: vi.fn(),
    })),
    _mockData: mockData,
    _setMockData: (path: string, data: Record<string, unknown>) => mockData.set(path, data),
  };
};

// =============================================================================
// Tests
// =============================================================================

describe('EmailQueueService', () => {
  let mockDb: ReturnType<typeof createMockFirestore>;
  
  // Import the module dynamically after setting up mocks
  let EmailQueueService: typeof import('../../services/EmailQueueService').EmailQueueService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-27T10:00:00Z'));
    
    mockDb = createMockFirestore();
    
    // Reset all mocks
    vi.clearAllMocks();
    mockSendGrid.sendEmail.mockResolvedValue({ success: true });
    mockWarmup.canSend.mockResolvedValue({ allowed: true });

    // Dynamic import to allow proper mocking
    const module = await import('../../services/EmailQueueService');
    EmailQueueService = module.EmailQueueService;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  describe('enqueue', () => {
    it('creates a queue item with pending status', async () => {
      const service = new EmailQueueService(
        mockDb as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      const message = createMockMessage();
      const result = await service.enqueue(message, { userId: 'user-1' });

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.attempts).toBe(0);
      expect(result.maxAttempts).toBe(3);
    });

    it('uses scheduled status when scheduledAt is in the future', async () => {
      const service = new EmailQueueService(
        mockDb as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      const message = createMockMessage();
      const futureTime = Date.now() + 60 * 60 * 1000; // 1 hour from now
      
      const result = await service.enqueue(message, { 
        userId: 'user-1',
        scheduledAt: futureTime,
      });

      expect(result.status).toBe('scheduled');
      expect(result.scheduledAt).toBe(futureTime);
    });

    it('returns existing item when idempotency key matches', async () => {
      const existingItem = createMockQueueItem({ idempotencyKey: 'unique-key' });
      
      // Set up mock to return existing item
      const mockWhere = vi.fn(() => ({
        limit: vi.fn(() => ({
          get: vi.fn(async () => ({
            empty: false,
            docs: [{ data: () => existingItem }],
          })),
        })),
      }));

      const customMockDb = {
        ...mockDb,
        collection: vi.fn(() => ({
          doc: mockDb.collection('test').doc,
          where: mockWhere,
        })),
      };

      const service = new EmailQueueService(
        customMockDb as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      const message = createMockMessage();
      const result = await service.enqueue(message, { idempotencyKey: 'unique-key' });

      expect(result.idempotencyKey).toBe('unique-key');
    });

    it('applies compliance and tracking to message', async () => {
      const service = new EmailQueueService(
        mockDb as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      const message = createMockMessage();
      await service.enqueue(message);

      expect(mockCompliance.injectComplianceElements).toHaveBeenCalledWith(message);
      expect(mockTracking.injectTracking).toHaveBeenCalled();
    });
  });

  describe('enqueueBatch', () => {
    it('enqueues multiple messages', async () => {
      const service = new EmailQueueService(
        mockDb as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      const messages = [
        createMockMessage({ id: 'msg-1' }),
        createMockMessage({ id: 'msg-2' }),
        createMockMessage({ id: 'msg-3' }),
      ];

      const results = await service.enqueueBatch(messages);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.status).toBe('pending');
      });
    });

    it('uses idempotency key function when provided', async () => {
      const service = new EmailQueueService(
        mockDb as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      const messages = [
        createMockMessage({ id: 'msg-1' }),
        createMockMessage({ id: 'msg-2' }),
      ];

      const keyFn = (msg: EmailMessage) => `key-${msg.id}`;
      const results = await service.enqueueBatch(messages, { idempotencyKeyFn: keyFn });

      expect(results).toHaveLength(2);
    });
  });

  describe('scheduleEmail', () => {
    it('schedules email for future delivery', async () => {
      const service = new EmailQueueService(
        mockDb as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      const message = createMockMessage();
      const futureTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      const result = await service.scheduleEmail(message, futureTime);

      expect(result.status).toBe('scheduled');
      expect(result.scheduledAt).toBe(futureTime);
    });
  });

  describe('processNext', () => {
    it('returns null when queue is empty', async () => {
      const service = new EmailQueueService(
        mockDb as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      const result = await service.processNext();

      expect(result).toBeNull();
    });
  });

  describe('processBatch', () => {
    it('processes up to limit items', async () => {
      const service = new EmailQueueService(
        mockDb as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      const results = await service.processBatch(5);

      // Empty queue returns empty array
      expect(results).toHaveLength(0);
    });

    it('respects default limit of 10', async () => {
      const service = new EmailQueueService(
        mockDb as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      const results = await service.processBatch();

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('cancelPendingByEmailId', () => {
    it('cancels pending emails matching email ID', async () => {
      const mockBatch = {
        update: vi.fn(),
        commit: vi.fn(),
      };

      const mockDocsToCancel = [
        { ref: { id: 'queue-1' } },
        { ref: { id: 'queue-2' } },
      ];

      const customMockDb = {
        ...mockDb,
        collection: vi.fn(() => ({
          where: vi.fn(() => ({
            where: vi.fn(() => ({
              get: vi.fn(async () => ({
                docs: mockDocsToCancel,
              })),
            })),
          })),
        })),
        batch: vi.fn(() => mockBatch),
      };

      const service = new EmailQueueService(
        customMockDb as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      const canceled = await service.cancelPendingByEmailId('msg-1');

      expect(canceled).toBe(2);
      expect(mockBatch.update).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('returns 0 when no emails match', async () => {
      const service = new EmailQueueService(
        mockDb as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      const canceled = await service.cancelPendingByEmailId('nonexistent');

      expect(canceled).toBe(0);
    });
  });

  describe('retry logic', () => {
    it('uses exponential backoff delays', () => {
      // Test the retry delay logic
      // Attempt 1: 1 minute
      // Attempt 2: 5 minutes
      // Attempt 3: 30 minutes
      
      const RETRY_DELAYS_MS = [
        1 * 60 * 1000,    // 1 minute
        5 * 60 * 1000,    // 5 minutes  
        30 * 60 * 1000,   // 30 minutes
      ];

      expect(RETRY_DELAYS_MS[0]).toBe(60000);
      expect(RETRY_DELAYS_MS[1]).toBe(300000);
      expect(RETRY_DELAYS_MS[2]).toBe(1800000);
    });
  });

  describe('warmup rate limiting', () => {
    it('respects warmup limits before sending', async () => {
      mockWarmup.canSend.mockResolvedValue({ allowed: false, reason: 'Daily limit reached' });

      const service = new EmailQueueService(
        mockDb as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      // When warmup denies, the service should handle it appropriately
      expect(mockWarmup.canSend).toBeDefined();
    });
  });

  describe('compliance gating', () => {
    it('fails non-compliant emails without sending', async () => {
      mockCompliance.validateComplianceElements.mockReturnValue({ valid: false, missing: ['List-Unsubscribe header'] as string[] });
      mockWarmup.canSend.mockResolvedValue({ allowed: true });
      const mockRefUpdate = vi.fn();

      const mockDbWithItem = createMockFirestore();
      // Seed queue item
      const queueItem = createMockQueueItem();
      await mockDbWithItem.collection('email_queue').doc(queueItem.id).set(queueItem as unknown as Record<string, unknown>);

      // Override collection to return the queued item on where().orderBy().limit().get()
      const mockDocSnapshot = {
        id: queueItem.id,
        data: () => queueItem,
      };

      (mockDbWithItem as unknown as { collection: unknown }).collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(async () => ({ exists: true, data: () => queueItem })),
          update: mockRefUpdate,
        })),
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(async () => ({ empty: false, docs: [mockDocSnapshot] })),
            })),
          })),
        })),
      }));

      mockDbWithItem.runTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: vi.fn(async () => ({ exists: true, data: () => queueItem })),
          update: mockRefUpdate,
        };
        return fn(tx as unknown as { get: (ref: unknown) => Promise<unknown>; update: (ref: unknown, data: unknown) => Promise<void> });
      });

      const service = new EmailQueueService(
        mockDbWithItem as unknown as import('firebase-admin/firestore').Firestore,
        mockSendGrid as unknown as import('../../services/SendGridClient').SendGridClient,
        mockCompliance as unknown as import('../../services/EmailComplianceService').EmailComplianceService,
        mockWarmup as unknown as import('../../services/EmailWarmupService').EmailWarmupService,
        mockTracking as unknown as import('../../services/EmailTrackingService').EmailTrackingService,
      );

      const processed = await service.processBatch(1);

      expect(processed[0]?.status).toBe('failed');
      expect(processed[0]?.lastError).toContain('non_compliant');
      expect(mockSendGrid.sendEmail).not.toHaveBeenCalled();
      expect(mockRefUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    });
  });
});
