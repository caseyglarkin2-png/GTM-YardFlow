/**
 * DraggableStepList - Sprint 702 T702.2
 * 
 * Drag-and-drop reorderable list for sequence steps.
 * Uses @dnd-kit for accessible drag and drop.
 * 
 * Features:
 * - Keyboard accessible drag and drop
 * - Smooth animations
 * - Screen reader announcements
 * - Touch support
 * - Reduced motion support
 * 
 * Note: @dnd-kit needs to be installed:
 * npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
 */

import { useState, useCallback, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery';
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface DraggableItem {
  id: string;
  [key: string]: unknown;
}

export interface DraggableStepListProps<T extends DraggableItem> {
  /** Items to render */
  items: T[];
  /** Render function for each item */
  renderItem: (item: T, index: number, isDragging: boolean) => ReactNode;
  /** Callback when order changes */
  onReorder: (items: T[]) => void;
  /** Callback when item is selected */
  onSelect?: (item: T) => void;
  /** Currently selected item ID */
  selectedId?: string;
  /** Whether items are draggable */
  draggable?: boolean;
  /** Accessibility label for the list */
  ariaLabel?: string;
  /** Additional CSS class */
  className?: string;
}

// =============================================================================
// Fallback Component (without @dnd-kit)
// 
// This provides arrow-based reordering when @dnd-kit is not available.
// Replace with dnd-kit implementation when package is installed.
// =============================================================================

export function DraggableStepList<T extends DraggableItem>({
  items,
  renderItem,
  onReorder,
  onSelect,
  selectedId,
  draggable = true,
  ariaLabel = 'Reorderable list',
  className = '',
}: DraggableStepListProps<T>): React.ReactElement {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');
  
  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length) return;
    
    const newItems = [...items];
    const [removed] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, removed);
    onReorder(newItems);
    
    setAnnouncement(`Moved item from position ${fromIndex + 1} to position ${toIndex + 1}`);
  }, [items, onReorder]);
  
  const handleMoveUp = useCallback((index: number) => {
    moveItem(index, index - 1);
  }, [moveItem]);
  
  const handleMoveDown = useCallback((index: number) => {
    moveItem(index, index + 1);
  }, [moveItem]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowUp' && e.altKey) {
      e.preventDefault();
      handleMoveUp(index);
    } else if (e.key === 'ArrowDown' && e.altKey) {
      e.preventDefault();
      handleMoveDown(index);
    }
  }, [handleMoveUp, handleMoveDown]);
  
  const transitionClass = prefersReducedMotion ? '' : 'transition-all duration-200';
  
  return (
    <>
      {/* Screen reader announcement */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      >
        {announcement}
      </div>
      
      <ul
        role="listbox"
        aria-label={ariaLabel}
        className={`space-y-2 ${className}`}
      >
        {items.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === items.length - 1;
          const isSelected = selectedId === item.id;
          const isDragging = draggingId === item.id;
          
          return (
            <li
              key={item.id}
              role="option"
              aria-selected={isSelected}
              tabIndex={0}
              className={`
                group relative flex items-start gap-2 p-2 rounded-lg
                ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-white'}
                ${isDragging ? 'shadow-lg scale-[1.02] z-10' : ''}
                ${transitionClass}
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              `}
              onClick={() => onSelect?.(item)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {/* Drag Handle / Reorder Buttons */}
              {draggable && (
                <div className="flex flex-col items-center gap-0.5 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveUp(index);
                    }}
                    disabled={isFirst}
                    className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={`Move step ${index + 1} up`}
                  >
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  </button>
                  
                  <div 
                    className="p-0.5 cursor-grab active:cursor-grabbing"
                    onMouseDown={() => setDraggingId(item.id)}
                    onMouseUp={() => setDraggingId(null)}
                    aria-hidden="true"
                  >
                    <GripVertical className="w-4 h-4 text-slate-400" />
                  </div>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveDown(index);
                    }}
                    disabled={isLast}
                    className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={`Move step ${index + 1} down`}
                  >
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              )}
              
              {/* Item Content */}
              <div className="flex-1 min-w-0">
                {renderItem(item, index, isDragging)}
              </div>
            </li>
          );
        })}
      </ul>
      
      {/* Keyboard instructions */}
      {draggable && (
        <p className="text-xs text-slate-500 mt-2" id="reorder-instructions">
          Use Alt + Arrow keys to reorder items
        </p>
      )}
    </>
  );
}

export default DraggableStepList;
