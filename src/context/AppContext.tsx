/**
 * AppContext - Sprint 701 T701.0c
 * 
 * Centralized state management for app-wide state.
 * Enables clean extraction of components from App.tsx.
 * 
 * State managed here:
 * - Navigation (active tab)
 * - Sidebar visibility
 * - View mode (people/companies)
 * - Accessibility announcements
 */

import { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  useMemo,
  type ReactNode,
} from 'react';
import type { TabId } from '../config/navigation';
import type { Prospect } from '../types/firestore';

// =============================================================================
// Types
// =============================================================================

export interface AppState {
  // Navigation
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  
  // Mobile sidebar
  isSidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  
  // Selected items
  selectedProspect: Prospect | null;
  setSelectedProspect: (prospect: Prospect | null) => void;
  
  // View mode
  viewMode: 'people' | 'companies';
  setViewMode: (mode: 'people' | 'companies') => void;
  
  // Sequence builder modal
  showSequenceBuilder: boolean;
  setShowSequenceBuilder: (show: boolean) => void;
  
  // Settings modal
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  
  // Accessibility announcements
  announce: (message: string) => void;
  announcement: string;
}

// =============================================================================
// Context
// =============================================================================

const AppContext = createContext<AppState | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface AppProviderProps {
  children: ReactNode;
  /** Initial tab (for testing or deep linking) */
  initialTab?: TabId;
}

export function AppProvider({ 
  children, 
  initialTab = 'dashboard' 
}: AppProviderProps): React.ReactElement {
  // Navigation state
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  
  // Sidebar state (mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Selection state
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  
  // View mode (people vs companies)
  const [viewMode, setViewModeState] = useState<'people' | 'companies'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('viewMode');
      return (saved === 'people' || saved === 'companies') ? saved : 'companies';
    }
    return 'companies';
  });
  
  // Modal states
  const [showSequenceBuilder, setShowSequenceBuilder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Accessibility announcements
  const [announcement, setAnnouncement] = useState('');
  
  // Memoized callbacks
  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  
  const setViewMode = useCallback((mode: 'people' | 'companies') => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('viewMode', mode);
    }
  }, []);
  
  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    // Clear after screen reader has time to read
    setTimeout(() => setAnnouncement(''), 1000);
  }, []);
  
  // Memoize context value
  const value = useMemo<AppState>(() => ({
    activeTab,
    setActiveTab,
    isSidebarOpen,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    selectedProspect,
    setSelectedProspect,
    viewMode,
    setViewMode,
    showSequenceBuilder,
    setShowSequenceBuilder,
    showSettings,
    setShowSettings,
    announce,
    announcement,
  }), [
    activeTab,
    isSidebarOpen,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    selectedProspect,
    viewMode,
    setViewMode,
    showSequenceBuilder,
    showSettings,
    announce,
    announcement,
  ]);
  
  return (
    <AppContext.Provider value={value}>
      {children}
      
      {/* Screen reader live region for announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      >
        {announcement}
      </div>
    </AppContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access app-wide state
 * 
 * @throws Error if used outside AppProvider
 */
export function useAppContext(): AppState {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

/**
 * Hook to access just the navigation state
 */
export function useNavigation() {
  const { activeTab, setActiveTab, announce } = useAppContext();
  return { activeTab, setActiveTab, announce };
}

/**
 * Hook to access just the sidebar state
 */
export function useSidebar() {
  const { isSidebarOpen, openSidebar, closeSidebar, toggleSidebar } = useAppContext();
  return { isSidebarOpen, openSidebar, closeSidebar, toggleSidebar };
}

/**
 * Hook to access view mode
 */
export function useViewMode() {
  const { viewMode, setViewMode } = useAppContext();
  return { viewMode, setViewMode };
}

export default AppContext;
