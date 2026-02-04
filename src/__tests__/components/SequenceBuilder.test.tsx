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
  const mockSequence: EmailSequence = {
    id: 'seq-1',
    name: 'Test Sequence',
    description: 'Test description',
    steps: [
      {
        id: 'step-1',
        type: 'initial',
        subject: 'Initial Email Subject',
        body: 'Hello {{firstName}}, this is an initial email.',
        delayDays: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'step-2',
        type: 'follow_up_1',
        subject: 'Follow-up Subject',
        body: 'Just checking in...',
        delayDays: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

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
