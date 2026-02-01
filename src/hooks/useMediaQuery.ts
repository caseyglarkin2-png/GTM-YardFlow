/**
 * useMediaQuery Hook - Sprint 701 T701.0a
 * 
 * SSR-safe media query hook using useSyncExternalStore.
 * 
 * Why useSyncExternalStore:
 * - Avoids hydration mismatch (window is undefined on server)
 * - Works correctly with React 18 concurrent rendering
 * - No tearing during rapid updates
 */

import { useSyncExternalStore, useCallback } from 'react';

/**
 * Subscribe to media query changes
 */
function createSubscribe(query: string) {
  return (callback: () => void) => {
    // Handle SSR - no window
    if (typeof window === 'undefined') {
      return () => {};
    }
    
    const mql = window.matchMedia(query);
    mql.addEventListener('change', callback);
    return () => mql.removeEventListener('change', callback);
  };
}

/**
 * Get current snapshot of media query match
 */
function createGetSnapshot(query: string) {
  return () => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  };
}

/**
 * Server snapshot - always returns false (assume mobile-first)
 */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Hook to track a media query match state
 * 
 * @param query - CSS media query string
 * @returns boolean indicating if the query matches
 * 
 * @example
 * const isWide = useMediaQuery('(min-width: 1024px)');
 * const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(createSubscribe(query), [query]);
  const getSnapshot = useCallback(createGetSnapshot(query), [query]);
  
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// =============================================================================
// Preset Hooks for Common Breakpoints
// =============================================================================

/**
 * Returns true when viewport is >= 1024px (Tailwind 'lg')
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

/**
 * Returns true when viewport is >= 1280px (Tailwind 'xl')
 */
export function useIsWideDesktop(): boolean {
  return useMediaQuery('(min-width: 1280px)');
}

/**
 * Returns true when viewport is >= 1536px (Tailwind '2xl')
 */
export function useIsUltraWide(): boolean {
  return useMediaQuery('(min-width: 1536px)');
}

/**
 * Returns true when viewport is < 1024px
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}

/**
 * Returns true when viewport is >= 768px and < 1024px (tablet range)
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

/**
 * Returns true when user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Returns true when user prefers dark color scheme
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

export default useMediaQuery;
