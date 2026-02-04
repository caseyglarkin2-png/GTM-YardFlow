import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader } from 'lucide-react';
import { LazyIcon } from '../icons';
import { ConversationManagerSingleton } from '../../services/ConversationManager';
import { buildSystemPrompt } from '../../services/SystemPromptBuilder';
import { useBrainActions } from '../../hooks/useBrainActions';
import { parseActionsFromResponse, type BrainAction, type RailwayAIAction } from '../../types/brainActions';
import type { Prospect, ChatMessage } from '../../types';

// Singleton instance
const conversationManager = ConversationManagerSingleton.getInstance();

/**
 * Describe a brain action in human-readable format
 */
function describeAction(action: BrainAction): string {
  switch (action.type) {
    case 'navigate':
      return `Navigate to ${action.tab}`;
    case 'filter':
      const filters: string[] = [];
      if (action.filters.tier) filters.push(`Tier ${action.filters.tier}`);
      if (action.filters.hasEmail !== undefined) {
        filters.push(action.filters.hasEmail ? 'with email' : 'without email');
      }
      return `Filter prospects: ${filters.join(', ') || 'clear filters'}`;
    case 'select':
      if (action.prospectIds) {
        return `Select ${action.prospectIds.length} prospect(s)`;
      }
      const criteria: string[] = [];
      if (action.criteria?.tier) criteria.push(`Tier ${action.criteria.tier}`);
      if (action.criteria?.limit) criteria.push(`top ${action.criteria.limit}`);
      if (action.criteria?.hasEmail) criteria.push('with email');
      return `Select prospects: ${criteria.join(', ')}`;
    case 'openModal':
      return `Open ${action.modal}`;
    case 'research':
      return `Research ${action.companyName}`;
    case 'notify':
      return `Show notification`;
    case 'scroll':
      return `Scroll to ${action.target}`;
    default:
      return 'Unknown action';
  }
}

/**
 * Map Railway action format to BrainAction format
 * Railway returns: { type, destination?, tier?, hasEmail?, personId?, accountId?, companyName? }
 * BrainAction expects: { type, tab?, filters?, prospectIds?, etc. }
 */
function mapRailwayAction(railwayAction: RailwayAIAction): BrainAction | null {
  const type = railwayAction.type;
  
  switch (type) {
    case 'navigate':
      return {
        type: 'navigate',
        tab: railwayAction.destination || 'prospects',
      } as BrainAction;
      
    case 'filter':
      return {
        type: 'filter',
        filters: {
          tier: railwayAction.tier,
          hasEmail: railwayAction.hasEmail,
        },
      } as BrainAction;
      
    case 'select':
      return {
        type: 'select',
        prospectIds: railwayAction.personId ? [railwayAction.personId] : undefined,
        criteria: railwayAction.tier ? {
          tier: railwayAction.tier,
          hasEmail: railwayAction.hasEmail,
        } : undefined,
      } as BrainAction;
      
    case 'research':
      return {
        type: 'research',
        companyName: railwayAction.companyName || '',
      } as BrainAction;
      
    case 'email':
      return {
        type: 'openModal',
        modal: 'bulkEmail',
        data: railwayAction.personId ? { prospectId: railwayAction.personId } : undefined,
      } as BrainAction;
      
    case 'explain':
      // Explain actions don't need execution - just display the response text
      return null;
      
    default:
      console.warn('[Brain] Unknown Railway action type:', type);
      return null;
  }
}

export interface ChatStats {
  total: number;
  contacted: number;
  booked: number;
  tier1: number;
}

interface ChatPanelProps {
  selectedProspect: Prospect | null;
  stats: ChatStats;
  geminiApiKey?: string;  // Deprecated - AI routes through Railway
  /** Prospects list for selection actions */
  prospects?: Prospect[];
  /** Callbacks for brain actions */
  onNavigate?: (tab: string) => void;
  onFilter?: (filters: Record<string, unknown>) => void;
  onSelect?: (prospectIds: string[]) => void;
  onOpenModal?: (modal: string, data?: Record<string, unknown>) => void;
}

export function ChatPanel({ 
  selectedProspect, 
  stats, 
  prospects = [],
  onNavigate,
  onFilter,
  onSelect,
  onOpenModal,
}: ChatPanelProps) {
  // Brain actions hook
  const { processResponse } = useBrainActions({
    prospects: prospects.map(p => ({ id: p.id, tier: p.tier, email: p.email })),
    onNavigate,
    onFilter,
    onSelect,
    onOpenModal,
  });
  // Local state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    const persisted = conversationManager.getHistory();
    if (persisted.length > 0) {
      return persisted.map(m => ({ role: m.role, text: m.content }));
    }
    return [{ role: 'model', text: "I'm the YardFlow Brain. Loaded with Manifest strategy, Primo Brands case study ($1M+ margin per facility), and Network Effects framework. Ask me to draft messages, analyze prospects, or explain our value prop." }];
  });
  const [isGenerating, setIsGenerating] = useState(false);
  // B2.5: Pending action for confirmation UI
  const [pendingActions, setPendingActions] = useState<BrainAction[] | null>(null);
  const [pendingActionMessage, setPendingActionMessage] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Update conversation context when prospect changes
  useEffect(() => {
    if (selectedProspect) {
      conversationManager.setProspectContext({
        name: selectedProspect.name,
        title: selectedProspect.title,
        company: selectedProspect.company,
        tier: selectedProspect.tier,
        score: selectedProspect.score,
        isOps: selectedProspect.isOps,
        isExec: selectedProspect.isExec,
        status: selectedProspect.status
      });
    } else {
      conversationManager.setProspectContext(null);
    }
  }, [selectedProspect]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isGenerating]);

  // Handle message sending - routes through Railway backend
  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    const newMsg: ChatMessage = { role: 'user', text: userMessage };
    setChatHistory(prev => [...prev, newMsg]);
    setChatInput('');
    setIsGenerating(true);

    // Add to conversation manager for persistence
    conversationManager.addMessage({
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    });

    try {
      // Build dynamic system prompt with context
      const prospectContext = selectedProspect ? {
        name: selectedProspect.name,
        title: selectedProspect.title,
        company: selectedProspect.company,
        tier: selectedProspect.tier,
        score: selectedProspect.score,
        isOps: selectedProspect.isOps,
        isExec: selectedProspect.isExec,
        status: selectedProspect.status
      } : null;

      const systemPrompt = buildSystemPrompt({
        prospect: prospectContext,
        stats: stats,
        recentActions: conversationManager.getRecentActions()
      });

      // Build conversation history for Gemini
      const contents = conversationManager.buildGeminiContents();

      // Call API - routes through Railway backend (no local key needed)
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contents,
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'API Error');
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm not sure how to respond to that.";
      
      // Railway returns structured action in _action field (Sprint 31 format)
      // Also parse text for legacy action blocks as fallback
      const railwayAction = data._action as RailwayAIAction | undefined;
      const parsed = parseActionsFromResponse(reply);
      const displayText = parsed.text || reply;
      
      // Collect all actions: Railway structured action + any text-embedded actions
      const allActions: BrainAction[] = [];
      
      // Add Railway structured action if present (validate structure)
      if (railwayAction && 
          typeof railwayAction === 'object' && 
          'type' in railwayAction &&
          typeof railwayAction.type === 'string') {
        console.log('[Brain] Railway action:', railwayAction);
        // Map Railway action format to our BrainAction format
        const mappedAction = mapRailwayAction(railwayAction);
        if (mappedAction) {
          allActions.push(mappedAction);
        }
      }
      
      // Add any text-parsed actions
      if (parsed.actions && parsed.actions.length > 0) {
        allActions.push(...parsed.actions);
      }
      
      // B2.5: Show action confirmation UI instead of immediate execution
      // Only for non-trivial actions (filter, select, navigate)
      const significantActions = allActions.filter(a => 
        a.type === 'navigate' || a.type === 'filter' || a.type === 'select'
      );
      
      if (significantActions.length > 0) {
        console.log('[Brain] Requesting confirmation for actions:', significantActions);
        setPendingActions(significantActions);
        setPendingActionMessage(displayText);
      } else if (allActions.length > 0) {
        // Execute non-significant actions (notify, scroll) immediately
        console.log('[Brain] Executing minor actions:', allActions);
        processResponse({ text: displayText, actions: allActions }).catch(err => {
          console.warn('[Brain] Action execution failed:', err);
        });
      }
      
      setChatHistory(prev => [...prev, { role: 'model', text: displayText }]);
      
      // Persist model response
      conversationManager.addMessage({
        role: 'model',
        content: displayText,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error("Gemini Error:", error);
      setChatHistory(prev => [...prev, { role: 'model', text: "Error connecting to AI service. Please try again later." }]);
    } finally {
      setIsGenerating(false);
    }
  }, [chatInput, selectedProspect, stats]);

  const handleClearHistory = useCallback(() => {
    conversationManager.clearHistory();
    setChatHistory([{ role: 'model', text: "I'm the YardFlow Brain. I've been loaded with the Manifest strategy docs, RFQ decks, and the Hitlist logic. Ask me to draft emails, analyze prospects, or explain 'Reynolds Number'." }]);
  }, []);

  const handleExportChat = useCallback((format: 'md' | 'json') => {
    const content = format === 'md' 
      ? conversationManager.exportAsMarkdown()
      : conversationManager.exportAsJSON();
    
    const blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yardflow-chat-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // B2.5: Action confirmation handlers
  const handleConfirmActions = useCallback(async () => {
    if (!pendingActions) return;
    
    console.log('[Brain] User confirmed actions:', pendingActions);
    try {
      const result = await processResponse({ text: pendingActionMessage, actions: pendingActions });
      const failed = result.results.filter(r => !r.success);
      if (failed.length > 0) {
        console.warn('[Brain] Some actions failed:', failed);
      }
    } catch (err) {
      console.error('[Brain] Action execution error:', err);
    }
    
    setPendingActions(null);
    setPendingActionMessage('');
  }, [pendingActions, pendingActionMessage, processResponse]);

  const handleCancelActions = useCallback(() => {
    console.log('[Brain] User cancelled actions');
    setPendingActions(null);
    setPendingActionMessage('');
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] lg:max-w-[80%] rounded-2xl p-3 lg:p-4 text-sm whitespace-pre-wrap ${
              msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex justify-start">
             <div className="bg-white border border-slate-200 rounded-2xl p-4 rounded-bl-none shadow-sm flex items-center space-x-2">
               <Loader className="h-4 w-4 animate-spin text-blue-600" />
               <span className="text-xs text-slate-500">Brain is thinking...</span>
             </div>
          </div>
        )}
        {/* B2.5: Action Confirmation UI */}
        {pendingActions && pendingActions.length > 0 && (
          <div className="flex justify-start">
            <div className="max-w-[90%] bg-blue-50 border border-blue-200 rounded-2xl p-4 rounded-bl-none shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <LazyIcon name="Wand2" className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Brain wants to take action:</span>
              </div>
              <ul className="text-sm text-blue-700 mb-3 space-y-1">
                {pendingActions.map((action, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    {describeAction(action)}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmActions}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={handleCancelActions}
                  className="px-3 py-1.5 bg-white text-slate-600 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="p-4 bg-white border-t border-slate-200">
         {/* Chat controls: Export and Clear */}
         {chatHistory.length > 1 && (
           <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
             <div className="flex items-center gap-2">
               <button
                 onClick={() => handleExportChat('md')}
                 className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                 title="Export as Markdown"
               >
                 <LazyIcon name="Download" className="h-3 w-3" />
                 Export .md
               </button>
               <button
                 onClick={() => handleExportChat('json')}
                 className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                 title="Export as JSON"
               >
                 <LazyIcon name="Download" className="h-3 w-3" />
                 Export .json
               </button>
             </div>
             <button
               onClick={handleClearHistory}
               className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
               title="Clear chat history"
             >
               <LazyIcon name="Trash2" className="h-3 w-3" />
               <span className="hidden sm:inline">Clear</span>
             </button>
           </div>
         )}
         <div className="relative">
           <input 
             type="text" 
             className="w-full bg-slate-50 border border-slate-200 rounded-full pl-4 pr-14 py-3 text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
             placeholder="Ask the brain..."
             value={chatInput}
             onChange={(e) => setChatInput(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
             disabled={isGenerating}
           />
           <button 
             onClick={handleSendMessage}
             disabled={isGenerating}
             className="absolute right-2 top-1.5 bg-blue-600 text-white p-2 lg:p-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 min-w-[40px] min-h-[40px] lg:min-w-[32px] lg:min-h-[32px] flex items-center justify-center"
             aria-label="Send message"
           >
             <LazyIcon name="Send" className="h-5 w-5 lg:h-4 lg:w-4" />
           </button>
         </div>
      </div>
    </div>
  );
}
