/**
 * StepPreview Tests - Sprint 702
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepPreview } from '../../../components/sequence/StepPreview';
import type { EmailStep } from '@/types/emailSequence';

describe('StepPreview', () => {
  const mockStep: EmailStep = {
    id: 'step-1',
    type: 'initial',
    subject: 'Hello {{firstName}}!',
    body: 'Hi {{firstName}},\n\nI wanted to reach out about {{company}}.',
    delayDays: 0,
    condition: 'no_reply',
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Empty State', () => {
    it('shows empty state when no step provided', () => {
      render(<StepPreview step={null} />);
      
      expect(screen.getByText('No Step Selected')).toBeInTheDocument();
    });
    
    it('shows custom empty state when provided', () => {
      render(
        <StepPreview 
          step={null} 
          emptyState={<div data-testid="custom-empty">Custom</div>} 
        />
      );
      
      expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
    });
  });
  
  describe('Preview Mode', () => {
    it('displays step type label', () => {
      render(<StepPreview step={mockStep} />);
      
      expect(screen.getByText('Initial Outreach')).toBeInTheDocument();
    });
    
    it('displays step number', () => {
      render(<StepPreview step={mockStep} stepIndex={0} />);
      
      expect(screen.getByText('1')).toBeInTheDocument();
    });
    
    it('displays delay information', () => {
      const stepWithDelay = { ...mockStep, delayDays: 3 };
      render(<StepPreview step={stepWithDelay} stepIndex={1} />);
      
      expect(screen.getByText(/3 days after previous/)).toBeInTheDocument();
    });
    
    it('highlights merge tags in subject', () => {
      render(<StepPreview step={mockStep} />);
      
      // firstName merge tag should be highlighted
      expect(screen.getAllByText('First Name')[0]).toHaveClass('px-1');
    });
    
    it('highlights merge tags in body', () => {
      render(<StepPreview step={mockStep} />);
      
      // Company merge tag should be highlighted
      expect(screen.getAllByText('Company')[0]).toHaveClass('px-1');
    });
    
    it('shows validation status', () => {
      render(<StepPreview step={mockStep} />);
      
      expect(screen.getByText('Valid')).toBeInTheDocument();
    });
    
    it('shows error count when errors present', () => {
      render(
        <StepPreview 
          step={mockStep} 
          errors={[{ field: 'subject', message: 'Required' }]} 
        />
      );
      
      expect(screen.getByText('1 issue')).toBeInTheDocument();
    });
    
    it('shows error message for specific field', () => {
      render(
        <StepPreview 
          step={mockStep} 
          errors={[{ field: 'subject', message: 'Subject is required' }]} 
        />
      );
      
      expect(screen.getByText('Subject is required')).toBeInTheDocument();
    });
  });
  
  describe('Edit Mode', () => {
    it('shows edit button when editable', () => {
      render(<StepPreview step={mockStep} editable />);
      
      expect(screen.getByRole('button', { name: /edit step/i })).toBeInTheDocument();
    });
    
    it('does not show edit button when not editable', () => {
      render(<StepPreview step={mockStep} editable={false} />);
      
      expect(screen.queryByRole('button', { name: /edit step/i })).not.toBeInTheDocument();
    });
    
    it('enters edit mode on edit button click', () => {
      render(<StepPreview step={mockStep} editable onUpdate={vi.fn()} />);
      
      fireEvent.click(screen.getByRole('button', { name: /edit step/i }));
      
      // Should show input fields
      expect(screen.getByPlaceholderText(/enter subject/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/write your email/i)).toBeInTheDocument();
    });
    
    it('populates inputs with current values', () => {
      render(<StepPreview step={mockStep} editable onUpdate={vi.fn()} />);
      
      fireEvent.click(screen.getByRole('button', { name: /edit step/i }));
      
      expect(screen.getByDisplayValue('Hello {{firstName}}!')).toBeInTheDocument();
    });
    
    it('shows save and cancel buttons in edit mode', () => {
      render(<StepPreview step={mockStep} editable onUpdate={vi.fn()} />);
      
      fireEvent.click(screen.getByRole('button', { name: /edit step/i }));
      
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
    
    it('calls onUpdate with new values on save', () => {
      const onUpdate = vi.fn();
      render(<StepPreview step={mockStep} editable onUpdate={onUpdate} />);
      
      // Enter edit mode
      fireEvent.click(screen.getByRole('button', { name: /edit step/i }));
      
      // Change subject
      const subjectInput = screen.getByDisplayValue('Hello {{firstName}}!');
      fireEvent.change(subjectInput, { target: { value: 'New Subject' } });
      
      // Save
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      
      expect(onUpdate).toHaveBeenCalledWith({
        subject: 'New Subject',
        body: mockStep.body,
      });
    });
    
    it('discards changes on cancel', () => {
      const onUpdate = vi.fn();
      render(<StepPreview step={mockStep} editable onUpdate={onUpdate} />);
      
      // Enter edit mode
      fireEvent.click(screen.getByRole('button', { name: /edit step/i }));
      
      // Change subject
      const subjectInput = screen.getByDisplayValue('Hello {{firstName}}!');
      fireEvent.change(subjectInput, { target: { value: 'New Subject' } });
      
      // Cancel
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      
      expect(onUpdate).not.toHaveBeenCalled();
      // Should be back in preview mode
      expect(screen.queryByPlaceholderText(/enter subject/i)).not.toBeInTheDocument();
    });
  });
  
  describe('Merge Tag Insertion', () => {
    it('shows available merge tags', () => {
      render(<StepPreview step={mockStep} />);
      
      expect(screen.getByText('First Name')).toBeInTheDocument();
      expect(screen.getByText('Last Name')).toBeInTheDocument();
      expect(screen.getByText('Company')).toBeInTheDocument();
    });
    
    it('merge tag buttons are disabled in preview mode', () => {
      render(<StepPreview step={mockStep} />);
      
      // Find merge tag button in the "Available Merge Tags" section
      const buttons = screen.getAllByRole('button');
      const mergeTagButton = buttons.find(b => b.textContent === 'First Name');
      expect(mergeTagButton).toBeDisabled();
    });
    
    it('merge tag buttons are enabled in edit mode', () => {
      render(<StepPreview step={mockStep} editable onUpdate={vi.fn()} />);
      
      fireEvent.click(screen.getByRole('button', { name: /edit step/i }));
      
      // Find merge tag buttons
      const buttons = screen.getAllByRole('button');
      const mergeTagButtons = buttons.filter(b => 
        ['First Name', 'Last Name', 'Company', 'Title', 'Sender'].includes(b.textContent || '')
      );
      
      mergeTagButtons.forEach(button => {
        expect(button).not.toBeDisabled();
      });
    });
  });
});
