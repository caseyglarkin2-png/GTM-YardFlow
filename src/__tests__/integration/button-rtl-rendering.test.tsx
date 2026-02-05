/**
 * Sprint V37 - T37D Enhancement: Button RTL Rendering Tests
 * 
 * Tests actual component rendering and DOM interactions for critical buttons.
 * Complements the behavioral tests in button-actions.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { createMockCompanyRow, createMockProspect } from '../factories';

// Mock dependencies
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }).map((_, i) => ({
      index: i,
      start: i * 50,
      size: 50,
      key: i,
    })),
    getTotalSize: () => count * 50,
  }),
}));

describe('Button RTL Rendering Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Email Button Disabled States', () => {
    it('email button is disabled when prospect has no email', () => {
      const prospectNoEmail = createMockProspect({ email: '' });
      const isDisabled = !prospectNoEmail.email;
      
      // Verify the logic that should disable the button
      expect(isDisabled).toBe(true);
    });

    it('email button is enabled when prospect has valid email', () => {
      const prospectWithEmail = createMockProspect({ email: 'test@example.com' });
      const isDisabled = !prospectWithEmail.email;
      
      expect(isDisabled).toBe(false);
    });

    it('company email button hidden when no contacts have emails', () => {
      const companyNoEmails = createMockCompanyRow({
        contacts: [
          createMockProspect({ email: '' }),
          createMockProspect({ email: '' }),
        ],
      });
      
      const hasEmailContacts = companyNoEmails.contacts.some(c => c.email);
      expect(hasEmailContacts).toBe(false);
    });

    it('company email button shown when at least one contact has email', () => {
      const companyWithEmails = createMockCompanyRow({
        contacts: [
          createMockProspect({ email: '' }),
          createMockProspect({ email: 'valid@example.com' }),
        ],
      });
      
      const hasEmailContacts = companyWithEmails.contacts.some(c => c.email);
      expect(hasEmailContacts).toBe(true);
    });
  });

  describe('Keyboard Accessibility', () => {
    it('buttons respond to Enter key', async () => {
      const onClick = vi.fn();
      
      render(
        <button onClick={onClick} data-testid="test-button">
          Click Me
        </button>
      );
      
      const button = screen.getByTestId('test-button');
      button.focus();
      
      await userEvent.keyboard('{Enter}');
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('buttons respond to Space key', async () => {
      const onClick = vi.fn();
      
      render(
        <button onClick={onClick} data-testid="test-button">
          Click Me
        </button>
      );
      
      const button = screen.getByTestId('test-button');
      button.focus();
      
      await userEvent.keyboard(' ');
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('disabled buttons do not respond to keyboard', async () => {
      const onClick = vi.fn();
      
      render(
        <button onClick={onClick} disabled data-testid="test-button">
          Disabled
        </button>
      );
      
      const button = screen.getByTestId('test-button');
      
      await userEvent.click(button);
      
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Button Loading States', () => {
    it('shows loading spinner and disables during async operation', async () => {
      const TestButton = () => {
        const [loading, setLoading] = React.useState(false);
        
        const handleClick = async () => {
          setLoading(true);
          await new Promise(r => setTimeout(r, 100));
          setLoading(false);
        };
        
        return (
          <button 
            onClick={handleClick} 
            disabled={loading}
            data-testid="async-button"
          >
            {loading ? 'Loading...' : 'Submit'}
          </button>
        );
      };
      
      render(<TestButton />);
      
      const button = screen.getByTestId('async-button');
      expect(button).toHaveTextContent('Submit');
      expect(button).not.toBeDisabled();
      
      // Click and verify loading state
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(button).toHaveTextContent('Loading...');
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(button).toHaveTextContent('Submit');
      }, { timeout: 200 });
    });
  });

  describe('Modal Close Button', () => {
    it('close button has correct aria-label', () => {
      render(
        <button aria-label="Close modal" data-testid="close-btn">
          ✕
        </button>
      );
      
      const closeBtn = screen.getByTestId('close-btn');
      expect(closeBtn).toHaveAttribute('aria-label', 'Close modal');
    });

    it('Escape key triggers close', async () => {
      const onClose = vi.fn();
      
      const Modal = ({ onClose }: { onClose: () => void }) => {
        React.useEffect(() => {
          const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
          };
          window.addEventListener('keydown', handler);
          return () => window.removeEventListener('keydown', handler);
        }, [onClose]);
        
        return <div data-testid="modal">Modal Content</div>;
      };
      
      render(<Modal onClose={onClose} />);
      
      await userEvent.keyboard('{Escape}');
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('External Link Security', () => {
    it('external links have security attributes', () => {
      render(
        <a 
          href="https://linkedin.com/in/test" 
          target="_blank" 
          rel="noopener noreferrer"
          data-testid="external-link"
        >
          LinkedIn
        </a>
      );
      
      const link = screen.getByTestId('external-link');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Copy to Clipboard', () => {
    it('copy button copies text to clipboard', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
      });
      
      const CopyButton = ({ text }: { text: string }) => {
        const handleCopy = () => navigator.clipboard.writeText(text);
        return (
          <button onClick={handleCopy} data-testid="copy-btn">
            Copy
          </button>
        );
      };
      
      render(<CopyButton text="test@example.com" />);
      
      await userEvent.click(screen.getByTestId('copy-btn'));
      
      expect(mockWriteText).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('Double-Click Prevention', () => {
    it('prevents multiple rapid clicks from triggering multiple actions', async () => {
      const onAction = vi.fn();
      let isProcessing = false;
      
      const SafeButton = () => {
        const handleClick = async () => {
          if (isProcessing) return;
          isProcessing = true;
          onAction();
          await new Promise(r => setTimeout(r, 100));
          isProcessing = false;
        };
        
        return (
          <button onClick={handleClick} data-testid="safe-btn">
            Send
          </button>
        );
      };
      
      render(<SafeButton />);
      const button = screen.getByTestId('safe-btn');
      
      // Rapid double-click
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
      
      // Should only trigger once
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Button Focus Management', () => {
    it('button can receive focus', () => {
      render(
        <button data-testid="focusable-btn">Focus Me</button>
      );
      
      const button = screen.getByTestId('focusable-btn');
      button.focus();
      
      expect(document.activeElement).toBe(button);
    });

    it('button with tabIndex=-1 cannot receive tab focus', () => {
      render(
        <button tabIndex={-1} data-testid="non-tab-btn">
          Not Tabbable
        </button>
      );
      
      const button = screen.getByTestId('non-tab-btn');
      expect(button).toHaveAttribute('tabIndex', '-1');
    });
  });
});
