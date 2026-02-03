/**
 * BulkStatusModal - YardFlow Hub
 * 
 * Modal for changing status of selected prospects in bulk.
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  X, 
  Check,
  Loader,
  Users,
  Send,
  FileEdit,
  Calendar
} from 'lucide-react';
import type { Prospect } from '../types';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export type ProspectStatus = Prospect['status'];

export interface BulkStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (status: ProspectStatus) => Promise<void>;
  selectedCount: number;
}

const STATUS_OPTIONS: { value: ProspectStatus; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { 
    value: 'new', 
    label: 'New', 
    icon: Users,
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  { 
    value: 'drafted', 
    label: 'Drafted', 
    icon: FileEdit,
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  { 
    value: 'contacted', 
    label: 'Contacted', 
    icon: Send,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  { 
    value: 'meeting_booked', 
    label: 'Meeting Booked', 
    icon: Calendar,
    color: 'bg-green-100 text-green-700 border-green-200',
  },
];

export function BulkStatusModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
}: BulkStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<ProspectStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dialogRef = useFocusTrap(isOpen, { onEscape: onClose, returnFocus: true });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStatus(null);
      setSubmitError(null);
    }
  }, [isOpen]);

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    if (!selectedStatus) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      await onConfirm(selectedStatus);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedStatus, onConfirm, onClose]);

  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedStatus && !isSubmitting) {
      handleConfirm();
    }
  }, [selectedStatus, isSubmitting, handleConfirm]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-modal-title"
      onKeyDown={handleKeyDown}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 id="status-modal-title" className="text-lg font-bold text-slate-800">
              Change Status
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Update {selectedCount} prospect{selectedCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close modal"
            data-testid="status-modal-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Options */}
        <div className="p-4 space-y-2">
          {STATUS_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedStatus === option.value;
            
            return (
              <button
                key={option.value}
                onClick={() => setSelectedStatus(option.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                  ${isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-transparent hover:bg-slate-50'
                  }`}
                data-testid={`status-option-${option.value}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${option.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                  {option.label}
                </span>
                {isSelected && (
                  <Check className="h-5 w-5 text-blue-600 ml-auto" />
                )}
              </button>
            );
          })}
        </div>

        {/* Error Message */}
        {submitError && (
          <div className="mx-4 mb-2 p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">
            {submitError}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            data-testid="status-modal-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedStatus || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white 
              bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="status-modal-confirm"
          >
            {isSubmitting ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Update Status
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkStatusModal;
