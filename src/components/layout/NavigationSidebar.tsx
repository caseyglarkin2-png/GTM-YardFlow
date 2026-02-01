/**
 * NavigationSidebar - Sprint 701 T701.3
 * 
 * Tab navigation component with responsive design.
 * - Mobile: Horizontal scrolling icons
 * - Desktop: Vertical list with full labels
 * 
 * Implements roving tabindex for keyboard navigation.
 */

import { useState, useCallback, type KeyboardEvent } from 'react';
import { NAVIGATION_TABS, type TabId, getNextTabId, getPreviousTabId } from '../../config/navigation';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { LazyIcon } from '../icons';
// Zap is kept as direct import since it's used in the logo (critical path)
import { Zap } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface NavigationSidebarProps {
  /** Currently active tab */
  activeTab: TabId;
  /** Callback when tab changes */
  onTabChange: (tabId: TabId) => void;
  /** Accessibility announcement callback */
  announce?: (message: string) => void;
  /** Callback to open settings */
  onSettingsClick?: () => void;
  /** Railway dashboard URL */
  railwayUrl?: string;
  /** Additional content above tabs */
  headerContent?: React.ReactNode;
  /** Additional content below tabs */
  footerContent?: React.ReactNode;
}

// =============================================================================
// Component
// =============================================================================

export function NavigationSidebar({
  activeTab,
  onTabChange,
  announce,
  onSettingsClick,
  railwayUrl = 'https://yardflow-hitlist-production-2f41.up.railway.app',
  headerContent,
  footerContent,
}: NavigationSidebarProps): React.ReactElement {
  const isDesktop = useIsDesktop();
  const [focusedTabId, setFocusedTabId] = useState<TabId>(activeTab);
  
  // Handle tab click
  const handleTabClick = useCallback((tabId: TabId) => {
    onTabChange(tabId);
    setFocusedTabId(tabId);
    
    const tab = NAVIGATION_TABS.find(t => t.id === tabId);
    if (tab && announce) {
      announce(`${tab.label} tab selected`);
    }
  }, [onTabChange, announce]);
  
  // Roving tabindex keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>, tabId: TabId) => {
    let nextTabId: TabId | null = null;
    
    if (isDesktop) {
      // Desktop: Up/Down navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        nextTabId = getNextTabId(tabId);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        nextTabId = getPreviousTabId(tabId);
      }
    } else {
      // Mobile: Left/Right navigation
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextTabId = getNextTabId(tabId);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nextTabId = getPreviousTabId(tabId);
      }
    }
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTabClick(tabId);
    }
    
    if (nextTabId) {
      setFocusedTabId(nextTabId);
      // Focus the button after state update
      requestAnimationFrame(() => {
        const button = document.querySelector(`[data-tab-id="${nextTabId}"]`) as HTMLButtonElement;
        button?.focus();
      });
    }
  }, [isDesktop, handleTabClick]);
  
  // ==========================================================================
  // Render
  // ==========================================================================
  
  return (
    <div className="flex flex-col h-full" data-testid="navigation-sidebar">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        {/* Logo and title */}
        <div className="flex items-center justify-between mb-4">
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
          
          {/* Quick actions */}
          <div className="flex items-center gap-2">
            {railwayUrl && (
              <a
                href={railwayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-500 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-blue-50 flex items-center gap-1"
                title="Open Railway dashboard"
              >
                <LazyIcon name="ExternalLink" className="h-3 w-3" />
                <span className="hidden lg:inline">Railway</span>
              </a>
            )}
            
            {onSettingsClick && (
              <button
                onClick={onSettingsClick}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Open settings"
              >
                <LazyIcon name="Settings" className="h-5 w-5 text-slate-600" />
              </button>
            )}
          </div>
        </div>
        
        {headerContent}
      </div>
      
      {/* Navigation tabs */}
      <nav 
        className={`
          ${isDesktop 
            ? 'flex flex-col p-2 space-y-1' 
            : 'flex overflow-x-auto p-2 gap-1 scrollbar-hide'
          }
        `}
        role="tablist"
        aria-label="Main navigation"
      >
        {NAVIGATION_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isFocused = focusedTabId === tab.id;
          
          return (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={tab.panelId}
              tabIndex={isFocused ? 0 : -1}
              onClick={() => handleTabClick(tab.id as TabId)}
              onKeyDown={(e) => handleKeyDown(e, tab.id as TabId)}
              className={`
                flex items-center
                rounded-lg font-medium transition-all
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                
                ${isDesktop 
                  ? 'justify-start w-full px-3 py-2.5 text-sm' 
                  : 'justify-center min-w-[48px] p-2 text-xs'
                }
                
                ${isActive 
                  ? 'bg-blue-50 text-blue-700 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }
              `}
            >
              <Icon 
                className={`
                  flex-shrink-0
                  ${isDesktop ? 'h-5 w-5 mr-3' : 'h-5 w-5'}
                  ${isActive ? 'text-blue-600' : 'text-slate-500'}
                `} 
                aria-hidden="true" 
              />
              
              {/* Label: hidden on mobile, visible on desktop */}
              <span className={isDesktop ? '' : 'sr-only'}>
                {tab.label}
              </span>
              
              {/* Short label on tablet (shown via CSS) */}
              <span className="hidden sm:inline lg:hidden ml-1 text-xs">
                {tab.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
      
      {/* Footer content */}
      {footerContent && (
        <div className="mt-auto border-t border-slate-100 p-4">
          {footerContent}
        </div>
      )}
    </div>
  );
}

export default NavigationSidebar;
