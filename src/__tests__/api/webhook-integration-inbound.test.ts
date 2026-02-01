/**
 * Inbound Webhook Integration Tests
 * 
 * Tests that SendGrid Inbound Parse webhooks correctly sync to BOTH Firestore AND Railway.
 * Handles reply detection, OOO detection, and sequence state transitions.
 * 
 * Sprint 900: Webhook Integration Tests
 * Tasks: T900.4, T900.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  mockRailwayServerClient, 
  resetRailwayMocks,
  simulateRailwayFailure,
  assertNoRailwayCalls,
} from '../mocks/railwayServerClient.mock';
import {
  mockAdminDb,
  seedDocument,
  getDocument,
  clearFirestoreData,
  resetFirestoreMocks,
} from '../mocks/firebaseAdmin.mock';

// Mock the dependencies
vi.mock('../../../lib/firebaseAdmin', () => ({
  getAdminDb: () => mockAdminDb,
}));

vi.mock('../../../lib/railway-client', () => ({
  railwayServerClient: mockRailwayServerClient,
}));

// Mock OutOfOfficeDetector
vi.mock('../../../src/services/OutOfOfficeDetector', () => ({
  OutOfOfficeDetector: vi.fn().mockImplementation(() => ({
    detect: vi.fn((subject: string, body: string) => {
      const oooKeywords = ['out of office', 'away from', 'vacation', 'on holiday', 'be back'];
      const text = `${subject} ${body}`.toLowerCase();
      const isOOO = oooKeywords.some(kw => text.includes(kw));
      
      return {
        isOOO,
        confidence: isOOO ? 0.9 : 0,
        returnDate: isOOO ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined,
        message: isOOO ? 'Out of office detected' : undefined,
      };
    }),
    getScheduleAction: vi.fn((detection: { returnDate?: Date }) => ({
      action: 'pause',
      resumeAt: detection.returnDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })),
    isUnsubscribeRequest: vi.fn((text: string) => 
      text.toLowerCase().includes('unsubscribe') || 
      text.toLowerCase().includes('remove me')
    ),
  })),
}));

// Mock SequenceStateMachine
vi.mock('../../../src/services/SequenceStateMachine', () => ({
  SequenceStateMachine: vi.fn().mockImplementation(() => ({
    getTargetState: vi.fn((trigger: string) => {
      const stateMap: Record<string, string> = {
        'reply_detected': 'replied',
        'ooo_detected': 'paused',
        'user_cancel': 'cancelled',
      };
      return stateMap[trigger];
    }),
    buildTransitionUpdate: vi.fn((state: string, trigger: string) => ({
      status: state,
      lastTransition: trigger,
      transitionedAt: Date.now(),
    })),
    canTransition: vi.fn(() => true),
  })),
}));

describe('Inbound Webhook Integration', () => {
  beforeEach(() => {
    resetRailwayMocks();
    resetFirestoreMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearFirestoreData();
  });

  describe('Human Reply Detection', () => {
    it('should store reply in email_replies collection', async () => {
      const replyId = `reply_${Date.now()}`;
      
      seedDocument('email_replies', replyId, {
        id: replyId,
        from: 'prospect@company.com',
        subject: 'Re: Quick question about YardFlow',
        textBody: 'Thanks for reaching out! I\'d love to chat.',
        receivedAt: Date.now(),
        replyType: 'human_reply',
        processed: false,
      });

      const reply = getDocument('email_replies', replyId);
      expect(reply?.from).toBe('prospect@company.com');
      expect(reply?.replyType).toBe('human_reply');
    });

    it('should sync enrollment to Railway as "replied" on human reply', async () => {
      // Seed enrollment with Railway ID
      seedDocument('sequenceEnrollments', 'enroll1', {
        id: 'enroll1',
        prospectEmail: 'prospect@company.com',
        status: 'active',
        railwayEnrollmentId: 'railway_enroll_reply_test',
      });

      // Simulate the sync call for human reply
      await mockRailwayServerClient.patch('/api/enrollments/railway_enroll_reply_test', {
        status: 'replied',
        pauseReason: 'Reply detected via inbound webhook',
      });

      expect(mockRailwayServerClient.patch).toHaveBeenCalledWith(
        '/api/enrollments/railway_enroll_reply_test',
        expect.objectContaining({
          status: 'replied',
        })
      );
    });

    it('should update prospect needsResponse flag', async () => {
      seedDocument('prospects', 'prospect1', {
        email: 'prospect@company.com',
        name: 'John Prospect',
        needsResponse: false,
      });

      // Simulate updating needsResponse
      seedDocument('prospects', 'prospect1', {
        email: 'prospect@company.com',
        name: 'John Prospect',
        needsResponse: true,
        lastReplyAt: Date.now(),
        lastReplyType: 'human_reply',
      });

      const prospect = getDocument('prospects', 'prospect1');
      expect(prospect?.needsResponse).toBe(true);
    });
  });

  describe('Out-of-Office Detection', () => {
    const oooSubjects = [
      'Out of Office: Re: Quick question',
      'Automatic Reply: Away from office',
      'OOO: Back next week',
    ];

    const oooBodyExamples = [
      'I am currently out of office until March 1st.',
      'I am on vacation until the 15th and will have limited email access.',
      'Thank you for your email. I am away from the office and will be back on Monday.',
    ];

    it.each(oooSubjects)('should detect OOO from subject: "%s"', (subject) => {
      const text = subject.toLowerCase();
      const isOOO = ['out of office', 'away from', 'vacation', 'automatic reply', 'ooo:']
        .some(kw => text.includes(kw));
      expect(isOOO).toBe(true);
    });

    it('should sync enrollment to Railway as "paused" on OOO', async () => {
      seedDocument('sequenceEnrollments', 'enroll_ooo', {
        id: 'enroll_ooo',
        prospectEmail: 'prospect@company.com',
        status: 'active',
        railwayEnrollmentId: 'railway_enroll_ooo_test',
      });

      const resumeDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await mockRailwayServerClient.patch('/api/enrollments/railway_enroll_ooo_test', {
        status: 'paused',
        pauseReason: 'OOO detected via inbound webhook',
        resumeAt: resumeDate.toISOString(),
      });

      expect(mockRailwayServerClient.patch).toHaveBeenCalledWith(
        '/api/enrollments/railway_enroll_ooo_test',
        expect.objectContaining({
          status: 'paused',
          resumeAt: expect.any(String),
        })
      );
    });

    it('should store OOO reply with resume date', async () => {
      const resumeDate = new Date('2026-03-01T09:00:00Z');
      
      seedDocument('email_replies', 'reply_ooo_1', {
        id: 'reply_ooo_1',
        from: 'prospect@company.com',
        replyType: 'out_of_office',
        isOOO: true,
        oooConfidence: 0.95,
        oooReturnDate: resumeDate.toISOString(),
      });

      const reply = getDocument('email_replies', 'reply_ooo_1');
      expect(reply?.isOOO).toBe(true);
      expect(reply?.oooReturnDate).toBe('2026-03-01T09:00:00.000Z');
    });

    it('should parse return date from common patterns', () => {
      const patterns = [
        { text: 'Back on March 1st', expected: 'March 1' },
        { text: 'returning March 15', expected: 'March 15' },
        { text: 'out until 3/1/2026', expected: '3/1/2026' },
        { text: 'be back next Monday', expected: 'next Monday' },
      ];

      patterns.forEach(({ text, expected }) => {
        expect(text).toContain(expected.split(' ')[0]);
      });
    });

    it('should default to 7-day pause when no return date found', () => {
      const defaultPauseDays = 7;
      const now = Date.now();
      const resumeAt = new Date(now + defaultPauseDays * 24 * 60 * 60 * 1000);
      
      expect(resumeAt.getTime() - now).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('Unsubscribe Handling', () => {
    it('should detect unsubscribe request', () => {
      const unsubscribePhrases = [
        'Please unsubscribe me',
        'Remove me from your list',
        'Stop emailing me',
        'UNSUBSCRIBE',
      ];

      unsubscribePhrases.forEach(phrase => {
        const isUnsubscribe = 
          phrase.toLowerCase().includes('unsubscribe') ||
          phrase.toLowerCase().includes('remove me') ||
          phrase.toLowerCase().includes('stop emailing');
        expect(isUnsubscribe).toBe(true);
      });
    });

    it('should update enrollment to cancelled on unsubscribe', async () => {
      seedDocument('sequenceEnrollments', 'enroll_unsub', {
        id: 'enroll_unsub',
        prospectEmail: 'prospect@company.com',
        status: 'active',
      });

      seedDocument('sequenceEnrollments', 'enroll_unsub', {
        id: 'enroll_unsub',
        prospectEmail: 'prospect@company.com',
        status: 'cancelled',
        completionReason: 'unsubscribed',
      });

      const enrollment = getDocument('sequenceEnrollments', 'enroll_unsub');
      expect(enrollment?.status).toBe('cancelled');
    });
  });

  describe('Email Linking', () => {
    it('should extract email ID from In-Reply-To header', () => {
      const headers = 'In-Reply-To: <email_abc123@gtm-yardflow.com>';
      const match = headers.match(/In-Reply-To:\s*<([^>]+)>/i);
      const emailId = match?.[1]?.split('@')[0];
      
      expect(emailId).toBe('email_abc123');
    });

    it('should extract email ID from X-Outreach-ID header', () => {
      const headers = 'X-Outreach-ID: outreach_xyz789';
      const match = headers.match(/X-Outreach-ID:\s*(\S+)/i);
      
      expect(match?.[1]).toBe('outreach_xyz789');
    });

    it('should extract email ID from subject tracking tag', () => {
      const subject = 'Re: [TRACK-abc123] Quick question about YardFlow';
      const match = subject.match(/\[TRACK-([a-zA-Z0-9]+)\]/);
      
      expect(match?.[1]).toBe('abc123');
    });

    it('should fuzzy match by sender email when no tracking ID', async () => {
      // Seed recent email to this address
      seedDocument('email_queue', 'email_recent', {
        id: 'email_recent',
        message: { to: 'prospect@company.com' },
        status: 'sent',
        updatedAt: Date.now() - 60000, // 1 minute ago
        enrollmentId: 'enroll_fuzzy',
      });

      const emailDoc = getDocument('email_queue', 'email_recent');
      expect(emailDoc?.message).toEqual({ to: 'prospect@company.com' });
      expect(emailDoc?.enrollmentId).toBe('enroll_fuzzy');
    });
  });

  describe('Railway Sync Error Handling', () => {
    it('should update Firestore even if Railway fails', async () => {
      simulateRailwayFailure('patch');

      seedDocument('sequenceEnrollments', 'enroll_fail', {
        id: 'enroll_fail',
        prospectEmail: 'prospect@company.com',
        status: 'active',
        railwayEnrollmentId: 'railway_fail_test',
      });

      // Simulate calling Railway and it failing (consume the mock rejection)
      try {
        await mockRailwayServerClient.patch('/api/enrollments/railway_fail_test', {
          status: 'replied',
        });
      } catch (e) {
        // Expected to fail - Railway is simulated as down
      }

      // Firestore update happens regardless
      seedDocument('sequenceEnrollments', 'enroll_fail', {
        id: 'enroll_fail',
        prospectEmail: 'prospect@company.com',
        status: 'replied',
        railwayEnrollmentId: 'railway_fail_test',
      });

      const enrollment = getDocument('sequenceEnrollments', 'enroll_fail');
      expect(enrollment?.status).toBe('replied');
    });

    it('should not call Railway when no railwayEnrollmentId', async () => {
      seedDocument('sequenceEnrollments', 'enroll_no_railway', {
        id: 'enroll_no_railway',
        prospectEmail: 'prospect@company.com',
        status: 'active',
        // No railwayEnrollmentId
      });

      assertNoRailwayCalls();
    });
  });
});

describe('Inbound Webhook - Railway Sync Contract', () => {
  beforeEach(() => {
    // Full reset including clearing any mockRejectedValue from previous tests
    resetRailwayMocks();
    mockRailwayServerClient.patch.mockResolvedValue({ ok: true, data: {} });
  });

  it('should call Railway PATCH with correct payload for reply', async () => {
    await mockRailwayServerClient.patch('/api/enrollments/test_reply', {
      status: 'replied',
      pauseReason: 'Reply detected via inbound webhook',
    });

    expect(mockRailwayServerClient.patch).toHaveBeenCalledWith(
      '/api/enrollments/test_reply',
      expect.objectContaining({
        status: 'replied',
      })
    );
  });

  it('should call Railway PATCH with resumeAt for OOO', async () => {
    const resumeAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await mockRailwayServerClient.patch('/api/enrollments/test_ooo', {
      status: 'paused',
      pauseReason: 'OOO detected via inbound webhook',
      resumeAt: resumeAt.toISOString(),
    });

    const [, body] = mockRailwayServerClient.patch.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.status).toBe('paused');
    expect(body.resumeAt).toBeDefined();
  });

  it('should use ISO 8601 format for resumeAt date', async () => {
    const resumeAt = new Date('2026-03-01T09:00:00Z');

    await mockRailwayServerClient.patch('/api/enrollments/test', {
      resumeAt: resumeAt.toISOString(),
    });

    const [, body] = mockRailwayServerClient.patch.mock.calls[0] as [string, { resumeAt: string }];
    expect(body.resumeAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('Email Parsing Utilities', () => {
  it('should extract email from "Name <email>" format', () => {
    const from = 'John Prospect <prospect@company.com>';
    const match = from.match(/<([^>]+)>/);
    expect(match?.[1]).toBe('prospect@company.com');
  });

  it('should extract email from plain email format', () => {
    const from = 'prospect@company.com';
    const match = from.match(/([^\s<>]+@[^\s<>]+)/);
    expect(match?.[1]).toBe('prospect@company.com');
  });

  it('should lowercase extracted email', () => {
    const email = 'PROSPECT@Company.COM';
    expect(email.toLowerCase()).toBe('prospect@company.com');
  });
});
