/**
 * BulkActionsToolbar - YardFlow Hub
 * 
 * Fixed-position toolbar that appears when prospects are selected.
 * Provides quick access to bulk actions: sequence assignment, tagging,
 * status changes, export, and delete.
 */

import { useEffect, useState, useCallback } from 'react';
import { 
  MessageSquare, 
  Tag, 
  RefreshCw, 
  Download, 
  Trash2, 
  X,
  Check,
  Mail,
} from 'lucide-react';

export interface BulkActionsToolbarProps {
  selectedCount: number;
  onAssignSequence: () => void;
  onAddTag: () => void;
  onChangeStatus: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
  onSendEmail?: () => void;
  isExporting?: boolean;
  isProcessing?: boolean;
  isSendingEmail?: boolean;
}

export function BulkActionsToolbar({
  selectedCount,
  onAssignSequence,
  onAddTag,
  onChangeStatus,
  onExport,
  onDelete,
  onClear,
  onSendEmail,
  isExporting = false,
  isProcessing = false,
  isSendingEmail = false,
}: BulkActionsToolbarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showExportSuccess, setShowExportSuccess] = useState(false);

  // Animate in when selection count changes from 0
  useEffect(() => {
    if (selectedCount > 0) {
      // Small delay for smooth entrance animation
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [selectedCount]);

  // Show export success feedback
  const handleExport = useCallback(async () => {
    await onExport();
    // Show success state briefly (actual export is async)
    setShowExportSuccess(true);
    setTimeout(() => setShowExportSuccess(false), 2000);
  }, [onExport]);

  if (selectedCount === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      aria-live="polite"
      data-testid="bulk-actions-toolbar"
      className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 
        bg-slate-900 text-white rounded-xl shadow-2xl 
        px-4 py-3 flex items-center gap-3
        transition-all duration-300 ease-out
        ${isVisible 
          ? 'translate-y-0 opacity-100' 
          : 'translate-y-4 opacity-0 pointer-events-none'
        }`}
    >
      {/* Selection Count Badge */}
      <div 
        className="flex items-center gap-2 pr-3 border-r border-slate-700"
        data-testid="selection-count"
      >
        <div className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full min-w-[24px] text-center">
          {selectedCount}
        </div>
        <span className="text-sm text-slate-300 hidden sm:inline">
          {selectedCount === 1 ? 'selected' : 'selected prospects'}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1" role="group" aria-label="Bulk action buttons">
        {/* Send Email - Sprint 22A */}
        {onSendEmail && (
          <button
            onClick={onSendEmail}
            disabled={isProcessing || isSendingEmail}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium 
              text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 
              rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send email to selected"
            aria-label="Send email to selected prospects"
            data-testid="bulk-send-email"
          >
            <Mail className={`h-4 w-4 ${isSendingEmail ? 'animate-pulse' : ''}`} aria-hidden="true" />
            <span className="hidden md:inline">Email</span>
          </button>
        )}

        {/* Assign Sequence */}
        <button
          onClick={onAssignSequence}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium 
            text-slate-200 hover:text-white hover:bg-slate-800 
            rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Assign to sequence"
          aria-label="Assign selected prospects to a sequence"
          data-testid="bulk-assign-sequence"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          <span className="hidden md:inline">Sequence</span>
        </button>

        {/* Add Tag */}
        <button
          onClick={onAddTag}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium 
            text-slate-200 hover:text-white hover:bg-slate-800 
            rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Add tags"
          aria-label="Add tags to selected prospects"
          data-testid="bulk-add-tag"
        >
          <Tag className="h-4 w-4" aria-hidden="true" />
          <span className="hidden md:inline">Tag</span>
        </button>

        {/* Change Status */}
        <button
          onClick={onChangeStatus}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium 
            text-slate-200 hover:text-white hover:bg-slate-800 
            rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Change status"
          aria-label="Change status of selected prospects"
          data-testid="bulk-change-status"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span className="hidden md:inline">Status</span>
        </button>

        {/* Export */}
        <button
          onClick={handleExport}
          disabled={isProcessing || isExporting}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium 
            rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
            ${showExportSuccess 
              ? 'text-green-400 bg-green-900/30' 
              : 'text-slate-200 hover:text-white hover:bg-slate-800'
            }`}
          title="Export selected"
          aria-label="Export selected prospects"
          data-testid="bulk-export"
        >
          {showExportSuccess ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Download className={`h-4 w-4 ${isExporting ? 'animate-pulse' : ''}`} aria-hidden="true" />
          )}
          <span className="hidden md:inline">
            {showExportSuccess ? 'Exported!' : 'Export'}
          </span>
        </button>

        {/* Delete - destructive action */}
        <button
          onClick={onDelete}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium 
            text-red-400 hover:text-red-300 hover:bg-red-900/30 
            rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Delete selected"
          aria-label="Delete selected prospects"
          data-testid="bulk-delete"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span className="hidden md:inline">Delete</span>
        </button>
      </div>

      {/* Clear Selection Button */}
      <div className="pl-2 border-l border-slate-700">
        <button
          onClick={onClear}
          className="flex items-center justify-center w-8 h-8 
            text-slate-400 hover:text-white hover:bg-slate-800 
            rounded-lg transition-colors"
          title="Clear selection"
          aria-label="Clear all selections"
          data-testid="bulk-clear-selection"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default BulkActionsToolbar;
