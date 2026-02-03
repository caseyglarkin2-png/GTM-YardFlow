/**
 * BulkTagModal - YardFlow Hub
 * 
 * Modal for adding tags to selected prospects.
 * Supports existing tag selection, new tag creation, and multi-select.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, 
  Search, 
  Tag, 
  Check, 
  Plus,
  Loader,
  AlertCircle
} from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface BulkTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tags: string[]) => Promise<void>;
  selectedCount: number;
  existingTags?: string[];
  isLoading?: boolean;
}

// Default tags for demo
const DEFAULT_TAGS = [
  'Manifest 2026',
  'Tier 1 Priority',
  'Co-Dev Candidate',
  'Decision Maker',
  'Technical Contact',
  'Budget Holder',
  'Champion',
  'Gatekeeper',
  'Hot Lead',
  'Follow Up Required',
  'Needs Nurture',
  'LinkedIn Connection',
];

export function BulkTagModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  existingTags = DEFAULT_TAGS,
  isLoading = false,
}: BulkTagModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');
  const dialogRef = useFocusTrap(isOpen, { onEscape: onClose, returnFocus: true });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedTags(new Set());
      setSubmitError(null);
      setShowNewTagInput(false);
      setNewTagValue('');
    }
  }, [isOpen]);

  // Filter tags based on search
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return existingTags;
    const query = searchQuery.toLowerCase();
    return existingTags.filter(tag => tag.toLowerCase().includes(query));
  }, [existingTags, searchQuery]);

  // Check if search query could be a new tag
  const canCreateNewTag = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return false;
    return !existingTags.some(t => t.toLowerCase() === query.toLowerCase());
  }, [searchQuery, existingTags]);

  // Toggle tag selection
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  // Create new tag
  const handleCreateTag = useCallback(() => {
    const tag = newTagValue.trim() || searchQuery.trim();
    if (tag) {
      setSelectedTags(prev => new Set(prev).add(tag));
      setNewTagValue('');
      setSearchQuery('');
      setShowNewTagInput(false);
    }
  }, [newTagValue, searchQuery]);

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    if (selectedTags.size === 0) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      await onConfirm(Array.from(selectedTags));
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add tags');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedTags, onConfirm, onClose]);

  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !showNewTagInput && selectedTags.size > 0 && !isSubmitting) {
      handleConfirm();
    }
  }, [showNewTagInput, selectedTags.size, isSubmitting, handleConfirm]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-modal-title"
      onKeyDown={handleKeyDown}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 id="tag-modal-title" className="text-lg font-bold text-slate-800">
              Add Tags
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Tag {selectedCount} prospect{selectedCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close modal"
            data-testid="tag-modal-close"
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
              placeholder="Search or create tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              aria-label="Search tags"
              data-testid="tag-search-input"
            />
          </div>
          
          {/* Selected Tags Display */}
          {selectedTags.size > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Array.from(selectedTags).map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                  <button
                    onClick={() => toggleTag(tag)}
                    className="ml-0.5 hover:text-blue-600"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="h-8 w-8 text-blue-600 animate-spin mb-3" />
              <p className="text-sm text-slate-500">Loading tags...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Create New Tag Option */}
              {(canCreateNewTag || showNewTagInput) && (
                <div className="pb-3 border-b border-slate-100">
                  {showNewTagInput ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Enter new tag name..."
                        value={newTagValue}
                        onChange={(e) => setNewTagValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTagValue.trim()) {
                            handleCreateTag();
                          } else if (e.key === 'Escape') {
                            setShowNewTagInput(false);
                          }
                        }}
                        autoFocus
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm
                          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        data-testid="new-tag-input"
                      />
                      <button
                        onClick={handleCreateTag}
                        disabled={!newTagValue.trim()}
                        className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                          hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowNewTagInput(false)}
                        className="p-2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (canCreateNewTag) {
                          setNewTagValue(searchQuery.trim());
                          handleCreateTag();
                        } else {
                          setShowNewTagInput(true);
                        }
                      }}
                      className="w-full flex items-center gap-2 p-3 text-left text-blue-600 
                        hover:bg-blue-50 rounded-lg transition-colors"
                      data-testid="create-new-tag"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {canCreateNewTag 
                          ? `Create tag "${searchQuery.trim()}"` 
                          : 'Create new tag'
                        }
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Existing Tags List */}
              {filteredTags.length === 0 && !canCreateNewTag ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <Tag className="h-8 w-8 mb-3" />
                  <p className="text-sm">No tags found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredTags.map(tag => {
                    const isSelected = selectedTags.has(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`flex items-center gap-2 p-2.5 text-left text-sm rounded-lg 
                          transition-colors border-2
                          ${isSelected 
                            ? 'bg-blue-50 border-blue-500 text-blue-800' 
                            : 'bg-white border-transparent hover:bg-slate-50 text-slate-700'
                          }`}
                        data-testid={`tag-option-${tag.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center
                          ${isSelected 
                            ? 'bg-blue-600 border-blue-600' 
                            : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="truncate">{tag}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Message */}
        {submitError && (
          <div className="mx-4 mb-2 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
          <span className="text-sm text-slate-500">
            {selectedTags.size} tag{selectedTags.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              data-testid="tag-modal-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedTags.size === 0 || isSubmitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white 
                bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="tag-modal-confirm"
            >
              {isSubmitting ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Tag className="h-4 w-4" />
                  Add Tags
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BulkTagModal;
