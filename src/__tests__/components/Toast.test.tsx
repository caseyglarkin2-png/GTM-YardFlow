/**
 * Toast Component Tests
 * 
 * Tests for the Toast notification system
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastContainer, useToast, type ToastMessage } from '../../components/Toast';
import React from 'react';

// Test component that uses the hook
function ToastTestComponent() {
  const { toasts, dismissToast, success, error, warning, info } = useToast();
  
  return (
    <div>
      <button data-testid="success-btn" onClick={() => success('Success Title', 'Success Description')}>
        Show Success
      </button>
      <button data-testid="error-btn" onClick={() => error('Error Title', 'Error Description')}>
        Show Error
      </button>
      <button data-testid="warning-btn" onClick={() => warning('Warning Title', 'Warning Description')}>
        Show Warning
      </button>
      <button data-testid="info-btn" onClick={() => info('Info Title', 'Info Description')}>
        Show Info
      </button>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('ToastContainer', () => {
    it('renders nothing when toasts array is empty', () => {
      const { container } = render(
        <ToastContainer toasts={[]} onDismiss={() => {}} />
      );
      expect(container.firstChild).toBeNull();
    });
    
    it('renders toast messages', () => {
      const toasts: ToastMessage[] = [
        { id: '1', type: 'success', title: 'Test Toast', description: 'Test Description' }
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
      
      expect(screen.getByText('Test Toast')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
    });
    
    it('renders multiple toasts', () => {
      const toasts: ToastMessage[] = [
        { id: '1', type: 'success', title: 'Toast 1' },
        { id: '2', type: 'error', title: 'Toast 2' },
        { id: '3', type: 'warning', title: 'Toast 3' },
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
      
      expect(screen.getByText('Toast 1')).toBeInTheDocument();
      expect(screen.getByText('Toast 2')).toBeInTheDocument();
      expect(screen.getByText('Toast 3')).toBeInTheDocument();
    });
    
    it('calls onDismiss when dismiss button clicked', () => {
      const onDismiss = vi.fn();
      const toasts: ToastMessage[] = [
        { id: 'toast-1', type: 'info', title: 'Dismissable Toast' }
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />);
      
      const dismissBtn = screen.getByLabelText('Dismiss');
      fireEvent.click(dismissBtn);
      
      expect(onDismiss).toHaveBeenCalledWith('toast-1');
    });
    
    it('applies correct position class for bottom-right', () => {
      const toasts: ToastMessage[] = [
        { id: '1', type: 'success', title: 'Test' }
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={() => {}} position="bottom-right" />);
      
      const container = screen.getByLabelText('Notifications');
      expect(container).toHaveClass('bottom-4');
      expect(container).toHaveClass('right-4');
    });
    
    it('applies correct position class for top-left', () => {
      const toasts: ToastMessage[] = [
        { id: '1', type: 'success', title: 'Test' }
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={() => {}} position="top-left" />);
      
      const container = screen.getByLabelText('Notifications');
      expect(container).toHaveClass('top-4');
      expect(container).toHaveClass('left-4');
    });
    
    it('has correct ARIA role', () => {
      const toasts: ToastMessage[] = [
        { id: '1', type: 'error', title: 'Error' }
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
  
  describe('Toast types', () => {
    it('renders success toast with correct styling', () => {
      const toasts: ToastMessage[] = [
        { id: '1', type: 'success', title: 'Success' }
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
      
      const toast = screen.getByTestId('toast-success');
      expect(toast).toHaveClass('bg-green-50');
      expect(toast).toHaveClass('border-green-200');
    });
    
    it('renders error toast with correct styling', () => {
      const toasts: ToastMessage[] = [
        { id: '1', type: 'error', title: 'Error' }
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
      
      const toast = screen.getByTestId('toast-error');
      expect(toast).toHaveClass('bg-red-50');
      expect(toast).toHaveClass('border-red-200');
    });
    
    it('renders warning toast with correct styling', () => {
      const toasts: ToastMessage[] = [
        { id: '1', type: 'warning', title: 'Warning' }
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
      
      const toast = screen.getByTestId('toast-warning');
      expect(toast).toHaveClass('bg-amber-50');
      expect(toast).toHaveClass('border-amber-200');
    });
    
    it('renders info toast with correct styling', () => {
      const toasts: ToastMessage[] = [
        { id: '1', type: 'info', title: 'Info' }
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
      
      const toast = screen.getByTestId('toast-info');
      expect(toast).toHaveClass('bg-blue-50');
      expect(toast).toHaveClass('border-blue-200');
    });
  });
  
  describe('useToast hook', () => {
    it('adds success toast', () => {
      render(<ToastTestComponent />);
      
      fireEvent.click(screen.getByTestId('success-btn'));
      
      expect(screen.getByText('Success Title')).toBeInTheDocument();
      expect(screen.getByText('Success Description')).toBeInTheDocument();
    });
    
    it('adds error toast', () => {
      render(<ToastTestComponent />);
      
      fireEvent.click(screen.getByTestId('error-btn'));
      
      expect(screen.getByText('Error Title')).toBeInTheDocument();
      expect(screen.getByText('Error Description')).toBeInTheDocument();
    });
    
    it('adds warning toast', () => {
      render(<ToastTestComponent />);
      
      fireEvent.click(screen.getByTestId('warning-btn'));
      
      expect(screen.getByText('Warning Title')).toBeInTheDocument();
      expect(screen.getByText('Warning Description')).toBeInTheDocument();
    });
    
    it('adds info toast', () => {
      render(<ToastTestComponent />);
      
      fireEvent.click(screen.getByTestId('info-btn'));
      
      expect(screen.getByText('Info Title')).toBeInTheDocument();
      expect(screen.getByText('Info Description')).toBeInTheDocument();
    });
    
    it('auto-dismisses toast after duration', async () => {
      render(<ToastTestComponent />);
      
      fireEvent.click(screen.getByTestId('success-btn'));
      expect(screen.getByText('Success Title')).toBeInTheDocument();
      
      // Fast-forward 5 seconds (default duration) + 200ms exit animation
      await act(async () => {
        vi.advanceTimersByTime(5200);
      });
      
      expect(screen.queryByText('Success Title')).not.toBeInTheDocument();
    });
    
    it('does not auto-dismiss persistent toast (duration 0)', () => {
      const PersistentToastTestComponent = () => {
        const { toasts, dismissToast, addToast } = useToast();
        
        return (
          <div>
            <button 
              data-testid="persistent-btn" 
              onClick={() => addToast({ type: 'info', title: 'Persistent', duration: 0 })}
            >
              Show Persistent
            </button>
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
          </div>
        );
      };
      
      render(<PersistentToastTestComponent />);
      
      fireEvent.click(screen.getByTestId('persistent-btn'));
      expect(screen.getByText('Persistent')).toBeInTheDocument();
      
      // Fast-forward way past normal timeout
      act(() => {
        vi.advanceTimersByTime(60000);
      });
      
      // Should still be there
      expect(screen.getByText('Persistent')).toBeInTheDocument();
    });
    
    it('can add multiple toasts', () => {
      render(<ToastTestComponent />);
      
      fireEvent.click(screen.getByTestId('success-btn'));
      fireEvent.click(screen.getByTestId('error-btn'));
      fireEvent.click(screen.getByTestId('info-btn'));
      
      expect(screen.getByText('Success Title')).toBeInTheDocument();
      expect(screen.getByText('Error Title')).toBeInTheDocument();
      expect(screen.getByText('Info Title')).toBeInTheDocument();
    });
  });
  
  describe('Accessibility', () => {
    it('toast has alert role', () => {
      const toasts: ToastMessage[] = [
        { id: '1', type: 'error', title: 'Test' }
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
      
      const toast = screen.getByRole('alert');
      expect(toast).toBeInTheDocument();
    });
    
    it('toast has assertive aria-live', () => {
      const toasts: ToastMessage[] = [
        { id: '1', type: 'error', title: 'Test' }
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
      
      const toast = screen.getByRole('alert');
      expect(toast).toHaveAttribute('aria-live', 'assertive');
    });
    
    it('dismiss button has accessible label', () => {
      const toasts: ToastMessage[] = [
        { id: '1', type: 'info', title: 'Test' }
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
      
      expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
    });
    
    it('container has notifications label', () => {
      const toasts: ToastMessage[] = [
        { id: '1', type: 'info', title: 'Test' }
      ];
      
      render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
      
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    });
  });
});
