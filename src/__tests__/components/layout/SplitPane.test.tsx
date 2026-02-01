/**
 * SplitPane Tests - Sprint 702
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SplitPane } from '../../../components/layout/SplitPane';

// Mock useMediaQuery
const mockUseIsDesktop = vi.fn(() => true);
const mockUsePrefersReducedMotion = vi.fn(() => false);

vi.mock('../../../hooks/useMediaQuery', () => ({
  useIsDesktop: () => mockUseIsDesktop(),
  usePrefersReducedMotion: () => mockUsePrefersReducedMotion(),
}));

describe('SplitPane', () => {
  const defaultProps = {
    left: <div data-testid="left-content">Left</div>,
    right: <div data-testid="right-content">Right</div>,
  };
  
  beforeEach(() => {
    mockUseIsDesktop.mockReturnValue(true);
    mockUsePrefersReducedMotion.mockReturnValue(false);
    localStorage.clear();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Desktop Layout', () => {
    it('renders left and right panels', () => {
      render(<SplitPane {...defaultProps} />);
      
      expect(screen.getByTestId('left-content')).toBeInTheDocument();
      expect(screen.getByTestId('right-content')).toBeInTheDocument();
    });
    
    it('renders resize handle', () => {
      render(<SplitPane {...defaultProps} />);
      
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });
    
    it('sets initial width from props', () => {
      render(<SplitPane {...defaultProps} initialLeftWidth={30} />);
      
      const separator = screen.getByRole('separator');
      expect(separator).toHaveAttribute('aria-valuenow', '30');
    });
    
    it('persists width to localStorage', () => {
      render(<SplitPane {...defaultProps} storageKey="test-split" initialLeftWidth={50} />);
      
      expect(localStorage.getItem('test-split')).toBe('50');
    });
    
    it('restores width from localStorage', () => {
      localStorage.setItem('test-split', '60');
      
      render(<SplitPane {...defaultProps} storageKey="test-split" />);
      
      const separator = screen.getByRole('separator');
      expect(separator).toHaveAttribute('aria-valuenow', '60');
    });
    
    it('handles keyboard resize with ArrowRight', () => {
      render(<SplitPane {...defaultProps} initialLeftWidth={50} />);
      
      const separator = screen.getByRole('separator');
      separator.focus();
      fireEvent.keyDown(separator, { key: 'ArrowRight' });
      
      expect(separator).toHaveAttribute('aria-valuenow', '55');
    });
    
    it('handles keyboard resize with ArrowLeft', () => {
      render(<SplitPane {...defaultProps} initialLeftWidth={50} />);
      
      const separator = screen.getByRole('separator');
      separator.focus();
      fireEvent.keyDown(separator, { key: 'ArrowLeft' });
      
      expect(separator).toHaveAttribute('aria-valuenow', '45');
    });
    
    it('clamps width to minimum 10%', () => {
      render(<SplitPane {...defaultProps} initialLeftWidth={12} />);
      
      const separator = screen.getByRole('separator');
      fireEvent.keyDown(separator, { key: 'ArrowLeft' });
      fireEvent.keyDown(separator, { key: 'ArrowLeft' });
      
      expect(separator).toHaveAttribute('aria-valuenow', '10');
    });
    
    it('clamps width to maximum 90%', () => {
      render(<SplitPane {...defaultProps} initialLeftWidth={88} />);
      
      const separator = screen.getByRole('separator');
      fireEvent.keyDown(separator, { key: 'ArrowRight' });
      fireEvent.keyDown(separator, { key: 'ArrowRight' });
      
      expect(separator).toHaveAttribute('aria-valuenow', '90');
    });
    
    it('renders panel headers when provided', () => {
      render(
        <SplitPane 
          {...defaultProps}
          leftHeader={<div data-testid="left-header">Left Header</div>}
          rightHeader={<div data-testid="right-header">Right Header</div>}
        />
      );
      
      expect(screen.getByTestId('left-header')).toBeInTheDocument();
      expect(screen.getByTestId('right-header')).toBeInTheDocument();
    });
  });
  
  describe('Collapse Behavior', () => {
    it('collapses left panel when button clicked', () => {
      render(
        <SplitPane 
          {...defaultProps} 
          leftCollapsible 
          rightHeader={<span>Header</span>}
        />
      );
      
      const collapseButton = screen.getByRole('button', { name: /collapse left/i });
      fireEvent.click(collapseButton);
      
      // Left content should be hidden
      expect(screen.queryByTestId('left-content')).not.toBeInTheDocument();
    });
    
    it('expands left panel when expand button clicked', () => {
      render(
        <SplitPane 
          {...defaultProps} 
          leftCollapsible
          rightHeader={<span>Header</span>}
        />
      );
      
      // First collapse
      fireEvent.click(screen.getByRole('button', { name: /collapse left/i }));
      
      // Then expand
      fireEvent.click(screen.getByRole('button', { name: /expand left/i }));
      
      expect(screen.getByTestId('left-content')).toBeInTheDocument();
    });
  });
  
  describe('Mobile Layout', () => {
    beforeEach(() => {
      mockUseIsDesktop.mockReturnValue(false);
    });
    
    it('stacks panels vertically', () => {
      render(<SplitPane {...defaultProps} />);
      
      expect(screen.getByTestId('left-content')).toBeInTheDocument();
      expect(screen.getByTestId('right-content')).toBeInTheDocument();
    });
    
    it('does not render resize handle', () => {
      render(<SplitPane {...defaultProps} />);
      
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });
  });
  
  describe('Reduced Motion', () => {
    it('removes transitions when reduced motion is preferred', () => {
      mockUsePrefersReducedMotion.mockReturnValue(true);
      
      render(<SplitPane {...defaultProps} />);
      
      const pane = screen.getByTestId('split-pane');
      // Check that panels don't have transition class
      const panels = pane.querySelectorAll('[class*="transition"]');
      expect(panels.length).toBe(0);
    });
  });
  
  describe('Accessibility', () => {
    it('separator has correct ARIA attributes', () => {
      render(<SplitPane {...defaultProps} initialLeftWidth={45} />);
      
      const separator = screen.getByRole('separator');
      expect(separator).toHaveAttribute('aria-orientation', 'vertical');
      expect(separator).toHaveAttribute('aria-valuenow', '45');
      expect(separator).toHaveAttribute('aria-valuemin', '10');
      expect(separator).toHaveAttribute('aria-valuemax', '90');
      expect(separator).toHaveAttribute('aria-label', 'Resize panels');
    });
    
    it('separator is focusable', () => {
      render(<SplitPane {...defaultProps} />);
      
      const separator = screen.getByRole('separator');
      expect(separator).toHaveAttribute('tabindex', '0');
    });
  });
});
