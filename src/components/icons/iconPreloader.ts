/**
 * Icon Preloader - Sprint 700 T700.2
 * 
 * Preloads critical path icons before initial render to prevent
 * flash of loading states for commonly used icons.
 * 
 * Strategy:
 * - Navigation icons are preloaded immediately
 * - Tab-specific icons can be preloaded on tab switch
 */

import { preloadIcons as preloadFromLazy } from './LazyIcon';

// =============================================================================
// Critical Icons (Always Preloaded)
// =============================================================================

/**
 * Icons that appear in the initial viewport and navigation.
 * These are preloaded before the app renders.
 */
export const CRITICAL_ICONS = [
  // Mobile header
  'Menu',
  'X',
  'Settings',
  'Zap',
  
  // Navigation tabs
  'LayoutDashboard',
  'Users',
  'Mail',
  'Upload',
  'Link2',
  'Bot',
  'Calculator',
  
  // Common action icons
  'ChevronDown',
  'ChevronUp',
  'Search',
  'Loader',
  'ExternalLink',
] as const;

// =============================================================================
// Tab-Specific Icons
// =============================================================================

/**
 * Icons that are only needed when specific tabs are active.
 * Preload these when user navigates to the tab.
 */
export const TAB_ICONS = {
  dashboard: [
    'TrendingUp',
    'TrendingDown',
    'Calendar',
    'Activity',
    'RefreshCw',
    'Download',
  ],
  prospects: [
    'Building2',
    'MapPin',
    'Phone',
    'Star',
    'Trash2',
    'Edit',
    'Check',
    'Filter',
    'Save',
  ],
  sequences: [
    'Plus',
    'Clock',
    'Play',
    'Pause',
    'CheckCircle',
    'AlertCircle',
    'Eye',
    'EyeOff',
    'FileText',
    'LayoutTemplate',
  ],
  import: [
    'FileSpreadsheet',
    'AlertTriangle',
    'CheckCircle2',
  ],
  integrations: [
    'Check',
    'AlertCircle',
    'RefreshCw',
    'Link',
    'Unlink',
  ],
  assistant: [
    'Send',
    'Copy',
    'Trash2',
  ],
  roi: [
    'DollarSign',
    'Percent',
    'Target',
    'Award',
  ],
} as const;

// =============================================================================
// Preload Functions
// =============================================================================

/**
 * Preload critical icons immediately.
 * Call this in main.tsx before createRoot().
 */
export async function preloadCriticalIcons(): Promise<void> {
  try {
    await preloadFromLazy([...CRITICAL_ICONS]);
    // eslint-disable-next-line no-console
    console.debug('[IconPreloader] Critical icons preloaded');
  } catch (error) {
    console.warn('[IconPreloader] Failed to preload critical icons:', error);
  }
}

/**
 * Preload icons for a specific tab.
 * Call this when user navigates to a tab.
 */
export async function preloadTabIcons(tabId: keyof typeof TAB_ICONS): Promise<void> {
  const icons = TAB_ICONS[tabId];
  if (!icons) return;

  try {
    await preloadFromLazy([...icons]);
  } catch (error) {
    console.warn(`[IconPreloader] Failed to preload icons for tab "${tabId}":`, error);
  }
}

/**
 * Preload all icons (use sparingly, e.g., during idle time)
 */
export async function preloadAllIcons(): Promise<void> {
  const allIcons = [
    ...CRITICAL_ICONS,
    ...Object.values(TAB_ICONS).flat(),
  ];
  
  // Deduplicate
  const unique = [...new Set(allIcons)];
  
  try {
    await preloadFromLazy(unique);
  } catch (error) {
    console.warn('[IconPreloader] Failed to preload all icons:', error);
  }
}

export default preloadCriticalIcons;
