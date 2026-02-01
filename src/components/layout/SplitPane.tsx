/**
 * SplitPane - Sprint 702 T702.1
 * 
 * Resizable split pane layout for desktop.
 * Used by SequenceBuilder for list/preview layout.
 * 
 * Features:
 * - Resizable divider
 * - Collapse left/right panels
 * - Responsive (stacks on mobile)
 * - Keyboard accessible resize
 * - localStorage persistence
 */

import { 
  useState, 
  useCallback, 
  useRef, 
  useEffect, 
  type ReactNode, 
  type PointerEvent,
  type KeyboardEvent,
} from 'react';
import { useIsDesktop, usePrefersReducedMotion } from '../../hooks/useMediaQuery';
import { LazyIcon } from '../icons';

// =============================================================================
// Types
// =============================================================================

export interface SplitPaneProps {
  /** Left panel content */
  left: ReactNode;
  /** Right panel content */
  right: ReactNode;
  /** Initial left panel width percentage (0-100) */
  initialLeftWidth?: number;
  /** Minimum left panel width in pixels */
  minLeftWidth?: number;
  /** Minimum right panel width in pixels */
  minRightWidth?: number;
  /** Storage key for persisting width */
  storageKey?: string;
  /** Left panel header */
  leftHeader?: ReactNode;
  /** Right panel header */
  rightHeader?: ReactNode;
  /** Whether left panel can collapse */
  leftCollapsible?: boolean;
  /** Whether right panel can collapse */
  rightCollapsible?: boolean;
  /** Additional CSS class */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_LEFT_WIDTH = 40;
const DEFAULT_MIN_WIDTH = 280;
const RESIZE_STEP = 5; // Percentage step for keyboard resize

// =============================================================================
// Component
// =============================================================================

export function SplitPane({
  left,
  right,
  initialLeftWidth = DEFAULT_LEFT_WIDTH,
  minLeftWidth = DEFAULT_MIN_WIDTH,
  minRightWidth = DEFAULT_MIN_WIDTH,
  storageKey = 'split-pane-width',
  leftHeader,
  rightHeader,
  leftCollapsible = true,
  rightCollapsible = false,
  className = '',
}: SplitPaneProps): React.ReactElement {
  const isDesktop = useIsDesktop();
  const prefersReducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === 'undefined') return initialLeftWidth;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? parseFloat(saved) : initialLeftWidth;
    } catch {
      return initialLeftWidth;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  
  // Persist width
  useEffect(() => {
    if (typeof window !== 'undefined' && !leftCollapsed && !rightCollapsed) {
      try {
        localStorage.setItem(storageKey, String(leftWidth));
      } catch {
        // Storage unavailable
      }
    }
  }, [leftWidth, storageKey, leftCollapsed, rightCollapsed]);
  
  // ==========================================================================
  // Resize Handling
  // ==========================================================================
  
  const handleResizeStart = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsResizing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  
  const handleResizeMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!isResizing || !containerRef.current) return;
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    
    // Calculate new percentage
    const newLeftPx = e.clientX - rect.left;
    let newLeftPercent = (newLeftPx / containerWidth) * 100;
    
    // Enforce minimums
    const minLeftPercent = (minLeftWidth / containerWidth) * 100;
    const minRightPercent = (minRightWidth / containerWidth) * 100;
    const maxLeftPercent = 100 - minRightPercent;
    
    newLeftPercent = Math.max(minLeftPercent, Math.min(maxLeftPercent, newLeftPercent));
    
    setLeftWidth(newLeftPercent);
  }, [isResizing, minLeftWidth, minRightWidth]);
  
  const handleResizeEnd = useCallback((e: PointerEvent<HTMLDivElement>) => {
    setIsResizing(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);
  
  // Keyboard resize
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setLeftWidth(prev => Math.max(10, prev - RESIZE_STEP));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setLeftWidth(prev => Math.min(90, prev + RESIZE_STEP));
    }
  }, []);
  
  // ==========================================================================
  // Collapse Handling
  // ==========================================================================
  
  const toggleLeftCollapse = useCallback(() => {
    setLeftCollapsed(prev => !prev);
    if (rightCollapsed) setRightCollapsed(false);
  }, [rightCollapsed]);
  
  const toggleRightCollapse = useCallback(() => {
    setRightCollapsed(prev => !prev);
    if (leftCollapsed) setLeftCollapsed(false);
  }, [leftCollapsed]);
  
  const transitionClass = prefersReducedMotion ? '' : 'transition-all duration-200';
  
  // ==========================================================================
  // Mobile Layout
  // ==========================================================================
  
  if (!isDesktop) {
    return (
      <div className={`flex flex-col ${className}`}>
        {/* Mobile: Stack vertically with tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {leftHeader}
          <div className="flex-1 overflow-auto">
            {left}
          </div>
        </div>
        <div className="border-t border-slate-200">
          {rightHeader}
          <div className="max-h-[40vh] overflow-auto">
            {right}
          </div>
        </div>
      </div>
    );
  }
  
  // ==========================================================================
  // Desktop Layout
  // ==========================================================================
  
  const effectiveLeftWidth = leftCollapsed ? 0 : rightCollapsed ? 100 : leftWidth;
  const effectiveRightWidth = rightCollapsed ? 0 : leftCollapsed ? 100 : (100 - leftWidth);
  
  return (
    <div 
      ref={containerRef}
      className={`flex h-full ${className}`}
      data-testid="split-pane"
    >
      {/* Left Panel */}
      <div 
        className={`
          flex flex-col overflow-hidden
          ${transitionClass}
          ${leftCollapsed ? 'w-0' : ''}
        `}
        style={{ 
          width: leftCollapsed ? 0 : `${effectiveLeftWidth}%`,
          minWidth: leftCollapsed ? 0 : minLeftWidth,
        }}
        aria-hidden={leftCollapsed}
      >
        {!leftCollapsed && (
          <>
            {leftHeader && (
              <div className="flex-shrink-0 border-b border-slate-200">
                {leftHeader}
              </div>
            )}
            <div className="flex-1 overflow-auto">
              {left}
            </div>
          </>
        )}
      </div>
      
      {/* Resize Handle */}
      {!leftCollapsed && !rightCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(leftWidth)}
          aria-valuemin={10}
          aria-valuemax={90}
          aria-label="Resize panels"
          tabIndex={0}
          className={`
            flex-shrink-0 w-2 bg-slate-100 
            hover:bg-blue-200 
            cursor-col-resize
            flex items-center justify-center
            group
            focus:outline-none focus-visible:bg-blue-300
            ${isResizing ? 'bg-blue-300' : ''}
          `}
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onKeyDown={handleKeyDown}
        >
          <LazyIcon 
            name="GripVertical"
            className={`
              w-4 h-4 text-slate-400 
              group-hover:text-blue-600
              ${isResizing ? 'text-blue-600' : ''}
            `} 
          />
        </div>
      )}
      
      {/* Collapse Buttons */}
      {leftCollapsible && leftCollapsed && (
        <button
          onClick={toggleLeftCollapse}
          className="flex-shrink-0 w-6 bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
          aria-label="Expand left panel"
        >
          <LazyIcon name="ChevronRight" className="w-4 h-4 text-slate-600" />
        </button>
      )}
      
      {/* Right Panel */}
      <div 
        className={`
          flex flex-col overflow-hidden
          ${transitionClass}
          ${rightCollapsed ? 'w-0' : ''}
        `}
        style={{ 
          width: rightCollapsed ? 0 : `${effectiveRightWidth}%`,
          minWidth: rightCollapsed ? 0 : minRightWidth,
        }}
        aria-hidden={rightCollapsed}
      >
        {!rightCollapsed && (
          <>
            {rightHeader && (
              <div className="flex-shrink-0 border-b border-slate-200 flex items-center">
                {leftCollapsible && !leftCollapsed && (
                  <button
                    onClick={toggleLeftCollapse}
                    className="p-2 hover:bg-slate-100"
                    aria-label="Collapse left panel"
                  >
                    <LazyIcon name="ChevronLeft" className="w-4 h-4 text-slate-600" />
                  </button>
                )}
                <div className="flex-1">
                  {rightHeader}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-auto">
              {right}
            </div>
          </>
        )}
      </div>
      
      {rightCollapsible && rightCollapsed && (
        <button
          onClick={toggleRightCollapse}
          className="flex-shrink-0 w-6 bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
          aria-label="Expand right panel"
        >
          <LazyIcon name="ChevronLeft" className="w-4 h-4 text-slate-600" />
        </button>
      )}
    </div>
  );
}

export default SplitPane;
