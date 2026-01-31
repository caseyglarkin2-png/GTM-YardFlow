/**
 * MeetingAttributionService Tests
 * 
 * Sprint 301: T301.2 - North Star metric coverage
 * Tests meeting attribution, stats collection, and sequence performance tracking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock functions that we can reference
const mockSetDoc = vi.fn();
const mockGetDocs = vi.fn();

// Mock Firebase modules before imports
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, path) => ({ path })),
  doc: vi.fn((db, collection, id) => ({ id, collection })),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  query: vi.fn((...args) => ({ args })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getFirestore: vi.fn(() => ({})),
  orderBy: vi.fn((field, dir) => ({ field, dir })),
  limit: vi.fn((n) => ({ limit: n })),
}));

vi.mock('firebase/app', () => ({
  getApp: vi.fn(() => ({})),
}));

// Import after mocks are set up
import {
  recordMeeting,
  getMeetingStats,
  getSequencePerformance,
} from '@/services/MeetingAttributionService';

describe('MeetingAttributionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recordMeeting', () => {
    it('records a meeting with provided attribution', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      const result = await recordMeeting({
        prospectId: 'prospect-123',
        prospectName: 'John Doe',
        prospectEmail: 'john@acme.com',
        companyName: 'Acme Corp',
        meetingType: 'discovery',
        sequenceId: 'seq-456',
        sequenceName: 'Cold Outreach',
        stepNumber: 2,
      });

      expect(result).not.toBeNull();
      expect(result?.prospectId).toBe('prospect-123');
      expect(result?.prospectName).toBe('John Doe');
      expect(result?.companyName).toBe('Acme Corp');
      expect(result?.sequenceId).toBe('seq-456');
      expect(result?.sequenceName).toBe('Cold Outreach');
      expect(result?.stepIndex).toBe(2);
      expect(result?.meetingType).toBe('discovery');
      expect(result?.attributedBy).toBe('user');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });

    it('records meeting with meeting scheduled date', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);
      const scheduledDate = '2026-02-15T14:00:00Z';

      const result = await recordMeeting({
        prospectId: 'prospect-123',
        prospectName: 'Jane Doe',
        companyName: 'Tech Inc',
        meetingScheduledFor: scheduledDate,
      });

      expect(result?.meetingScheduledFor).toBe(scheduledDate);
    });

    it('records meeting with notes', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      const result = await recordMeeting({
        prospectId: 'prospect-123',
        prospectName: 'Bob Smith',
        companyName: 'Corp LLC',
        notes: 'Follow up on pricing discussion',
        meetingType: 'follow_up',
      });

      expect(result?.notes).toBe('Follow up on pricing discussion');
      expect(result?.meetingType).toBe('follow_up');
    });

    it('auto-discovers attribution from enrollment when not provided', async () => {
      // Mock finding an enrollment
      mockGetDocs
        .mockResolvedValueOnce({
          empty: false,
          docs: [{
            id: 'enrollment-789',
            data: () => ({
              sequenceId: 'auto-seq',
              currentStepIndex: 3,
              lastSentAt: '2026-01-30T10:00:00Z',
            }),
          }],
        })
        // Mock sequence lookup
        .mockResolvedValueOnce({
          empty: false,
          docs: [{
            data: () => ({ name: 'Auto Sequence' }),
          }],
        })
        // Mock reply lookup
        .mockResolvedValueOnce({ empty: true, docs: [] });
      
      mockSetDoc.mockResolvedValueOnce(undefined);

      const result = await recordMeeting({
        prospectId: 'prospect-auto',
        prospectName: 'Auto User',
        companyName: 'Auto Corp',
      });

      expect(result?.sequenceId).toBe('auto-seq');
      expect(result?.sequenceName).toBe('Auto Sequence');
      expect(result?.stepIndex).toBe(3);
    });

    it('handles missing enrollment gracefully', async () => {
      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });
      mockSetDoc.mockResolvedValueOnce(undefined);

      const result = await recordMeeting({
        prospectId: 'prospect-no-enrollment',
        prospectName: 'Cold Lead',
        companyName: 'Unknown Corp',
      });

      expect(result).not.toBeNull();
      expect(result?.sequenceId).toBeUndefined();
      expect(result?.prospectName).toBe('Cold Lead');
    });

    it('generates unique meeting ID', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      const result1 = await recordMeeting({
        prospectId: 'p1',
        prospectName: 'User 1',
        companyName: 'Corp 1',
      });

      vi.advanceTimersByTime(1);

      const result2 = await recordMeeting({
        prospectId: 'p2',
        prospectName: 'User 2',
        companyName: 'Corp 2',
      });

      expect(result1?.id).not.toBe(result2?.id);
      expect(result1?.id).toContain('meeting_');
      expect(result1?.id).toContain('p1');
    });

    it('sets correct timestamps', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      const result = await recordMeeting({
        prospectId: 'p1',
        prospectName: 'Timestamp User',
        companyName: 'Time Corp',
      });

      expect(result?.meetingBookedAt).toBe('2026-01-31T12:00:00.000Z');
      expect(result?.createdAt).toBe('2026-01-31T12:00:00.000Z');
    });

    it('handles missing prospectEmail with default empty string', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      const result = await recordMeeting({
        prospectId: 'p1',
        prospectName: 'No Email User',
        companyName: 'Corp',
      });

      expect(result?.prospectEmail).toBe('');
    });

    it('uses meetingDate when meetingScheduledFor not provided', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);
      const meetingDate = new Date('2026-02-20T15:00:00Z');

      const result = await recordMeeting({
        prospectId: 'p1',
        prospectName: 'Date User',
        companyName: 'Corp',
        meetingDate,
      });

      expect(result?.meetingScheduledFor).toBe('2026-02-20T15:00:00.000Z');
    });
  });

  describe('getMeetingStats', () => {
    it('calculates correct stats from meetings', async () => {
      // Mock meetings collection
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => ({
              meetingBookedAt: '2026-01-31T10:00:00Z', // This week (Friday)
              sequenceId: 'seq-1',
              sequenceName: 'seq-1',
            }),
          },
          {
            data: () => ({
              meetingBookedAt: '2026-01-30T10:00:00Z', // This week (Thursday)
              sequenceId: 'seq-1',
              sequenceName: 'seq-1',
            }),
          },
          {
            data: () => ({
              meetingBookedAt: '2026-01-22T10:00:00Z', // Last week
              sequenceId: 'seq-2',
              sequenceName: 'seq-2',
            }),
          },
          {
            data: () => ({
              meetingBookedAt: '2026-01-15T10:00:00Z', // This month
              sequenceId: 'seq-1',
              sequenceName: 'seq-1',
            }),
          },
        ],
      });

      const stats = await getMeetingStats();

      expect(stats.total).toBe(4);
      expect(stats.thisMonth).toBeGreaterThanOrEqual(3);
      expect(stats.bySequence['seq-1']).toBe(3);
      expect(stats.bySequence['seq-2']).toBe(1);
    });

    it('returns zero stats when no meetings', async () => {
      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });

      const stats = await getMeetingStats();

      expect(stats.total).toBe(0);
      expect(stats.thisWeek).toBe(0);
      expect(stats.lastWeek).toBe(0);
      expect(stats.thisMonth).toBe(0);
      expect(Object.keys(stats.bySequence)).toHaveLength(0);
    });

    it('calculates week-over-week change', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          // 3 meetings this week (Mon-Fri of Jan 27-31, 2026)
          { data: () => ({ meetingBookedAt: '2026-01-31T10:00:00Z' }) },
          { data: () => ({ meetingBookedAt: '2026-01-30T10:00:00Z' }) },
          { data: () => ({ meetingBookedAt: '2026-01-29T10:00:00Z' }) },
          // 2 meetings last week (Jan 20-26, 2026)
          { data: () => ({ meetingBookedAt: '2026-01-22T10:00:00Z' }) },
          { data: () => ({ meetingBookedAt: '2026-01-21T10:00:00Z' }) },
        ],
      });

      const stats = await getMeetingStats();

      // Week-over-week should be positive (3 vs 2)
      expect(stats.weekOverWeekChange).toBeGreaterThan(0);
    });

    it('handles 100% increase when last week is zero', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          // All meetings this week
          { data: () => ({ meetingBookedAt: '2026-01-31T10:00:00Z' }) },
          { data: () => ({ meetingBookedAt: '2026-01-30T10:00:00Z' }) },
        ],
      });

      const stats = await getMeetingStats();

      expect(stats.thisWeek).toBe(2);
      expect(stats.lastWeek).toBe(0);
      expect(stats.weekOverWeekChange).toBe(100);
    });
  });

  describe('getSequencePerformance', () => {
    it('calculates performance metrics for all sequences', async () => {
      // Mock returns in order: enrollments, email_events, meetings, sequences
      mockGetDocs
        // Enrollments query
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            { data: () => ({ sequenceId: 'seq-123', status: 'active', currentStepIndex: 2 }) },
            { data: () => ({ sequenceId: 'seq-123', status: 'completed', currentStepIndex: 4 }) },
            { data: () => ({ sequenceId: 'seq-123', status: 'replied', currentStepIndex: 1 }) },
          ],
        })
        // Email events query
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            { data: () => ({ sequenceId: 'seq-123', type: 'sent' }) },
            { data: () => ({ sequenceId: 'seq-123', type: 'sent' }) },
            { data: () => ({ sequenceId: 'seq-123', type: 'sent' }) },
            { data: () => ({ sequenceId: 'seq-123', type: 'sent' }) },
            { data: () => ({ sequenceId: 'seq-123', type: 'open' }) },
            { data: () => ({ sequenceId: 'seq-123', type: 'open' }) },
            { data: () => ({ sequenceId: 'seq-123', type: 'click' }) },
          ],
        })
        // Meetings query
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ sequenceId: 'seq-123' }) }],
        })
        // Sequences query
        .mockResolvedValueOnce({
          empty: false,
          docs: [{
            id: 'seq-123',
            data: () => ({ name: 'Cold Outreach' }),
          }],
        });

      const performance = await getSequencePerformance();

      expect(performance).toHaveLength(1);
      const seq = performance[0];
      expect(seq.sequenceId).toBe('seq-123');
      expect(seq.sequenceName).toBe('Cold Outreach');
      expect(seq.enrolled).toBe(3);
      expect(seq.sent).toBe(4);
      expect(seq.opened).toBe(2);
      expect(seq.clicked).toBe(1);
      expect(seq.replied).toBe(1);
      expect(seq.meetings).toBe(1);
      expect(seq.openRate).toBe(50); // 2/4 = 50%
      expect(seq.clickRate).toBe(25); // 1/4 = 25%
    });

    it('handles zero enrollments gracefully', async () => {
      mockGetDocs
        .mockResolvedValueOnce({ empty: true, docs: [] }) // No enrollments
        .mockResolvedValueOnce({ empty: true, docs: [] }) // No email events
        .mockResolvedValueOnce({ empty: true, docs: [] }) // No meetings
        .mockResolvedValueOnce({ empty: true, docs: [] }); // No sequences

      const performance = await getSequencePerformance();

      // Should return empty array when no sequences
      expect(performance).toHaveLength(0);
    });

    it('filters out sequences with zero enrollments', async () => {
      mockGetDocs
        // One enrollment for seq-1, zero for seq-2
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            { data: () => ({ sequenceId: 'seq-1', status: 'active' }) },
          ],
        })
        .mockResolvedValueOnce({ empty: true, docs: [] }) // No email events
        .mockResolvedValueOnce({ empty: true, docs: [] }) // No meetings
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            { id: 'seq-1', data: () => ({ name: 'Active Sequence' }) },
            { id: 'seq-2', data: () => ({ name: 'Empty Sequence' }) },
          ],
        });

      const performance = await getSequencePerformance();

      // Only seq-1 should be returned (has enrollments)
      expect(performance).toHaveLength(1);
      expect(performance[0].sequenceId).toBe('seq-1');
    });

    it('sorts by meetings descending', async () => {
      mockGetDocs
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            { data: () => ({ sequenceId: 'seq-a', status: 'active' }) },
            { data: () => ({ sequenceId: 'seq-a', status: 'active' }) },
            { data: () => ({ sequenceId: 'seq-b', status: 'active' }) },
          ],
        })
        .mockResolvedValueOnce({ empty: true, docs: [] })
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            { data: () => ({ sequenceId: 'seq-b' }) },
            { data: () => ({ sequenceId: 'seq-b' }) },
            { data: () => ({ sequenceId: 'seq-a' }) },
          ],
        })
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            { id: 'seq-a', data: () => ({ name: 'Sequence A' }) },
            { id: 'seq-b', data: () => ({ name: 'Sequence B' }) },
          ],
        });

      const performance = await getSequencePerformance();

      // seq-b has more meetings (2 vs 1), should be first
      expect(performance[0].sequenceId).toBe('seq-b');
      expect(performance[0].meetings).toBe(2);
      expect(performance[1].sequenceId).toBe('seq-a');
      expect(performance[1].meetings).toBe(1);
    });

    it('handles database errors gracefully', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Database error'));

      const performance = await getSequencePerformance();

      expect(performance).toEqual([]);
    });
  });
});
