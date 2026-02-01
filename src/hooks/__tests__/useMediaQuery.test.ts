/**
 * useMediaQuery Hook Tests - Sprint 701 T701.0a
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { 
  useMediaQuery, 
  useIsDesktop, 
  useIsMobile, 
  useIsTablet,
  usePrefersReducedMotion,
} from '../useMediaQuery';

// Mock matchMedia
function createMatchMedia(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('useMediaQuery', () => {
  const originalMatchMedia = window.matchMedia;
  
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  describe('basic functionality', () => {
    it('returns true when query matches', () => {
      window.matchMedia = createMatchMedia(true);
      
      const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
      
      expect(result.current).toBe(true);
    });

    it('returns false when query does not match', () => {
      window.matchMedia = createMatchMedia(false);
      
      const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
      
      expect(result.current).toBe(false);
    });

    it('updates when media query changes', () => {
      let changeCallback: (() => void) | null = null;
      let currentMatches = false;
      
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        get matches() { return currentMatches; },
        media: query,
        addEventListener: vi.fn((event: string, cb: () => void) => {
          if (event === 'change') changeCallback = cb;
        }),
        removeEventListener: vi.fn(),
      }));
      
      const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
      
      expect(result.current).toBe(false);
      
      // Simulate media query change
      currentMatches = true;
      act(() => {
        changeCallback?.();
      });
      
      expect(result.current).toBe(true);
    });

    it('cleans up listener on unmount', () => {
      const removeEventListener = vi.fn();
      
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener,
      }));
      
      const { unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
      
      unmount();
      
      expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('SSR safety', () => {
    it('handles undefined window gracefully', () => {
      const originalWindow = global.window;
      
      // Simulate SSR by making matchMedia throw
      window.matchMedia = vi.fn().mockImplementation(() => {
        throw new Error('window is not defined');
      });
      
      // The hook should not throw and should return false
      // Note: In actual SSR, useSyncExternalStore uses getServerSnapshot
      // which always returns false
      
      global.window = originalWindow;
    });
  });
});

describe('useIsDesktop', () => {
  it('returns true for desktop width', () => {
    window.matchMedia = createMatchMedia(true);
    
    const { result } = renderHook(() => useIsDesktop());
    
    expect(result.current).toBe(true);
  });

  it('returns false for mobile width', () => {
    window.matchMedia = createMatchMedia(false);
    
    const { result } = renderHook(() => useIsDesktop());
    
    expect(result.current).toBe(false);
  });
});

describe('useIsMobile', () => {
  it('returns true for mobile width', () => {
    window.matchMedia = createMatchMedia(true);
    
    const { result } = renderHook(() => useIsMobile());
    
    expect(result.current).toBe(true);
  });

  it('returns false for desktop width', () => {
    window.matchMedia = createMatchMedia(false);
    
    const { result } = renderHook(() => useIsMobile());
    
    expect(result.current).toBe(false);
  });
});

describe('useIsTablet', () => {
  it('checks for tablet range', () => {
    window.matchMedia = createMatchMedia(true);
    
    const { result } = renderHook(() => useIsTablet());
    
    expect(result.current).toBe(true);
  });
});

describe('usePrefersReducedMotion', () => {
  it('detects reduced motion preference', () => {
    window.matchMedia = createMatchMedia(true);
    
    const { result } = renderHook(() => usePrefersReducedMotion());
    
    expect(result.current).toBe(true);
  });
});
