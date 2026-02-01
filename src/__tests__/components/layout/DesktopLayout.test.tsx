/**
 * DesktopLayout Tests - Sprint 701
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DesktopLayout } from '../../../components/layout/DesktopLayout';

// Mock useMediaQuery
const mockUseIsDesktop = vi.fn(() => true);
const mockUsePrefersReducedMotion = vi.fn(() => false);

vi.mock('../../../hooks/useMediaQuery', () => ({
  useIsDesktop: () => mockUseIsDesktop(),
  usePrefersReducedMotion: () => mockUsePrefersReducedMotion(),
}));

describe('DesktopLayout', () => {
  const defaultProps = {
    sidebar: <div data-testid="sidebar-content">Sidebar</div>,
    main: <div data-testid="main-content">Main</div>,
  };
  
  beforeEach(() => {
    mockUseIsDesktop.mockReturnValue(true);
    mockUsePrefersReducedMotion.mockReturnValue(false);
    localStorage.clear();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Desktop Mode', () => {
    it('renders sidebar and main content', () => {
      render(<DesktopLayout {...defaultProps} />);
      
      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
    });
    
    it('renders collapse button when collapsible', () => {
      render(<DesktopLayout {...defaultProps} collapsible />);
      
      const button = screen.getByRole('button', { name: /collapse sidebar/i });
      expect(button).toBeInTheDocument();
    });
    
    it('toggles collapsed state on button click', () => {
      render(<DesktopLayout {...defaultProps} collapsible />);
      
      const button = screen.getByRole('button', { name: /collapse sidebar/i });
      fireEvent.click(button);
      
      // After collapse, button should say "Expand"
      expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
    });
    
    it('persists collapsed state to localStorage', () => {
      render(<DesktopLayout {...defaultProps} collapsible />);
      
      const button = screen.getByRole('button', { name: /collapse sidebar/i });
      fireEvent.click(button);
      
      expect(localStorage.getItem('desktop-layout-collapsed')).toBe('true');
    });
    
    it('restores collapsed state from localStorage', () => {
      localStorage.setItem('desktop-layout-collapsed', 'true');
      
      render(<DesktopLayout {...defaultProps} collapsible />);
      
      expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
    });
    
    it('applies custom sidebar width', () => {
      render(<DesktopLayout {...defaultProps} sidebarWidth="wide" />);
      
      const sidebar = screen.getByRole('complementary', { name: /navigation sidebar/i });
      expect(sidebar).toHaveStyle({ width: '400px' });
    });
    
    it('does not render collapse button when collapsible is false', () => {
      render(<DesktopLayout {...defaultProps} collapsible={false} />);
      
      expect(screen.queryByRole('button', { name: /collapse|expand/i })).not.toBeInTheDocument();
    });
  });
  
  describe('Mobile Mode', () => {
    beforeEach(() => {
      mockUseIsDesktop.mockReturnValue(false);
    });
    
    it('renders main content', () => {
      render(<DesktopLayout {...defaultProps} />);
      
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
    });
    
    it('does not render sidebar by default', () => {
      render(<DesktopLayout {...defaultProps} />);
      
      expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument();
    });
    
    it('renders sidebar when isMobileSidebarOpen is true', () => {
      render(<DesktopLayout {...defaultProps} isMobileSidebarOpen />);
      
      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
    });
    
    it('renders close button in mobile sidebar', () => {
      render(<DesktopLayout {...defaultProps} isMobileSidebarOpen />);
      
      expect(screen.getByRole('button', { name: /close navigation/i })).toBeInTheDocument();
    });
    
    it('calls onMobileSidebarClose when close button clicked', () => {
      const onClose = vi.fn();
      render(
        <DesktopLayout 
          {...defaultProps} 
          isMobileSidebarOpen 
          onMobileSidebarClose={onClose} 
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /close navigation/i }));
      
      expect(onClose).toHaveBeenCalledOnce();
    });
    
    it('calls onMobileSidebarClose when backdrop clicked', () => {
      const onClose = vi.fn();
      render(
        <DesktopLayout 
          {...defaultProps} 
          isMobileSidebarOpen 
          onMobileSidebarClose={onClose} 
        />
      );
      
      // Click backdrop (has aria-hidden)
      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop!);
      
      expect(onClose).toHaveBeenCalledOnce();
    });
    
    it('marks sidebar as modal dialog', () => {
      render(<DesktopLayout {...defaultProps} isMobileSidebarOpen />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
  });
  
  describe('Reduced Motion', () => {
    it('removes transitions when reduced motion is preferred', () => {
      mockUsePrefersReducedMotion.mockReturnValue(true);
      
      render(<DesktopLayout {...defaultProps} collapsible />);
      
      // Sidebar should not have transition classes
      const sidebar = screen.getByRole('complementary', { name: /navigation sidebar/i });
      expect(sidebar.className).not.toContain('transition');
    });
  });
});
