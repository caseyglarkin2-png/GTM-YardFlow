/**
 * SortableHeader Component
 * 
 * Reusable sortable table header with visual indicators and accessibility.
 * Sprint 36B: T36B.2 - Sortable header component
 */

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Tooltip } from './Tooltip';
import type { SortDirection } from '@/hooks/useSortableTable';

export interface SortableHeaderProps {
  /** Column identifier */
  column: string;
  /** Display label */
  label: string;
  /** Current sort indicator ('asc' | 'desc' | null) */
  sortIndicator: SortDirection | null;
  /** Click handler to toggle sort */
  onSort: (column: string) => void;
  /** Optional tooltip content */
  tooltip?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
}

/**
 * Sortable table header with sort indicators
 */
export function SortableHeader({
  column,
  label,
  sortIndicator,
  onSort,
  tooltip,
  className = '',
  align = 'left',
}: SortableHeaderProps) {
  const handleClick = () => {
    onSort(column);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSort(column);
    }
  };

  // Determine aria-sort value
  const ariaSort = sortIndicator 
    ? (sortIndicator === 'asc' ? 'ascending' : 'descending')
    : 'none';

  // Icon based on state
  const SortIcon = sortIndicator === 'asc' 
    ? ArrowUp 
    : sortIndicator === 'desc' 
    ? ArrowDown 
    : ArrowUpDown;

  const alignClass = align === 'right' 
    ? 'justify-end' 
    : align === 'center' 
    ? 'justify-center' 
    : 'justify-start';

  const content = (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        group flex items-center gap-1 
        ${alignClass}
        cursor-pointer select-none
        hover:text-blue-600 dark:hover:text-blue-400
        focus:outline-none focus:text-blue-600
        transition-colors
        ${sortIndicator ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}
        ${className}
      `}
      aria-sort={ariaSort}
      aria-label={`Sort by ${label}${sortIndicator ? `, currently ${ariaSort}` : ''}`}
    >
      <span className="font-medium text-xs uppercase tracking-wider">
        {label}
      </span>
      <SortIcon 
        className={`
          h-3.5 w-3.5 flex-shrink-0
          ${sortIndicator 
            ? 'opacity-100' 
            : 'opacity-0 group-hover:opacity-50'
          }
          transition-opacity
        `}
        aria-hidden="true"
      />
    </button>
  );

  // Wrap with tooltip if provided
  if (tooltip) {
    return (
      <Tooltip content={tooltip} placement="top">
        {content}
      </Tooltip>
    );
  }

  return content;
}

/**
 * Non-sortable header variant for consistency
 */
export interface StaticHeaderProps {
  label: string;
  tooltip?: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function StaticHeader({
  label,
  tooltip,
  className = '',
  align = 'left',
}: StaticHeaderProps) {
  const alignClass = align === 'right' 
    ? 'text-right' 
    : align === 'center' 
    ? 'text-center' 
    : 'text-left';

  const content = (
    <span 
      className={`
        font-medium text-xs uppercase tracking-wider
        text-gray-700 dark:text-gray-300
        ${alignClass}
        ${className}
      `}
    >
      {label}
    </span>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} placement="top">
        {content}
      </Tooltip>
    );
  }

  return content;
}

export default SortableHeader;
