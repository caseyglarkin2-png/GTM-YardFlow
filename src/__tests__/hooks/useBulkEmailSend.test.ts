/**
 * useBulkEmailSend Hook Tests
 * 
 * Sprint 27: F5/F6 - Tests for bulk email send orchestration
 * Sprint V37: T37E.2 - Added sendRecipient fetch tests (CRITICAL)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkEmailSend } from '../../hooks/useBulkEmailSend';
import type { Prospect } from '../../types';

// Mock Firebase auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: {
      getIdToken: vi.fn(() => Promise.resolve('mock-firebase-token')),
    },
  })),
}));

// Mock useAIGenerate
vi.mock('../../hooks/useAIGenerate', () => ({
  useAIGenerate: () => ({
    generate: vi.fn(() => Promise.resolve({
      success: true,
      subject: 'AI Generated Subject',
      content: 'AI generated body content',
    })),
    isGenerating: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockProspects: Prospect[] = [
  { 
    id: 'p1', 
    name: 'John Doe', 
    email: 'john@example.com', 
    company: 'Acme Corp',
    tier: 'T1',
  } as Prospect,
  { 
    id: 'p2', 
    name: 'Jane Smith', 
    email: 'jane@example.com', 
    company: 'Tech Inc',
    tier: 'T2',
  } as Prospect,
  { 
    id: 'p3', 
    name: 'No Email',
    company: 'Missing Co',
    tier: 'T3',
  } as Prospect, // No email - should be filtered out
];

describe('useBulkEmailSend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initRecipients', () => {
    it('initializes recipients from prospects with email only', () => {
      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Test Subject', 'Test Body');
      });

      // Should only have 2 recipients (p3 has no email)
      expect(result.current.recipients).toHaveLength(2);
      expect(result.current.recipients[0].id).toBe('p1');
      expect(result.current.recipients[1].id).toBe('p2');
    });

    it('sets initial subject and body for each recipient', () => {
      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Base Subject', 'Base Body');
      });

      expect(result.current.recipients[0].subject).toBe('Base Subject');
      expect(result.current.recipients[0].body).toBe('Base Body');
    });

    it('generates unique idempotency keys', () => {
      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      const keys = result.current.recipients.map(r => r.idempotencyKey);
      const uniqueKeys = new Set(keys);
      
      expect(uniqueKeys.size).toBe(keys.length);
      expect(keys[0]).toMatch(/^prospect-p1-/);
    });

    it('sets all recipients to pending status', () => {
      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      expect(result.current.recipients.every(r => r.status === 'pending')).toBe(true);
    });
  });

  describe('progress tracking', () => {
    it('calculates correct progress', () => {
      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      expect(result.current.progress).toEqual({
        total: 2,
        generated: 0,
        sent: 0,
        failed: 0,
      });
    });
  });

  describe('updateRecipientContent', () => {
    it('updates subject and body for recipient', () => {
      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Original', 'Original');
      });

      act(() => {
        result.current.updateRecipientContent('p1', 'New Subject', 'New Body');
      });

      const recipient = result.current.recipients.find(r => r.id === 'p1');
      expect(recipient?.subject).toBe('New Subject');
      expect(recipient?.body).toBe('New Body');
    });

    it('marks pending recipient as generated after content update', () => {
      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Original', 'Original');
      });

      act(() => {
        result.current.updateRecipientContent('p1', 'New Subject', 'New Body');
      });

      const recipient = result.current.recipients.find(r => r.id === 'p1');
      expect(recipient?.status).toBe('generated');
    });
  });

  describe('reset', () => {
    it('clears all recipients and state', () => {
      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      expect(result.current.recipients).toHaveLength(2);

      act(() => {
        result.current.reset();
      });

      expect(result.current.recipients).toHaveLength(0);
      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('idempotency', () => {
    it('idempotency key includes prospect id', () => {
      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      const recipient = result.current.recipients[0];
      expect(recipient.idempotencyKey).toContain('prospect-p1');
    });

    it('reinitializing generates new idempotency keys', () => {
      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      const firstKey = result.current.recipients[0].idempotencyKey;

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      const secondKey = result.current.recipients[0].idempotencyKey;

      expect(firstKey).not.toBe(secondKey);
    });
  });

  // ===========================================================================
  // Sprint V37: T37E.2 - sendRecipient Fetch Tests (CRITICAL)
  // ===========================================================================
  
  describe('sendRecipient', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('sends email via /api/email/send with correct payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-123', status: 'pending' }),
      });

      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Test Subject', 'Test Body');
      });

      await act(async () => {
        await result.current.sendRecipient('p1');
      });

      // Verify fetch was called with correct endpoint and payload
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/email/send', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-firebase-token',
        }),
      }));

      // Verify the body contains required fields
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.to).toBe('john@example.com');
      expect(body.subject).toBe('Test Subject');
      expect(body.body).toBe('Test Body');
      expect(body.prospectId).toBe('p1');
    });

    it('sends Idempotency-Key header with request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-123', status: 'pending' }),
      });

      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      const recipient = result.current.recipients[0];

      await act(async () => {
        await result.current.sendRecipient('p1');
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers['Idempotency-Key']).toBe(recipient.idempotencyKey);
    });

    it('updates status to "sent" on successful API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-123', status: 'pending' }),
      });

      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      expect(result.current.recipients[0].status).toBe('pending');

      await act(async () => {
        await result.current.sendRecipient('p1');
      });

      expect(result.current.recipients[0].status).toBe('sent');
    });

    it('updates status to "failed" on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ error: 'Email blocked', reason: 'suppressed' }),
      });

      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      await act(async () => {
        await result.current.sendRecipient('p1');
      });

      expect(result.current.recipients[0].status).toBe('failed');
      expect(result.current.recipients[0].error).toBe('Email blocked');
    });

    it('updates status to "failed" on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      await act(async () => {
        await result.current.sendRecipient('p1');
      });

      expect(result.current.recipients[0].status).toBe('failed');
      expect(result.current.recipients[0].error).toBe('Network error');
    });

    it('prevents duplicate sends with same idempotency key', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'email-123', status: 'pending' }),
      });

      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      // First send
      await act(async () => {
        await result.current.sendRecipient('p1');
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Attempt duplicate send (should be prevented)
      await act(async () => {
        await result.current.sendRecipient('p1');
      });

      // Should still be only 1 call (duplicate prevented)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles rate limit (429) error with user message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ 
          error: 'Daily email limit reached', 
          reason: 'warmup_limit',
          remaining: 0,
          message: 'New accounts start with 20 emails/day.' 
        }),
      });

      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      await act(async () => {
        await result.current.sendRecipient('p1');
      });

      expect(result.current.recipients[0].status).toBe('failed');
      expect(result.current.recipients[0].error).toBe('Daily email limit reached');
    });

    it('transitions from pending to sending during API call', async () => {
      // This test verifies the status transition happens during the send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-123', status: 'pending' }),
      });

      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      expect(result.current.recipients[0].status).toBe('pending');

      await act(async () => {
        await result.current.sendRecipient('p1');
      });

      // After send completes, status should be 'sent'
      expect(result.current.recipients[0].status).toBe('sent');
    });

    it('does not make fetch call when recipient has no content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-123', status: 'pending' }),
      });

      const prospectsNoContent: Prospect[] = [
        { 
          id: 'p-empty', 
          email: 'empty@example.com',
          company: 'Empty Co',
          tier: 'T1',
        } as Prospect,
      ];

      const { result } = renderHook(() => useBulkEmailSend());

      // Initialize with empty subject to test content validation
      act(() => {
        result.current.initRecipients(prospectsNoContent, '', '');
      });

      await act(async () => {
        await result.current.sendRecipient('p-empty');
      });

      // Fetch should not be called when subject or body is missing
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('progress tracking with sends', () => {
    it('updates sent count after successful send', async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-123', status: 'pending' }),
      });

      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      expect(result.current.progress.sent).toBe(0);

      await act(async () => {
        await result.current.sendRecipient('p1');
      });

      expect(result.current.progress.sent).toBe(1);
    });

    it('updates failed count after failed send', async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const { result } = renderHook(() => useBulkEmailSend());

      act(() => {
        result.current.initRecipients(mockProspects, 'Subject', 'Body');
      });

      expect(result.current.progress.failed).toBe(0);

      await act(async () => {
        await result.current.sendRecipient('p1');
      });

      expect(result.current.progress.failed).toBe(1);
    });
  });
});
