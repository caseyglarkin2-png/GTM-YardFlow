/**
 * SidebarContent - Sprint 800.3 T800.3.1a
 * 
 * Extracted sidebar content from App.tsx.
 * Contains tab navigation, branding, and context-specific filters.
 * 
 * Features:
 * - Tab navigation (7 main tabs)
 * - YardFlow branding header
 * - Context-sensitive filters (Hitlist tab shows prospect filters)
 * - Sync status display
 * - Settings access
 */

import { type ReactNode, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { LazyIcon } from '../icons';
import { NAVIGATION_TABS, type TabId } from '@/config/navigation';
import { type ViewMode } from '@/components/ViewModeToggle';
import { SyncStatus } from '@/components/SyncStatus';
import { type SyncStatus as SyncStatusType } from '@/services/OfflineQueue';
import { ViewModeToggle } from '@/components/ViewModeToggle';

// =============================================================================
// Types
// =============================================================================

export interface SidebarContentProps {
  /** Currently active tab */
  activeTab: TabId | 'stats' | 'assets';
  /** Callback when tab changes */
  onTabChange: (tabId: TabId) => void;
  /** Callback to open settings modal */
  onSettingsClick: () => void;
  /** Callback to close mobile sidebar (optional, for mobile gesture) */
  onCloseMobile?: () => void;
  
  // Hitlist filters (only used when activeTab === 'prospects')
  filter?: string;
  onFilterChange?: (value: string) => void;
  tierFilter?: string;
  onTierFilterChange?: (value: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  tagFilter?: string[];
  onTagFilterChange?: (tags: string[]) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  
  // Dashboard date period (only used when activeTab === 'dashboard')
  datePeriod?: string;
  onDatePeriodChange?: (period: string) => void;
  
  // Status display
  syncStatus?: { status: SyncStatusType; pendingCount: number; retry: () => void };
  
  // Accessibility
  announce?: (message: string) => void;
  
  // Additional content slots
  headerContent?: ReactNode;
  footerContent?: ReactNode;
  
  // Railway dashboard URL
  railwayUrl?: string;
}

// =============================================================================
// Icon name mapping for LazyIcon
// =============================================================================

const ICON_NAMES: Record<string, string> = {
  LayoutDashboard: 'LayoutDashboard',
  Users: 'Users',
  Mail: 'Mail',
  Upload: 'Upload',
  Link2: 'Link2',
  Bot: 'Bot',
  Calculator: 'Calculator',
};

// =============================================================================
// Component
// =============================================================================

export function SidebarContent({
  activeTab,
  onTabChange,
  onSettingsClick,
  onCloseMobile,
  filter = '',
  onFilterChange,
  tierFilter = 'all',
  onTierFilterChange,
  statusFilter = 'all',
  onStatusFilterChange,
  viewMode = 'people',
  onViewModeChange,
  datePeriod,
  onDatePeriodChange,
  syncStatus,
  announce,
  headerContent,
  footerContent,
  railwayUrl = 'https://yardflow-hitlist-production-2f41.up.railway.app',
}: SidebarContentProps): React.ReactElement {
  
  // Handle tab selection
  const handleTabClick = useCallback((tabId: TabId) => {
    onTabChange(tabId);
    announce?.(`${NAVIGATION_TABS.find(t => t.id === tabId)?.label || tabId} tab selected`);
    // Close mobile sidebar on tab change
    onCloseMobile?.();
  }, [onTabChange, announce, onCloseMobile]);
  
  return (
    <div className="flex flex-col h-full" data-testid="sidebar-content">
      {/* Header with branding */}
      <div className="p-4 border-b border-slate-100">
        {/* Desktop header - hidden on mobile (mobile has own header in App.tsx) */}
        <div className="hidden lg:flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div 
              className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center"
              aria-hidden="true"
            >
              <Zap className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-slate-800">
              YardFlow <span className="text-blue-600">Hub</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Railway Dashboard Link */}
            <a
              href={railwayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-blue-50 flex items-center gap-1"
              title="Open Railway dashboard for email & sequences"
            >
              <LazyIcon name="ExternalLink" className="h-3 w-3" />
              Railway
            </a>
            
            {/* Sync Status */}
            {syncStatus && (
              <SyncStatus 
                status={syncStatus.status} 
                pendingCount={syncStatus.pendingCount}
                onRetry={syncStatus.retry}
                showDetails={false}
              />
            )}
            
            {/* Settings */}
            <button 
              onClick={onSettingsClick} 
              className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100"
              aria-label="Open settings"
            >
              <LazyIcon name="Settings" className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        
        {/* Additional header content slot */}
        {headerContent}
        
        {/* Tab Navigation */}
        <div 
          className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg" 
          role="tablist" 
          aria-label="Main navigation"
        >
          {NAVIGATION_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const iconName = ICON_NAMES[tab.icon.displayName || tab.icon.name] || tab.icon.name;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id as TabId)}
                role="tab"
                aria-selected={isActive}
                aria-controls={tab.panelId}
                id={`tab-${tab.id}`}
                className={`
                  flex-1 flex items-center justify-center py-1.5 rounded text-xs font-medium transition-all
                  ${isActive 
                    ? 'bg-white shadow-sm text-blue-700' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }
                `}
              >
                <LazyIcon 
                  name={iconName} 
                  className="h-3 w-3 mr-1" 
                  aria-hidden="true" 
                />
                {tab.shortLabel}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Context-sensitive content based on active tab */}
      <div className="flex-1 overflow-y-auto">
        {/* Hitlist filters (prospects tab) */}
        {activeTab === 'prospects' && (
          <div className="p-4 space-y-3 border-b border-slate-100">
            {/* Search */}
            <div className="relative">
              <LazyIcon 
                name="Search" 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" 
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Search prospects..."
                value={filter}
                onChange={(e) => onFilterChange?.(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
            
            {/* Tier and Status filters */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={tierFilter}
                onChange={(e) => onTierFilterChange?.(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                aria-label="Filter by tier"
              >
                <option value="all">All Tiers</option>
                <option value="Tier 1">Tier 1</option>
                <option value="Tier 2">Tier 2</option>
                <option value="Tier 3">Tier 3</option>
              </select>
              
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange?.(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="replied">Replied</option>
                <option value="meeting_booked">Meeting Booked</option>
                <option value="not_interested">Not Interested</option>
              </select>
            </div>
            
            {/* View Mode Toggle */}
            {onViewModeChange && (
              <ViewModeToggle 
                viewMode={viewMode || 'people'} 
                onViewModeChange={onViewModeChange} 
              />
            )}
          </div>
        )}
        
        {/* Dashboard date period filter */}
        {activeTab === 'dashboard' && onDatePeriodChange && (
          <div className="p-4 border-b border-slate-100">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Time Period
            </label>
            <select
              value={datePeriod || 'week'}
              onChange={(e) => onDatePeriodChange(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              aria-label="Select time period"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
        )}
      </div>
      
      {/* Footer content slot */}
      {footerContent && (
        <div className="border-t border-slate-100 p-4">
          {footerContent}
        </div>
      )}
    </div>
  );
}

export default SidebarContent;
