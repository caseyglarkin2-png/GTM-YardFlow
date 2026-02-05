/**
 * useSpamScore Hook Tests
 * 
 * Sprint 39C.3: Tests for real-time spam analysis hook
 * 
 * Note: Uses real timers with short debounce for reliable testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock SpamScoreService
const mockAnalyze = vi.fn();
vi.mock('@/services/SpamScoreService', () => ({
  SpamScoreService: {
    getInstance: () => ({
      analyze: mockAnalyze,
    }),
  },
}));

// Mock firebase auth
const mockGetIdToken = vi.fn();
vi.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: {
      uid: 'test-user-123',
      getIdToken: () => mockGetIdToken(),
    },
  },
}));

// Mock fetch for API mode
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { useSpamScore } from '@/hooks/useSpamScore';

describe('useSpamScore', () => {
  const mockResult = {
    score: 15,
    level: 'low' as const,
    issues: [
      { category: 'compliance', description: 'Missing unsubscribe', severity: 4, location: 'general' as const },
    ],
    suggestions: ['Add unsubscribe link'],
    analysis: {
      subject: { score: 5, capsRatio: 0.1, length: 20, hasSpamWords: false, spamWordsFound: [] },
      body: { score: 10, spamWordCount: 0, spamWordsFound: [], hasExcessiveFormatting: false, imageCount: 0, linkCount: 1 },
      links: { score: 0, totalLinks: 1, suspiciousLinks: [], excessiveLinks: false },
      quality: { readabilityScore: 80, personalization: true, hasUnsubscribe: false, hasPhysicalAddress: true },
    },
  };

  const mockHighRiskResult = {
    score: 65,
    level: 'high' as const,
    issues: [
      { category: 'spam_words', description: 'Contains spam words', severity: 5, location: 'body' as const },
      { category: 'formatting', description: 'All caps subject', severity: 3, location: 'subject' as const },
      { category: 'links', description: 'Suspicious links', severity: 4, location: 'link' as const },
    ],
    suggestions: ['Remove spam words', 'Fix formatting', 'Remove suspicious links'],
    analysis: {
      subject: { score: 20, capsRatio: 0.8, length: 30, hasSpamWords: true, spamWordsFound: ['free', 'urgent'] },
      body: { score: 30, spamWordCount: 5, spamWordsFound: ['free', 'money'], hasExcessiveFormatting: false, imageCount: 0, linkCount: 3 },
      links: { score: 15, totalLinks: 3, suspiciousLinks: ['http://bit.ly/test'], excessiveLinks: false },
      quality: { readabilityScore: 50, personalization: false, hasUnsubscribe: true, hasPhysicalAddress: false },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalyze.mockReturnValue(mockResult);
    mockGetIdToken.mockResolvedValue('test-token');
    mockFetch.mockReset();
  });

  describe('Initial state', () => {
    it('starts with null result and loading state', () => {
      const { result } = renderHook(() => useSpamScore({
        subject: 'Test',
        body: 'Content',
        debounceMs: 10,
      }));

      expect(result.current.result).toBe(null);
      expect(result.current.isLoading).toBe(true);
    });

    it('does not analyze when disabled', async () => {
      const { result } = renderHook(() => useSpamScore({
        subject: 'Test',
        body: 'Content',
        enabled: false,
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockAnalyze).not.toHaveBeenCalled();
      expect(result.current.result).toBe(null);
    });

    it('does not analyze empty content', async () => {
      const { result } = renderHook(() => useSpamScore({
        subject: '',
        body: '',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockAnalyze).not.toHaveBeenCalled();
      expect(result.current.result).toBe(null);
    });
  });

  describe('Local analysis', () => {
    it('analyzes content after debounce', async () => {
      const { result } = renderHook(() => useSpamScore({
        subject: 'Test',
        body: 'Content here',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.result).not.toBe(null);
      }, { timeout: 1000 });

      expect(result.current.result).toEqual(mockResult);
      expect(result.current.isLoading).toBe(false);
      expect(mockAnalyze).toHaveBeenCalledWith({
        subject: 'Test',
        body: 'Content here',
        isHtml: false,
      });
    });

    it('passes isHtml flag to service', async () => {
      renderHook(() => useSpamScore({
        subject: 'Test',
        body: '<p>HTML content</p>',
        isHtml: true,
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(mockAnalyze).toHaveBeenCalledWith({
          subject: 'Test',
          body: '<p>HTML content</p>',
          isHtml: true,
        });
      });
    });

    it('handles analysis errors', async () => {
      mockAnalyze.mockImplementation(() => {
        throw new Error('Analysis failed');
      });

      const { result } = renderHook(() => useSpamScore({
        subject: 'Test',
        body: 'Content',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.error).toBe('Analysis failed');
      });

      expect(result.current.result).toBe(null);
    });
  });

  describe('Computed values', () => {
    it('calculates scoreColor for low score', async () => {
      mockAnalyze.mockReturnValue({ ...mockResult, score: 15 });
      
      const { result } = renderHook(() => useSpamScore({
        subject: 'Test',
        body: 'Content',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.result).not.toBe(null);
      });

      expect(result.current.scoreColor).toBe('text-green-600');
    });

    it('calculates scoreColor for medium score', async () => {
      mockAnalyze.mockReturnValue({ ...mockResult, score: 35 });
      
      const { result } = renderHook(() => useSpamScore({
        subject: 'Test',
        body: 'Content',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.result).not.toBe(null);
      });

      expect(result.current.scoreColor).toBe('text-yellow-600');
    });

    it('calculates scoreColor for high score', async () => {
      mockAnalyze.mockReturnValue({ ...mockResult, score: 55 });
      
      const { result } = renderHook(() => useSpamScore({
        subject: 'Test',
        body: 'Content',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.result).not.toBe(null);
      });

      expect(result.current.scoreColor).toBe('text-orange-600');
    });

    it('calculates scoreColor for critical score', async () => {
      mockAnalyze.mockReturnValue({ ...mockResult, score: 75 });
      
      const { result } = renderHook(() => useSpamScore({
        subject: 'Test',
        body: 'Content',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.result).not.toBe(null);
      });

      expect(result.current.scoreColor).toBe('text-red-600');
    });

    it('calculates levelColor for each level', async () => {
      // Test low
      mockAnalyze.mockReturnValue({ ...mockResult, level: 'low' });
      const { result: lowResult } = renderHook(() => useSpamScore({
        subject: 'Low1',
        body: 'Content1',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(lowResult.current.levelColor).toContain('green');
      });

      // Test medium
      mockAnalyze.mockReturnValue({ ...mockResult, level: 'medium' });
      const { result: medResult } = renderHook(() => useSpamScore({
        subject: 'Med1',
        body: 'Content2',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(medResult.current.levelColor).toContain('yellow');
      });

      // Test high
      mockAnalyze.mockReturnValue({ ...mockResult, level: 'high' });
      const { result: highResult } = renderHook(() => useSpamScore({
        subject: 'High1',
        body: 'Content3',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(highResult.current.levelColor).toContain('orange');
      });

      // Test critical
      mockAnalyze.mockReturnValue({ ...mockResult, level: 'critical' });
      const { result: critResult } = renderHook(() => useSpamScore({
        subject: 'Crit1',
        body: 'Content4',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(critResult.current.levelColor).toContain('red');
      });
    });

    it('isSafeToSend is true only for low risk', async () => {
      mockAnalyze.mockReturnValue({ ...mockResult, level: 'low' });
      
      const { result } = renderHook(() => useSpamScore({
        subject: 'Safe1',
        body: 'Content',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.isSafeToSend).toBe(true);
      });

      // Test medium (not safe)
      mockAnalyze.mockReturnValue({ ...mockResult, level: 'medium' });
      const { result: result2 } = renderHook(() => useSpamScore({
        subject: 'Unsafe1',
        body: 'Content2',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result2.current.isSafeToSend).toBe(false);
      });
    });

    it('hasCriticalIssues detects critical level', async () => {
      mockAnalyze.mockReturnValue({ ...mockResult, level: 'critical' });
      
      const { result } = renderHook(() => useSpamScore({
        subject: 'Crit2',
        body: 'Content',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.hasCriticalIssues).toBe(true);
      });
    });

    it('hasCriticalIssues detects severity 5 issues', async () => {
      mockAnalyze.mockReturnValue(mockHighRiskResult);
      
      const { result } = renderHook(() => useSpamScore({
        subject: 'HighRisk1',
        body: 'Content',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.hasCriticalIssues).toBe(true);
      });
    });
  });

  describe('Helper functions', () => {
    it('getTopIssues returns sorted issues', async () => {
      mockAnalyze.mockReturnValue(mockHighRiskResult);
      
      const { result } = renderHook(() => useSpamScore({
        subject: 'Issue1',
        body: 'Content',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.result).not.toBe(null);
      });

      const topIssues = result.current.getTopIssues(2);
      expect(topIssues).toHaveLength(2);
      expect(topIssues[0].severity).toBe(5);
    });

    it('getTopIssues returns empty for null result', () => {
      const { result } = renderHook(() => useSpamScore({
        subject: '',
        body: '',
        debounceMs: 10,
      }));

      expect(result.current.getTopIssues()).toHaveLength(0);
    });

    it('hasIssueCategory checks for category', async () => {
      mockAnalyze.mockReturnValue(mockHighRiskResult);
      
      const { result } = renderHook(() => useSpamScore({
        subject: 'Cat1',
        body: 'Content',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.result).not.toBe(null);
      });

      expect(result.current.hasIssueCategory('spam_words')).toBe(true);
      expect(result.current.hasIssueCategory('deceptive')).toBe(false);
    });
  });

  describe('Refresh function', () => {
    it('refresh function is provided', async () => {
      const { result } = renderHook(() => useSpamScore({
        subject: 'Refresh1',
        body: 'Content',
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.result).not.toBe(null);
      });

      expect(typeof result.current.refresh).toBe('function');
    });
  });

  describe('API mode', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });
    });

    it('uses API when useApi is true', async () => {
      const { result } = renderHook(() => useSpamScore({
        subject: 'API1',
        body: 'Content',
        useApi: true,
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/email/spam-check',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              subject: 'API1',
              body: 'Content',
              isHtml: false,
            }),
          })
        );
      });

      // Local analyze should not be called
      expect(mockAnalyze).not.toHaveBeenCalled();
    });

    it('handles API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const { result } = renderHook(() => useSpamScore({
        subject: 'APIErr1',
        body: 'Content',
        useApi: true,
        debounceMs: 10,
      }));

      await waitFor(() => {
        expect(result.current.error).toBe('Server error');
      });
    });
  });
});
