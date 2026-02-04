/**
 * useBrainActions Hook
 * 
 * Sprint 30: B2 - Execute brain actions to control the app
 * 
 * This hook provides a dispatcher for brain actions, allowing
 * the AI Brain to navigate, filter, select, and trigger features.
 */

import { useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import type { 
  BrainAction, 
  ActionResult, 
  BrainResponse,
} from '@/types/brainActions';
import { validateAction } from '@/types/brainActions';

interface UseBrainActionsOptions {
  /** Callback when navigation occurs */
  onNavigate?: (tab: string) => void;
  /** Callback when filters change */
  onFilter?: (filters: Record<string, unknown>) => void;
  /** Callback when prospects are selected */
  onSelect?: (prospectIds: string[]) => void;
  /** Callback to open a modal */
  onOpenModal?: (modal: string, data?: Record<string, unknown>) => void;
  /** Callback for research action */
  onResearch?: (companyName: string) => void;
  /** Callback for notifications */
  onNotify?: (message: string, severity: 'info' | 'success' | 'warning' | 'error') => void;
  /** List of prospects for selection actions */
  prospects?: Array<{ id: string; tier?: string; email?: string }>;
}

interface UseBrainActionsReturn {
  /** Execute a single brain action */
  executeAction: (action: BrainAction) => Promise<ActionResult>;
  /** Execute multiple actions in sequence */
  executeActions: (actions: BrainAction[]) => Promise<ActionResult[]>;
  /** Parse response and execute any embedded actions */
  processResponse: (response: BrainResponse) => Promise<{
    text: string;
    results: ActionResult[];
  }>;
}

export function useBrainActions(options: UseBrainActionsOptions = {}): UseBrainActionsReturn {
  const { setActiveTab } = useAppContext();
  
  const {
    onNavigate,
    onFilter,
    onSelect,
    onOpenModal,
    onResearch,
    onNotify,
    prospects = [],
  } = options;

  /**
   * Execute a single brain action
   */
  const executeAction = useCallback(async (action: BrainAction): Promise<ActionResult> => {
    // Validate action structure before execution
    if (!validateAction(action)) {
      console.warn('[Brain] Invalid action structure:', action);
      return { 
        success: false, 
        action, 
        error: 'Invalid action structure' 
      };
    }

    try {
      switch (action.type) {
        case 'navigate': {
          console.log('[Brain] Navigating to:', action.tab);
          setActiveTab?.(action.tab);
          onNavigate?.(action.tab);
          return { success: true, action };
        }

        case 'filter': {
          console.log('[Brain] Applying filters:', action.filters);
          onFilter?.(action.filters);
          return { success: true, action };
        }

        case 'select': {
          let idsToSelect: string[] = [];
          
          if (action.prospectIds) {
            idsToSelect = action.prospectIds;
          } else if (action.criteria) {
            let filtered = [...prospects];
            
            if (action.criteria.tier) {
              filtered = filtered.filter(p => p.tier === action.criteria!.tier);
            }
            if (action.criteria.hasEmail) {
              filtered = filtered.filter(p => !!p.email);
            }
            if (action.criteria.limit) {
              filtered = filtered.slice(0, action.criteria.limit);
            }
            
            idsToSelect = filtered.map(p => p.id);
          }
          
          console.log('[Brain] Selecting prospects:', idsToSelect.length);
          onSelect?.(idsToSelect);
          return { success: true, action };
        }

        case 'openModal': {
          console.log('[Brain] Opening modal:', action.modal);
          onOpenModal?.(action.modal, action.data);
          return { success: true, action };
        }

        case 'research': {
          console.log('[Brain] Researching:', action.companyName);
          onResearch?.(action.companyName);
          return { success: true, action };
        }

        case 'notify': {
          console.log('[Brain] Notification:', action.message);
          onNotify?.(action.message, action.severity);
          return { success: true, action };
        }

        case 'scroll': {
          console.log('[Brain] Scrolling to:', action.target);
          
          switch (action.target) {
            case 'top':
              window.scrollTo({ top: 0, behavior: 'smooth' });
              break;
            case 'bottom':
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
              break;
            case 'prospect':
              if (action.prospectId) {
                // Escape the ID to prevent XSS via CSS selector
                const safeId = CSS.escape(action.prospectId);
                const element = document.querySelector(`[data-prospect-id="${safeId}"]`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              break;
            case 'selection': {
              const element = document.querySelector('[data-selection-summary]');
              element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              break;
            }
          }
          return { success: true, action };
        }

        default: {
          console.warn('[Brain] Unknown action type:', (action as BrainAction).type);
          return { 
            success: false, 
            action, 
            error: `Unknown action type: ${(action as BrainAction).type}` 
          };
        }
      }
    } catch (error) {
      console.error('[Brain] Action failed:', action, error);
      return {
        success: false,
        action,
        error: error instanceof Error ? error.message : 'Action execution failed',
      };
    }
  }, [setActiveTab, onNavigate, onFilter, onSelect, onOpenModal, onResearch, onNotify, prospects]);

  /**
   * Execute multiple actions in sequence
   */
  const executeActions = useCallback(async (actions: BrainAction[]): Promise<ActionResult[]> => {
    const results: ActionResult[] = [];
    
    for (const action of actions) {
      const result = await executeAction(action);
      results.push(result);
      
      // Add small delay between actions for UX
      await new Promise(r => setTimeout(r, 100));
    }
    
    return results;
  }, [executeAction]);

  /**
   * Process a brain response and execute any embedded actions
   */
  const processResponse = useCallback(async (response: BrainResponse): Promise<{
    text: string;
    results: ActionResult[];
  }> => {
    const results = response.actions 
      ? await executeActions(response.actions)
      : [];
    
    return {
      text: response.text,
      results,
    };
  }, [executeActions]);

  return {
    executeAction,
    executeActions,
    processResponse,
  };
}
