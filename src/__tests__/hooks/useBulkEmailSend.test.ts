/**
 * useBulkEmailSend Hook Tests
 * 
 * Sprint 27: F5/F6 - Tests for bulk email send orchestration
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
});
