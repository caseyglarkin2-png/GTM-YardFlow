/**
 * Brain Actions Type Definitions
 * 
 * Sprint 30: B2 - Brain can navigate app and trigger actions
 * 
 * These actions allow the AI Brain to control the app's "limbs":
 * - Navigate between tabs
 * - Apply filters
 * - Select prospects
 * - Open modals
 */

import type { TabId } from '@/config/navigation';

/** Base action interface */
interface BaseAction {
  type: string;
  /** Description of what this action does (for AI to explain) */
  description?: string;
}

/** Navigate to a specific tab */
export interface NavigateAction extends BaseAction {
  type: 'navigate';
  tab: TabId;
}

/** Apply filters to prospect list */
export interface FilterAction extends BaseAction {
  type: 'filter';
  filters: {
    tier?: 'T1' | 'T2' | 'T3' | 'all';
    hasEmail?: boolean;
    search?: string;
    tags?: string[];
    status?: 'new' | 'contacted' | 'replied' | 'meeting' | 'all';
  };
}

/** Select specific prospects */
export interface SelectAction extends BaseAction {
  type: 'select';
  /** Select by IDs */
  prospectIds?: string[];
  /** Or select by criteria */
  criteria?: {
    tier?: 'T1' | 'T2' | 'T3';
    limit?: number;
    hasEmail?: boolean;
  };
  /** Clear current selection first */
  clearFirst?: boolean;
}

/** Open a modal/panel */
export interface OpenModalAction extends BaseAction {
  type: 'openModal';
  modal: 'bulkEmail' | 'sequenceBuilder' | 'import' | 'prospectDetail';
  /** Additional data to pass to modal */
  data?: Record<string, unknown>;
}

/** Trigger AI research for a company */
export interface ResearchAction extends BaseAction {
  type: 'research';
  companyName: string;
}

/** Show a toast/notification */
export interface NotifyAction extends BaseAction {
  type: 'notify';
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

/** Scroll to a specific element */
export interface ScrollAction extends BaseAction {
  type: 'scroll';
  target: 'top' | 'bottom' | 'prospect' | 'selection';
  prospectId?: string;
}

/**
 * Railway AI Action format (Sprint 31)
 * This is the action format returned by Railway's /api/ai/chat endpoint.
 * It gets mapped to BrainAction in ChatPanel via mapRailwayAction.
 */
export interface RailwayAIAction {
  type: 'navigate' | 'filter' | 'select' | 'research' | 'email' | 'explain';
  destination?: string;
  tier?: string;
  hasEmail?: boolean;
  personId?: string;
  accountId?: string;
  companyName?: string;
}

/** Union of all brain actions */
export type BrainAction = 
  | NavigateAction
  | FilterAction
  | SelectAction
  | OpenModalAction
  | ResearchAction
  | NotifyAction
  | ScrollAction;

/** 
 * Parsed AI response with optional action
 * When the AI responds, it may include structured actions
 */
export interface BrainResponse {
  /** The text response to show the user */
  text: string;
  /** Optional action(s) to execute */
  actions?: BrainAction[];
  /** Whether user confirmation is needed before executing */
  requiresConfirmation?: boolean;
}

/**
 * Action result after execution
 */
export interface ActionResult {
  success: boolean;
  action: BrainAction;
  error?: string;
}

/**
 * Parse action keywords from AI response text
 * 
 * AI should respond with actions in JSON block:
 * ```action
 * {"type": "navigate", "tab": "sequences"}
 * ```
 */
export function parseActionsFromResponse(response: string): BrainResponse {
  const actionRegex = /```action\s*\n?([\s\S]*?)\n?```/g;
  const actions: BrainAction[] = [];
  
  let textResponse = response;
  let match;
  
  while ((match = actionRegex.exec(response)) !== null) {
    try {
      const actionJson = match[1].trim();
      const parsed = JSON.parse(actionJson);
      
      // Could be single action or array
      if (Array.isArray(parsed)) {
        actions.push(...parsed);
      } else {
        actions.push(parsed);
      }
      
      // Remove action block from text response
      textResponse = textResponse.replace(match[0], '').trim();
    } catch (e) {
      console.warn('Failed to parse brain action:', match[1], e);
    }
  }
  
  return {
    text: textResponse,
    actions: actions.length > 0 ? actions : undefined,
  };
}

/**
 * Validate a brain action is well-formed
 */
export function validateAction(action: unknown): action is BrainAction {
  if (!action || typeof action !== 'object') return false;
  
  const a = action as Record<string, unknown>;
  
  switch (a.type) {
    case 'navigate':
      return typeof a.tab === 'string';
    case 'filter':
      return typeof a.filters === 'object';
    case 'select':
      return Array.isArray(a.prospectIds) || typeof a.criteria === 'object';
    case 'openModal':
      return typeof a.modal === 'string';
    case 'research':
      return typeof a.companyName === 'string';
    case 'notify':
      return typeof a.message === 'string';
    case 'scroll':
      return typeof a.target === 'string';
    default:
      return false;
  }
}
