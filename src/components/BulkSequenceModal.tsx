/**
 * BulkSequenceModal - YardFlow Hub
 * 
 * Modal for assigning selected prospects to an email sequence.
 * Supports search/filter, loading states, and partial success handling.
 * Sprint V33: Added template tab for creating sequences from templates.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, 
  Search, 
  Mail, 
  Check, 
  AlertCircle, 
  Loader,
  RefreshCw,
  ChevronRight,
  Sparkles,
  FileText
} from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { MANIFEST_SEQUENCES } from '@/data/sequenceTemplates';
import type { SequenceTemplate } from '@/types/emailSequence';

export interface Sequence {
  id: string;
  name: string;
  description?: string;
  stepCount: number;
  activeProspects: number;
  status: 'active' | 'paused' | 'draft';
}

export interface BulkSequenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sequenceId: string) => Promise<void>;
  selectedCount: number;
  sequences?: Sequence[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  // Sprint V33: Template support
  onCreateFromTemplate?: (template: SequenceTemplate) => Promise<string | null>;
}

// Mock sequences removed for production polish


export function BulkSequenceModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  sequences = [],
  isLoading = false,
  error = null,
  onRetry,
  onCreateFromTemplate,
}: BulkSequenceModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [partialSuccess, setPartialSuccess] = useState<{ success: number; failed: number } | null>(null);
  const dialogRef = useFocusTrap(isOpen, { onEscape: onClose, returnFocus: true });
  
  // Sprint V33: Tab state and template selection
  const [activeTab, setActiveTab] = useState<'sequences' | 'templates'>('sequences');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedSequenceId(null);
      setSubmitError(null);
      setPartialSuccess(null);
      setActiveTab('sequences');
      setSelectedTemplateId(null);
      setIsCreatingFromTemplate(false);
    }
  }, [isOpen]);

  // Filter sequences based on search
  const filteredSequences = useMemo(() => {
    if (!searchQuery.trim()) return sequences;
    const query = searchQuery.toLowerCase();
    return sequences.filter(
      s => s.name.toLowerCase().includes(query) || 
           s.description?.toLowerCase().includes(query)
    );
  }, [sequences, searchQuery]);

  // Sprint V33: Filter templates based on search
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return MANIFEST_SEQUENCES;
    const query = searchQuery.toLowerCase();
    return MANIFEST_SEQUENCES.filter(
      t => t.name.toLowerCase().includes(query) || 
           t.description?.toLowerCase().includes(query) ||
           t.category?.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Handle confirm - supports both existing sequences and templates
  const handleConfirm = useCallback(async () => {
    setSubmitError(null);
    
    // If template is selected, create sequence from it first
    if (activeTab === 'templates' && selectedTemplateId && onCreateFromTemplate) {
      const template = MANIFEST_SEQUENCES.find(t => t.id === selectedTemplateId);
      if (!template) {
        setSubmitError('Template not found');
        return;
      }
      
      setIsCreatingFromTemplate(true);
      try {
        const newSequenceId = await onCreateFromTemplate(template);
        if (!newSequenceId) {
          setSubmitError('Failed to create sequence from template');
          return;
        }
        
        // Now assign prospects to the new sequence
        setIsSubmitting(true);
        await onConfirm(newSequenceId);
        onClose();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to create sequence');
      } finally {
        setIsCreatingFromTemplate(false);
        setIsSubmitting(false);
      }
      return;
    }
    
    // Standard sequence selection
    if (!selectedSequenceId) return;
    
    setIsSubmitting(true);
    
    try {
      await onConfirm(selectedSequenceId);
      onClose();
    } catch (err) {
      // Check for partial success in error
      if (err instanceof Error && err.message.includes('partial')) {
        // Parse partial success from error message
        const match = err.message.match(/(\d+) succeeded, (\d+) failed/);
        if (match) {
          setPartialSuccess({ success: parseInt(match[1]), failed: parseInt(match[2]) });
        }
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Failed to assign sequence');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedSequenceId, selectedTemplateId, activeTab, onConfirm, onClose, onCreateFromTemplate]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const hasSelection = activeTab === 'sequences' ? selectedSequenceId : selectedTemplateId;
    if (e.key === 'Enter' && hasSelection && !isSubmitting && !isCreatingFromTemplate) {
      handleConfirm();
    }
  }, [activeTab, selectedSequenceId, selectedTemplateId, isSubmitting, isCreatingFromTemplate, handleConfirm]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sequence-modal-title"
      onKeyDown={handleKeyDown}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 id="sequence-modal-title" className="text-lg font-bold text-slate-800">
              Assign to Sequence
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Add {selectedCount} prospect{selectedCount !== 1 ? 's' : ''} to a sequence
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close modal"
            data-testid="sequence-modal-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              placeholder={activeTab === 'sequences' ? 'Search sequences...' : 'Search templates...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              aria-label={activeTab === 'sequences' ? 'Search sequences' : 'Search templates'}
              data-testid="sequence-search-input"
            />
          </div>
          
          {/* Sprint V33: Tab Selector */}
          <div className="flex gap-1 mt-3" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'sequences'}
              onClick={() => { setActiveTab('sequences'); setSelectedTemplateId(null); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'sequences' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
              data-testid="tab-sequences"
            >
              <FileText className="h-4 w-4" />
              My Sequences ({sequences.length})
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'templates'}
              onClick={() => { setActiveTab('templates'); setSelectedSequenceId(null); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'templates' 
                  ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
              data-testid="tab-templates"
            >
              <Sparkles className="h-4 w-4" />
              Templates ({MANIFEST_SEQUENCES.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {activeTab === 'sequences' ? (
            // Sequences Tab Content
            <>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12" data-testid="sequence-loading">
                  <Loader className="h-8 w-8 text-blue-600 animate-spin mb-3" />
                  <p className="text-sm text-slate-500">Loading sequences...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12" data-testid="sequence-error">
                  <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
                  <p className="text-sm text-red-600 mb-4">{error}</p>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry
                    </button>
                  )}
                </div>
              ) : filteredSequences.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Mail className="h-8 w-8 mb-3" />
                  <p className="text-sm">
                    {searchQuery ? 'No sequences match your search' : 'No sequences available'}
                  </p>
                  {sequences.length === 0 && (
                    <button
                      onClick={() => setActiveTab('templates')}
                      className="mt-3 text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                    >
                      <Sparkles className="h-4 w-4" />
                      Browse templates to get started
                    </button>
                  )}
                </div>
              ) : (
                <ul role="listbox" aria-label="Available sequences" className="space-y-1">
                  {filteredSequences.map((sequence) => (
                    <li key={sequence.id}>
                      <button
                        onClick={() => setSelectedSequenceId(sequence.id)}
                        role="option"
                        aria-selected={selectedSequenceId === sequence.id}
                        className={`w-full text-left p-3 rounded-lg transition-colors
                          ${selectedSequenceId === sequence.id 
                            ? 'bg-blue-50 border-2 border-blue-500' 
                            : 'hover:bg-slate-50 border-2 border-transparent'
                          }`}
                        data-testid={`sequence-option-${sequence.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800 truncate">
                                {sequence.name}
                              </span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase
                                ${sequence.status === 'active' ? 'bg-green-100 text-green-700' : 
                                  sequence.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : 
                                  'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {sequence.status}
                              </span>
                            </div>
                            {sequence.description && (
                              <p className="text-xs text-slate-500 mt-1 truncate">
                                {sequence.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                              <span>{sequence.stepCount} steps</span>
                              <span>•</span>
                              <span>{sequence.activeProspects} active</span>
                            </div>
                          </div>
                          {selectedSequenceId === sequence.id && (
                            <Check className="h-5 w-5 text-blue-600 flex-shrink-0 ml-2" />
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            // Templates Tab Content
            <>
              {filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Sparkles className="h-8 w-8 mb-3" />
                  <p className="text-sm">No templates match your search</p>
                </div>
              ) : (
                <ul role="listbox" aria-label="Available templates" className="space-y-1">
                  {filteredTemplates.map((template) => (
                    <li key={template.id}>
                      <button
                        onClick={() => setSelectedTemplateId(template.id)}
                        role="option"
                        aria-selected={selectedTemplateId === template.id}
                        className={`w-full text-left p-3 rounded-lg transition-colors
                          ${selectedTemplateId === template.id 
                            ? 'bg-purple-50 border-2 border-purple-500' 
                            : 'hover:bg-slate-50 border-2 border-transparent'
                          }`}
                        data-testid={`template-option-${template.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800 truncate">
                                {template.name}
                              </span>
                              {template.category && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 uppercase">
                                  {template.category}
                                </span>
                              )}
                            </div>
                            {template.description && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                {template.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                              <span>{template.steps.length} steps</span>
                              {template.persona && (
                                <>
                                  <span>•</span>
                                  <span>{template.persona}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {selectedTemplateId === template.id && (
                            <Check className="h-5 w-5 text-purple-600 flex-shrink-0 ml-2" />
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Error/Partial Success Messages */}
        {(submitError || partialSuccess) && (
          <div className={`mx-4 mb-2 p-3 rounded-lg text-sm
            ${partialSuccess ? 'bg-yellow-50 text-yellow-800' : 'bg-red-50 text-red-800'}`}
          >
            {partialSuccess ? (
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Partial success: {partialSuccess.success} added, {partialSuccess.failed} failed
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            data-testid="sequence-modal-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              (activeTab === 'sequences' && !selectedSequenceId) ||
              (activeTab === 'templates' && (!selectedTemplateId || !onCreateFromTemplate)) ||
              isSubmitting ||
              isCreatingFromTemplate
            }
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white 
              rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              ${activeTab === 'templates' 
                ? 'bg-purple-600 hover:bg-purple-700' 
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
            data-testid="sequence-modal-confirm"
          >
            {isCreatingFromTemplate ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Creating sequence...
              </>
            ) : isSubmitting ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : activeTab === 'templates' ? (
              <>
                <Sparkles className="h-4 w-4" />
                Create & Assign
              </>
            ) : (
              <>
                Assign to Sequence
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkSequenceModal;
