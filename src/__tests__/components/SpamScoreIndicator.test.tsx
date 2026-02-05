/**
 * SpamScoreIndicator Component Tests
 * 
 * Sprint 39C.4: Tests for spam score visual indicator
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpamScoreIndicator } from '@/components/SpamScoreIndicator';
import type { SpamScoreResult, SpamRiskLevel } from '@/types/spamScore';

// ============================================
// Test Fixtures
// ============================================

const createMockResult = (overrides: Partial<SpamScoreResult> = {}): SpamScoreResult => ({
  score: 15,
  level: 'low' as SpamRiskLevel,
  issues: [],
  suggestions: ['Add unsubscribe link', 'Include physical address'],
  analysis: {
    subject: { score: 5, capsRatio: 0.1, length: 20, hasSpamWords: false, spamWordsFound: [] },
    body: { score: 10, spamWordCount: 0, spamWordsFound: [], hasExcessiveFormatting: false, imageCount: 0, linkCount: 1 },
    links: { score: 0, totalLinks: 1, suspiciousLinks: [], excessiveLinks: false },
    quality: { readabilityScore: 80, personalization: true, hasUnsubscribe: false, hasPhysicalAddress: true },
  },
  ...overrides,
});

const mockHighRiskResult: SpamScoreResult = {
  score: 65,
  level: 'high',
  issues: [
    { category: 'spam_words', description: 'Subject contains spam trigger words', severity: 5, location: 'subject' },
    { category: 'formatting', description: 'Excessive use of capital letters', severity: 4, location: 'body' },
    { category: 'links', description: 'Contains URL shortener links', severity: 3, location: 'link' },
  ],
  suggestions: ['Remove spam words from subject', 'Reduce caps usage', 'Use full URLs'],
  analysis: {
    subject: { score: 20, capsRatio: 0.8, length: 30, hasSpamWords: true, spamWordsFound: ['free', 'urgent'] },
    body: { score: 30, spamWordCount: 5, spamWordsFound: ['free', 'money'], hasExcessiveFormatting: true, imageCount: 0, linkCount: 3 },
    links: { score: 15, totalLinks: 3, suspiciousLinks: ['http://bit.ly/test'], excessiveLinks: false },
    quality: { readabilityScore: 50, personalization: false, hasUnsubscribe: true, hasPhysicalAddress: false },
  },
};

const mockCriticalResult: SpamScoreResult = {
  score: 85,
  level: 'critical',
  issues: [
    { category: 'spam_words', description: 'Multiple spam trigger words detected', severity: 5, location: 'subject' },
    { category: 'deceptive', description: 'Deceptive link text detected', severity: 5, location: 'link' },
  ],
  suggestions: ['Complete rewrite recommended'],
  analysis: {
    subject: { score: 25, capsRatio: 1.0, length: 50, hasSpamWords: true, spamWordsFound: ['free', 'urgent', 'act now'] },
    body: { score: 40, spamWordCount: 10, spamWordsFound: ['free', 'money', 'click here'], hasExcessiveFormatting: true, imageCount: 5, linkCount: 10 },
    links: { score: 20, totalLinks: 10, suspiciousLinks: ['http://bit.ly/a', 'http://bit.ly/b'], excessiveLinks: true },
    quality: { readabilityScore: 30, personalization: false, hasUnsubscribe: false, hasPhysicalAddress: false },
  },
};

// ============================================
// Tests
// ============================================

describe('SpamScoreIndicator', () => {
  describe('Loading state', () => {
    it('shows loading message when loading without result', () => {
      render(<SpamScoreIndicator result={null} isLoading={true} />);
      
      expect(screen.getByText(/analyzing content/i)).toBeInTheDocument();
    });

    it('shows placeholder when no result and not loading', () => {
      render(<SpamScoreIndicator result={null} isLoading={false} />);
      
      expect(screen.getByText(/start typing to see spam analysis/i)).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('displays error message', () => {
      render(<SpamScoreIndicator result={null} error="Analysis failed" />);
      
      expect(screen.getByText(/failed to analyze/i)).toBeInTheDocument();
      expect(screen.getByText(/analysis failed/i)).toBeInTheDocument();
    });
  });

  describe('Result display - Low risk', () => {
    it('shows LOW risk level badge', () => {
      render(<SpamScoreIndicator result={createMockResult()} />);
      
      expect(screen.getByText('LOW')).toBeInTheDocument();
    });

    it('shows the spam score', () => {
      render(<SpamScoreIndicator result={createMockResult({ score: 15 })} />);
      
      expect(screen.getByText(/score: 15/i)).toBeInTheDocument();
    });

    it('shows safe to send indicator', () => {
      render(<SpamScoreIndicator result={createMockResult()} />);
      
      expect(screen.getByText(/safe to send/i)).toBeInTheDocument();
    });
  });

  describe('Result display - Medium risk', () => {
    it('shows MEDIUM risk level badge', () => {
      render(<SpamScoreIndicator result={createMockResult({ level: 'medium', score: 35 })} />);
      
      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    });

    it('shows review suggested indicator', () => {
      render(<SpamScoreIndicator result={createMockResult({ level: 'medium', score: 35 })} />);
      
      expect(screen.getByText(/review suggested/i)).toBeInTheDocument();
    });
  });

  describe('Result display - High risk', () => {
    it('shows HIGH risk level badge', () => {
      render(<SpamScoreIndicator result={mockHighRiskResult} />);
      
      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('shows needs attention indicator', () => {
      render(<SpamScoreIndicator result={mockHighRiskResult} />);
      
      expect(screen.getByText(/needs attention/i)).toBeInTheDocument();
    });

    it('shows issue count', () => {
      render(<SpamScoreIndicator result={mockHighRiskResult} />);
      
      expect(screen.getByText(/3 issues/i)).toBeInTheDocument();
    });
  });

  describe('Result display - Critical risk', () => {
    it('shows CRITICAL risk level badge', () => {
      render(<SpamScoreIndicator result={mockCriticalResult} />);
      
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });

    it('shows needs attention for critical issues', () => {
      render(<SpamScoreIndicator result={mockCriticalResult} />);
      
      expect(screen.getByText(/needs attention/i)).toBeInTheDocument();
    });
  });

  describe('Expandable details', () => {
    it('expands to show issues when header is clicked', () => {
      render(<SpamScoreIndicator result={mockHighRiskResult} />);
      
      // Click header to expand
      const header = screen.getByTestId('spam-score-indicator-header');
      fireEvent.click(header);
      
      // Should show issues
      expect(screen.getByTestId('spam-score-indicator-details')).toBeInTheDocument();
      expect(screen.getByText(/subject contains spam trigger words/i)).toBeInTheDocument();
    });

    it('shows severity badges for issues', () => {
      render(<SpamScoreIndicator result={mockHighRiskResult} />);
      
      fireEvent.click(screen.getByTestId('spam-score-indicator-header'));
      
      // Should show Critical and High severity badges
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('shows suggestions when expanded', () => {
      render(<SpamScoreIndicator result={mockHighRiskResult} />);
      
      fireEvent.click(screen.getByTestId('spam-score-indicator-header'));
      
      expect(screen.getByText(/remove spam words from subject/i)).toBeInTheDocument();
    });

    it('shows score breakdown when expanded', () => {
      render(<SpamScoreIndicator result={mockHighRiskResult} />);
      
      fireEvent.click(screen.getByTestId('spam-score-indicator-header'));
      
      expect(screen.getByText('Score Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Subject')).toBeInTheDocument();
      expect(screen.getByText('Body')).toBeInTheDocument();
      expect(screen.getByText('Links')).toBeInTheDocument();
    });

    it('collapses when clicked again', () => {
      render(<SpamScoreIndicator result={mockHighRiskResult} />);
      
      const header = screen.getByTestId('spam-score-indicator-header');
      fireEvent.click(header); // Expand
      expect(screen.getByTestId('spam-score-indicator-details')).toBeInTheDocument();
      
      fireEvent.click(header); // Collapse
      expect(screen.queryByTestId('spam-score-indicator-details')).not.toBeInTheDocument();
    });
  });

  describe('Compact mode', () => {
    it('renders compact badge', () => {
      render(<SpamScoreIndicator result={createMockResult()} compact />);
      
      expect(screen.getByText('LOW')).toBeInTheDocument();
      expect(screen.getByText('(15)')).toBeInTheDocument();
    });

    it('shows loading in compact mode', () => {
      render(<SpamScoreIndicator result={null} isLoading compact />);
      
      expect(screen.getByText('Analyzing...')).toBeInTheDocument();
    });

    it('renders nothing in compact mode with no result', () => {
      const { container } = render(<SpamScoreIndicator result={null} compact />);
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('respects maxIssues prop', () => {
      const manyIssuesResult = {
        ...mockHighRiskResult,
        issues: [
          { category: 'spam_words', description: 'Issue 1', severity: 5, location: 'subject' as const },
          { category: 'formatting', description: 'Issue 2', severity: 4, location: 'body' as const },
          { category: 'links', description: 'Issue 3', severity: 3, location: 'link' as const },
          { category: 'compliance', description: 'Issue 4', severity: 2, location: 'general' as const },
          { category: 'quality', description: 'Issue 5', severity: 1, location: 'general' as const },
        ],
      };

      render(<SpamScoreIndicator result={manyIssuesResult} maxIssues={2} />);
      
      fireEvent.click(screen.getByTestId('spam-score-indicator-header'));
      
      // Should show "+3 more issues"
      expect(screen.getByText(/\+3 more issues/i)).toBeInTheDocument();
    });

    it('hides breakdown when showBreakdown is false', () => {
      render(<SpamScoreIndicator result={mockHighRiskResult} showBreakdown={false} />);
      
      // Click should do nothing if showBreakdown is false
      fireEvent.click(screen.getByTestId('spam-score-indicator-header'));
      
      expect(screen.queryByTestId('spam-score-indicator-details')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<SpamScoreIndicator result={createMockResult()} className="custom-class" />);
      
      expect(screen.getByTestId('spam-score-indicator').classList.contains('custom-class')).toBe(true);
    });

    it('applies custom testId', () => {
      render(<SpamScoreIndicator result={createMockResult()} testId="my-custom-id" />);
      
      expect(screen.getByTestId('my-custom-id')).toBeInTheDocument();
    });
  });

  describe('Issue sorting', () => {
    it('sorts issues by severity (highest first)', () => {
      const mixedIssues = {
        ...mockHighRiskResult,
        issues: [
          { category: 'low_pri', description: 'Low priority', severity: 1, location: 'general' as const },
          { category: 'high_pri', description: 'High priority', severity: 5, location: 'subject' as const },
          { category: 'med_pri', description: 'Medium priority', severity: 3, location: 'body' as const },
        ],
      };

      render(<SpamScoreIndicator result={mixedIssues} />);
      
      fireEvent.click(screen.getByTestId('spam-score-indicator-header'));
      
      const issues = screen.getAllByText(/priority/i);
      expect(issues[0].textContent).toBe('High priority');
      expect(issues[1].textContent).toBe('Medium priority');
      expect(issues[2].textContent).toBe('Low priority');
    });
  });

  describe('No issues state', () => {
    it('shows no issues message when result has no issues', () => {
      render(<SpamScoreIndicator result={createMockResult({ issues: [] })} />);
      
      fireEvent.click(screen.getByTestId('spam-score-indicator-header'));
      
      expect(screen.getByText(/no spam issues detected/i)).toBeInTheDocument();
    });
  });

  describe('Category formatting', () => {
    it('formats category names for display', () => {
      const result = createMockResult({
        issues: [
          { category: 'spam_words', description: 'Test issue', severity: 3, location: 'body' },
        ],
      });

      render(<SpamScoreIndicator result={result} />);
      
      fireEvent.click(screen.getByTestId('spam-score-indicator-header'));
      
      expect(screen.getByText(/spam words/i)).toBeInTheDocument();
    });
  });
});
