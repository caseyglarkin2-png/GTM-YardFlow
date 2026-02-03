/**
 * BulkSequenceModal - YardFlow Hub
 * 
 * Modal for assigning selected prospects to an email sequence.
 * Supports search/filter, loading states, and partial success handling.
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
  ChevronRight
} from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

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
}: BulkSequenceModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [partialSuccess, setPartialSuccess] = useState<{ success: number; failed: number } | null>(null);
  const dialogRef = useFocusTrap(isOpen, { onEscape: onClose, returnFocus: true });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedSequenceId(null);
      setSubmitError(null);
      setPartialSuccess(null);
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

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    if (!selectedSequenceId) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
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
  }, [selectedSequenceId, onConfirm, onClose]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedSequenceId && !isSubmitting) {
      handleConfirm();
    }
  }, [selectedSequenceId, isSubmitting, handleConfirm]);

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
              placeholder="Search sequences..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              aria-label="Search sequences"
              data-testid="sequence-search-input"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
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
            disabled={!selectedSequenceId || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white 
              bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="sequence-modal-confirm"
          >
            {isSubmitting ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Assigning...
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
