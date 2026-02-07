/**
 * MultiSelectDropdown Component
 * 
 * A fully accessible multi-select dropdown with keyboard navigation.
 * Sprint 36D: T36D.1 - Multi-select tier filter
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
  emoji?: string;
}

export interface MultiSelectDropdownProps {
  /** Accessible label */
  label: string;
  /** Options to display */
  options: MultiSelectOption[];
  /** Currently selected values */
  selected: string[];
  /** Change handler */
  onChange: (selected: string[]) => void;
  /** Placeholder when nothing selected */
  placeholder?: string;
  /** Unique ID for ARIA */
  id?: string;
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select...',
  id = 'multi-select',
  className = '',
  disabled = false,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useFocusTrap(isOpen);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Focus trap handles accessibility

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when opening
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  // Toggle an option's selection
  const toggleOption = useCallback((value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }, [selected, onChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Escape':
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev => Math.min(prev + 1, options.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev => Math.max(prev - 1, 0));
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && options[highlightedIndex]) {
          toggleOption(options[highlightedIndex].value);
        } else {
          setIsOpen(true);
        }
        break;
      case 'Tab':
        if (isOpen) {
          setIsOpen(false);
        }
        break;
    }
  }, [disabled, isOpen, highlightedIndex, options, toggleOption]);

  // Display text for button
  const displayText = selected.length === 0
    ? placeholder
    : selected.length === 1
    ? options.find(o => o.value === selected[0])?.label || selected[0]
    : `${selected.length} selected`;

  const listboxId = `${id}-listbox`;

  return (
    <div 
      ref={containerRef} 
      className={`relative ${className}`} 
      onKeyDown={handleKeyDown}
      data-testid={`multi-select-${id}`}
    >
      <label 
        id={`${id}-label`}
        className="block text-[10px] font-medium text-slate-500 uppercase mb-1"
      >
        {label}
      </label>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${id}-label`}
        aria-controls={listboxId}
        className={`
          w-full flex items-center justify-between px-3 py-2 text-sm
          border rounded-lg bg-white
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'}
          ${selected.length > 0 ? 'text-slate-800' : 'text-slate-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        data-testid={`${id}-button`}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown 
          className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          aria-hidden="true" 
        />
      </button>

      {isOpen && !disabled && (
        <div 
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={`${id}-label`}
          className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto"
          data-testid={`${id}-listbox`}
        >
          {options.map((option, index) => {
            const isSelected = selected.includes(option.value);
            const isHighlighted = highlightedIndex === index;
            
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleOption(option.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`
                  w-full flex items-center justify-between px-3 py-2 text-sm text-left
                  transition-colors focus-visible:outline-none
                  ${isHighlighted ? 'bg-slate-100' : ''}
                  ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}
                `}
                data-testid={`${id}-option-${option.value.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <span className="flex items-center gap-2">
                  {option.emoji && <span aria-hidden="true">{option.emoji}</span>}
                  <span>{option.label}</span>
                </span>
                <span className="flex items-center gap-2">
                  {option.count !== undefined && (
                    <span className="text-xs text-slate-400">{option.count}</span>
                  )}
                  {isSelected && (
                    <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  )}
                </span>
              </button>
            );
          })}
          
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full px-3 py-2 text-xs text-slate-500 hover:text-slate-700 border-t border-slate-100 focus-visible:outline-none focus-visible:bg-slate-100"
              data-testid={`${id}-clear`}
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default MultiSelectDropdown;
