/**
 * DesktopLayout - Sprint 701 T701.1
 * 
 * Responsive layout container that adapts to desktop and mobile.
 * Uses CSS Grid for desktop, Flexbox for mobile.
 * 
 * Features:
 * - Collapsible sidebar
 * - Responsive breakpoints (mobile < 1024px < desktop)
 * - CSS custom properties for dynamic sizing
 * - Smooth transitions
 */

import { type ReactNode, useState, useCallback, useEffect } from 'react';
import { useIsDesktop, usePrefersReducedMotion } from '../../hooks/useMediaQuery';
import { LazyIcon } from '../icons';

// =============================================================================
// Types
// =============================================================================

export interface DesktopLayoutProps {
  /** Sidebar content (navigation, filters, etc.) */
  sidebar: ReactNode;
  /** Main content area */
  main: ReactNode;
  /** Sidebar width preset */
  sidebarWidth?: 'narrow' | 'medium' | 'wide';
  /** Whether sidebar can be collapsed on desktop */
  collapsible?: boolean;
  /** Initial collapsed state */
  initialCollapsed?: boolean;
  /** Mobile sidebar open state (controlled) */
  isMobileSidebarOpen?: boolean;
  /** Callback when mobile sidebar should close */
  onMobileSidebarClose?: () => void;
  /** Additional CSS class for layout container */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const SIDEBAR_WIDTHS = {
  narrow: 280,
  medium: 320,
  wide: 400,
} as const;

const STORAGE_KEY = 'desktop-layout-collapsed';

// =============================================================================
// Component
// =============================================================================

export function DesktopLayout({
  sidebar,
  main,
  sidebarWidth = 'medium',
  collapsible = true,
  initialCollapsed = false,
  isMobileSidebarOpen = false,
  onMobileSidebarClose,
  className = '',
}: DesktopLayoutProps): React.ReactElement {
  const isDesktop = useIsDesktop();
  const prefersReducedMotion = usePrefersReducedMotion();
  
  // Desktop collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return initialCollapsed;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialCollapsed;
    } catch {
      return initialCollapsed;
    }
  });
  
  // Persist collapse state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(isCollapsed));
      } catch {
        // localStorage quota exceeded or unavailable
      }
    }
  }, [isCollapsed]);
  
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev: boolean) => !prev);
  }, []);
  
  const widthPx = SIDEBAR_WIDTHS[sidebarWidth];
  const transitionClass = prefersReducedMotion ? '' : 'transition-all duration-300 ease-in-out';
  
  // ==========================================================================
  // Mobile Layout
  // ==========================================================================
  
  if (!isDesktop) {
    return (
      <div className={`flex flex-col min-h-screen ${className}`}>
        {/* Mobile sidebar overlay */}
        {isMobileSidebarOpen && (
          <>
            {/* Backdrop */}
            <div 
              className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm ${transitionClass}`}
              onClick={onMobileSidebarClose}
              aria-hidden="true"
            />
            
            {/* Sidebar drawer */}
            <aside
              className={`
                fixed inset-y-0 left-0 z-50
                w-80 max-w-[85vw]
                bg-white border-r border-slate-200
                flex flex-col shadow-xl
                ${transitionClass}
              `}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              {/* Close button */}
              <div className="flex justify-end p-2">
                <button
                  onClick={onMobileSidebarClose}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                  aria-label="Close navigation menu"
                >
                  <LazyIcon name="X" className="h-5 w-5 text-slate-600" />
                </button>
              </div>
              
              {/* Sidebar content */}
              <div className="flex-1 overflow-y-auto">
                {sidebar}
              </div>
            </aside>
          </>
        )}
        
        {/* Main content */}
        <main className="flex-1 flex flex-col" role="main">
          {main}
        </main>
      </div>
    );
  }
  
  // ==========================================================================
  // Desktop Layout
  // ==========================================================================
  
  return (
    <div 
      className={`
        flex min-h-screen
        ${className}
      `}
      style={{
        '--sidebar-width': `${isCollapsed ? 0 : widthPx}px`,
      } as React.CSSProperties}
    >
      {/* Desktop sidebar */}
      <aside
        className={`
          flex-shrink-0 bg-white border-r border-slate-200
          flex flex-col overflow-hidden
          ${transitionClass}
        `}
        style={{
          width: isCollapsed ? 0 : widthPx,
        }}
        aria-label="Navigation sidebar"
        aria-hidden={isCollapsed}
      >
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {sidebar}
          </div>
        )}
      </aside>
      
      {/* Desktop main content */}
      <main 
        className={`flex-1 flex flex-col overflow-hidden ${transitionClass}`}
        role="main"
      >
        {/* Collapse toggle (if collapsible) */}
        {collapsible && (
          <button
            onClick={toggleCollapse}
            className={`
              fixed z-30 p-2 rounded-r-lg
              bg-white border border-l-0 border-slate-200
              hover:bg-slate-50 transition-colors
              shadow-sm
            `}
            style={{
              left: isCollapsed ? 0 : widthPx,
              top: 12,
            }}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
          >
            <svg 
              className={`h-4 w-4 text-slate-600 ${transitionClass} ${isCollapsed ? '' : 'rotate-180'}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        
        {main}
      </main>
    </div>
  );
}

export default DesktopLayout;
