/**
 * BulkDeleteModal - YardFlow Hub
 * 
 * Confirmation modal for bulk delete operations.
 * Shows warning, affected prospect names, and provides undo capability.
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  Trash2,
  Loader,
  Undo2,
  CheckCircle
} from 'lucide-react';
import type { Prospect } from '../types';

export interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onUndo?: () => Promise<void>;
  selectedProspects: Prospect[];
  isProcessing?: boolean;
}

export function BulkDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  onUndo,
  selectedProspects,
  isProcessing = false,
}: BulkDeleteModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState(10);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSubmitError(null);
      setShowUndoToast(false);
      setUndoCountdown(10);
    }
  }, [isOpen]);

  // Undo countdown timer
  useEffect(() => {
    if (!showUndoToast) return;
    
    if (undoCountdown <= 0) {
      setShowUndoToast(false);
      return;
    }

    const timer = setInterval(() => {
      setUndoCountdown(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [showUndoToast, undoCountdown]);

  // Handle confirm delete
  const handleConfirm = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      await onConfirm();
      onClose();
      
      // Show undo toast
      if (onUndo) {
        setShowUndoToast(true);
        setUndoCountdown(10);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to delete prospects');
    } finally {
      setIsSubmitting(false);
    }
  }, [onConfirm, onClose, onUndo]);

  // Handle undo
  const handleUndo = useCallback(async () => {
    if (!onUndo) return;
    
    try {
      await onUndo();
      setShowUndoToast(false);
    } catch (err) {
      console.error('Undo failed:', err);
    }
  }, [onUndo]);

  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Display first 5 prospect names
  const displayedProspects = selectedProspects.slice(0, 5);
  const remainingCount = selectedProspects.length - 5;

  // Render undo toast (appears after modal closes)
  if (showUndoToast && !isOpen) {
    return (
      <div 
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50
          bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3
          flex items-center gap-3 animate-slide-up"
        role="alert"
        aria-live="polite"
        data-testid="undo-toast"
      >
        <CheckCircle className="h-5 w-5 text-green-400" />
        <span className="text-sm">
          {selectedProspects.length} prospect{selectedProspects.length !== 1 ? 's' : ''} deleted
        </span>
        <button
          onClick={handleUndo}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium
            bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          data-testid="undo-button"
        >
          <Undo2 className="h-4 w-4" />
          Undo ({undoCountdown}s)
        </button>
        <button
          onClick={() => setShowUndoToast(false)}
          className="p-1 text-slate-400 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-description"
      onKeyDown={handleKeyDown}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="delete-modal-title" className="text-lg font-bold text-slate-800">
              Delete {selectedProspects.length} prospect{selectedProspects.length !== 1 ? 's' : ''}?
            </h2>
            <p id="delete-modal-description" className="text-sm text-slate-500 mt-1">
              This action will move the selected prospects to trash. You can restore them within 30 days.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors -mt-2 -mr-2"
            aria-label="Close modal"
            data-testid="delete-modal-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Affected Prospects List */}
        <div className="px-6 pb-4">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-medium text-slate-500 uppercase mb-2">
              Affected Prospects
            </p>
            <ul className="space-y-1.5">
              {displayedProspects.map(prospect => (
                <li 
                  key={prospect.id}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">
                    {prospect.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <span className="truncate">{prospect.name}</span>
                  <span className="text-slate-400 text-xs">- {prospect.company}</span>
                </li>
              ))}
              {remainingCount > 0 && (
                <li className="text-sm text-slate-500 italic pl-8">
                  and {remainingCount} more...
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Error Message */}
        {submitError && (
          <div className="mx-6 mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={isSubmitting || isProcessing}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="delete-modal-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || isProcessing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white 
              bg-red-600 hover:bg-red-700 rounded-lg transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="delete-modal-confirm"
          >
            {isSubmitting ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkDeleteModal;
