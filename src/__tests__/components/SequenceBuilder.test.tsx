/**
 * SequenceBuilder Tests - Sprint V34 P2.1
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SequenceBuilder } from '../../components/SequenceBuilder';
import type { EmailSequence } from '@/types/emailSequence';

// Mock hooks
vi.mock('@/hooks/useSequences', () => ({
  useSequences: () => ({
    sequences: [],
    isLoading: false,
    error: null,
    createSequence: vi.fn(),
    updateSequence: vi.fn(),
    deleteSequence: vi.fn(),
    isRailwayEnabled: false,
  }),
}));

vi.mock('@/components/SequenceTemplateLibrary', () => ({
  SequenceTemplateLibrary: () => <div data-testid="template-library">Template Library</div>,
}));

describe('SequenceBuilder', () => {
  // Use Partial to avoid all the default fields
  const mockSequence = {
    id: 'seq-1',
    name: 'Test Sequence',
    description: 'Test description',
    steps: [
      {
        id: 'step-1',
        type: 'initial' as const,
        subject: 'Initial Email Subject',
        body: 'Hello {{firstName}}, this is an initial email.',
        delayDays: 0,
        condition: 'always' as const,
      },
      {
        id: 'step-2',
        type: 'follow_up_1' as const,
        subject: 'Follow-up Subject',
        body: 'Just checking in...',
        delayDays: 3,
        condition: 'no_reply' as const,
      },
    ],
    status: 'active' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    enrolledCount: 0,
    completedCount: 0,
    skipWeekends: true,
    pauseOnReply: true,
    pauseOnMeeting: true,
    timezone: 'America/New_York',
  } satisfies EmailSequence;

  it('renders sequence builder', () => {
    render(<SequenceBuilder initialSequence={mockSequence} />);
    // Input field should have the sequence name
    expect(screen.getByDisplayValue('Test Sequence')).toBeInTheDocument();
  });

  it('shows steps', () => {
    render(<SequenceBuilder initialSequence={mockSequence} />);
    // Use getAllByText since there may be multiple matching elements (dropdown options, etc.)
    expect(screen.getAllByText('Initial Outreach').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Follow-up 1').length).toBeGreaterThan(0);
  });

  describe('Step Preview (Sprint V34 P2.1)', () => {
    it('shows delay info for non-first steps', () => {
      render(<SequenceBuilder initialSequence={mockSequence} />);
      expect(screen.getByText(/3 days after previous/)).toBeInTheDocument();
    });

    it('renders step type labels', () => {
      render(<SequenceBuilder initialSequence={mockSequence} />);
      // Use getAllByText since there may be multiple matching elements
      expect(screen.getAllByText('Initial Outreach').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Follow-up 1').length).toBeGreaterThan(0);
    });
  });
});
