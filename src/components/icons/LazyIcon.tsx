/**
 * LazyIcon - Sprint 700 T700.1
 * 
 * Lazy-loaded icon component to fix INP performance issues.
 * Uses dynamic imports with Suspense and ErrorBoundary for resilience.
 * 
 * Why this matters:
 * - Importing 40+ icons from lucide-react blocks main thread for ~360ms
 * - This component loads icons on-demand with graceful fallbacks
 * - Critical icons are preloaded (see iconPreloader.ts)
 */

import { Suspense, lazy, memo, useMemo, type ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { IconErrorBoundary } from './IconErrorBoundary';

// =============================================================================
// Types
// =============================================================================

export interface LazyIconProps extends LucideProps {
  /** Name of the Lucide icon (e.g., 'Menu', 'Settings', 'Mail') */
  name: string;
  /** Size in pixels (used for width, height, and fallback dimensions) */
  size?: number;
}

// =============================================================================
// Icon Loading Cache
// =============================================================================

// Cache for loaded icon components to prevent re-importing
const iconCache = new Map<string, ComponentType<LucideProps>>();

import type { LazyExoticComponent } from 'react';

// Cache for lazy components (React.lazy wrapped)
const lazyIconCache = new Map<string, LazyExoticComponent<ComponentType<LucideProps>>>();

/**
 * Get or create a lazy-loaded icon component
 */
function getLazyIcon(name: string): LazyExoticComponent<ComponentType<LucideProps>> {
  // Return cached lazy component if available
  if (lazyIconCache.has(name)) {
    return lazyIconCache.get(name)!;
  }

  // Create lazy component with dynamic import
  const LazyComponent = lazy(async () => {
    // Check if already loaded in cache
    if (iconCache.has(name)) {
      return { default: iconCache.get(name)! };
    }

    try {
      // Dynamic import from lucide-react
      // Note: lucide-react exports icons from the main bundle
      const lucide = await import('lucide-react');
      const Icon = (lucide as unknown as Record<string, ComponentType<LucideProps>>)[name];
      
      if (!Icon) {
        console.warn(`[LazyIcon] Icon "${name}" not found in lucide-react`);
        // Return a placeholder for unknown icons
        return { default: PlaceholderIcon };
      }

      // Cache for future use
      iconCache.set(name, Icon);
      return { default: Icon };
    } catch (error) {
      console.error(`[LazyIcon] Failed to load icon "${name}":`, error);
      return { default: PlaceholderIcon };
    }
  });

  lazyIconCache.set(name, LazyComponent);
  return LazyComponent;
}

// =============================================================================
// Fallback Components
// =============================================================================

/**
 * Placeholder shown during loading - matches icon dimensions to prevent layout shift
 */
function IconFallback({ size = 24 }: { size?: number }) {
  return (
    <span
      className="inline-block bg-slate-200 rounded animate-pulse"
      style={{ width: size, height: size }}
      aria-hidden="true"
      data-testid="icon-fallback"
    />
  );
}

/**
 * Placeholder for unknown or failed icons
 */
function PlaceholderIcon({ size = 24, className = '' }: LucideProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      data-testid="placeholder-icon"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * LazyIcon - Lazy-loaded icon with fallbacks
 * 
 * @example
 * // Basic usage
 * <LazyIcon name="Menu" className="h-6 w-6" />
 * 
 * @example
 * // With size prop
 * <LazyIcon name="Settings" size={20} />
 */
function LazyIconInner({ name, size = 24, className, ref: _ref, ...props }: LazyIconProps) {
  // Memoize the lazy component lookup
  const IconComponent = useMemo(() => getLazyIcon(name), [name]);

  return (
    <IconErrorBoundary fallback={<IconFallback size={size} />}>
      <Suspense fallback={<IconFallback size={size} />}>
        <IconComponent size={size} className={className} {...props} />
      </Suspense>
    </IconErrorBoundary>
  );
}

// Memoize to prevent unnecessary re-renders
export const LazyIcon = memo(LazyIconInner);
LazyIcon.displayName = 'LazyIcon';

export default LazyIcon;

// =============================================================================
// Preload Helper (for critical icons)
// =============================================================================

/**
 * Preload an icon into the cache
 * Call this for critical path icons before render
 */
export async function preloadIcon(name: string): Promise<void> {
  if (iconCache.has(name)) return;

  try {
    const lucide = await import('lucide-react');
    const Icon = (lucide as unknown as Record<string, ComponentType<LucideProps>>)[name];
    if (Icon) {
      iconCache.set(name, Icon);
    }
  } catch (error) {
    console.warn(`[LazyIcon] Failed to preload icon "${name}":`, error);
  }
}

/**
 * Preload multiple icons in parallel
 */
export async function preloadIcons(names: string[]): Promise<void> {
  await Promise.all(names.map(preloadIcon));
}

/**
 * Check if an icon is already cached
 */
export function isIconCached(name: string): boolean {
  return iconCache.has(name);
}
