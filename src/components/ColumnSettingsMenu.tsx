/**
 * ColumnSettingsMenu Component
 * 
 * Dropdown menu to show/hide table columns.
 * Sprint 36E: T36E.2 - Column customization UI
 */

import React, { useState, useRef, useEffect } from 'react';
import { Settings, Check, RotateCcw } from 'lucide-react';
import type { ColumnConfig } from '@/hooks/useColumnPreferences';

export interface ColumnSettingsMenuProps {
  /** Available columns */
  columns: ColumnConfig[];
  /** Currently visible column IDs */
  visibleColumns: Set<string>;
  /** Toggle column visibility */
  onToggle: (columnId: string) => void;
  /** Reset to defaults */
  onReset: () => void;
}

export function ColumnSettingsMenu({
  columns,
  visibleColumns,
  onToggle,
  onReset,
}: ColumnSettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const visibleCount = visibleColumns.size;
  const totalCount = columns.length;

  return (
    <div ref={menuRef} className="relative" data-testid="column-settings">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          p-1.5 rounded transition-colors
          ${isOpen ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}
        `}
        title="Customize columns"
        aria-label="Customize visible columns"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        data-testid="column-settings-button"
      >
        <Settings className="h-4 w-4" />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20"
          role="menu"
          aria-label="Column visibility settings"
          data-testid="column-settings-menu"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Visible Columns</span>
            <span className="text-[10px] text-slate-400">
              {visibleCount}/{totalCount}
            </span>
          </div>
          
          {/* Column toggles */}
          <div className="py-1">
            {columns.map(col => {
              const isChecked = visibleColumns.has(col.id);
              const isRequired = col.required;
              
              return (
                <button
                  key={col.id}
                  onClick={() => !isRequired && onToggle(col.id)}
                  disabled={isRequired}
                  role="menuitemcheckbox"
                  aria-checked={isChecked}
                  className={`
                    w-full flex items-center justify-between px-3 py-1.5 text-sm text-left
                    transition-colors
                    ${isRequired 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-slate-50 cursor-pointer'
                    }
                    ${isChecked ? 'text-slate-700' : 'text-slate-400'}
                  `}
                  data-testid={`column-toggle-${col.id}`}
                >
                  <span className="flex items-center gap-2">
                    {isRequired && (
                      <span className="text-[10px] text-slate-400" title="Always visible">
                        🔒
                      </span>
                    )}
                    <span>{col.label}</span>
                  </span>
                  {isChecked && (
                    <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Reset button */}
          <button
            onClick={() => {
              onReset();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors"
            data-testid="column-settings-reset"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}

export default ColumnSettingsMenu;
