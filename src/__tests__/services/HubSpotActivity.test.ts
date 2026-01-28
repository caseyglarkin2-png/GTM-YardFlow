/**
 * HubSpot Activity Logger Tests
 * Sprint 26 - T26.7
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createActivityLogger, 
  type ActivityLogEntry 
} from '../../services/HubSpotActivityLogger';
import type { HubSpotClient } from '../../services/HubSpotClient';

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageMock.store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageMock.store[key]; }),
  clear: vi.fn(() => { localStorageMock.store = {}; }),
};
vi.stubGlobal('localStorage', localStorageMock);

describe('HubSpot Activity Logger - T26.7', () => {
  let mockClient: HubSpotClient;
  let logger: ReturnType<typeof createActivityLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    mockClient = {
      createNote: vi.fn().mockResolvedValue({ id: 'note-123', type: 'NOTE' }),
      createTask: vi.fn().mockResolvedValue({ id: 'task-123', type: 'TASK' }),
      logEmail: vi.fn().mockResolvedValue({ id: 'email-123', type: 'EMAIL' }),
      getContacts: vi.fn(),
      getContact: vi.fn(),
      createContact: vi.fn(),
      updateContact: vi.fn(),
      searchContacts: vi.fn(),
      getDeals: vi.fn(),
      getDeal: vi.fn(),
      createDeal: vi.fn(),
      updateDeal: vi.fn(),
      associateContactToDeal: vi.fn(),
      batchCreateContacts: vi.fn(),
      getRateLimitStatus: vi.fn(),
      invalidateCache: vi.fn(),
    } as unknown as HubSpotClient;

    logger = createActivityLogger(mockClient);
  });

  describe('logActivity', () => {
    it('should log email activity', async () => {
      const activity: ActivityLogEntry = {
        id: 'act-1',
        type: 'email_sent',
        contactId: 'hs-contact-123',
        timestamp: '2026-01-28T10:00:00Z',
        subject: 'Test Email',
        body: 'Email body content',
      };

      const result = await logger.logActivity(activity);

      expect(result.success).toBe(true);
      expect(result.engagementId).toBe('email-123');
      expect(mockClient.logEmail).toHaveBeenCalledWith('hs-contact-123', {
        subject: 'Test Email',
        body: 'Email body content',
      });
    });

    it('should log note activity', async () => {
      const activity: ActivityLogEntry = {
        id: 'act-2',
        type: 'note_added',
        contactId: 'hs-contact-123',
        timestamp: '2026-01-28T10:00:00Z',
        body: 'This is a note',
      };

      const result = await logger.logActivity(activity);

      expect(result.success).toBe(true);
      expect(mockClient.createNote).toHaveBeenCalled();
    });

    it('should log task completion', async () => {
      const activity: ActivityLogEntry = {
        id: 'act-3',
        type: 'task_completed',
        contactId: 'hs-contact-123',
        timestamp: '2026-01-28T10:00:00Z',
        subject: 'Follow up call',
      };

      const result = await logger.logActivity(activity);

      expect(result.success).toBe(true);
      expect(mockClient.createTask).toHaveBeenCalled();
    });

    it('should handle API error', async () => {
      vi.mocked(mockClient.createNote).mockRejectedValueOnce(new Error('API Error'));

      const activity: ActivityLogEntry = {
        id: 'act-error',
        type: 'note_added',
        contactId: 'hs-contact-123',
        timestamp: '2026-01-28T10:00:00Z',
        body: 'Test',
      };

      const result = await logger.logActivity(activity);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });

  describe('Deduplication', () => {
    it('should skip duplicate activities', async () => {
      const activity: ActivityLogEntry = {
        id: 'act-dupe',
        type: 'email_sent',
        contactId: 'hs-contact-123',
        timestamp: '2026-01-28T10:00:00Z',
        subject: 'Test',
        body: 'Body',
      };

      // First call - should succeed
      const result1 = await logger.logActivity(activity);
      expect(result1.success).toBe(true);
      expect(result1.skipped).toBeFalsy();

      // Second call - same activity should be skipped
      const result2 = await logger.logActivity(activity);
      expect(result2.success).toBe(true);
      expect(result2.skipped).toBe(true);
      expect(result2.reason).toContain('Duplicate');

      // logEmail should only be called once
      expect(mockClient.logEmail).toHaveBeenCalledTimes(1);
    });

    it('should allow same type for different contacts', async () => {
      const activity1: ActivityLogEntry = {
        id: 'act-1',
        type: 'email_sent',
        contactId: 'hs-contact-1',
        timestamp: '2026-01-28T10:00:00Z',
        subject: 'Test',
        body: 'Body',
      };

      const activity2: ActivityLogEntry = {
        ...activity1,
        id: 'act-2',
        contactId: 'hs-contact-2',
      };

      await logger.logActivity(activity1);
      const result2 = await logger.logActivity(activity2);

      expect(result2.success).toBe(true);
      expect(result2.skipped).toBeFalsy();
      expect(mockClient.logEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('Queue Operations', () => {
    it('should queue activities', () => {
      const activity: ActivityLogEntry = {
        id: 'act-queue',
        type: 'note_added',
        contactId: 'hs-contact-123',
        timestamp: '2026-01-28T10:00:00Z',
        body: 'Queued note',
      };

      logger.queueActivity(activity);

      expect(logger._getQueue()).toHaveLength(1);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should queue multiple activities', () => {
      const activities: ActivityLogEntry[] = [
        {
          id: 'act-1',
          type: 'email_sent',
          contactId: 'hs-1',
          timestamp: '2026-01-28T10:00:00Z',
          body: 'Email 1',
        },
        {
          id: 'act-2',
          type: 'email_sent',
          contactId: 'hs-2',
          timestamp: '2026-01-28T10:01:00Z',
          body: 'Email 2',
        },
      ];

      logger.queueActivities(activities);

      expect(logger._getQueue()).toHaveLength(2);
    });

    it('should flush queue and log all activities', async () => {
      const activities: ActivityLogEntry[] = Array.from({ length: 5 }, (_, i) => ({
        id: `act-${i}`,
        type: 'note_added' as const,
        contactId: `hs-${i}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        body: `Note ${i}`,
      }));

      logger.queueActivities(activities);

      const result = await logger.flushQueue();

      expect(result.total).toBe(5);
      expect(result.successful).toBe(5);
      expect(result.failed).toBe(0);
      expect(logger._getQueue()).toHaveLength(0);
    });

    it('should retry failed activities', async () => {
      vi.mocked(mockClient.createNote)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue({ id: 'note-retry', type: 'NOTE', properties: { hs_timestamp: new Date().toISOString() }, createdAt: '', updatedAt: '' });

      const activity: ActivityLogEntry = {
        id: 'act-retry',
        type: 'note_added',
        contactId: 'hs-retry',
        timestamp: '2026-01-28T10:00:00Z',
        body: 'Retry note',
      };

      logger.queueActivity(activity);

      // First flush - should fail
      const result1 = await logger.flushQueue();
      expect(result1.successful).toBe(0);
      expect(logger._getQueue()).toHaveLength(1);

      // Second flush - should succeed
      const result2 = await logger.flushQueue();
      expect(result2.successful).toBe(1);
      expect(logger._getQueue()).toHaveLength(0);
    });

    it('should stop retrying after max retries', async () => {
      vi.mocked(mockClient.createNote).mockRejectedValue(new Error('Persistent error'));

      const activity: ActivityLogEntry = {
        id: 'act-fail',
        type: 'note_added',
        contactId: 'hs-fail',
        timestamp: '2026-01-28T10:00:00Z',
        body: 'Failing note',
      };

      logger.queueActivity(activity);

      // Flush 3 times (default maxRetries)
      await logger.flushQueue();
      await logger.flushQueue();
      const result = await logger.flushQueue();

      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].activityId).toBe('act-fail');
    });
  });

  describe('Queue Status', () => {
    it('should report queue status', () => {
      const activities: ActivityLogEntry[] = [
        { id: 'act-1', type: 'note_added', contactId: 'hs-1', timestamp: '2026-01-28T10:00:00Z', body: 'Note 1' },
        { id: 'act-2', type: 'note_added', contactId: 'hs-2', timestamp: '2026-01-28T10:01:00Z', body: 'Note 2' },
      ];

      logger.queueActivities(activities);

      const status = logger.getQueueStatus();

      expect(status.queueLength).toBe(2);
      expect(status.oldestItem).not.toBeNull();
      expect(status.failedItems).toBe(0);
    });

    it('should clear queue', () => {
      logger.queueActivity({
        id: 'act-clear',
        type: 'note_added',
        contactId: 'hs-clear',
        timestamp: '2026-01-28T10:00:00Z',
        body: 'To be cleared',
      });

      expect(logger._getQueue()).toHaveLength(1);

      logger.clearQueue();

      expect(logger._getQueue()).toHaveLength(0);
    });
  });

  describe('Convenience Methods', () => {
    it('should log email sent', async () => {
      const result = await logger.logEmailSent(
        'hs-contact-123',
        'Follow up',
        'Thanks for the call!',
        'John'
      );

      expect(result.success).toBe(true);
      expect(mockClient.logEmail).toHaveBeenCalled();
    });

    it('should log call', async () => {
      const result = await logger.logCall(
        'hs-contact-123',
        'Interested',
        'Good call, scheduling demo',
        'John'
      );

      expect(result.success).toBe(true);
      expect(mockClient.createNote).toHaveBeenCalled();
    });

    it('should log note', async () => {
      const result = await logger.logNote(
        'hs-contact-123',
        'Met at trade show',
        'Jane'
      );

      expect(result.success).toBe(true);
      expect(mockClient.createNote).toHaveBeenCalled();
    });

    it('should log DM copied', async () => {
      const result = await logger.logDmCopied(
        'hs-contact-123',
        'LinkedIn',
        'Hi, I noticed you...',
        'John'
      );

      expect(result.success).toBe(true);
    });

    it('should log sequence events', async () => {
      const startResult = await logger.logSequenceEvent(
        'hs-contact-123',
        'started',
        'Outbound Sequence v2',
        'John'
      );

      expect(startResult.success).toBe(true);

      const completeResult = await logger.logSequenceEvent(
        'hs-contact-456',
        'completed',
        'Outbound Sequence v2',
        'John'
      );

      expect(completeResult.success).toBe(true);
    });
  });

  describe('Batch Processing', () => {
    it('should process activities in batches', async () => {
      // Create 60 activities (should process in 2 batches of 50+10)
      const activities: ActivityLogEntry[] = Array.from({ length: 60 }, (_, i) => ({
        id: `act-batch-${i}`,
        type: 'note_added' as const,
        contactId: `hs-${i}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        body: `Batch note ${i}`,
      }));

      logger.queueActivities(activities);

      const result = await logger.flushQueue();

      expect(result.total).toBe(60);
      expect(result.successful).toBe(60);
      expect(mockClient.createNote).toHaveBeenCalledTimes(60);
    });
  });
});
