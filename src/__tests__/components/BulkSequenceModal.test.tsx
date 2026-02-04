/**
 * Tests for BulkSequenceModal Component
 * 
 * Sprint V33: Template selection feature
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkSequenceModal, Sequence } from '../../components/BulkSequenceModal';

// Mock the templates
vi.mock('@/data/sequenceTemplates', () => ({
  MANIFEST_SEQUENCES: [
    {
      id: 'template-1',
      name: 'Template One',
      description: 'Test template description',
      category: 'test',
      persona: 'test_persona',
      steps: [
        { delayDays: 0, type: 'initial', subjectTemplate: 'Subject', bodyTemplate: 'Body' }
      ],
    },
    {
      id: 'template-2',
      name: 'Template Two',
      description: 'Another template',
      category: 'outreach',
      persona: 'ops',
      steps: [
        { delayDays: 0, type: 'initial', subjectTemplate: 'Sub1', bodyTemplate: 'Body1' },
        { delayDays: 3, type: 'followup', subjectTemplate: 'Sub2', bodyTemplate: 'Body2' },
      ],
    },
  ],
}));

describe('BulkSequenceModal', () => {
  const mockSequences: Sequence[] = [
    {
      id: 'seq-1',
      name: 'Existing Sequence',
      description: 'An existing sequence',
      stepCount: 3,
      activeProspects: 10,
      status: 'active',
    },
    {
      id: 'seq-2',
      name: 'Draft Sequence',
      description: 'A draft sequence',
      stepCount: 2,
      activeProspects: 0,
      status: 'draft',
    },
  ];

  let mockOnClose: () => void;
  let mockOnConfirm: (id: string) => Promise<void>;
  let mockOnCreateFromTemplate: ((template: unknown) => Promise<string | null>) | undefined;

  beforeEach(() => {
    mockOnClose = vi.fn();
    mockOnConfirm = vi.fn().mockResolvedValue(undefined);
    mockOnCreateFromTemplate = vi.fn().mockResolvedValue('new-seq-id');
  });

  describe('Basic Rendering', () => {
    it('does not render when isOpen is false', () => {
      render(
        <BulkSequenceModal
          isOpen={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={5}
          sequences={mockSequences}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders dialog when isOpen is true', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={5}
          sequences={mockSequences}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Add 5 prospects to a sequence')).toBeInTheDocument();
    });

    it('displays sequences in list', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={mockSequences}
        />
      );

      expect(screen.getByText('Existing Sequence')).toBeInTheDocument();
      expect(screen.getByText('Draft Sequence')).toBeInTheDocument();
    });
  });

  describe('Tab Switching (Sprint V33)', () => {
    it('shows tab buttons for sequences and templates', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={mockSequences}
        />
      );

      expect(screen.getByTestId('tab-sequences')).toBeInTheDocument();
      expect(screen.getByTestId('tab-templates')).toBeInTheDocument();
      expect(screen.getByText(/My Sequences/)).toBeInTheDocument();
      expect(screen.getByText(/Templates/)).toBeInTheDocument();
    });

    it('defaults to sequences tab', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={mockSequences}
        />
      );

      const sequencesTab = screen.getByTestId('tab-sequences');
      expect(sequencesTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Existing Sequence')).toBeInTheDocument();
    });

    it('switches to templates tab when clicked', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={mockSequences}
        />
      );

      fireEvent.click(screen.getByTestId('tab-templates'));

      const templatesTab = screen.getByTestId('tab-templates');
      expect(templatesTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Template One')).toBeInTheDocument();
      expect(screen.getByText('Template Two')).toBeInTheDocument();
    });

    it('clears selection when switching tabs', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={mockSequences}
        />
      );

      // Select a sequence
      fireEvent.click(screen.getByTestId('sequence-option-seq-1'));
      
      // Switch to templates
      fireEvent.click(screen.getByTestId('tab-templates'));
      
      // Switch back to sequences - selection should be cleared
      fireEvent.click(screen.getByTestId('tab-sequences'));
      
      // Confirm button should be disabled (no selection)
      expect(screen.getByTestId('sequence-modal-confirm')).toBeDisabled();
    });
  });

  describe('Template Selection', () => {
    it('selects template when clicked', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={mockSequences}
          onCreateFromTemplate={mockOnCreateFromTemplate}
        />
      );

      // Switch to templates tab
      fireEvent.click(screen.getByTestId('tab-templates'));
      
      // Click a template
      fireEvent.click(screen.getByTestId('template-option-template-1'));
      
      // Button should show template-specific text
      expect(screen.getByText('Create & Assign')).toBeInTheDocument();
    });

    it('shows template step count', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={mockSequences}
        />
      );

      fireEvent.click(screen.getByTestId('tab-templates'));
      
      expect(screen.getByText('1 steps')).toBeInTheDocument(); // Template One
      expect(screen.getByText('2 steps')).toBeInTheDocument(); // Template Two
    });

    it('calls onCreateFromTemplate then onConfirm when template confirmed', async () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={mockSequences}
          onCreateFromTemplate={mockOnCreateFromTemplate}
        />
      );

      // Switch to templates and select one
      fireEvent.click(screen.getByTestId('tab-templates'));
      fireEvent.click(screen.getByTestId('template-option-template-1'));
      
      // Click confirm
      fireEvent.click(screen.getByTestId('sequence-modal-confirm'));
      
      await waitFor(() => {
        expect(mockOnCreateFromTemplate).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'template-1', name: 'Template One' })
        );
      });
      
      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith('new-seq-id');
      });
    });
  });

  describe('Search Functionality', () => {
    it('filters sequences by search query', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={mockSequences}
        />
      );

      const searchInput = screen.getByTestId('sequence-search-input');
      fireEvent.change(searchInput, { target: { value: 'Draft' } });

      expect(screen.getByText('Draft Sequence')).toBeInTheDocument();
      expect(screen.queryByText('Existing Sequence')).not.toBeInTheDocument();
    });

    it('filters templates by search query', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={mockSequences}
        />
      );

      fireEvent.click(screen.getByTestId('tab-templates'));
      
      const searchInput = screen.getByTestId('sequence-search-input');
      fireEvent.change(searchInput, { target: { value: 'Two' } });

      expect(screen.getByText('Template Two')).toBeInTheDocument();
      expect(screen.queryByText('Template One')).not.toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading state', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={[]}
          isLoading={true}
        />
      );

      expect(screen.getByTestId('sequence-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading sequences...')).toBeInTheDocument();
    });

    it('shows error state with retry button', () => {
      const mockRetry = vi.fn();
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={[]}
          error="Network error"
          onRetry={mockRetry}
        />
      );

      expect(screen.getByTestId('sequence-error')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Retry'));
      expect(mockRetry).toHaveBeenCalled();
    });

    it('shows empty state with link to templates when no sequences', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={[]}
        />
      );

      expect(screen.getByText('No sequences available')).toBeInTheDocument();
      expect(screen.getByText('Browse templates to get started')).toBeInTheDocument();
    });
  });

  describe('Close and Cancel', () => {
    it('calls onClose when X button clicked', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={mockSequences}
        />
      );

      fireEvent.click(screen.getByTestId('sequence-modal-close'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when Cancel button clicked', () => {
      render(
        <BulkSequenceModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          selectedCount={3}
          sequences={mockSequences}
        />
      );

      fireEvent.click(screen.getByTestId('sequence-modal-cancel'));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
