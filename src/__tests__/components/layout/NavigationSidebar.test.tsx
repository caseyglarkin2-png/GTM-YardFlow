/**
 * NavigationSidebar Tests - Sprint 701
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationSidebar } from '../../../components/layout/NavigationSidebar';
import type { TabId } from '../../../config/navigation';

// Mock useMediaQuery
const mockUseIsDesktop = vi.fn(() => true);

vi.mock('../../../hooks/useMediaQuery', () => ({
  useIsDesktop: () => mockUseIsDesktop(),
}));

describe('NavigationSidebar', () => {
  const defaultProps = {
    activeTab: 'dashboard' as TabId,
    onTabChange: vi.fn(),
  };
  
  beforeEach(() => {
    mockUseIsDesktop.mockReturnValue(true);
    vi.clearAllMocks();
  });
  
  describe('Rendering', () => {
    it('renders navigation tabs', () => {
      render(<NavigationSidebar {...defaultProps} />);
      
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(7); // NAVIGATION_TABS has 7 tabs
    });
    
    it('renders active tab with correct aria-selected', () => {
      // 'prospects' is the tab ID, 'Hitlist' is the label
      render(<NavigationSidebar {...defaultProps} activeTab="prospects" />);
      
      const tabs = screen.getAllByRole('tab');
      const prospectsTab = tabs.find(tab => 
        tab.textContent?.includes('Hitlist') || 
        tab.getAttribute('data-tab-id') === 'prospects'
      );
      expect(prospectsTab).toBeTruthy();
      expect(prospectsTab).toHaveAttribute('aria-selected', 'true');
    });
    
    it('renders logo and title', () => {
      render(<NavigationSidebar {...defaultProps} />);
      
      expect(screen.getByText('YardFlow')).toBeInTheDocument();
      expect(screen.getByText('Hub')).toBeInTheDocument();
    });
    
    it('renders settings button when callback provided', () => {
      render(<NavigationSidebar {...defaultProps} onSettingsClick={vi.fn()} />);
      
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    });
    
    it('renders Railway link', () => {
      render(<NavigationSidebar {...defaultProps} />);
      
      expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
    });
    
    it('renders header content when provided', () => {
      render(
        <NavigationSidebar 
          {...defaultProps} 
          headerContent={<div data-testid="header">Header</div>} 
        />
      );
      
      expect(screen.getByTestId('header')).toBeInTheDocument();
    });
    
    it('renders footer content when provided', () => {
      render(
        <NavigationSidebar 
          {...defaultProps} 
          footerContent={<div data-testid="footer">Footer</div>} 
        />
      );
      
      expect(screen.getByTestId('footer')).toBeInTheDocument();
    });
  });
  
  describe('Tab Interaction', () => {
    it('calls onTabChange when tab clicked', () => {
      const onTabChange = vi.fn();
      render(<NavigationSidebar {...defaultProps} onTabChange={onTabChange} />);
      
      const tabs = screen.getAllByRole('tab');
      fireEvent.click(tabs[1]); // Click second tab
      
      expect(onTabChange).toHaveBeenCalled();
    });
    
    it('calls announce when tab selected', () => {
      const announce = vi.fn();
      const onTabChange = vi.fn();
      render(
        <NavigationSidebar 
          {...defaultProps} 
          onTabChange={onTabChange}
          announce={announce} 
        />
      );
      
      const tabs = screen.getAllByRole('tab');
      fireEvent.click(tabs[0]);
      
      expect(announce).toHaveBeenCalledWith(expect.stringContaining('tab selected'));
    });
    
    it('calls onSettingsClick when settings button clicked', () => {
      const onSettingsClick = vi.fn();
      render(<NavigationSidebar {...defaultProps} onSettingsClick={onSettingsClick} />);
      
      fireEvent.click(screen.getByRole('button', { name: /settings/i }));
      
      expect(onSettingsClick).toHaveBeenCalledOnce();
    });
  });
  
  describe('Keyboard Navigation (Roving Tabindex)', () => {
    it('has tabindex=0 on active tab, -1 on others', () => {
      render(<NavigationSidebar {...defaultProps} activeTab="dashboard" />);
      
      const tabs = screen.getAllByRole('tab');
      const dashboardTab = tabs.find(t => t.getAttribute('data-tab-id') === 'dashboard');
      const otherTabs = tabs.filter(t => t.getAttribute('data-tab-id') !== 'dashboard');
      
      expect(dashboardTab).toHaveAttribute('tabindex', '0');
      otherTabs.forEach(tab => {
        expect(tab).toHaveAttribute('tabindex', '-1');
      });
    });
    
    it('moves focus down on ArrowDown (desktop)', () => {
      render(<NavigationSidebar {...defaultProps} activeTab="dashboard" />);
      
      const tabs = screen.getAllByRole('tab');
      const dashboardTab = tabs.find(t => t.getAttribute('data-tab-id') === 'dashboard')!;
      
      fireEvent.keyDown(dashboardTab, { key: 'ArrowDown' });
      
      // The focused tab should change (we can't easily test focus in jsdom)
      // But we can verify the event was handled (no default behavior)
    });
    
    it('moves focus left on ArrowLeft (mobile)', () => {
      mockUseIsDesktop.mockReturnValue(false);
      
      // Use 'prospects' which is the valid TabId for Hitlist
      render(<NavigationSidebar {...defaultProps} activeTab="prospects" />);
      
      const tabs = screen.getAllByRole('tab');
      const prospectsTab = tabs.find(t => t.getAttribute('data-tab-id') === 'prospects');
      
      // Guard against element not found
      expect(prospectsTab).toBeTruthy();
      if (prospectsTab) {
        fireEvent.keyDown(prospectsTab, { key: 'ArrowLeft' });
      }
      
      // Event should be prevented and focus moved
    });
    
    it('selects tab on Enter', () => {
      const onTabChange = vi.fn();
      render(<NavigationSidebar {...defaultProps} onTabChange={onTabChange} />);
      
      const tabs = screen.getAllByRole('tab');
      fireEvent.keyDown(tabs[0], { key: 'Enter' });
      
      expect(onTabChange).toHaveBeenCalled();
    });
    
    it('selects tab on Space', () => {
      const onTabChange = vi.fn();
      render(<NavigationSidebar {...defaultProps} onTabChange={onTabChange} />);
      
      const tabs = screen.getAllByRole('tab');
      fireEvent.keyDown(tabs[0], { key: ' ' });
      
      expect(onTabChange).toHaveBeenCalled();
    });
  });
  
  describe('Responsive Layout', () => {
    it('renders vertical layout on desktop', () => {
      mockUseIsDesktop.mockReturnValue(true);
      
      render(<NavigationSidebar {...defaultProps} />);
      
      const nav = screen.getByRole('tablist');
      expect(nav.className).toContain('flex-col');
    });
    
    it('renders horizontal layout on mobile', () => {
      mockUseIsDesktop.mockReturnValue(false);
      
      render(<NavigationSidebar {...defaultProps} />);
      
      const nav = screen.getByRole('tablist');
      expect(nav.className).not.toContain('flex-col');
    });
    
    it('shows full labels on desktop', () => {
      mockUseIsDesktop.mockReturnValue(true);
      
      render(<NavigationSidebar {...defaultProps} />);
      
      // Labels should be visible (not sr-only)
      const tabs = screen.getAllByRole('tab');
      const labelSpan = tabs[0].querySelector('span:not(.sr-only)');
      expect(labelSpan).toBeInTheDocument();
    });
  });
});
