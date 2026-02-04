/**
 * SidebarContent Tests - Sprint 800.3 T800.3.1a
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SidebarContent } from '../../../components/layout/SidebarContent';
import type { TabId } from '../../../config/navigation';

// Mock LazyIcon
vi.mock('../../../components/icons', () => ({
  LazyIcon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>
      {name}
    </span>
  ),
}));

// Mock SyncStatus
vi.mock('../../../components/SyncStatus', () => ({
  SyncStatus: ({ status }: { status: string }) => (
    <div data-testid="sync-status">{status}</div>
  ),
}));

// Mock ViewModeToggle (uses viewMode/onViewModeChange, not value/onChange)
vi.mock('../../../components/ViewModeToggle', () => ({
  ViewModeToggle: ({ viewMode, onViewModeChange }: { viewMode: string; onViewModeChange: (v: string) => void }) => (
    <button data-testid="view-mode-toggle" onClick={() => onViewModeChange('companies')}>
      {viewMode}
    </button>
  ),
}));

describe('SidebarContent', () => {
  const defaultProps = {
    activeTab: 'dashboard' as TabId,
    onTabChange: vi.fn(),
    onSettingsClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<SidebarContent {...defaultProps} />);
      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
    });

    it('renders YardFlow branding', () => {
      render(<SidebarContent {...defaultProps} />);
      expect(screen.getByText('YardFlow')).toBeInTheDocument();
      expect(screen.getByText('Hub')).toBeInTheDocument();
    });

    it('renders all 7 navigation tabs', () => {
      render(<SidebarContent {...defaultProps} />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(8);
    });

    it('renders Railway link', () => {
      render(<SidebarContent {...defaultProps} />);
      const railwayLink = screen.getByRole('link', { name: /railway/i });
      expect(railwayLink).toHaveAttribute('href', expect.stringContaining('railway.app'));
      expect(railwayLink).toHaveAttribute('target', '_blank');
    });

    it('renders settings button', () => {
      render(<SidebarContent {...defaultProps} />);
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('marks active tab as selected', () => {
      render(<SidebarContent {...defaultProps} activeTab="sequences" />);
      const sequencesTab = screen.getByRole('tab', { name: /seq/i });
      expect(sequencesTab).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onTabChange when tab is clicked', () => {
      const onTabChange = vi.fn();
      render(<SidebarContent {...defaultProps} onTabChange={onTabChange} />);
      
      fireEvent.click(screen.getByRole('tab', { name: /hits/i }));
      expect(onTabChange).toHaveBeenCalledWith('prospects');
    });

    it('calls announce when tab is clicked', () => {
      const announce = vi.fn();
      render(<SidebarContent {...defaultProps} announce={announce} />);
      
      fireEvent.click(screen.getByRole('tab', { name: /seq/i }));
      expect(announce).toHaveBeenCalledWith(expect.stringContaining('tab selected'));
    });

    it('calls onCloseMobile when tab is clicked', () => {
      const onCloseMobile = vi.fn();
      render(<SidebarContent {...defaultProps} onCloseMobile={onCloseMobile} />);
      
      fireEvent.click(screen.getByRole('tab', { name: /dash/i }));
      expect(onCloseMobile).toHaveBeenCalled();
    });

    it('each tab has correct aria-controls', () => {
      render(<SidebarContent {...defaultProps} />);
      const dashboardTab = screen.getByRole('tab', { name: /dash/i });
      expect(dashboardTab).toHaveAttribute('aria-controls', 'panel-dashboard');
    });
  });

  describe('Settings Button', () => {
    it('calls onSettingsClick when clicked', () => {
      const onSettingsClick = vi.fn();
      render(<SidebarContent {...defaultProps} onSettingsClick={onSettingsClick} />);
      
      fireEvent.click(screen.getByRole('button', { name: /settings/i }));
      expect(onSettingsClick).toHaveBeenCalled();
    });
  });

  describe('Hitlist Filters', () => {
    it('shows filters when activeTab is prospects', () => {
      render(<SidebarContent {...defaultProps} activeTab="prospects" />);
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });

    it('hides filters when activeTab is not prospects', () => {
      render(<SidebarContent {...defaultProps} activeTab="dashboard" />);
      expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    });

    it('calls onFilterChange when search input changes', () => {
      const onFilterChange = vi.fn();
      render(
        <SidebarContent 
          {...defaultProps} 
          activeTab="prospects" 
          onFilterChange={onFilterChange} 
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'test' } });
      expect(onFilterChange).toHaveBeenCalledWith('test');
    });

    it('calls onTierFilterChange when tier dropdown changes', () => {
      const onTierFilterChange = vi.fn();
      render(
        <SidebarContent 
          {...defaultProps} 
          activeTab="prospects" 
          onTierFilterChange={onTierFilterChange} 
        />
      );
      
      fireEvent.change(screen.getByLabelText(/filter by tier/i), { target: { value: 'Tier 1' } });
      expect(onTierFilterChange).toHaveBeenCalledWith('Tier 1');
    });

    it('calls onStatusFilterChange when status dropdown changes', () => {
      const onStatusFilterChange = vi.fn();
      render(
        <SidebarContent 
          {...defaultProps} 
          activeTab="prospects" 
          onStatusFilterChange={onStatusFilterChange} 
        />
      );
      
      fireEvent.change(screen.getByLabelText(/filter by status/i), { target: { value: 'replied' } });
      expect(onStatusFilterChange).toHaveBeenCalledWith('replied');
    });

    it('renders ViewModeToggle when onViewModeChange is provided', () => {
      render(
        <SidebarContent 
          {...defaultProps} 
          activeTab="prospects" 
          onViewModeChange={vi.fn()} 
        />
      );
      expect(screen.getByTestId('view-mode-toggle')).toBeInTheDocument();
    });
  });

  describe('Dashboard Filters', () => {
    it('shows date period filter when activeTab is dashboard', () => {
      render(
        <SidebarContent 
          {...defaultProps} 
          activeTab="dashboard" 
          onDatePeriodChange={vi.fn()} 
        />
      );
      expect(screen.getByLabelText(/time period/i)).toBeInTheDocument();
    });

    it('hides date period filter when onDatePeriodChange is not provided', () => {
      render(<SidebarContent {...defaultProps} activeTab="dashboard" />);
      expect(screen.queryByLabelText(/time period/i)).not.toBeInTheDocument();
    });

    it('calls onDatePeriodChange when period changes', () => {
      const onDatePeriodChange = vi.fn();
      render(
        <SidebarContent 
          {...defaultProps} 
          activeTab="dashboard" 
          onDatePeriodChange={onDatePeriodChange} 
        />
      );
      
      fireEvent.change(screen.getByLabelText(/time period/i), { target: { value: 'month' } });
      expect(onDatePeriodChange).toHaveBeenCalledWith('month');
    });
  });

  describe('Sync Status', () => {
    it('renders sync status when provided', () => {
      render(
        <SidebarContent 
          {...defaultProps} 
          syncStatus={{ status: 'synced', pendingCount: 0, retry: vi.fn() }} 
        />
      );
      expect(screen.getByTestId('sync-status')).toBeInTheDocument();
    });

    it('does not render sync status when not provided', () => {
      render(<SidebarContent {...defaultProps} />);
      expect(screen.queryByTestId('sync-status')).not.toBeInTheDocument();
    });
  });

  describe('Content Slots', () => {
    it('renders header content when provided', () => {
      render(
        <SidebarContent 
          {...defaultProps} 
          headerContent={<div data-testid="header-content">Header</div>} 
        />
      );
      expect(screen.getByTestId('header-content')).toBeInTheDocument();
    });

    it('renders footer content when provided', () => {
      render(
        <SidebarContent 
          {...defaultProps} 
          footerContent={<div data-testid="footer-content">Footer</div>} 
        />
      );
      expect(screen.getByTestId('footer-content')).toBeInTheDocument();
    });
  });

  describe('Custom Railway URL', () => {
    it('uses custom railway URL when provided', () => {
      render(<SidebarContent {...defaultProps} railwayUrl="https://custom.railway.app" />);
      const railwayLink = screen.getByRole('link', { name: /railway/i });
      expect(railwayLink).toHaveAttribute('href', 'https://custom.railway.app');
    });
  });

  describe('Quick Filter Presets (Sprint V34)', () => {
    const filterProps = {
      ...defaultProps,
      activeTab: 'prospects' as TabId,
      onTierFilterChange: vi.fn(),
      onEmailFilterChange: vi.fn(),
      onTagFilterChange: vi.fn(),
      onFilterChange: vi.fn(),
      announce: vi.fn(),
    };

    it('renders quick filter buttons on prospects tab', () => {
      render(<SidebarContent {...filterProps} />);
      expect(screen.getByTestId('quick-filter-manifest')).toBeInTheDocument();
      expect(screen.getByTestId('quick-filter-tier1-email')).toBeInTheDocument();
      expect(screen.getByTestId('quick-filter-no-email')).toBeInTheDocument();
      expect(screen.getByTestId('quick-filter-clear')).toBeInTheDocument();
    });

    it('Manifest button sets tag filter', () => {
      render(<SidebarContent {...filterProps} />);
      fireEvent.click(screen.getByTestId('quick-filter-manifest'));
      expect(filterProps.onTagFilterChange).toHaveBeenCalledWith('Manifest 2026');
      expect(filterProps.announce).toHaveBeenCalledWith('Filtered to Manifest 2026 attendees');
    });

    it('T1+Email button sets tier and email filters', () => {
      render(<SidebarContent {...filterProps} />);
      fireEvent.click(screen.getByTestId('quick-filter-tier1-email'));
      expect(filterProps.onTierFilterChange).toHaveBeenCalledWith('Tier 1');
      expect(filterProps.onEmailFilterChange).toHaveBeenCalledWith('has_email');
      expect(filterProps.onTagFilterChange).toHaveBeenCalledWith(null);
    });

    it('Needs Email button sets email filter', () => {
      render(<SidebarContent {...filterProps} />);
      fireEvent.click(screen.getByTestId('quick-filter-no-email'));
      expect(filterProps.onEmailFilterChange).toHaveBeenCalledWith('no_email');
    });

    it('Clear button resets all filters', () => {
      render(<SidebarContent {...filterProps} />);
      fireEvent.click(screen.getByTestId('quick-filter-clear'));
      expect(filterProps.onTierFilterChange).toHaveBeenCalledWith('All');
      expect(filterProps.onEmailFilterChange).toHaveBeenCalledWith('all');
      expect(filterProps.onTagFilterChange).toHaveBeenCalledWith(null);
      expect(filterProps.onFilterChange).toHaveBeenCalledWith('');
    });

    it('highlights active quick filter', () => {
      render(<SidebarContent {...filterProps} tagFilter="Manifest 2026" />);
      const manifestBtn = screen.getByTestId('quick-filter-manifest');
      expect(manifestBtn).toHaveClass('bg-purple-600');
    });
  });

  describe('Saved Filters (Sprint V34)', () => {
    const filterProps = {
      ...defaultProps,
      activeTab: 'prospects' as TabId,
      onTierFilterChange: vi.fn(),
      onEmailFilterChange: vi.fn(),
      onTagFilterChange: vi.fn(),
      onFilterChange: vi.fn(),
      announce: vi.fn(),
      tierFilter: 'Tier 1', // Active filter to show Save button
      emailFilter: 'has_email',
    };

    beforeEach(() => {
      localStorage.clear();
    });

    it('shows saved filters toggle when filters are active', () => {
      render(<SidebarContent {...filterProps} />);
      expect(screen.getByTestId('saved-filters-toggle')).toBeInTheDocument();
    });

    it('opens saved filters section on toggle click', () => {
      render(<SidebarContent {...filterProps} />);
      fireEvent.click(screen.getByTestId('saved-filters-toggle'));
      expect(screen.getByTestId('save-filter-button')).toBeInTheDocument();
    });

    it('shows save input when clicking save button', () => {
      render(<SidebarContent {...filterProps} />);
      fireEvent.click(screen.getByTestId('saved-filters-toggle'));
      fireEvent.click(screen.getByTestId('save-filter-button'));
      expect(screen.getByTestId('save-filter-input')).toBeInTheDocument();
    });

    it('saves a filter preset', () => {
      render(<SidebarContent {...filterProps} />);
      fireEvent.click(screen.getByTestId('saved-filters-toggle'));
      fireEvent.click(screen.getByTestId('save-filter-button'));
      
      const input = screen.getByTestId('save-filter-input');
      fireEvent.change(input, { target: { value: 'My Custom Filter' } });
      fireEvent.click(screen.getByTestId('save-filter-confirm'));

      // Verify it's in localStorage
      const stored = JSON.parse(localStorage.getItem('yardflow_filter_presets') || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('My Custom Filter');
    });

    it('loads a saved filter preset', () => {
      // Pre-populate a preset
      const preset = [{
        id: 'preset-test',
        name: 'Test Preset',
        tierFilter: 'Tier 2',
        emailFilter: 'no_email',
        tagFilter: 'VIP',
        searchQuery: 'search-term',
        createdAt: Date.now(),
      }];
      localStorage.setItem('yardflow_filter_presets', JSON.stringify(preset));

      render(<SidebarContent {...filterProps} />);
      fireEvent.click(screen.getByTestId('saved-filters-toggle'));
      fireEvent.click(screen.getByTestId('load-filter-preset-test'));

      expect(filterProps.onTierFilterChange).toHaveBeenCalledWith('Tier 2');
      expect(filterProps.onEmailFilterChange).toHaveBeenCalledWith('no_email');
      expect(filterProps.onTagFilterChange).toHaveBeenCalledWith('VIP');
      expect(filterProps.onFilterChange).toHaveBeenCalledWith('search-term');
      expect(filterProps.announce).toHaveBeenCalledWith('Loaded filter: Test Preset');
    });

    it('deletes a saved filter preset', () => {
      const preset = [{
        id: 'preset-delete',
        name: 'Delete Me',
        tierFilter: 'All',
        emailFilter: 'all',
        tagFilter: null,
        searchQuery: '',
        createdAt: Date.now(),
      }];
      localStorage.setItem('yardflow_filter_presets', JSON.stringify(preset));

      render(<SidebarContent {...filterProps} />);
      fireEvent.click(screen.getByTestId('saved-filters-toggle'));
      fireEvent.click(screen.getByTestId('delete-filter-preset-delete'));

      const stored = JSON.parse(localStorage.getItem('yardflow_filter_presets') || '[]');
      expect(stored).toHaveLength(0);
    });

    it('cancels save input on cancel button', () => {
      render(<SidebarContent {...filterProps} />);
      fireEvent.click(screen.getByTestId('saved-filters-toggle'));
      fireEvent.click(screen.getByTestId('save-filter-button'));
      fireEvent.click(screen.getByTestId('save-filter-cancel'));

      expect(screen.queryByTestId('save-filter-input')).not.toBeInTheDocument();
      expect(screen.getByTestId('save-filter-button')).toBeInTheDocument();
    });
  });
});
