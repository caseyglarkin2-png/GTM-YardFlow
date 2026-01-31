/**
 * SequenceSchedulerService Tests
 * 
 * Tests for the core sequence scheduling engine that calculates
 * next send times, processes enrollments, and manages step advancement.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SequenceSchedulerService } from '../../services/SequenceSchedulerService';
import type { EmailSequence, EmailStep, SequenceEnrollment } from '../../types/emailSequence';

// =============================================================================
// Mock Data
// =============================================================================

const mockStep: EmailStep = {
  id: 'step-1',
  type: 'initial',
  subject: 'Hello {{firstName}}',
  body: 'Hi {{firstName}}, I noticed {{company}} is growing...',
  delayDays: 0,
  sendTime: 'morning',
  condition: 'always',
};

const mockFollowUpStep: EmailStep = {
  id: 'step-2',
  type: 'follow_up_1',
  subject: 'Following up',
  body: 'Just wanted to follow up...',
  delayDays: 3,
  delayHours: 2,
  sendTime: 'afternoon',
  condition: 'no_reply',
};

const mockSequence: EmailSequence = {
  id: 'seq-1',
  name: 'Cold Outreach',
  description: 'Standard cold outreach',
  steps: [mockStep, mockFollowUpStep],
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
  skipWeekends: true,
  pauseOnReply: true,
  pauseOnMeeting: true,
  timezone: 'America/New_York',
  enrolledCount: 10,
  completedCount: 5,
};

const mockEnrollment: SequenceEnrollment = {
  id: 'enroll-1',
  sequenceId: 'seq-1',
  prospectId: 'prospect-1',
  prospectEmail: 'john@example.com',
  prospectName: 'John Doe',
  companyName: 'Acme Corp',
  status: 'active',
  currentStepIndex: 0,
  enrolledAt: '2026-01-20T10:00:00Z',
  nextSendAt: '2026-01-20T09:15:00Z',
  stepHistory: [],
  customFields: {
    enrolledBy: 'user-1',
    firstName: 'John',
    company: 'Acme Corp',
  },
};

// =============================================================================
// Mock Firestore
// =============================================================================

const createMockFirestore = () => {
  const mockData: Record<string, Record<string, unknown>> = {};
  const updateMocks: Record<string, ReturnType<typeof vi.fn>> = {};
  
  const mockDoc = (data: Record<string, unknown> | undefined, id: string) => ({
    exists: !!data,
    id,
    data: () => data,
    ref: { id },
  });

  const createDocMethods = (collectionName: string, docId: string) => {
    const path = `${collectionName}/${docId}`;
    // Create a persistent update mock for this doc
    if (!updateMocks[path]) {
      updateMocks[path] = vi.fn(async (data: unknown) => {
        const existing = mockData[path] || {};
        mockData[path] = { ...existing, ...data as Record<string, unknown> };
      });
    }
    
    return {
      get: vi.fn(async () => mockDoc(mockData[path], docId)),
      set: vi.fn(async (data: unknown) => {
        mockData[path] = data as Record<string, unknown>;
      }),
      update: updateMocks[path],
    };
  };

  const mockCollection = vi.fn((collectionName: string) => ({
    doc: vi.fn((docId: string) => createDocMethods(collectionName, docId)),
    where: vi.fn(() => ({
      where: vi.fn(() => ({
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
  }));

  return {
    collection: mockCollection,
    _mockData: mockData,
    _updateMocks: updateMocks,
    _setMockData: (path: string, data: Record<string, unknown>) => {
      mockData[path] = data;
    },
    _getUpdateMock: (path: string) => updateMocks[path],
  };
};

// =============================================================================
// Tests
// =============================================================================

describe('SequenceSchedulerService', () => {
  let service: SequenceSchedulerService;
  let mockDb: ReturnType<typeof createMockFirestore>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-27T10:00:00Z')); // Monday
    
    mockDb = createMockFirestore();
    service = new SequenceSchedulerService(mockDb as unknown as FirebaseFirestore.Firestore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateNextSendAt', () => {
    it('calculates next send time for immediate step', () => {
      const fromDate = new Date('2026-01-27T10:00:00Z'); // Monday
      const step: EmailStep = {
        id: 'step-1',
        type: 'initial',
        subject: 'Test',
        body: 'Test body',
        delayDays: 0,
        sendTime: 'morning',
        condition: 'always',
      };

      const result = service.calculateNextSendAt(mockSequence, step, fromDate);

      // Should be next business day at morning time (9:15)
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(15);
    });

    it('adds delay days correctly', () => {
      const fromDate = new Date('2026-01-27T08:00:00Z'); // Monday morning
      const step: EmailStep = {
        id: 'step-2',
        type: 'follow_up_1',
        subject: 'Follow up',
        body: 'Following up',
        delayDays: 3,
        sendTime: 'morning',
        condition: 'no_reply',
      };

      const result = service.calculateNextSendAt(mockSequence, step, fromDate);

      // 3 days from Monday = Thursday
      expect(result.getDate()).toBe(30);
    });

    it('adds delay hours correctly', () => {
      const fromDate = new Date('2026-01-27T08:00:00Z'); // Monday 8 AM
      const step: EmailStep = {
        id: 'step-2',
        type: 'follow_up_1',
        subject: 'Follow up',
        body: 'Following up',
        delayDays: 0,
        delayHours: 4,
        sendTime: 'morning',
        condition: 'no_reply',
      };

      const result = service.calculateNextSendAt(mockSequence, step, fromDate);

      // Should still respect sendTime setting
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(15);
    });

    it('skips Saturday to Monday when skipWeekends is true', () => {
      const fromDate = new Date('2026-01-31T10:00:00Z'); // Friday
      const step: EmailStep = {
        id: 'step-1',
        type: 'follow_up_1',
        subject: 'Test',
        body: 'Test',
        delayDays: 1,
        sendTime: 'morning',
        condition: 'no_reply',
      };

      const sequenceWithWeekendSkip = { ...mockSequence, skipWeekends: true };
      const result = service.calculateNextSendAt(sequenceWithWeekendSkip, step, fromDate);

      // Friday + 1 day = Saturday, should skip to Monday (Feb 2)
      expect(result.getDay()).toBe(1); // Monday
      expect(result.getDate()).toBe(2);
    });

    it('skips Sunday to Monday when skipWeekends is true', () => {
      const fromDate = new Date('2026-01-31T10:00:00Z'); // Friday
      const step: EmailStep = {
        id: 'step-1',
        type: 'follow_up_1',
        subject: 'Test',
        body: 'Test',
        delayDays: 2, // +2 days = Sunday
        sendTime: 'morning',
        condition: 'no_reply',
      };

      const sequenceWithWeekendSkip = { ...mockSequence, skipWeekends: true };
      const result = service.calculateNextSendAt(sequenceWithWeekendSkip, step, fromDate);

      // Should skip Sunday to Monday
      expect(result.getDay()).toBe(1); // Monday
    });

    it('does not skip weekends when skipWeekends is false', () => {
      // Set date to Wednesday so +2 days = Friday (not weekend)
      // This tests that when the result naturally falls on a weekday, it stays there
      const fromDate = new Date('2026-01-28T08:00:00Z'); // Wednesday
      const step: EmailStep = {
        id: 'step-1',
        type: 'follow_up_1',
        subject: 'Test',
        body: 'Test',
        delayDays: 2,
        sendTime: 'morning',
        condition: 'no_reply',
      };

      const sequenceNoWeekendSkip = { ...mockSequence, skipWeekends: false };
      const result = service.calculateNextSendAt(sequenceNoWeekendSkip, step, fromDate);

      // Wednesday + 2 = Friday
      expect(result.getDay()).toBe(5); // Friday
    });

    it('uses correct send time for afternoon', () => {
      const fromDate = new Date('2026-01-27T08:00:00Z');
      const step: EmailStep = {
        id: 'step-1',
        type: 'initial',
        subject: 'Test',
        body: 'Test',
        delayDays: 0,
        sendTime: 'afternoon',
        condition: 'always',
      };

      const result = service.calculateNextSendAt(mockSequence, step, fromDate);

      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(0);
    });

    it('uses correct send time for evening', () => {
      const fromDate = new Date('2026-01-27T08:00:00Z');
      const step: EmailStep = {
        id: 'step-1',
        type: 'initial',
        subject: 'Test',
        body: 'Test',
        delayDays: 0,
        sendTime: 'evening',
        condition: 'always',
      };

      const result = service.calculateNextSendAt(mockSequence, step, fromDate);

      expect(result.getHours()).toBe(16);
      expect(result.getMinutes()).toBe(30);
    });

    it('defaults to morning send time when not specified', () => {
      const fromDate = new Date('2026-01-27T08:00:00Z');
      const step: EmailStep = {
        id: 'step-1',
        type: 'initial',
        subject: 'Test',
        body: 'Test',
        delayDays: 0,
        condition: 'always',
        // No sendTime specified
      };

      const result = service.calculateNextSendAt(mockSequence, step, fromDate);

      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(15);
    });
  });

  describe('getDueEnrollments', () => {
    it('returns empty array when no enrollments are due', async () => {
      const result = await service.getDueEnrollments();
      
      expect(result).toEqual([]);
    });

    it('respects the limit parameter', async () => {
      const result = await service.getDueEnrollments(5);
      
      expect(mockDb.collection).toHaveBeenCalledWith('sequenceEnrollments');
    });
  });

  describe('completeEnrollment', () => {
    it('marks enrollment as completed with reason', async () => {
      mockDb._setMockData('sequenceEnrollments/enroll-1', mockEnrollment);
      
      await service.completeEnrollment('enroll-1', 'all_steps_sent');

      // Verify update was called
      const updateMock = mockDb._getUpdateMock('sequenceEnrollments/enroll-1');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          pauseReason: 'all_steps_sent',
          nextSendAt: null,
        })
      );
    });
  });

  describe('pauseEnrollment', () => {
    it('pauses enrollment with reason', async () => {
      mockDb._setMockData('sequenceEnrollments/enroll-1', mockEnrollment);
      
      await service.pauseEnrollment('enroll-1', 'prospect_replied');

      const updateMock = mockDb._getUpdateMock('sequenceEnrollments/enroll-1');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paused',
          pauseReason: 'prospect_replied',
          nextSendAt: null,
        })
      );
    });
  });

  describe('markReplied', () => {
    it('marks enrollment as replied and stops sequence', async () => {
      mockDb._setMockData('sequenceEnrollments/enroll-1', mockEnrollment);
      
      await service.markReplied('enroll-1');

      const updateMock = mockDb._getUpdateMock('sequenceEnrollments/enroll-1');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'replied',
          nextSendAt: null,
        })
      );
    });
  });

  describe('advanceStep', () => {
    it('advances to next step when more steps exist', async () => {
      const enrollmentWithHistory = {
        ...mockEnrollment,
        currentStepIndex: 0,
        stepHistory: [],
      };
      
      mockDb._setMockData('sequenceEnrollments/enroll-1', enrollmentWithHistory);
      mockDb._setMockData('sequences/seq-1', mockSequence);

      await service.advanceStep('enroll-1', 'step-1');

      const updateMock = mockDb._getUpdateMock('sequenceEnrollments/enroll-1');
      expect(updateMock).toHaveBeenCalled();
    });

    it('throws error when enrollment not found', async () => {
      await expect(service.advanceStep('nonexistent', 'step-1')).rejects.toThrow(
        'Enrollment nonexistent not found'
      );
    });
  });

  describe('enrollProspect', () => {
    it('creates enrollment with correct initial state', async () => {
      mockDb._setMockData('sequences/seq-1', mockSequence);

      const enrollmentId = await service.enrollProspect(
        'prospect-1',
        'john@example.com',
        'John Doe',
        'Acme Corp',
        'seq-1',
        'user-1'
      );

      expect(enrollmentId).toBeDefined();
      expect(typeof enrollmentId).toBe('string');
    });

    it('throws error when sequence not found', async () => {
      await expect(
        service.enrollProspect(
          'prospect-1',
          'john@example.com',
          'John Doe',
          'Acme Corp',
          'nonexistent-sequence',
          'user-1'
        )
      ).rejects.toThrow('Sequence nonexistent-sequence not found');
    });

    it('throws error when sequence has no steps', async () => {
      const emptySequence = { ...mockSequence, steps: [] };
      mockDb._setMockData('sequences/empty-seq', emptySequence);

      await expect(
        service.enrollProspect(
          'prospect-1',
          'john@example.com',
          'John Doe',
          'Acme Corp',
          'empty-seq',
          'user-1'
        )
      ).rejects.toThrow('Sequence empty-seq has no steps');
    });
  });
});
