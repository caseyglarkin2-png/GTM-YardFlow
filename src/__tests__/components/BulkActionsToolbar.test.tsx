/**
 * BulkActionsToolbar Tests - YardFlow Hub
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkActionsToolbar } from '../../components/BulkActionsToolbar';

describe('BulkActionsToolbar', () => {
  const defaultProps = {
    selectedCount: 5,
    onAssignSequence: vi.fn(),
    onAddTag: vi.fn(),
    onChangeStatus: vi.fn(),
    onExport: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render when selectedCount > 0', () => {
      render(<BulkActionsToolbar {...defaultProps} />);
      
      expect(screen.getByTestId('bulk-actions-toolbar')).toBeInTheDocument();
    });

    it('should not render when selectedCount is 0', () => {
      render(<BulkActionsToolbar {...defaultProps} selectedCount={0} />);
      
      expect(screen.queryByTestId('bulk-actions-toolbar')).not.toBeInTheDocument();
    });

    it('should display correct selection count', () => {
      render(<BulkActionsToolbar {...defaultProps} selectedCount={10} />);
      
      expect(screen.getByTestId('selection-count')).toHaveTextContent('10');
    });

    it('should have correct ARIA role', () => {
      render(<BulkActionsToolbar {...defaultProps} />);
      
      expect(screen.getByRole('toolbar')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should render all action buttons', () => {
      render(<BulkActionsToolbar {...defaultProps} />);
      
      expect(screen.getByTestId('bulk-assign-sequence')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-add-tag')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-change-status')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-export')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-delete')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-clear-selection')).toBeInTheDocument();
    });

    it('should call onAssignSequence when sequence button clicked', async () => {
      const user = userEvent.setup();
      render(<BulkActionsToolbar {...defaultProps} />);
      
      await user.click(screen.getByTestId('bulk-assign-sequence'));
      
      expect(defaultProps.onAssignSequence).toHaveBeenCalledTimes(1);
    });

    it('should call onAddTag when tag button clicked', async () => {
      const user = userEvent.setup();
      render(<BulkActionsToolbar {...defaultProps} />);
      
      await user.click(screen.getByTestId('bulk-add-tag'));
      
      expect(defaultProps.onAddTag).toHaveBeenCalledTimes(1);
    });

    it('should call onChangeStatus when status button clicked', async () => {
      const user = userEvent.setup();
      render(<BulkActionsToolbar {...defaultProps} />);
      
      await user.click(screen.getByTestId('bulk-change-status'));
      
      expect(defaultProps.onChangeStatus).toHaveBeenCalledTimes(1);
    });

    it('should call onExport when export button clicked', async () => {
      const user = userEvent.setup();
      render(<BulkActionsToolbar {...defaultProps} />);
      
      await user.click(screen.getByTestId('bulk-export'));
      
      expect(defaultProps.onExport).toHaveBeenCalledTimes(1);
    });

    it('should call onDelete when delete button clicked', async () => {
      const user = userEvent.setup();
      render(<BulkActionsToolbar {...defaultProps} />);
      
      await user.click(screen.getByTestId('bulk-delete'));
      
      expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
    });

    it('should call onClear when clear button clicked', async () => {
      const user = userEvent.setup();
      render(<BulkActionsToolbar {...defaultProps} />);
      
      await user.click(screen.getByTestId('bulk-clear-selection'));
      
      expect(defaultProps.onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('Disabled State', () => {
    it('should disable all action buttons when isProcessing is true', () => {
      render(<BulkActionsToolbar {...defaultProps} isProcessing={true} />);
      
      expect(screen.getByTestId('bulk-assign-sequence')).toBeDisabled();
      expect(screen.getByTestId('bulk-add-tag')).toBeDisabled();
      expect(screen.getByTestId('bulk-change-status')).toBeDisabled();
      expect(screen.getByTestId('bulk-delete')).toBeDisabled();
    });

    it('should disable export button when isExporting is true', () => {
      render(<BulkActionsToolbar {...defaultProps} isExporting={true} />);
      
      expect(screen.getByTestId('bulk-export')).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for all buttons', () => {
      render(<BulkActionsToolbar {...defaultProps} />);
      
      expect(screen.getByLabelText(/assign selected prospects to a sequence/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/add tags to selected prospects/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/change status of selected prospects/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/export selected prospects/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/delete selected prospects/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/clear all selections/i)).toBeInTheDocument();
    });

    it('should have aria-live region for announcements', () => {
      render(<BulkActionsToolbar {...defaultProps} />);
      
      expect(screen.getByRole('toolbar')).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Visual Feedback', () => {
    it('should show animation class when visible', async () => {
      render(<BulkActionsToolbar {...defaultProps} />);
      
      // Wait for visibility animation
      await waitFor(() => {
        const toolbar = screen.getByTestId('bulk-actions-toolbar');
        expect(toolbar.className).toContain('opacity-100');
      });
    });

    it('should style delete button as destructive', () => {
      render(<BulkActionsToolbar {...defaultProps} />);
      
      const deleteButton = screen.getByTestId('bulk-delete');
      expect(deleteButton.className).toContain('text-red');
    });
  });
});

describe('BulkSequenceModal', () => {
  it.skip('should render sequence modal (TODO: implement)', () => {
    // Basic modal tests would go here - testing import/component separately
  });
});

describe('BulkTagModal', () => {
  it.skip('should render tag modal (TODO: implement)', () => {
    // Basic modal tests would go here - testing import/component separately
  });
});

describe('BulkDeleteModal', () => {
  it.skip('should render delete modal (TODO: implement)', () => {
    // Basic modal tests would go here - testing import/component separately
  });
});
