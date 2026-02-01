/**
 * AppContext Tests - Sprint 701 T701.0c
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { 
  AppProvider, 
  useAppContext, 
  useNavigation, 
  useSidebar, 
  useViewMode 
} from '../../context/AppContext';
import type { ReactNode } from 'react';

// Wrapper for testing hooks
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AppProvider>{children}</AppProvider>;
  };
}

describe('AppProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides context to children', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: createWrapper(),
    });
    
    expect(result.current).toBeDefined();
    expect(result.current.activeTab).toBe('dashboard');
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => useAppContext());
    }).toThrow('useAppContext must be used within an AppProvider');
    
    consoleSpy.mockRestore();
  });

  it('accepts initial tab prop', () => {
    function Wrapper({ children }: { children: ReactNode }) {
      return <AppProvider initialTab="sequences">{children}</AppProvider>;
    }
    
    const { result } = renderHook(() => useAppContext(), { wrapper: Wrapper });
    
    expect(result.current.activeTab).toBe('sequences');
  });

  it('renders screen reader announcement region', () => {
    render(
      <AppProvider>
        <div>App content</div>
      </AppProvider>
    );
    
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });
});

describe('useAppContext', () => {
  it('allows setting active tab', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: createWrapper(),
    });
    
    act(() => {
      result.current.setActiveTab('sequences');
    });
    
    expect(result.current.activeTab).toBe('sequences');
  });

  it('allows toggling sidebar', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: createWrapper(),
    });
    
    expect(result.current.isSidebarOpen).toBe(false);
    
    act(() => {
      result.current.toggleSidebar();
    });
    
    expect(result.current.isSidebarOpen).toBe(true);
    
    act(() => {
      result.current.toggleSidebar();
    });
    
    expect(result.current.isSidebarOpen).toBe(false);
  });

  it('allows opening and closing sidebar', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: createWrapper(),
    });
    
    act(() => {
      result.current.openSidebar();
    });
    expect(result.current.isSidebarOpen).toBe(true);
    
    act(() => {
      result.current.closeSidebar();
    });
    expect(result.current.isSidebarOpen).toBe(false);
  });

  it('allows setting selected prospect', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: createWrapper(),
    });
    
    const mockProspect = { id: '123', firstName: 'John' } as any;
    
    act(() => {
      result.current.setSelectedProspect(mockProspect);
    });
    
    expect(result.current.selectedProspect).toEqual(mockProspect);
    
    act(() => {
      result.current.setSelectedProspect(null);
    });
    
    expect(result.current.selectedProspect).toBeNull();
  });

  it('persists view mode to localStorage', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: createWrapper(),
    });
    
    act(() => {
      result.current.setViewMode('people');
    });
    
    expect(result.current.viewMode).toBe('people');
    expect(localStorage.getItem('viewMode')).toBe('people');
  });

  it('restores view mode from localStorage', () => {
    localStorage.setItem('viewMode', 'people');
    
    const { result } = renderHook(() => useAppContext(), {
      wrapper: createWrapper(),
    });
    
    expect(result.current.viewMode).toBe('people');
  });

  it('allows announcing messages', () => {
    vi.useFakeTimers();
    
    const { result } = renderHook(() => useAppContext(), {
      wrapper: createWrapper(),
    });
    
    act(() => {
      result.current.announce('Test message');
    });
    
    expect(result.current.announcement).toBe('Test message');
    
    // Announcement should clear after timeout
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    
    expect(result.current.announcement).toBe('');
    
    vi.useRealTimers();
  });
});

describe('useNavigation', () => {
  it('returns navigation state', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: createWrapper(),
    });
    
    expect(result.current.activeTab).toBe('dashboard');
    expect(typeof result.current.setActiveTab).toBe('function');
    expect(typeof result.current.announce).toBe('function');
  });
});

describe('useSidebar', () => {
  it('returns sidebar state', () => {
    const { result } = renderHook(() => useSidebar(), {
      wrapper: createWrapper(),
    });
    
    expect(result.current.isSidebarOpen).toBe(false);
    expect(typeof result.current.openSidebar).toBe('function');
    expect(typeof result.current.closeSidebar).toBe('function');
    expect(typeof result.current.toggleSidebar).toBe('function');
  });
});

describe('useViewMode', () => {
  it('returns view mode state', () => {
    const { result } = renderHook(() => useViewMode(), {
      wrapper: createWrapper(),
    });
    
    // Default viewMode is 'people' as defined in AppContext
    expect(result.current.viewMode).toBe('people');
    expect(typeof result.current.setViewMode).toBe('function');
  });
});
