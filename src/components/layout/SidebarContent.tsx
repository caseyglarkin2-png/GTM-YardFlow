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
 * - Sprint V34: Quick filter presets + saved filters
 */

import { type ReactNode, useCallback, useState, useMemo } from 'react';
import { Zap } from 'lucide-react';
import { LazyIcon } from '../icons';
import { NAVIGATION_TABS, type TabId } from '@/config/navigation';
import { QUICK_FILTER_PRESETS, type QuickFilterPreset } from '@/config/quickFilters';
import { type ViewMode } from '@/components/ViewModeToggle';
import { SyncStatus } from '@/components/SyncStatus';
import { type SyncStatus as SyncStatusType } from '@/services/OfflineQueue';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { useRailwayHealth, type RailwayHealthStatus } from '@/hooks/useRailwayHealth';
import { useSavedFilters } from '@/hooks/useSavedFilters';
import { MultiSelectDropdown, type MultiSelectOption } from '../MultiSelectDropdown';

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
  // Sprint 1002 - Email Filter
  emailFilter?: string;
  onEmailFilterChange?: (value: string) => void;
  // Sprint 32 - Tag Filter
  tagFilter?: string | null;
  onTagFilterChange?: (tag: string | null) => void;
  allTags?: string[];
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  
  // Sprint 36C - Quick Filter Support
  activeQuickFilter?: string | null;
  onQuickFilterChange?: (preset: QuickFilterPreset | null) => void;
  minFacilitiesFilter?: number;
  onMinFacilitiesChange?: (min: number | undefined) => void;
  minScoreFilter?: number;
  onMinScoreChange?: (min: number | undefined) => void;
  
  // Sprint 36D - Multi-tier support
  multiTierFilter?: string[];
  onMultiTierFilterChange?: (tiers: string[]) => void;
  tierCounts?: Record<string, number>; // For showing counts in dropdown
  
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

  // Badge counts for tabs
  badgeCounts?: Record<string, number>;

  // Railway status (optional to allow parent-provided status)
  railwayStatus?: RailwayHealthStatus;
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
  Inbox: 'Inbox',
};

// =============================================================================
// SavedFiltersSection Component - Sprint V34
// =============================================================================

interface SavedFiltersSectionProps {
  currentFilters: {
    tierFilter: string;
    emailFilter: string;
    tagFilter: string | null;
    searchQuery: string;
  };
  onLoadFilter: (preset: { name: string; tierFilter: string; emailFilter: string; tagFilter: string | null; searchQuery: string }) => void;
}

function SavedFiltersSection({ currentFilters, onLoadFilter }: SavedFiltersSectionProps) {
  const { presets, savePreset, deletePreset } = useSavedFilters();
  const [isOpen, setIsOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleSave = useCallback(() => {
    if (!newPresetName.trim()) return;
    savePreset(newPresetName.trim(), currentFilters);
    setNewPresetName('');
    setShowSaveInput(false);
  }, [newPresetName, currentFilters, savePreset]);

  const hasActiveFilters = 
    currentFilters.tierFilter !== 'All' || 
    currentFilters.emailFilter !== 'all' || 
    currentFilters.tagFilter !== null ||
    currentFilters.searchQuery !== '';

  if (presets.length === 0 && !hasActiveFilters) {
    return null; // Don't show section if no presets and no filters to save
  }

  return (
    <div className="space-y-1.5" data-testid="saved-filters-section">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
        aria-expanded={isOpen}
        data-testid="saved-filters-toggle"
      >
        <LazyIcon name={isOpen ? 'ChevronDown' : 'ChevronRight'} className="h-3 w-3" />
        Saved Filters ({presets.length})
      </button>
      
      {isOpen && (
        <div className="space-y-2 pl-1">
          {/* Preset list */}
          {presets.length > 0 && (
            <div className="space-y-1">
              {presets.map((preset) => (
                <div 
                  key={preset.id} 
                  className="flex items-center gap-1 group"
                  data-testid={`saved-filter-${preset.id}`}
                >
                  <button
                    onClick={() => onLoadFilter(preset)}
                    className="flex-1 text-left px-2 py-1 text-xs rounded bg-slate-50 hover:bg-blue-50 hover:text-blue-700 transition-colors truncate"
                    title={`Load filter: ${preset.name}`}
                    data-testid={`load-filter-${preset.id}`}
                  >
                    {preset.name}
                  </button>
                  <button
                    onClick={() => deletePreset(preset.id)}
                    className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete filter"
                    aria-label={`Delete filter ${preset.name}`}
                    data-testid={`delete-filter-${preset.id}`}
                  >
                    <LazyIcon name="X" className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Save new preset */}
          {hasActiveFilters && (
            <>
              {showSaveInput ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    placeholder="Filter name..."
                    className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    autoFocus
                    data-testid="save-filter-input"
                  />
                  <button
                    onClick={handleSave}
                    disabled={!newPresetName.trim()}
                    className="p-1 text-green-600 hover:text-green-700 disabled:text-slate-300 disabled:cursor-not-allowed"
                    title="Save filter"
                    data-testid="save-filter-confirm"
                  >
                    <LazyIcon name="Check" className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setShowSaveInput(false); setNewPresetName(''); }}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Cancel"
                    data-testid="save-filter-cancel"
                  >
                    <LazyIcon name="X" className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveInput(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                  data-testid="save-filter-button"
                >
                  <LazyIcon name="Plus" className="h-3 w-3" />
                  Save current filter
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

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
  emailFilter = 'all',
  onEmailFilterChange,
  tagFilter = null,
  onTagFilterChange,
  allTags = [],
  viewMode = 'people',
  onViewModeChange,
  // Sprint 36C - Quick Filter props
  activeQuickFilter = null,
  onQuickFilterChange,
  minFacilitiesFilter,
  onMinFacilitiesChange,
  minScoreFilter,
  onMinScoreChange,
  // Sprint 36D - Multi-tier support
  multiTierFilter = [],
  onMultiTierFilterChange,
  tierCounts,
  datePeriod,
  onDatePeriodChange,
  syncStatus,
  announce,
  headerContent,
  footerContent,
  railwayUrl = 'https://yardflow-hitlist-production-2f41.up.railway.app',
  badgeCounts,
  railwayStatus,
}: SidebarContentProps): React.ReactElement {
  const { status: derivedStatus } = useRailwayHealth();
  const effectiveRailwayStatus = railwayStatus ?? derivedStatus;
  
  // Sprint 36D: Tier options for multi-select dropdown
  const tierOptions: MultiSelectOption[] = useMemo(() => [
    { value: 'Tier 1', label: 'Tier 1', emoji: '⭐', count: tierCounts?.['Tier 1'] },
    { value: 'Tier 2', label: 'Tier 2', emoji: '🔵', count: tierCounts?.['Tier 2'] },
    { value: 'Tier 3', label: 'Tier 3', emoji: '⚪', count: tierCounts?.['Tier 3'] },
    { value: 'Tier 4', label: 'Tier 4', emoji: '⬜', count: tierCounts?.['Tier 4'] },
  ], [tierCounts]);
  
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
              FreightRoll <span className="text-blue-600">Hub</span>
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

            {/* Railway Connection Status */}
            <div className="flex items-center gap-2 px-2 py-1 rounded bg-slate-50" aria-label="Railway connection status">
              <span
                className={
                  `inline-block h-2 w-2 rounded-full ${
                    effectiveRailwayStatus === 'healthy' ? 'bg-green-500' :
                    effectiveRailwayStatus === 'unhealthy' ? 'bg-red-500' :
                    'bg-amber-400 animate-pulse'
                  }`
                }
                aria-hidden="true"
              />
              <span className="text-[11px] font-medium text-slate-600">
                {effectiveRailwayStatus === 'healthy' && 'Connected'}
                {effectiveRailwayStatus === 'unhealthy' && 'Offline mode'}
                {effectiveRailwayStatus === 'checking' && 'Checking…'}
              </span>
            </div>
            
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
            const badgeCount = badgeCounts?.[tab.id] || 0;
            
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
                {badgeCount > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full min-w-[14px] h-[14px] flex items-center justify-center">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
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
            {/* Quick Filter Presets - Sprint V36C: 8 workflow-oriented filters */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Quick Filters</span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_FILTER_PRESETS.map((preset) => {
                  const isActive = activeQuickFilter === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        if (isActive) {
                          // Clear this quick filter
                          onQuickFilterChange?.(null);
                          // Also clear underlying filters
                          onTierFilterChange?.('All');
                          onEmailFilterChange?.('all');
                          onTagFilterChange?.(null);
                          onMinFacilitiesChange?.(undefined);
                          onMinScoreChange?.(undefined);
                          announce?.('Cleared quick filter');
                        } else {
                          // Apply the quick filter
                          onQuickFilterChange?.(preset);
                          
                          // Apply tier filter (single tier only until S36D adds multi-select)
                          if (preset.filters.tiers?.length === 1) {
                            onTierFilterChange?.(preset.filters.tiers[0]);
                          } else if (preset.filters.tiers && preset.filters.tiers.length > 1) {
                            // For now, use first tier (S36D will add proper multi-tier)
                            onTierFilterChange?.(preset.filters.tiers[0]);
                          } else {
                            onTierFilterChange?.('All');
                          }
                          
                          // Apply email filter
                          if (preset.filters.emailStatus) {
                            onEmailFilterChange?.(preset.filters.emailStatus);
                          } else {
                            onEmailFilterChange?.('all');
                          }
                          
                          // Apply tag filter
                          if (preset.filters.tags?.length) {
                            onTagFilterChange?.(preset.filters.tags[0]);
                          } else {
                            onTagFilterChange?.(null);
                          }
                          
                          // Apply numeric filters
                          if (preset.filters.minFacilities !== undefined) {
                            onMinFacilitiesChange?.(preset.filters.minFacilities);
                          } else {
                            onMinFacilitiesChange?.(undefined);
                          }
                          
                          if (preset.filters.minScore !== undefined) {
                            onMinScoreChange?.(preset.filters.minScore);
                          } else {
                            onMinScoreChange?.(undefined);
                          }
                          
                          announce?.(`Filtered to ${preset.label}: ${preset.description}`);
                        }
                      }}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${
                        isActive 
                          ? `${preset.color.bgActive} text-white` 
                          : `${preset.color.bg} ${preset.color.text} hover:opacity-80`
                      }`}
                      title={preset.description}
                      data-testid={`quick-filter-${preset.id}`}
                    >
                      {preset.emoji} {preset.label}
                    </button>
                  );
                })}
                {/* Clear button */}
                <button
                  onClick={() => {
                    onQuickFilterChange?.(null);
                    onTierFilterChange?.('All');
                    onEmailFilterChange?.('all');
                    onTagFilterChange?.(null);
                    onFilterChange?.('');
                    onMinFacilitiesChange?.(undefined);
                    onMinScoreChange?.(undefined);
                    announce?.('Cleared all filters');
                  }}
                  className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  data-testid="quick-filter-clear"
                >
                  ✕ Clear
                </button>
              </div>
            </div>

            {/* Saved Filters - Sprint V34 */}
            <SavedFiltersSection
              currentFilters={{
                tierFilter,
                emailFilter,
                tagFilter,
                searchQuery: filter,
              }}
              onLoadFilter={(preset) => {
                onTierFilterChange?.(preset.tierFilter);
                onEmailFilterChange?.(preset.emailFilter);
                onTagFilterChange?.(preset.tagFilter);
                onFilterChange?.(preset.searchQuery);
                announce?.(`Loaded filter: ${preset.name}`);
              }}
            />

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
            
            {/* Tier, Status, and Email filters */}
            <div className="grid grid-cols-1 gap-2">
              {/* Sprint 36D: Multi-select tier filter */}
              {onMultiTierFilterChange ? (
                <MultiSelectDropdown
                  id="tier-filter"
                  label="Tier"
                  options={tierOptions}
                  selected={multiTierFilter}
                  onChange={onMultiTierFilterChange}
                  placeholder="All Tiers"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={tierFilter}
                    onChange={(e) => onTierFilterChange?.(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    aria-label="Filter by tier"
                  >
                    <option value="All">All Tiers</option>
                    <option value="Tier 1">Tier 1</option>
                    <option value="Tier 2">Tier 2</option>
                    <option value="Tier 3">Tier 3</option>
                  </select>
                  
                  <select
                    value={emailFilter}
                    onChange={(e) => onEmailFilterChange?.(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    aria-label="Filter by email"
                  >
                    <option value="all">Any Email</option>
                    <option value="has_email">Has Email</option>
                    <option value="no_email">No Email</option>
                  </select>
                </div>
              )}

              {/* Email filter (shown separately when multi-tier enabled) */}
              {onMultiTierFilterChange && (
                <select
                  value={emailFilter}
                  onChange={(e) => onEmailFilterChange?.(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  aria-label="Filter by email"
                >
                  <option value="all">Any Email</option>
                  <option value="has_email">Has Email</option>
                  <option value="no_email">No Email</option>
                </select>
              )}

              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange?.(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-full"
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="replied">Replied</option>
                <option value="meeting_booked">Meeting Booked</option>
                <option value="not_interested">Not Interested</option>
              </select>
              
              {/* Sprint 32: Tag Filter Dropdown */}
              {allTags.length > 0 && (
                <select
                  value={tagFilter || ''}
                  onChange={(e) => onTagFilterChange?.(e.target.value || null)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-full"
                  aria-label="Filter by tag"
                >
                  <option value="">All Tags</option>
                  {allTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              )}
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
