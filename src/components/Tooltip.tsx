/**
 * Tooltip Component
 * 
 * Accessible tooltip with portal rendering and smart positioning.
 * Sprint 36A: T36A.2 - Rich tooltips for column headers
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  /** Element that triggers the tooltip */
  children: React.ReactNode;
  /** Tooltip content - can be string or JSX for rich content */
  content: React.ReactNode;
  /** Preferred placement */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing tooltip in ms */
  delay?: number;
  /** Max width of tooltip */
  maxWidth?: number;
  /** Disable tooltip */
  disabled?: boolean;
}

export function Tooltip({ 
  children, 
  content,
  placement = 'top',
  delay = 200,
  maxWidth = 280,
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [actualPlacement, setActualPlacement] = useState(placement);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    // Calculate initial position based on placement
    let top = 0;
    let left = 0;
    let finalPlacement = placement;
    
    const OFFSET = 8; // Gap between trigger and tooltip
    
    switch (placement) {
      case 'top':
        top = rect.top + scrollY - OFFSET;
        left = rect.left + scrollX + rect.width / 2;
        // Flip to bottom if not enough space on top
        if (rect.top < 80) {
          finalPlacement = 'bottom';
          top = rect.bottom + scrollY + OFFSET;
        }
        break;
      case 'bottom':
        top = rect.bottom + scrollY + OFFSET;
        left = rect.left + scrollX + rect.width / 2;
        // Flip to top if not enough space on bottom
        if (rect.bottom > viewportHeight - 80) {
          finalPlacement = 'top';
          top = rect.top + scrollY - OFFSET;
        }
        break;
      case 'left':
        top = rect.top + scrollY + rect.height / 2;
        left = rect.left + scrollX - OFFSET;
        break;
      case 'right':
        top = rect.top + scrollY + rect.height / 2;
        left = rect.right + scrollX + OFFSET;
        break;
    }
    
    // Keep tooltip within viewport horizontally
    const tooltipWidth = maxWidth;
    if (left - tooltipWidth / 2 < 10) {
      left = tooltipWidth / 2 + 10;
    } else if (left + tooltipWidth / 2 > viewportWidth - 10) {
      left = viewportWidth - tooltipWidth / 2 - 10;
    }
    
    setPosition({ top, left });
    setActualPlacement(finalPlacement);
  }, [placement, maxWidth]);

  const show = useCallback(() => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      calculatePosition();
      setVisible(true);
    }, delay);
  }, [delay, disabled, calculatePosition]);

  const hide = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  // Recalculate position on scroll/resize while visible
  useEffect(() => {
    if (!visible) return;
    
    const handleReposition = () => calculatePosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [visible, calculatePosition]);

  const getTransformStyle = () => {
    switch (actualPlacement) {
      case 'top':
        return 'translate(-50%, -100%)';
      case 'bottom':
        return 'translate(-50%, 0)';
      case 'left':
        return 'translate(-100%, -50%)';
      case 'right':
        return 'translate(0, -50%)';
      default:
        return 'translate(-50%, -100%)';
    }
  };

  const getArrowClasses = () => {
    const base = 'absolute border-4 border-transparent';
    switch (actualPlacement) {
      case 'top':
        return `${base} -bottom-2 left-1/2 -translate-x-1/2 border-t-slate-800`;
      case 'bottom':
        return `${base} -top-2 left-1/2 -translate-x-1/2 border-b-slate-800`;
      case 'left':
        return `${base} -right-2 top-1/2 -translate-y-1/2 border-l-slate-800`;
      case 'right':
        return `${base} -left-2 top-1/2 -translate-y-1/2 border-r-slate-800`;
      default:
        return `${base} -bottom-2 left-1/2 -translate-x-1/2 border-t-slate-800`;
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </div>
      {visible && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          className="fixed z-[100] px-3 py-2 text-xs bg-slate-800 text-white rounded-lg shadow-lg"
          style={{ 
            top: position.top, 
            left: position.left,
            transform: getTransformStyle(),
            maxWidth,
          }}
        >
          {content}
          <div className={getArrowClasses()} />
        </div>,
        document.body
      )}
    </>
  );
}

export default Tooltip;
