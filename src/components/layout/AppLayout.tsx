/**
 * AppLayout - Sprint 701
 * 
 * Top-level layout wrapper that combines:
 * - AppProvider (context)
 * - DesktopLayout (responsive shell)
 * - NavigationSidebar
 * - Accessibility announcer
 * 
 * This component bridges the new layout system with App.tsx.
 */

import { ReactNode, useCallback } from 'react';
import { AppProvider, useAppContext, useNavigation, useSidebar } from '../../context/AppContext';
import { DesktopLayout } from './DesktopLayout';
import { NavigationSidebar } from './NavigationSidebar';

// =============================================================================
// Types
// =============================================================================

export interface AppLayoutProps {
  /** Main content area */
  children: ReactNode;
  /** Callback to open settings panel */
  onSettingsClick?: () => void;
  /** Optional header content for navigation */
  navigationHeaderContent?: ReactNode;
  /** Optional footer content for navigation */
  navigationFooterContent?: ReactNode;
}

// =============================================================================
// Inner Layout (uses context)
// =============================================================================

function AppLayoutInner({
  children,
  onSettingsClick,
  navigationHeaderContent,
  navigationFooterContent,
}: AppLayoutProps): React.ReactElement {
  const { announce } = useAppContext();
  const { activeTab, setActiveTab } = useNavigation();
  const { isSidebarOpen, closeSidebar } = useSidebar();
  
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
      closeSidebar(); // Close sidebar on mobile when opening settings
    }
  }, [onSettingsClick, closeSidebar]);
  
  const sidebar = (
    <NavigationSidebar
      activeTab={activeTab}
      onTabChange={setActiveTab}
      announce={announce}
      onSettingsClick={handleSettingsClick}
      headerContent={navigationHeaderContent}
      footerContent={navigationFooterContent}
    />
  );
  
  return (
    <DesktopLayout
      sidebar={sidebar}
      main={children}
      sidebarWidth="medium"
      collapsible={true}
      isMobileSidebarOpen={isSidebarOpen}
      onMobileSidebarClose={closeSidebar}
    />
  );
}

// =============================================================================
// Public Component (provides context)
// =============================================================================

export function AppLayout(props: AppLayoutProps): React.ReactElement {
  return (
    <AppProvider>
      <AppLayoutInner {...props} />
    </AppProvider>
  );
}

// =============================================================================
// HOC for gradual migration
// =============================================================================

/**
 * Higher-order component to wrap existing components with AppLayout.
 * Use this for gradual migration of App.tsx.
 */
export function withAppLayout<P extends object>(
  Component: React.ComponentType<P>,
  layoutProps?: Omit<AppLayoutProps, 'children'>
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props: P) => (
    <AppLayout {...layoutProps}>
      <Component {...props} />
    </AppLayout>
  );
  
  WrappedComponent.displayName = `withAppLayout(${Component.displayName || Component.name || 'Component'})`;
  
  return WrappedComponent;
}

export default AppLayout;
