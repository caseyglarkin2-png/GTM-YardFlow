import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader } from 'lucide-react';
import { LazyIcon } from '../icons';
import { ConversationManagerSingleton } from '../../services/ConversationManager';
import { buildSystemPrompt } from '../../services/SystemPromptBuilder';
import { useBrainActions } from '../../hooks/useBrainActions';
import { parseActionsFromResponse } from '../../types/brainActions';
import type { Prospect, ChatMessage } from '../../types';

// Singleton instance
const conversationManager = ConversationManagerSingleton.getInstance();

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
      
      // Parse for actions and execute them
      const parsed = parseActionsFromResponse(reply);
      const displayText = parsed.text || reply;
      
      // Execute any actions in the response
      if (parsed.actions && parsed.actions.length > 0) {
        console.log('[Brain] Executing actions:', parsed.actions);
        processResponse(parsed).then(result => {
          const failedActions = result.results.filter(r => !r.success);
          if (failedActions.length > 0) {
            console.warn('[Brain] Some actions failed:', failedActions);
          }
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
