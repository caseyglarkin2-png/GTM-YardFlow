/**
 * Navigation Configuration - Sprint 701 T701.0b
 * 
 * Centralized tab configuration for the app navigation.
 * Extracted from App.tsx for clean component separation.
 */

import {
  LayoutDashboard,
  Users,
  Mail,
  Upload,
  Link2,
  Bot,
  Calculator,
  Inbox,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface TabConfig {
  /** Unique identifier for the tab */
  id: string;
  /** Full label (shown on desktop) */
  label: string;
  /** Short label (shown on tablet) */
  shortLabel: string;
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Accessible label for screen readers */
  ariaLabel: string;
  /** Panel ID for aria-controls */
  panelId: string;
}

// =============================================================================
// Tab Configuration
// =============================================================================

export const NAVIGATION_TABS: readonly TabConfig[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Dash',
    icon: LayoutDashboard,
    ariaLabel: 'Analytics Dashboard',
    panelId: 'panel-dashboard',
  },
  {
    id: 'inbox',
    label: 'Inbox',
    shortLabel: 'Inbox',
    icon: Inbox,
    ariaLabel: 'Inbox',
    panelId: 'panel-inbox',
  },
  {
    id: 'prospects',
    label: 'Hitlist',
    shortLabel: 'Hits',
    icon: Users,
    ariaLabel: 'Prospect Hitlist',
    panelId: 'panel-prospects',
  },
  {
    id: 'sequences',
    label: 'Sequences',
    shortLabel: 'Seq',
    icon: Mail,
    ariaLabel: 'Email Sequences',
    panelId: 'panel-sequences',
  },
  {
    id: 'import',
    label: 'Import',
    shortLabel: 'Imp',
    icon: Upload,
    ariaLabel: 'Import Prospects',
    panelId: 'panel-import',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    shortLabel: 'Int',
    icon: Link2,
    ariaLabel: 'Integrations',
    panelId: 'panel-integrations',
  },
  {
    id: 'assistant',
    label: 'AI Brain',
    shortLabel: 'AI',
    icon: Bot,
    ariaLabel: 'AI Assistant',
    panelId: 'panel-assistant',
  },
  {
    id: 'roi',
    label: 'ROI Calculator',
    shortLabel: 'ROI',
    icon: Calculator,
    ariaLabel: 'ROI Calculator',
    panelId: 'panel-roi',
  },
] as const;

// =============================================================================
// Type Helpers
// =============================================================================

/** Union type of all valid tab IDs */
export type TabId = typeof NAVIGATION_TABS[number]['id'];

/** Get tab config by ID */
export function getTabById(id: TabId): TabConfig | undefined {
  return NAVIGATION_TABS.find(tab => tab.id === id);
}

/** Get tab index by ID */
export function getTabIndex(id: TabId): number {
  return NAVIGATION_TABS.findIndex(tab => tab.id === id);
}

/** Get next tab ID (wraps around) */
export function getNextTabId(currentId: TabId): TabId {
  const index = getTabIndex(currentId);
  const nextIndex = (index + 1) % NAVIGATION_TABS.length;
  return NAVIGATION_TABS[nextIndex].id as TabId;
}

/** Get previous tab ID (wraps around) */
export function getPreviousTabId(currentId: TabId): TabId {
  const index = getTabIndex(currentId);
  const prevIndex = (index - 1 + NAVIGATION_TABS.length) % NAVIGATION_TABS.length;
  return NAVIGATION_TABS[prevIndex].id as TabId;
}

export default NAVIGATION_TABS;
